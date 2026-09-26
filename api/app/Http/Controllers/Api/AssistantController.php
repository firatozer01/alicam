<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\BuyerRequest;
use App\Models\Offer;
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
    /** Veritabanindaki durum degerlerinin kullaniciya gosterilecek karsiliklari. */
    private const STATUS_LABELS = [
        'open' => 'Açık — teklif toplanıyor',
        'in_negotiation' => 'Görüşme sürüyor',
        'accepted' => 'Teklif kabul edildi',
        'closed' => 'Kapandı',
        'expired' => 'Süresi doldu',
    ];

    public function __construct(private readonly AssistantAi $ai) {}

    /**
     * Saate ve ada gore selamlama. Ad bos ya da tek harfse adsiz bicime
     * dusulur; "Merhaba ! " gibi bir sonuc cikmasin diye.
     */
    private function greetingFor(object $user): string
    {
        $hour = (int) now()->format('G');

        $match = collect(config('assistant.greetings'))->first(function (array $slot) use ($hour): bool {
            // Gece yarisini asan aralik (orn. 23-5) iki parca halinde bakilir.
            return $slot['from'] <= $slot['to']
                ? ($hour >= $slot['from'] && $hour < $slot['to'])
                : ($hour >= $slot['from'] || $hour < $slot['to']);
        });

        $text = $match['text'] ?? config('assistant.greeting');
        $first = trim(explode(' ', trim((string) $user->name))[0] ?? '');

        if (mb_strlen($first) < 2) {
            return trim(str_replace([' {ad}', '{ad}'], '', $text));
        }

        return str_replace('{ad}', $first, $text);
    }

    /** Giris yapmamis ziyaretciye gosterilmeyecek konular. */
    private function topicsFor(?object $user): array
    {
        return collect(config('assistant.topics'))
            ->filter(fn (array $topic) => $user !== null || $topic['audience'] === 'all')
            ->map(fn (array $topic) => [
                'key' => $topic['key'],
                'title' => $topic['title'],
                // Kart gorunumu icin. Iceriye deger girilmemisse arayuz
                // duz liste olarak cizmeye devam eder.
                'icon' => $topic['icon'] ?? null,
                'summary' => $topic['summary'] ?? null,
                'group' => $topic['group'] ?? null,
            ])
            ->values()
            ->all();
    }

    /**
     * Uye panelindeki kart gruplari, gosterim sirasiyla. Icinde gorunur konu
     * kalmayan grup elenir ki bos baslik cizilmesin.
     *
     * @param  array<int, array<string, mixed>>  $topics
     * @return array<int, array<string, string>>
     */
    private function groupsFor(array $topics): array
    {
        $used = array_filter(array_column($topics, 'group'));

        return collect(config('assistant.groups', []))
            ->filter(fn (array $group) => in_array($group['key'], $used, true))
            ->map(fn (array $group) => ['key' => $group['key'], 'title' => $group['title']])
            ->values()
            ->all();
    }

    /** Acilis: selamlama, konu basliklari ve calisma modu. */
    public function intro(Request $request): JsonResponse
    {
        $user = $request->user();
        $topics = $this->topicsFor($user);

        return response()->json([
            'mode' => $this->mode($user),
            'greeting' => $user
                ? $this->greetingFor($user)
                : config('assistant.guest_greeting'),
            'display_name' => $user?->name,
            'subtitle' => $user ? null : config('assistant.guest_subtitle'),
            'topics' => $topics,
            'groups' => $user ? $this->groupsFor($topics) : [],
            // Hizli sorgulama yalnizca uyeye acik.
            'lookup' => $user ? [
                'label' => config('assistant.lookup.label'),
                'placeholder' => config('assistant.lookup.placeholder'),
                'action' => config('assistant.lookup.action'),
            ] : null,
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
                    'suggestions' => $this->related($topics, $match['key'], $user === null),
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
                    'suggestions' => $this->related($topics, null, false),
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
            'suggestions' => $this->related($topics, $match['key'] ?? null, $user === null),
        ]);
    }

    /**
     * Hizli sorgulama: talep referansindan durum ogrenme.
     *
     * Yalnizca giris yapmis kullanicilar icindir ve yalnizca kendi talebini
     * ya da teklif verdigi bir talebi gorebilir. Ilgisiz bir referans icin
     * "bulunamadi" doner; boylece referans deneyerek baskasinin talebi
     * hakkinda bilgi toplanamaz.
     */
    public function lookup(Request $request): JsonResponse
    {
        $data = $request->validate([
            'reference' => ['required', 'string', 'max:32'],
        ]);

        $user = $request->user();
        $reference = mb_strtoupper(trim($data['reference']), 'UTF-8');

        $found = BuyerRequest::query()
            ->with(['category:id,name', 'city:id,name', 'district:id,name'])
            ->withCount('offers')
            ->where('public_reference', $reference)
            ->first();

        $ownOffer = $found
            ? Offer::query()
                ->where('request_id', $found->id)
                ->where('seller_id', $user->id)
                ->first()
            : null;

        $isOwner = $found && $found->user_id === $user->id;

        if (! $found || (! $isOwner && ! $ownOffer)) {
            return response()->json([
                'found' => false,
                'message' => 'Bu referansla bir talep bulamadım. Referansı talep detayında '
                    .'ya da panelindeki listede görebilirsin.',
            ]);
        }

        return response()->json([
            'found' => true,
            'reference' => $found->public_reference,
            'title' => $found->title,
            'status' => $found->status,
            'status_label' => self::STATUS_LABELS[$found->status] ?? $found->status,
            'role' => $isOwner ? 'buyer' : 'seller',
            'category' => $found->category?->name,
            'location' => trim(($found->district?->name ?? '').' '.($found->city?->name ?? '')) ?: null,
            'offer_count' => $isOwner ? $found->offers_count : null,
            'own_offer_status' => $ownOffer?->status,
            'expires_at' => $found->expires_at?->toIso8601String(),
            'created_at' => $found->created_at?->toIso8601String(),
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
    private function related(\Illuminate\Support\Collection $topics, ?string $exclude, bool $all = false): array
    {
        return $topics
            ->when($exclude, fn ($items) => $items->where('key', '!=', $exclude))
            // Misafirde yazma kutusu yok; gezinmenin tek yolu kartlar oldugu
            // icin kalanlarin hepsi gosterilir.
            ->when(! $all, fn ($items) => $items->take(4))
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
