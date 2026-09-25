<?php

namespace App\Jobs;

use App\Models\Message;
use App\Services\AppSettings;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

/**
 * Okunmamis mesaj icin e-posta.
 *
 * Gecikmeli calisir: alici mesaji bu arada okuduysa ya da bildirim zaten
 * gonderildiyse hicbir sey yapmaz. Boylece sohbet ederken posta kutusu
 * dolmaz, ama uygulamada degilse haberi olur.
 */
class NotifyUnreadMessage implements ShouldQueue
{
    use Queueable;

    public function __construct(private readonly int $messageId) {}

    public function handle(): void
    {
        $message = Message::query()
            ->with(['conversation.buyer', 'conversation.seller', 'sender'])
            ->find($this->messageId);

        if (! $message || $message->read_at || $message->notified_at) {
            return;
        }

        $recipient = $message->conversation->counterpartFor($message->sender_id);

        if (! $recipient?->email) {
            return;
        }

        // E-posta baglanmamissa sessizce gec: uygulama ici bildirim zaten var.
        AppSettings::applyMailConfig();

        if (config('mail.default') === 'log') {
            Log::info('Mesaj bildirimi atlandi: e-posta baglanmamis', [
                'message_id' => $message->id,
                'recipient_id' => $recipient->id,
            ]);

            return;
        }

        // Ayni gonderici bu konusmada az once haber verdiyse tekrar yazmayiz:
        // uzaktaki kisi don donup 5 mesaj yazinca 5 e-posta almamali. Mesaj
        // yine de islenmis sayilir ki kuyruk tekrar denemesin.
        $cooldown = (int) config('messaging.email_cooldown_minutes', 30);

        $recentlyNotified = Message::query()
            ->where('conversation_id', $message->conversation_id)
            ->where('sender_id', $message->sender_id)
            ->whereKeyNot($message->id)
            ->whereNotNull('notified_at')
            ->where('notified_at', '>=', now()->subMinutes($cooldown))
            ->exists();

        if ($recentlyNotified) {
            $message->forceFill(['notified_at' => now()])->save();

            return;
        }

        $sender = $message->sender->name;
        $preview = mb_substr(trim($message->body), 0, 160);

        try {
            Mail::raw(
                "{$sender} sana alıcam.net üzerinden bir mesaj gönderdi:\n\n"
                ."\"{$preview}\"\n\n"
                ."Yanıtlamak için: ".rtrim((string) config('services.frontend_url'), '/')."/mesajlar\n",
                fn ($mail) => $mail->to($recipient->email)
                    ->subject("{$sender} sana mesaj gönderdi — alıcam.net"),
            );

            $message->forceFill(['notified_at' => now()])->save();
        } catch (\Throwable $error) {
            Log::warning('Mesaj bildirimi gonderilemedi', [
                'message_id' => $message->id,
                'error' => mb_substr($error->getMessage(), 0, 200),
            ]);
        }
    }
}
