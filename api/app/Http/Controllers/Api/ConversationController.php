<?php

namespace App\Http\Controllers\Api;

use App\Exceptions\InsufficientCreditsException;
use App\Http\Controllers\Controller;
use App\Models\BuyerRequest;
use App\Models\Conversation;
use App\Models\Message;
use App\Models\User;
use App\Services\MessagingService;
use App\Support\Text;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ConversationController extends Controller
{
    public function __construct(private readonly MessagingService $messaging) {}

    /** Kullanicinin konusmalari, en son yazilan ustte. */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        $conversations = Conversation::query()
            ->where(fn ($query) => $query->where('buyer_id', $user->id)->orWhere('seller_id', $user->id))
            ->with(['buyer:id,name', 'seller:id,name', 'buyerRequest:id,public_reference,title'])
            ->withCount('messages')
            ->orderByRaw('last_message_at desc nulls last')
            ->limit(60)
            ->get();

        return response()->json([
            'data' => $conversations->map(fn (Conversation $conversation) => $this->present($conversation, $user)),
            'meta' => [
                'unread_total' => $conversations->sum(
                    fn (Conversation $conversation) => $conversation->buyer_id === $user->id
                        ? $conversation->buyer_unread
                        : $conversation->seller_unread,
                ),
            ],
        ]);
    }

    /**
     * Konusmayi acar ya da var olani dondurur. Vitrinden "mesaj gonder"
     * bu ucu kullanir; talep uzerinden acildiysa request_id gecilir.
     */
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'seller_id' => ['required', 'integer', 'exists:users,id'],
            'request_id' => ['sometimes', 'nullable', 'integer', 'exists:requests,id'],
        ]);

        $user = $request->user();
        $other = User::query()->whereKey($data['seller_id'])->firstOrFail();

        abort_if($other->id === $user->id, 422, 'Kendinize mesaj gönderemezsiniz.');

        $onayli = fn (User $aday) => $aday->sellerProfile()
            ->where('approval_status', 'approved')
            ->exists();

        // Koltuklar role gore dagitilir, kimin basladigina gore degil.
        // Karsi taraf hizmet verense cagiran alici koltugundadir; degilse ve
        // cagiran hizmet verense yonler yer degistirir, boylece satici da
        // aliciya yazabilir.
        if ($onayli($other)) {
            [$buyer, $seller] = [$user, $other];
        } elseif ($onayli($user)) {
            [$buyer, $seller] = [$other, $user];
        } else {
            abort(422, 'Bu hesap mesaj almaya açık değil.');
        }

        $buyerRequest = null;
        if (! empty($data['request_id'])) {
            $buyerRequest = BuyerRequest::query()->whereKey($data['request_id'])->first();
            // Talep baglantisi yalnizca talebin sahibi icin kurulur.
            if ($buyerRequest && $buyerRequest->user_id !== $buyer->id) {
                $buyerRequest = null;
            }
        }

        $conversation = $this->messaging->open($buyer, $seller, $buyerRequest);

        return response()->json([
            'data' => $this->present($conversation->fresh(['buyer', 'seller', 'buyerRequest']), $user),
        ], 201);
    }

    /** Konusma detayi ve mesajlar; acilista okundu isaretlenir. */
    public function show(Request $request, Conversation $conversation): JsonResponse
    {
        $user = $request->user();
        abort_unless($conversation->isParticipant($user->id), 403);

        $this->messaging->markRead($conversation, $user);

        $messages = $conversation->messages()
            ->with('sender:id,name')
            ->orderBy('id')
            ->limit(300)
            ->get();

        $conversation->load(['buyer:id,name', 'seller:id,name', 'buyerRequest:id,public_reference,title']);

        return response()->json([
            'data' => $this->present($conversation->fresh(['buyer', 'seller', 'buyerRequest']), $user),
            'messages' => $messages
                ->map(fn ($message) => $this->presentMessage($message, $user, $conversation->canRead($user->id)))
                ->values(),
            'compose' => $this->composeState($conversation, $user),
        ]);
    }

    public function send(Request $request, Conversation $conversation): JsonResponse
    {
        $data = $request->validate([
            'body' => ['required', 'string', 'min:1', 'max:4000'],
        ]);

        $user = $request->user();
        abort_unless($conversation->isParticipant($user->id), 403);

        try {
            $message = $this->messaging->send($conversation, $user, trim($data['body']));
        } catch (InsufficientCreditsException $exception) {
            return response()->json([
                'message' => 'Bu konuşmayı açmak için yeterli kontörün yok.',
                'required' => $exception->required ?? null,
                'balance' => $exception->balance ?? null,
            ], 402);
        }

        return response()->json([
            // Gonderen her zaman kendi yazdigini gorur.
            'data' => $this->presentMessage($message->loadMissing('sender:id,name'), $user, true),
            'credit_spent' => $message->credit_spent,
            'compose' => $this->composeState($conversation->fresh(), $user),
        ], 201);
    }

    /**
     * Hizmet veren konusmayi acar: kontor duser, govdeler gorunur olur.
     *
     * Tekrar cagrilirsa kontor bir daha dusmez; "zaten acik" doner.
     */
    public function unlock(Request $request, Conversation $conversation): JsonResponse
    {
        $user = $request->user();
        abort_unless($conversation->isParticipant($user->id), 403);
        abort_unless($user->id === $conversation->seller_id, 403);

        try {
            $result = $this->messaging->unlock($conversation, $user);
        } catch (InsufficientCreditsException $exception) {
            return response()->json([
                'message' => 'Bu konuşmayı açmak için yeterli kontörün yok.',
                'code' => 'insufficient_credits',
                'required' => $exception->required,
                'balance' => $exception->balance,
            ], 402);
        }

        $fresh = $result['conversation']->fresh(['buyer', 'seller', 'buyerRequest']);

        return response()->json([
            'message' => $result['already_unlocked']
                ? 'Bu konuşma zaten açık.'
                : 'Konuşma açıldı; artık mesajları okuyup yanıtlayabilirsin.',
            'already_unlocked' => $result['already_unlocked'],
            'credit_spent' => $result['credit_spent'],
            'balance' => $result['balance'],
            'data' => $this->present($fresh, $user),
        ]);
    }

    /**
     * Yeni mesajlari cekmek icin hafif uc. Canli tasiyici baglanana kadar
     * arayuz bunu kisa araliklarla yoklar; tasiyici geldiginde ayni yanit
     * sekli kullanilir.
     */
    public function poll(Request $request, Conversation $conversation): JsonResponse
    {
        $data = $request->validate([
            'after' => ['sometimes', 'integer', 'min:0'],
        ]);

        $user = $request->user();
        abort_unless($conversation->isParticipant($user->id), 403);

        $messages = $conversation->messages()
            ->with('sender:id,name')
            ->where('id', '>', $data['after'] ?? 0)
            ->orderBy('id')
            ->limit(100)
            ->get();

        if ($messages->contains(fn ($message) => $message->sender_id !== $user->id)) {
            $this->messaging->markRead($conversation, $user);
        }

        return response()->json([
            'messages' => $messages
                ->map(fn ($message) => $this->presentMessage($message, $user, $conversation->canRead($user->id)))
                ->values(),
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function composeState(Conversation $conversation, User $user): array
    {
        $cost = $this->messaging->unlockCost($conversation, $user);
        $isSeller = $user->id === $conversation->seller_id;

        if ($cost > 0) {
            return [
                'credit_cost' => $cost,
                'locked' => true,
                'can_send' => false,
                'notice' => "Bu konuşmayı okumak ve yanıtlamak için {$cost} kontör düşer. "
                    .'Açtıktan sonra aynı konuşmada sınırsız yazışırsın.',
            ];
        }

        // Alici, hizmet veren konusmayi acana kadar sinirli sayida yazabilir.
        $limit = max(1, (int) config('messaging.locked_message_limit', 3));
        $kalan = ($isSeller || $conversation->isUnlocked())
            ? null
            : max(0, $limit - $conversation->locked_message_count);

        return [
            'credit_cost' => 0,
            'locked' => false,
            'can_send' => $kalan === null || $kalan > 0,
            'notice' => $kalan === null
                ? null
                : ($kalan > 0
                    ? "Hizmet veren konuşmayı henüz açmadı. {$kalan} mesaj daha gönderebilirsin."
                    : 'Hizmet veren konuşmayı açana kadar yeni mesaj gönderemezsin.'),
        ];
    }

    /**
     * Tek mesajin disariya donen sekli.
     *
     * $canRead false ise govde GONDERILMEZ: hizmet veren konusmayi acmadan
     * metni goremez. Kimden ve ne zaman geldigi yine gorunur ki neye kontor
     * harcayacagina karar verebilsin. Kendi yazdigini her zaman gorur.
     *
     * @return array<string, mixed>
     */
    private function presentMessage(Message $message, User $user, bool $canRead): array
    {
        $mine = $message->sender_id === $user->id;
        $gorunur = $canRead || $mine;

        return [
            'id' => $message->id,
            'body' => $gorunur ? $message->body : null,
            'locked' => ! $gorunur,
            'sender_id' => $message->sender_id,
            'mine' => $mine,
            // Ad serbest metindir; kilitliyken kisaltilir ve satir sonlari
            // atilir, yoksa mesaj adin icine yazilip bedelsiz ulastirilir.
            'sender' => Text::safeName($message->sender?->name, $gorunur),
            'read' => $message->read_at !== null,
            'created_at' => $message->created_at->toIso8601String(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function present(Conversation $conversation, User $user): array
    {
        $isBuyer = $conversation->buyer_id === $user->id;
        $other = $isBuyer ? $conversation->seller : $conversation->buyer;

        return [
            'id' => $conversation->id,
            // Soketten gelen mesajda "mine" bulunmaz (tek yayin iki kisiye
            // gider); arayuz bunu sender_id ile karsilastirarak bulur.
            'viewer_id' => $user->id,
            'counterpart' => ['id' => $other?->id, 'name' => Text::safeName($other?->name)],
            'role' => $isBuyer ? 'buyer' : 'seller',
            'unread' => $isBuyer ? $conversation->buyer_unread : $conversation->seller_unread,
            // Hizmet veren icin kilit durumu; alicida her zaman acik.
            'locked' => ! $conversation->canRead($user->id),
            'unlock_cost' => $this->messaging->unlockCost($conversation, $user),
            'last_message_at' => $conversation->last_message_at?->toIso8601String(),
            // Talep basligi da kilidin arkasindadir. Basligi alici yazar;
            // serbest metin oldugu icin acilmadan gosterilirse hem mesajin
            // ozu hem iletisim bilgisi bedelsiz sizar, ustelik ayni basligi
            // talep listesinde gormek RequestUnlock bedeli ister.
            'request' => ($conversation->buyerRequest && $conversation->canRead($user->id)) ? [
                'id' => $conversation->buyerRequest->id,
                'reference' => $conversation->buyerRequest->public_reference,
                'title' => $conversation->buyerRequest->title,
            ] : null,
        ];
    }
}
