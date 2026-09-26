<?php

namespace App\Http\Controllers\Api;

use App\Exceptions\InsufficientCreditsException;
use App\Http\Controllers\Controller;
use App\Models\BuyerRequest;
use App\Models\Conversation;
use App\Models\User;
use App\Services\MessagingService;
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
        $seller = User::query()->whereKey($data['seller_id'])->firstOrFail();

        abort_if($seller->id === $user->id, 422, 'Kendinize mesaj gönderemezsiniz.');
        abort_unless(
            $seller->sellerProfile()->where('approval_status', 'approved')->exists(),
            422,
            'Bu hesap mesaj almaya açık değil.',
        );

        $buyerRequest = null;
        if (! empty($data['request_id'])) {
            $buyerRequest = BuyerRequest::query()->whereKey($data['request_id'])->first();
            // Talep baglantisi yalnizca talebin sahibi icin kurulur.
            if ($buyerRequest && $buyerRequest->user_id !== $user->id) {
                $buyerRequest = null;
            }
        }

        $conversation = $this->messaging->open($user, $seller, $buyerRequest);

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
            'messages' => $messages->map(fn ($message) => [
                'id' => $message->id,
                'body' => $message->body,
                'sender_id' => $message->sender_id,
                'mine' => $message->sender_id === $user->id,
                'sender' => $message->sender->name,
                'read' => $message->read_at !== null,
                'created_at' => $message->created_at->toIso8601String(),
            ])->values(),
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
                'message' => 'İlk mesajı göndermek için yeterli kontörün yok.',
                'required' => $exception->required ?? null,
                'balance' => $exception->balance ?? null,
            ], 402);
        }

        return response()->json([
            'data' => [
                'id' => $message->id,
                'body' => $message->body,
                'sender_id' => $message->sender_id,
                'mine' => true,
                'sender' => $user->name,
                'read' => false,
                'created_at' => $message->created_at->toIso8601String(),
            ],
            'credit_spent' => $message->credit_spent,
            'compose' => $this->composeState($conversation->fresh(), $user),
        ], 201);
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
            'messages' => $messages->map(fn ($message) => [
                'id' => $message->id,
                'body' => $message->body,
                'sender_id' => $message->sender_id,
                'mine' => $message->sender_id === $user->id,
                'sender' => $message->sender->name,
                'read' => $message->read_at !== null,
                'created_at' => $message->created_at->toIso8601String(),
            ])->values(),
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function composeState(Conversation $conversation, User $user): array
    {
        $cost = $this->messaging->costFor($conversation, $user);

        return [
            'credit_cost' => $cost,
            'notice' => $cost > 0
                ? "Bu konuşmadaki ilk mesajın {$cost} kontör düşer; sonraki mesajlar ücretsizdir."
                : null,
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
            'counterpart' => ['id' => $other?->id, 'name' => $other?->name ?? 'Hesap'],
            'role' => $isBuyer ? 'buyer' : 'seller',
            'unread' => $isBuyer ? $conversation->buyer_unread : $conversation->seller_unread,
            'last_message_at' => $conversation->last_message_at?->toIso8601String(),
            'request' => $conversation->buyerRequest ? [
                'id' => $conversation->buyerRequest->id,
                'reference' => $conversation->buyerRequest->public_reference,
                'title' => $conversation->buyerRequest->title,
            ] : null,
        ];
    }
}
