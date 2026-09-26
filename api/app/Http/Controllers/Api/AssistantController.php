<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\AppSettings;
use App\Services\AssistantAi;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * alıcam asistanı.
 *
 * Yapay zekâ bağlı değilken sorular Bilgi Bankası'nda aranır ve kayıtlı
 * metin olduğu gibi döner ("hazır cevap modu"). Yönetim panelinden bir
 * Yönetim panelinden bir Gemini anahtarı girildiğinde giriş yapmış
 * kullanıcıların soruları modele sorulur ve bilgi bankası modele bağlam
 * olarak verilir. Misafirler her zaman hazır cevap modunda kalır.
 */
class AssistantController extends Controller
{
    public function __construct(private readonly AssistantAi $ai) {}

    /** Giris yapmamis ziyaretciye gosterilmeyecek konular. */
    private function topicsFor(?object $user): array
    {
        return collect(config('assistant.topics'))
            ->filter(fn (array $topic) => $user !== null || $topic['audience'] === 'all')
            ->map(fn (array $topic) => [
                'key' => $topic['key'],
                'title' => $topic['title'],
            ])
            ->values()
            ->all();
    }

    /** Acilis: selamlama, konu basliklari ve calisma modu. */
    public function intro(Request $request): JsonResponse
    {
        $user = $request->user();

        return response()->json([
            'mode' => $this->mode($user),
            'greeting' => $user
                ? config('assistant.greeting')
                : config('assistant.guest_greeting'),
            'display_name' => $user?->name,
            'topics' => $this->topicsFor($user),
        ]);
    }

    public function ask(Request $request): JsonResponse
    {
        $data = $request->validate([
            'question' => ['required_without:topic', 'nullable', 'string', 'max:500'],
            'topic' => ['sometimes', 'nullable', 'string', 'max:60'],
        ]);

        $user = $request->user();
        $topics = collect(config('assistant.topics'))
            ->filter(fn (array $topic) => $user !== null || $topic['audience'] === 'all');

        // Konu karti tiklandiysa dogrudan o metin doner.
        if (! empty($data['topic'])) {
            $match = $topics->firstWhere('key', $data['topic']);

            if ($match) {
                return response()->json([
                    'mode' => $this->mode($user),
                    'source' => 'knowledge',
                    'answer' => $match['answer'],
                    'topic' => $match['key'],
                    'suggestions' => $this->related($topics, $match['key']),
                ]);
            }
        }

        $question = trim((string) ($data['question'] ?? ''));
        $mode = $this->mode($user);

        // Yapay zeka aciksa once modele sorulur. Model cevap uretemezse
        // (anahtar gecersiz, kota dolmus, Google tarafi dusmus) asagidaki
        // bilgi bankasi aramasi devreye girer; asistan hicbir kosulda
        // cevapsiz kalmaz.
        if ($mode === 'ai') {
            $generated = $this->ai->answer($question, $topics, $user->id);

            if ($generated !== null) {
                return response()->json([
                    'mode' => $mode,
                    'source' => 'ai',
                    'answer' => $generated,
                    'topic' => null,
                    'matched' => true,
                    'suggestions' => $this->related($topics, null),
                ]);
            }
        }

        $match = $this->search($topics, $question);

        return response()->json([
            'mode' => $mode,
            // Modele sorulup cevap alinamadiysa mod 'ai' olsa bile cevabi
            // bilgi bankasi verdi; arayuz rozetinin yalan soylememesi icin
            // gercek kaynak ayrica bildirilir.
            'source' => 'knowledge',
            'answer' => $match['answer'] ?? config('assistant.fallback'),
            'topic' => $match['key'] ?? null,
            'matched' => $match !== null,
            'suggestions' => $this->related($topics, $match['key'] ?? null),
        ]);
    }

    /**
     * Basit puanlama: baslik ve anahtar kelime gecisleri sayilir. Yapay zekâ
     * bagli olmadigi icin uydurma yapmaz, yalnizca kayitli metni doner.
     */
    private function search(\Illuminate\Support\Collection $topics, string $question): ?array
    {
        if ($question === '') {
            return null;
        }

        $needle = $this->fold($question);
        $best = null;
        $bestScore = 0;

        foreach ($topics as $topic) {
            $score = 0;

            foreach ($topic['keywords'] as $keyword) {
                if (str_contains($needle, $this->fold($keyword))) {
                    $score += mb_strlen($keyword) > 4 ? 3 : 2;
                }
            }

            if (str_contains($needle, $this->fold($topic['title']))) {
                $score += 5;
            }

            if ($score > $bestScore) {
                $bestScore = $score;
                $best = $topic;
            }
        }

        return $bestScore >= 2 ? $best : null;
    }

    /**
     * Turkce aksanlari sadelestirir. Kullanicilarin cogu "kontör" yerine
     * "kontor", "ücret" yerine "ucret" yaziyor; aksi halde bu sorular
     * bilgi bankasinda hic eslesmiyordu.
     */
    private function fold(string $value): string
    {
        $folded = str_replace(
            ['ı', 'İ', 'ş', 'Ş', 'ğ', 'Ğ', 'ü', 'Ü', 'ö', 'Ö', 'ç', 'Ç', 'â', 'î', 'û'],
            ['i', 'i', 's', 's', 'g', 'g', 'u', 'u', 'o', 'o', 'c', 'c', 'a', 'i', 'u'],
            $value,
        );

        // Noktalama atilir: baslik "Vitrinimi nasil duzenlerim?" seklinde
        // soru isaretiyle bittigi icin ayni cumleyi yazan kullaniciyla
        // eslesemiyordu.
        $folded = preg_replace('/[^\p{L}\p{N}\s]+/u', ' ', $folded) ?? $folded;
        $folded = preg_replace('/\s+/u', ' ', $folded) ?? $folded;

        return trim(mb_strtolower($folded, 'UTF-8'));
    }

    /**
     * @return array<int, array<string, string>>
     */
    private function related(\Illuminate\Support\Collection $topics, ?string $exclude): array
    {
        return $topics
            ->when($exclude, fn ($items) => $items->where('key', '!=', $exclude))
            ->take(4)
            ->map(fn (array $topic) => ['key' => $topic['key'], 'title' => $topic['title']])
            ->values()
            ->all();
    }

    /**
     * Yapay zeka yalnizca giris yapmis kullanicilar icin acilir; misafirler
     * her zaman hazir cevap modunda kalir. Anahtar girilmemisse herkes icin
     * hazir cevap modu gecerlidir.
     */
    private function mode(?object $user = null): string
    {
        if ($user === null) {
            return 'knowledge';
        }

        return AppSettings::get('assistant.gemini_key') ? 'ai' : 'knowledge';
    }
}
