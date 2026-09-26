<?php

namespace App\Services;

use App\Events\MessageSent;
use App\Exceptions\ConversationLockedException;
use App\Exceptions\InsufficientCreditsException;
use App\Jobs\NotifyUnreadMessage;
use App\Models\BuyerRequest;
use App\Models\Conversation;
use App\Models\CreditTransaction;
use App\Models\Message;
use App\Models\SellerCredit;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * Birebir mesajlasma.
 *
 * Kural: alici bir hizmet verene her zaman UCRETSIZ yazar. Hizmet veren o
 * konusmayi OKUMAK ve YANITLAMAK icin bir kez kontor oder; odedikten sonra
 * ayni konusmada sinirsiz yazisir. Odemeden once mesajin govdesini goremez,
 * yalnizca kimden ve ne zaman geldigini gorur.
 *
 * Boylece hizmet veren hangi isi ciddiye alacagina kendisi karar verir ve
 * alici tarafi hicbir zaman odeme yapmaz.
 */
class MessagingService
{
    /** Konusmayi bulur, yoksa acar. Ayni ikili + talep icin tek satir olur. */
    public function open(User $buyer, User $seller, ?BuyerRequest $request = null): Conversation
    {
        return Conversation::query()->firstOrCreate(
            [
                'buyer_id' => $buyer->id,
                'seller_id' => $seller->id,
                'request_id' => $request?->id,
            ],
            ['last_message_at' => null],
        );
    }

    /** Bu kullanici icin konusmayi acmanin bedeli. Alicida ve acik konusmada sifir. */
    public function unlockCost(Conversation $conversation, User $user): int
    {
        if ($user->id !== $conversation->seller_id || $conversation->isUnlocked()) {
            return 0;
        }

        return max(0, (int) config('messaging.unlock_cost', 1));
    }

    /**
     * Hizmet veren konusmayi acar: kontor duser ve damgayi atar.
     *
     * Ayni anda iki istek gelirse satir kilitlenip yeniden okundugu icin
     * kontor yalnizca bir kez duser; ikinci istek "zaten acik" doner.
     *
     * @return array{conversation: Conversation, already_unlocked: bool, credit_spent: int, balance: int|null}
     *
     * @throws InsufficientCreditsException
     */
    public function unlock(Conversation $conversation, User $seller): array
    {
        return DB::transaction(function () use ($conversation, $seller): array {
            $locked = Conversation::query()->whereKey($conversation->id)->lockForUpdate()->firstOrFail();

            abort_unless($seller->id === $locked->seller_id, 403);

            if ($locked->isUnlocked()) {
                return [
                    'conversation' => $locked,
                    'already_unlocked' => true,
                    'credit_spent' => 0,
                    'balance' => SellerCredit::query()->where('user_id', $seller->id)->value('balance'),
                ];
            }

            $cost = max(0, (int) config('messaging.unlock_cost', 1));
            $balance = $cost > 0
                ? $this->charge($seller, $locked, $cost)
                : SellerCredit::query()->where('user_id', $seller->id)->value('balance');

            $locked->update([
                'unlocked_at' => now(),
                'unlock_cost' => $cost,
            ]);

            return [
                'conversation' => $locked,
                'already_unlocked' => false,
                'credit_spent' => $cost,
                'balance' => $balance,
            ];
        }, 3);
    }

    /**
     * Mesaji kaydeder ve karsi tarafa haber verir.
     *
     * @throws ConversationLockedException
     */
    public function send(Conversation $conversation, User $sender, string $body): Message
    {
        $message = DB::transaction(function () use ($conversation, $sender, $body): Message {
            $locked = Conversation::query()->whereKey($conversation->id)->lockForUpdate()->firstOrFail();
            $isSeller = $sender->id === $locked->seller_id;

            if (! $locked->isUnlocked()) {
                if ($isSeller) {
                    throw ConversationLockedException::sellerMustUnlock(
                        max(0, (int) config('messaging.unlock_cost', 1)),
                    );
                }

                // Alici kilitli konusmada sinirsiz yazamaz: aksi halde hizmet
                // vereni duvar metinle kontor odemeye zorlamak mumkun olurdu.
                $limit = max(1, (int) config('messaging.locked_message_limit', 3));

                if ($locked->locked_message_count >= $limit) {
                    throw ConversationLockedException::buyerLimitReached($limit);
                }
            }

            $message = Message::query()->create([
                'conversation_id' => $locked->id,
                'sender_id' => $sender->id,
                'body' => $body,
                'credit_spent' => 0,
            ]);

            $recipientIsBuyer = $isSeller;

            $locked->update([
                'last_message_at' => $message->created_at,
                'buyer_unread' => $recipientIsBuyer ? $locked->buyer_unread + 1 : $locked->buyer_unread,
                'seller_unread' => $recipientIsBuyer ? $locked->seller_unread : $locked->seller_unread + 1,
                'locked_message_count' => $locked->isUnlocked()
                    ? $locked->locked_message_count
                    : $locked->locked_message_count + 1,
            ]);

            return $message;
        }, 3);

        $fresh = $conversation->fresh();

        // Canli yayin bir EK'tir, bagimlilik degil. WebSocket sunucusu
        // kapaliysa mesaj yine de kaydedilmis olmali ve karsi tarafa
        // yoklamayla ulasmalidir; bu yuzden hata yutulur ve kayda yazilir.
        //
        // Kilitli konusmada govde yayina KONMAZ: kanala hizmet veren de abone
        // ve odemeden metni okuyabilirdi.
        try {
            MessageSent::dispatch($message, $fresh?->isUnlocked() ?? false);
        } catch (\Throwable $error) {
            Log::warning('Mesaj canli yayinlanamadi, yoklamaya birakildi', [
                'message_id' => $message->id,
                'error' => mb_substr($error->getMessage(), 0, 200),
            ]);
        }

        // Gecikmeli gonderim: karsi taraf birkac dakika icinde okursa e-posta
        // hic cikmaz, sohbet ederken kutusu dolmaz.
        NotifyUnreadMessage::dispatch($message->id)
            ->delay(now()->addMinutes((int) config('messaging.email_delay_minutes', 3)));

        return $message;
    }

    /**
     * Kullanicinin bu konusmadaki okunmamislarini sifirlar.
     *
     * Kilitli konusmada hizmet veren hicbir sey okuyamadigi icin sayaci da
     * dusmez; aksi halde rozet sonerdi ama mesaj okunmamis kalirdi.
     */
    public function markRead(Conversation $conversation, User $reader): void
    {
        if (! $conversation->canRead($reader->id)) {
            return;
        }

        Message::query()
            ->where('conversation_id', $conversation->id)
            ->where('sender_id', '!=', $reader->id)
            ->whereNull('read_at')
            ->update(['read_at' => now()]);

        $conversation->update(
            $reader->id === $conversation->buyer_id
                ? ['buyer_unread' => 0]
                : ['seller_unread' => 0],
        );
    }

    /** Kontoru duser ve kalan bakiyeyi doner. */
    private function charge(User $seller, Conversation $conversation, int $cost): int
    {
        SellerCredit::query()->firstOrCreate(['user_id' => $seller->id], ['balance' => 0]);

        $wallet = SellerCredit::query()
            ->where('user_id', $seller->id)
            ->lockForUpdate()
            ->firstOrFail();

        if ($wallet->balance < $cost) {
            throw new InsufficientCreditsException($wallet->balance, $cost);
        }

        $balance = $wallet->balance - $cost;
        $wallet->update(['balance' => $balance]);

        CreditTransaction::query()->create([
            'user_id' => $seller->id,
            'type' => 'spend',
            'amount' => -$cost,
            'reference_type' => 'conversation_unlock',
            'reference_id' => $conversation->id,
            'balance_after' => $balance,
            'metadata' => [
                'conversation_id' => $conversation->id,
                'request_id' => $conversation->request_id,
                'unlock_cost' => $cost,
            ],
        ]);

        return $balance;
    }
}
