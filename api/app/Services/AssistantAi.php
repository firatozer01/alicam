<?php

namespace App\Services;

use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * alicam asistaninin Gemini baglantisi.
 *
 * Yonetim panelinden bir anahtar girilmemisse ya da cagri herhangi bir
 * sebeple basarisiz olursa null doner; cagiran taraf o zaman hazir cevap
 * moduna duser. Yani yapay zeka bir ek, bir bagimlilik degil: Google
 * tarafinda bir sorun ciktiginda asistan susmaz, bilgi bankasindan
 * cevaplamaya devam eder.
 */
class AssistantAi
{
    private const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/interactions';

    /** Gemini 3 ailesinin istedigi surum basligi. */
    private const REVISION = '2026-05-20';

    /** Anahtar sahibinin faturasini korumak icin kullanici basina saatlik tavan. */
    private const HOURLY_LIMIT = 40;

    public function configured(): bool
    {
        return AppSettings::get('assistant.gemini_key') !== null;
    }

    /**
     * Soruyu modele sorar. Cevap uretilemezse null doner.
     *
     * $userId zorunludur: misafir istegi buraya hic ulasmamali, tip imzasi
     * da bunu garanti eder.
     *
     * @param  Collection<int, array<string, mixed>>  $topics  modele baglam olarak verilecek bilgi bankasi
     */
    public function answer(string $question, Collection $topics, int $userId): ?string
    {
        $key = AppSettings::get('assistant.gemini_key');

        if ($key === null || trim($question) === '') {
            return null;
        }

        if (! $this->withinQuota($userId)) {
            return null;
        }

        try {
            $response = Http::withHeaders([
                'x-goog-api-key' => $key,
                'Api-Revision' => self::REVISION,
            ])
                ->timeout(15)
                ->connectTimeout(5)
                ->post(self::ENDPOINT, [
                    'model' => AppSettings::get('assistant.model', 'gemini-3.8-flash'),
                    'input' => $this->prompt($question, $topics),
                    'generation_config' => ['thinking_level' => 'low'],
                ]);

            if (! $response->successful()) {
                Log::warning('Asistan: Gemini cagrisi reddedildi', [
                    'status' => $response->status(),
                    'body' => mb_substr($response->body(), 0, 300),
                ]);

                return null;
            }

            $text = trim((string) $response->json('output_text', ''));

            return $text === '' ? null : $text;
        } catch (\Throwable $error) {
            Log::warning('Asistan: Gemini cagrisi basarisiz', [
                'error' => mb_substr($error->getMessage(), 0, 200),
            ]);

            return null;
        }
    }

    /**
     * Modele tek parca metin gonderilir: once davranis kurallari, sonra
     * bilgi bankasi, en sonda soru. Kurallar modelin siteye ait olmayan
     * konulara savrulmasini ve olmayan ozellik uydurmasini engeller.
     *
     * @param  Collection<int, array<string, mixed>>  $topics
     */
    private function prompt(string $question, Collection $topics): string
    {
        $knowledge = $topics
            ->map(fn (array $topic) => "### {$topic['title']}\n{$topic['answer']}")
            ->implode("\n\n");

        return <<<METIN
        Sen alıcam.net sitesinin yardım asistanısın. alıcam.net ters çalışan bir pazaryeridir:
        alıcı ihtiyacını yazar, hizmet verenler ona teklif gönderir.

        Kurallar:
        - Yalnızca Türkçe yanıt ver.
        - Yalnızca alıcam.net'in kullanımıyla ilgili soruları yanıtla. Konu dışı bir soru gelirse
          kibarca bu konuda yardımcı olamayacağını söyle ve siteyle ilgili ne sorabileceğini hatırlat.
        - Aşağıdaki bilgi bankasında olmayan bir özellik, ücret, süre ya da garanti UYDURMA.
          Bilmiyorsan bilmediğini söyle ve destekle iletişime geçmesini öner.
        - Kısa ve net yaz: en fazla üç kısa paragraf ya da beş maddelik bir liste.
        - Samimi ve sade bir dil kullan, kullanıcıya "sen" diye hitap et.

        BİLGİ BANKASI:
        {$knowledge}

        KULLANICININ SORUSU:
        {$question}
        METIN;
    }

    /** Saatlik sayaci artirir ve tavanin altinda olup olmadigimizi soyler. */
    private function withinQuota(int $userId): bool
    {
        $key = "assistant-ai:{$userId}:".now()->format('YmdH');
        $used = (int) Cache::get($key, 0);

        if ($used >= self::HOURLY_LIMIT) {
            return false;
        }

        Cache::put($key, $used + 1, now()->addHour());

        return true;
    }
}
