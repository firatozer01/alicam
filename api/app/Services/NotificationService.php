<?php

namespace App\Services;

use App\Events\NotificationPushed;
use App\Models\Notification;
use Illuminate\Support\Facades\Log;

/**
 * Ust cubuktaki zilin arkasindaki servis.
 *
 * Bildirim yazmak hicbir zaman ana isi bozmamali: bir teklif kaydedildiyse
 * bildirimi yazilamadi diye teklif geri alinmaz. Bu yuzden butun hatalar
 * burada yutulur ve yalnizca kayda dusulur.
 */
class NotificationService
{
    /**
     * Bildirimi yazar ve acik sekmelere iletir.
     *
     * $dedupeKey verilirse ayni anahtarli satir YENIDEN kullanilir: ayni
     * konusmadan gelen besinci mesaj yeni satir acmaz, var olani tazeleyip
     * okunmamis hale getirir. Boylece rozet "uc konusmada yeni mesaj" der,
     * "kirk yedi mesaj" demez.
     *
     * @param  array<string, mixed>  $data
     */
    public function push(
        int $userId,
        string $type,
        string $title,
        ?string $body = null,
        ?string $link = null,
        ?string $dedupeKey = null,
        array $data = [],
        ?string $subjectType = null,
        ?int $subjectId = null,
    ): ?Notification {
        try {
            $payload = [
                'type' => $type,
                'title' => mb_substr($title, 0, 160),
                'body' => $body === null ? null : mb_substr($body, 0, 320),
                'link' => $link,
                'subject_type' => $subjectType,
                'subject_id' => $subjectId,
                'data' => $data === [] ? null : $data,
                // Tazelenen satir tekrar okunmamis sayilir ve listenin basina
                // cikar; aksi halde eski tarihiyle asagida kaybolurdu.
                'read_at' => null,
                'created_at' => now(),
                'updated_at' => now(),
            ];

            $notification = $dedupeKey === null
                ? Notification::query()->create($payload + ['user_id' => $userId])
                : Notification::query()->updateOrCreate(
                    ['user_id' => $userId, 'dedupe_key' => $dedupeKey],
                    $payload,
                );

            $this->announce($notification);

            return $notification;
        } catch (\Throwable $error) {
            Log::warning('Bildirim yazilamadi', [
                'user_id' => $userId,
                'type' => $type,
                'error' => mb_substr($error->getMessage(), 0, 200),
            ]);

            return null;
        }
    }

    /** Rozet sayaci. Kismi index sayesinde yalnizca okunmamislari tarar. */
    public function unreadCount(int $userId): int
    {
        return Notification::query()
            ->where('user_id', $userId)
            ->whereNull('read_at')
            ->count();
    }

    /**
     * Verilen satirlari okundu isaretler. Bos dizi gelirse kisinin TUM
     * okunmamislari kapanir ("tumunu okundu say").
     *
     * @param  array<int, int>  $ids
     */
    public function markRead(int $userId, array $ids = []): int
    {
        $query = Notification::query()->where('user_id', $userId)->whereNull('read_at');

        if ($ids !== []) {
            $query->whereIn('id', $ids);
        }

        return $query->update(['read_at' => now()]);
    }

    /** Acik sekmelere canli iletir; tasiyici yoksa sessizce gecilir. */
    private function announce(Notification $notification): void
    {
        try {
            NotificationPushed::dispatch($notification, $this->unreadCount($notification->user_id));
        } catch (\Throwable $error) {
            Log::warning('Bildirim canli iletilemedi', [
                'notification_id' => $notification->id,
                'error' => mb_substr($error->getMessage(), 0, 200),
            ]);
        }
    }
}
