<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\AppSettings;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * alıcam asistanı.
 *
 * Yapay zekâ bağlı değilken sorular Bilgi Bankası'nda aranır ve kayıtlı
 * metin olduğu gibi döner ("hazır cevap modu"). Yönetim panelinden bir
 * Gemini anahtarı girildiğinde aynı uç modele sorar; bilgi bankası o
 * durumda modele bağlam olarak verilir.
 */
class AssistantController extends Controller
{
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
            'mode' => $this->mode(),
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
                    'mode' => $this->mode(),
                    'answer' => $match['answer'],
                    'topic' => $match['key'],
                    'suggestions' => $this->related($topics, $match['key']),
                ]);
            }
        }

        $question = trim((string) ($data['question'] ?? ''));
        $match = $this->search($topics, $question);

        return response()->json([
            'mode' => $this->mode(),
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

        $needle = mb_strtolower($question, 'UTF-8');
        $best = null;
        $bestScore = 0;

        foreach ($topics as $topic) {
            $score = 0;

            foreach ($topic['keywords'] as $keyword) {
                if (str_contains($needle, mb_strtolower($keyword, 'UTF-8'))) {
                    $score += mb_strlen($keyword) > 4 ? 3 : 2;
                }
            }

            if (str_contains($needle, mb_strtolower($topic['title'], 'UTF-8'))) {
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

    /** Yapay zekâ anahtari girilmediyse hazir cevap modundayiz. */
    private function mode(): string
    {
        return AppSettings::get('assistant.gemini_key') ? 'ai' : 'knowledge';
    }
}
