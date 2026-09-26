<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Category;
use App\Models\District;
use App\Models\SellerListing;
use App\Models\SellerListingImage;
use App\Services\CategoryAttributeForm;
use App\Services\ImageShaper;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

/**
 * Saticinin vitrinindeki urun/ilanlar.
 *
 * Emlakci bir daireyi, galerici bir araci buraya koyar; kategoriye bagli
 * alanlar (Marka, Yil, KM / m2, Oda Sayisi, Isitma) taleplerle ayni
 * altyapidan gelir.
 */
class SellerListingController extends Controller
{
    private const DISK = 'local';

    /** Bir ilanda en fazla bu kadar fotograf. */
    private const MAX_IMAGES = 15;

    public function __construct(
        private readonly CategoryAttributeForm $attributeForm,
        private readonly ImageShaper $shaper,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $data = $request->validate([
            'status' => ['sometimes', Rule::in(['draft', 'published', 'sold', 'archived'])],
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:100'],
        ]);

        $items = SellerListing::query()
            ->where('user_id', $request->user()->id)
            ->when($data['status'] ?? null, fn ($q, $s) => $q->where('status', $s))
            ->with(['category', 'city', 'district', 'images'])
            ->withCount('offers')
            ->orderBy('sort_order')
            ->latest('id')
            ->paginate($data['per_page'] ?? 20);

        return response()->json([
            'data' => $items->getCollection()->map(fn (SellerListing $i) => self::present($i))->values(),
            'meta' => [
                'current_page' => $items->currentPage(),
                'last_page' => $items->lastPage(),
                'total' => $items->total(),
                'max_images' => self::MAX_IMAGES,
            ],
        ]);
    }

    /**
     * Teklife iliktirilebilecek ilanlar.
     *
     * Yalnizca yayindakiler; satilmis ya da taslak bir urun teklif
     * edilemez.
     */
    public function pickable(Request $request): JsonResponse
    {
        $items = SellerListing::query()
            ->where('user_id', $request->user()->id)
            ->published()
            ->with(['category', 'city', 'district', 'images'])
            ->orderBy('sort_order')
            ->latest('id')
            ->limit(60)
            ->get();

        return response()->json([
            'data' => $items->map(fn (SellerListing $i) => self::present($i))->values(),
        ]);
    }

    public function show(Request $request, SellerListing $sellerListing): JsonResponse
    {
        abort_unless($sellerListing->user_id === $request->user()->id, 403);

        $sellerListing->load(['category.attributes', 'city', 'district', 'images']);

        return response()->json(['data' => self::present($sellerListing, true)]);
    }

    public function store(Request $request): JsonResponse
    {
        [$temel, $kategori] = $this->validatedPayload($request);

        $cozum = $this->attributeForm->resolve($kategori, $request->input('attributes', []), 'listing');

        $listing = SellerListing::query()->create([
            'user_id' => $request->user()->id,
            'category_id' => $kategori->id,
            'city_id' => $temel['city_id'] ?? null,
            'district_id' => $temel['district_id'] ?? null,
            'public_reference' => $this->newReference(),
            'title' => $temel['title'],
            'description' => $temel['description'],
            'price' => $temel['price'] ?? null,
            'attributes' => $cozum['attributes'],
            'attribute_schema_snapshot' => $cozum['snapshot'],
            // Yeni ilan taslak baslar: fotograf eklenmeden vitrine
            // dusmesin.
            'status' => 'draft',
        ]);

        $listing->load(['category', 'city', 'district', 'images']);

        return response()->json([
            'message' => 'İlan oluşturuldu. Fotoğraf ekledikten sonra yayınlayabilirsiniz.',
            'data' => self::present($listing, true),
        ], 201);
    }

    public function update(Request $request, SellerListing $sellerListing): JsonResponse
    {
        abort_unless($sellerListing->user_id === $request->user()->id, 403);

        [$temel, $kategori] = $this->validatedPayload($request);
        $cozum = $this->attributeForm->resolve($kategori, $request->input('attributes', []), 'listing');

        $sellerListing->update([
            'category_id' => $kategori->id,
            'city_id' => $temel['city_id'] ?? null,
            'district_id' => $temel['district_id'] ?? null,
            'title' => $temel['title'],
            'description' => $temel['description'],
            'price' => $temel['price'] ?? null,
            'attributes' => $cozum['attributes'],
            'attribute_schema_snapshot' => $cozum['snapshot'],
        ]);

        $sellerListing->load(['category', 'city', 'district', 'images']);

        return response()->json([
            'message' => 'İlan güncellendi.',
            // Gecmis teklifler etkilenmez: teklif, verildigi andaki urun
            // bilgisini kendi icinde tasiyor.
            'data' => self::present($sellerListing, true),
        ]);
    }

    /** Yayina alma / geri cekme / satildi isaretleme. */
    public function setStatus(Request $request, SellerListing $sellerListing): JsonResponse
    {
        abort_unless($sellerListing->user_id === $request->user()->id, 403);

        $data = $request->validate([
            'status' => ['required', Rule::in(['draft', 'published', 'sold', 'archived'])],
        ]);

        if (in_array($data['status'], ['archived', 'draft'], true)) {
            $this->guardAccepted($sellerListing);
        }

        if ($data['status'] === 'published' && $sellerListing->images()->count() === 0) {
            return response()->json([
                'message' => 'Yayınlamadan önce en az bir fotoğraf ekleyin.',
            ], 422);
        }

        $sellerListing->update(['status' => $data['status']]);

        return response()->json([
            'message' => match ($data['status']) {
                'published' => 'İlan yayına alındı.',
                'sold' => 'İlan satıldı olarak işaretlendi.',
                'archived' => 'İlan arşivlendi.',
                default => 'İlan taslağa alındı.',
            },
            'data' => ['status' => $sellerListing->status],
        ]);
    }

    public function destroy(Request $request, SellerListing $sellerListing): JsonResponse
    {
        abort_unless($sellerListing->user_id === $request->user()->id, 403);
        $this->guardAccepted($sellerListing);

        foreach ($sellerListing->images as $gorsel) {
            Storage::disk(self::DISK)->delete($gorsel->path);
        }

        // Tekliflerdeki baglanti null'a duser ama anlik goruntu kalir;
        // alici kabul ettigi urunu gormeye devam eder.
        $sellerListing->delete();

        return response()->json(['message' => 'İlan silindi.']);
    }

    /**
     * Alicinin kabul ettigi bir urun ortadan kaldirilamaz.
     *
     * Teklif anlik goruntuyu kendi icinde tasidigi icin alici ne kabul
     * ettigini gormeye devam eder, ama satilmis bir anlasmanin urununu
     * vitrinden silmek ya da taslaga cekmek alicinin ilan sayfasini
     * koparir. Satildi olarak isaretlemek serbest.
     */
    private function guardAccepted(SellerListing $listing): void
    {
        $kabul = $listing->offers()->where('status', 'accepted')->exists();

        abort_if(
            $kabul,
            422,
            'Bu ürün kabul edilmiş bir teklife bağlı; kaldırılamaz. Satıldı olarak işaretleyebilirsiniz.',
        );
    }

    public function uploadImage(Request $request, SellerListing $sellerListing): JsonResponse
    {
        abort_unless($sellerListing->user_id === $request->user()->id, 403);
        abort_if(
            $sellerListing->images()->count() >= self::MAX_IMAGES,
            422,
            'Bir ilana en fazla '.self::MAX_IMAGES.' fotoğraf eklenebilir.',
        );

        $request->validate([
            'image' => ['required', 'image', 'mimes:jpeg,jpg,png,webp', 'max:8192'],
        ]);

        $ham = (string) file_get_contents($request->file('image')->getRealPath());
        $sekilli = $this->shaper->shape($ham, 'listing');

        if ($sekilli === null) {
            return response()->json(['message' => 'Görsel okunamadı. Farklı bir dosya deneyin.'], 422);
        }

        $yol = "listing-images/{$sellerListing->id}/".bin2hex(random_bytes(8)).'.jpg';
        Storage::disk(self::DISK)->put($yol, $sekilli);

        // Sira tahsisi oku-sonra-yaz; panelde birden cok dosya ayni anda
        // yuklenebildigi icin iki istek ayni sirayi alabilirdi. Kapak
        // indeksi benzersiz oldugundan bu artik veritabani hatasi
        // demek; ilan satiri kilitlenerek istekler siraya aliniyor.
        $gorsel = DB::transaction(function () use ($sellerListing, $yol) {
            SellerListing::query()->whereKey($sellerListing->id)->lockForUpdate()->first();

            $mevcut = SellerListingImage::query()
                ->where('seller_listing_id', $sellerListing->id)
                ->max('sort_order');

            return SellerListingImage::query()->create([
                'seller_listing_id' => $sellerListing->id,
                'path' => $yol,
                // Ilk fotograf kapak olsun diye sifirdan baslar.
                'sort_order' => $mevcut === null ? 0 : (int) $mevcut + 1,
            ]);
        });

        return response()->json([
            'message' => 'Fotoğraf eklendi.',
            'data' => ['id' => $gorsel->id, 'url' => $gorsel->url],
        ], 201);
    }

    public function destroyImage(Request $request, SellerListingImage $sellerListingImage): JsonResponse
    {
        abort_unless($sellerListingImage->listing->user_id === $request->user()->id, 403);

        Storage::disk(self::DISK)->delete($sellerListingImage->path);
        $sellerListingImage->delete();

        return response()->json(['message' => 'Fotoğraf kaldırıldı.']);
    }

    /** Kapak fotografini degistirir: secilen gorsel sifirinci siraya gecer. */
    public function makeCover(Request $request, SellerListingImage $sellerListingImage): JsonResponse
    {
        $listing = $sellerListingImage->listing;
        abort_unless($listing->user_id === $request->user()->id, 403);

        // Once digerleri bir kayar (sifirdaki bire cikar), sonra secilen
        // sifira iner. Kapak indeksi benzersiz oldugu icin sira onemli
        // ve ikisi tek islemde olmali.
        DB::transaction(function () use ($listing, $sellerListingImage) {
            SellerListingImage::query()
                ->where('seller_listing_id', $listing->id)
                ->whereKeyNot($sellerListingImage->id)
                ->increment('sort_order');

            $sellerListingImage->update(['sort_order' => 0]);
        });

        return response()->json(['message' => 'Kapak fotoğrafı güncellendi.']);
    }

    /**
     * Ilan kartinin ortak gosterimi.
     *
     * $full true ise aciklama ve ozellik tablosu da gelir; liste
     * ekranlarinda bunlar tasinmaz.
     *
     * $public true ise yonetim alanlari (durum, teklif sayisi) duser.
     *
     * @return array<string, mixed>
     */
    public static function present(SellerListing $listing, bool $full = false, bool $public = false): array
    {
        $temel = [
            'id' => $listing->id,
            'reference' => $listing->public_reference,
            'title' => $listing->title,
            'price' => $listing->price,
            'cover_url' => $listing->cover_url,
            'category' => $listing->category ? [
                'id' => $listing->category->id,
                'name' => $listing->category->name,
                'slug' => $listing->category->slug,
                'icon' => $listing->category->icon,
            ] : null,
            'location' => [
                'city' => $listing->city?->name,
                'district' => $listing->district?->name,
                // Id'ler duzenleme formunun secim kutularini doldurmak
                // icin; ada gore eslestirmek yonetici bir sehri yeniden
                // adlandirdiginda sessizce bos secim birakiyordu.
                'city_id' => $listing->city_id,
                'district_id' => $listing->district_id,
            ],
            'image_count' => $listing->relationLoaded('images')
                ? $listing->images->count()
                : $listing->images()->count(),
            'created_at' => $listing->created_at?->toIso8601String(),
        ];

        // Yonetim alanlari yalnizca saticinin kendi ekraninda. Alici
        // bir ilanin taslak mi oldugunu ya da kac teklifte kullanildigini
        // bilmek zorunda degil.
        if (! $public) {
            $temel['status'] = $listing->status;
            $temel['offer_count'] = (int) ($listing->offers_count ?? 0);
        }

        if (! $full) {
            return $temel;
        }

        return $temel + [
            'description' => $listing->description,
            'images' => $listing->images->map(fn (SellerListingImage $g) => [
                'id' => $g->id,
                'url' => $g->url,
            ])->values(),
            'attributes' => self::attributeRows($listing),
        ];
    }

    /**
     * Sahibinden'deki ozellik tablosunun satirlari.
     *
     * Etiketler kayittaki sema anlik goruntusunden okunur, kategorinin
     * guncel halinden degil: yonetici bir alani sonradan yeniden
     * adlandirsa bile eski ilan tutarli gorunur.
     *
     * @return array<int, array<string, mixed>>
     */
    private static function attributeRows(SellerListing $listing): array
    {
        $degerler = collect($listing->attributes ?? []);

        return collect($listing->attribute_schema_snapshot ?? [])
            // is_private alanlar ilanda gosterilmez; bunlar talep
            // tarafinda alicinin ozel notlari icin tanimlanmis olabilir.
            ->reject(fn ($alan) => ($alan['is_private'] ?? false))
            ->filter(fn ($alan) => $degerler->has($alan['key']) && $degerler->get($alan['key']) !== null)
            ->map(fn ($alan) => [
                'key' => $alan['key'],
                'label' => $alan['label'],
                'value' => $degerler->get($alan['key']),
                'unit' => $alan['unit'] ?? null,
            ])->values()->all();
    }

    /**
     * Ortak dogrulama; kategori nesnesiyle birlikte doner.
     *
     * @return array{0: array<string, mixed>, 1: Category}
     */
    private function validatedPayload(Request $request): array
    {
        $temel = $request->validate([
            'category_slug' => ['required', 'string', 'exists:categories,slug'],
            'title' => ['required', 'string', 'min:10', 'max:140'],
            'description' => ['required', 'string', 'min:20', 'max:5000'],
            // Fiyat istege bagli: "fiyat sorunuz" diyen ilanlar var.
            'price' => ['nullable', 'numeric', 'min:0', 'max:9999999999'],
            'city_id' => ['nullable', 'integer', 'exists:cities,id'],
            'district_id' => ['nullable', 'integer', 'exists:districts,id'],
            'attributes' => ['present', 'array'],
        ]);

        $kategori = Category::query()
            ->where('slug', $temel['category_slug'])
            ->where('is_active', true)
            ->with('attributes')
            ->firstOrFail();

        if (! empty($temel['district_id'])) {
            $uyumlu = District::query()
                ->whereKey($temel['district_id'])
                ->where('city_id', $temel['city_id'] ?? 0)
                ->where('is_active', true)
                ->exists();

            Validator::make(
                ['district_id' => $uyumlu],
                ['district_id' => ['accepted']],
                ['district_id.accepted' => 'Seçilen ilçe seçilen şehre ait değil.'],
            )->validate();
        }

        return [$temel, $kategori];
    }

    private function newReference(): string
    {
        do {
            $referans = 'ALC-URN-'.Str::upper(Str::random(8));
        } while (SellerListing::query()->where('public_reference', $referans)->exists());

        return $referans;
    }
}
