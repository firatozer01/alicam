<?php

namespace App\Events;

use App\Models\Message;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * Yeni mesajin konusmadaki her iki tarafa aninda ulasmasi.
 *
 * Kuyruga atilmaz (ShouldBroadcastNow): sohbet gecikmeye tahammul etmiyor ve
 * kuyruk isciSi --sleep=2 ile calistigi icin arada iki saniyeye kadar bekleme
 * olurdu. Reverb ayni docker aginda oldugundan cagri birkac milisaniye surer.
 *
 * Yuk, ConversationController::poll ile AYNI alanlari tasir; tek fark "mine"
 * alaninin olmamasi. Bir yayin iki kisiye birden gider, "bu benim mesajim mi"
 * sorusunun cevabi ise bakana gore degisir; bu yuzden sender_id gonderilir ve
 * karari arayuz verir.
 */
class MessageSent implements ShouldBroadcastNow
{
    use Dispatchable, SerializesModels;

    public function __construct(private readonly Message $message) {}

    /**
     * @return array<int, PrivateChannel>
     */
    public function broadcastOn(): array
    {
        return [new PrivateChannel('conversation.'.$this->message->conversation_id)];
    }

    public function broadcastAs(): string
    {
        return 'message.sent';
    }

    /**
     * @return array<string, mixed>
     */
    public function broadcastWith(): array
    {
        $this->message->loadMissing('sender:id,name');

        return [
            'id' => $this->message->id,
            'conversation_id' => $this->message->conversation_id,
            'body' => $this->message->body,
            'sender_id' => $this->message->sender_id,
            'sender' => $this->message->sender?->name ?? 'Hesap',
            'read' => $this->message->read_at !== null,
            'created_at' => $this->message->created_at->toIso8601String(),
        ];
    }
}
