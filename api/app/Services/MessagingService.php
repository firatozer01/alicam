<?php

namespace App\Services;

use App\Exceptions\InsufficientCreditsException;
use App\Jobs\NotifyUnreadMessage;
use App\Models\BuyerRequest;
use App\Models\Conversation;
use App\Models\CreditTransaction;
use App\Models\Message;
use App\Models\SellerCredit;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * Birebir mesajlasma.
 *
 * Kural: bir konusmada hizmet verenin ILK mesaji kontor dusurur, sonrakiler
 * ucretsizdir. Alici hicbir zaman odemez. Boylece satici rastgele toplu mesaj
 * atamaz ama basladigi konusmayi surdurmek icin tekrar odemez.
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

    /** Saticinin bu konusmada daha once mesaji var mi. */
    public function sellerHasWritten(Conversation $conversation): bool
    {
        return Message::query()
            ->where('conversation_id', $conversation->id)
            ->where('sender_id', $conversation->seller_id)
            ->exists();
    }

    /** Bu gonderim icin dusecek kontor. Alicida her zaman sifir. */
    public function costFor(Conversation $conversation, User $sender): int
    {
        if ($sender->id !== $conversation->seller_id) {
            return 0;
        }

        if ($this->sellerHasWritten($conversation)) {
            return 0;
        }

        return max(0, (int) config('messaging.first_message_cost', 1));
    }

    /**
     * Mesaji kaydeder, gerekiyorsa kontor duser, okunmamis bildirimi kuyruga
     * atar.
     *
     * @throws InsufficientCreditsException
     */
    public function send(Conversation $conversation, User $sender, string $body): Message
    {
        return DB::transaction(function () use ($conversation, $sender, $body): Message {
            $locked = Conversation::query()->whereKey($conversation->id)->lockForUpdate()->firstOrFail();
            $cost = $this->costFor($locked, $sender);

            if ($cost > 0) {
                $this->charge($sender, $locked, $cost);
            }

            $message = Message::query()->create([
                'conversation_id' => $locked->id,
                'sender_id' => $sender->id,
                'body' => $body,
                'credit_spent' => $cost,
            ]);

            $recipientIsBuyer = $sender->id === $locked->seller_id;

            $locked->update([
                'last_message_at' => $message->created_at,
                'buyer_unread' => $recipientIsBuyer ? $locked->buyer_unread + 1 : $locked->buyer_unread,
                'seller_unread' => $recipientIsBuyer ? $locked->seller_unread : $locked->seller_unread + 1,
            ]);

            // Gecikmeli gonderim: karsi taraf birkac dakika icinde okursa
            // e-posta hic cikmaz, sohbet ederken kutusu dolmaz.
            NotifyUnreadMessage::dispatch($message->id)
                ->delay(now()->addMinutes((int) config('messaging.email_delay_minutes', 3)));

            return $message;
        }, 3);
    }

    /** Kullanicinin bu konusmadaki okunmamislarini sifirlar. */
    public function markRead(Conversation $conversation, User $reader): void
    {
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

    private function charge(User $seller, Conversation $conversation, int $cost): void
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
            'reference_type' => 'conversation_open',
            'reference_id' => $conversation->id,
            'balance_after' => $balance,
            'metadata' => [
                'conversation_id' => $conversation->id,
                'request_id' => $conversation->request_id,
                'first_message_cost' => $cost,
            ],
        ]);
    }
}
