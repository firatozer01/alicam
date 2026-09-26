<?php

namespace App\Events;

use App\Models\Notification;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * Yeni bildirimin acik sekmelere aninda dusmesi.
 *
 * Kanal kullanicinin kendisine aittir (private-user.{id}), konusmaya degil:
 * bildirim kisiseldir ve baska kimse abone olamaz. Kuyruga atilmaz, cunku
 * rozetin saniyeler sonra guncellenmesi anlamsiz olurdu.
 */
class NotificationPushed implements ShouldBroadcastNow
{
    use Dispatchable, SerializesModels;

    public function __construct(
        private readonly Notification $notification,
        private readonly int $unreadCount,
    ) {}

    /**
     * @return array<int, PrivateChannel>
     */
    public function broadcastOn(): array
    {
        return [new PrivateChannel('user.'.$this->notification->user_id)];
    }

    public function broadcastAs(): string
    {
        return 'notification.pushed';
    }

    /**
     * @return array<string, mixed>
     */
    public function broadcastWith(): array
    {
        return [
            'unread' => $this->unreadCount,
            'notification' => [
                'id' => $this->notification->id,
                'type' => $this->notification->type,
                'title' => $this->notification->title,
                'body' => $this->notification->body,
                'link' => $this->notification->link,
                'read' => false,
                'created_at' => $this->notification->created_at->toIso8601String(),
            ],
        ];
    }
}
