<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Notification;
use App\Services\NotificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Ust cubuktaki zil.
 *
 * Rozet sayaci her sayfa yuklemesinde okundugu icin ayri ve ucuz bir uc
 * olarak durur; listeyi yalnizca panel acildiginda cekeriz.
 */
class NotificationController extends Controller
{
    public function __construct(private readonly NotificationService $notifications) {}

    /** Yalnizca rozet sayaci. Kismi index uzerinden tek sayim. */
    public function count(Request $request): JsonResponse
    {
        return response()->json([
            'unread' => $this->notifications->unreadCount($request->user()->id),
        ]);
    }

    /** Panel listesi: en yeni bildirimler. */
    public function index(Request $request): JsonResponse
    {
        $data = $request->validate([
            'limit' => ['sometimes', 'integer', 'min:1', 'max:50'],
        ]);

        $user = $request->user();

        $items = Notification::query()
            ->where('user_id', $user->id)
            // read_at siralamada KULLANILMAZ: nullable oldugu icin
            // "read_at desc" okunmamislari degil NULL'lari basa alirdi.
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->limit($data['limit'] ?? 20)
            ->get();

        return response()->json([
            'data' => $items->map(fn (Notification $item) => [
                'id' => $item->id,
                'type' => $item->type,
                'title' => $item->title,
                'body' => $item->body,
                'link' => $item->link,
                'read' => $item->read_at !== null,
                'created_at' => $item->created_at->toIso8601String(),
            ])->values(),
            'meta' => ['unread' => $this->notifications->unreadCount($user->id)],
        ]);
    }

    /**
     * Okundu isaretle.
     *
     * Kimlik verilirse yalnizca o satirlar kapanir: panel acildi diye
     * kullanicinin hic gormedigi bildirimler silinmis sayilmasin. Kimlik
     * verilmezse "tumunu okundu say" calisir.
     */
    public function read(Request $request): JsonResponse
    {
        $data = $request->validate([
            'ids' => ['sometimes', 'array', 'max:100'],
            'ids.*' => ['integer', 'min:1'],
        ]);

        $user = $request->user();
        $count = $this->notifications->markRead($user->id, $data['ids'] ?? []);

        return response()->json([
            'marked' => $count,
            'unread' => $this->notifications->unreadCount($user->id),
        ]);
    }
}
