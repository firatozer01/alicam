<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Category;
use App\Services\AppSettings;
use App\Services\CategoryImage;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Storage;

/**
 * Anasayfanin yonetim panelinden duzenlenmesi.
 *
 * Iki ayri sey yonetiliyor:
 *  - cerceve metinleri (baslik, alt baslik, arama ipucu) -> app_settings
 *  - hizmet kartlarinin fotograflari -> categories.image_path
 *
 * Basliklarin kendisi kategori agacindan geliyor ve buradan degistirilmiyor;
 * onlar AdminCategoryController'in isi.
 */
class AdminHomeController extends Controller
{
    private const DISK = 'local';

    /** Katalog onbellegi bu sayaci tasir; gorsel degisince artirilir. */
    public const VERSION_KEY = 'service-catalog:version';

    public function show(): JsonResponse
    {
        return response()->json([
            'data' => [
                'copy' => $this->copy(),
                'pinned' => $this->pinned(),
                'categories' => $this->inventory(),
            ],
            'meta' => [
                'with_image' => Category::query()->whereNotNull('image_path')->count(),
                'total' => $this->inventoryQuery()->count(),
            ],
        ]);
    }

    public function update(Request $request): JsonResponse
    {
        $data = $request->validate([
            'copy' => ['sometimes', 'array'],
            'copy.hero_title' => ['sometimes', 'string', 'max:120'],
            'copy.hero_accent' => ['sometimes', 'string', 'max:120'],
            'copy.hero_placeholder' => ['sometimes', 'string', 'max:200'],
            'copy.popular_title' => ['sometimes', 'string', 'max:120'],
            'copy.popular_subtitle' => ['sometimes', 'string', 'max:60'],
            'copy.trending_title' => ['sometimes', 'string', 'max:120'],
            'copy.trending_subtitle' => ['sometimes', 'string', 'max:60'],
            'copy.groups_title' => ['sometimes', 'string', 'max:120'],
            'copy.groups_subtitle' => ['sometimes', 'string', 'max:60'],
            'copy.listing_title' => ['sometimes', 'string', 'max:120'],
            'copy.listing_subtitle' => ['sometimes', 'string', 'max:60'],
            'pinned' => ['sometimes', 'array', 'max:24'],
            'pinned.*' => ['string', 'max:190'],
        ]);

        $yazilacak = [];

        foreach ($data['copy'] ?? [] as $anahtar => $deger) {
            $yazilacak['home.'.$anahtar] = trim($deger);
        }

        if (array_key_exists('pinned', $data)) {
            // Var olmayan slug panele geri donmesin diye burada elenir;
            // aksi halde yanlis yazilan bir slug sessizce kayitli kalir.
            $gecerli = Category::query()
                ->whereIn('slug', $data['pinned'])
                ->pluck('slug')
                ->all();

            $sirali = array_values(array_intersect($data['pinned'], $gecerli));

            $yazilacak['home.popular_pinned'] = implode(',', $sirali);
        }

        AppSettings::put($yazilacak);
        $this->bump();

        return response()->json([
            'message' => 'Anasayfa güncellendi.',
            'data' => ['copy' => $this->copy(), 'pinned' => $this->pinned()],
        ]);
    }

    /** Yoneticinin kendi yukledigi kapak. */
    public function uploadImage(Request $request, Category $category): JsonResponse
    {
        $request->validate([
            'image' => ['required', 'image', 'mimes:jpg,jpeg,png,webp', 'max:4096'],
        ]);

        $this->forget($category);

        // Yuklenen dosya oldugu gibi saklanmaz: 4 MB'lik bir fotograf
        // anasayfaya oldugu gibi giderdi. Indirilen kapaklarla ayni
        // olcuden gecirilir.
        $yol = app(CategoryImage::class)->store(
            (string) file_get_contents($request->file('image')->getRealPath()),
            $category->id,
        );

        $category->update([
            'image_path' => $yol,
            'image_credit' => 'Panelden yüklendi',
            'image_source' => null,
        ]);

        $this->bump();

        return response()->json([
            'message' => 'Görsel yüklendi.',
            'data' => $this->present($category->refresh()),
        ]);
    }

    /** Tek bir kategori icin Commons'tan otomatik gorsel cekmeyi dener. */
    public function fetchImage(Category $category): JsonResponse
    {
        $cikti = Artisan::call('categories:fetch-images', [
            '--only' => $category->slug,
            '--force' => true,
        ]);

        $category->refresh();

        if ($category->image_path === null) {
            return response()->json([
                'message' => 'Bu başlık için uygun görsel bulunamadı. Elle yükleyebilirsiniz.',
                'data' => $this->present($category),
            ], 422);
        }

        $this->bump();

        return response()->json([
            'message' => 'Görsel bulundu ve kaydedildi.',
            'data' => $this->present($category),
            'meta' => ['exit_code' => $cikti],
        ]);
    }

    public function destroyImage(Category $category): JsonResponse
    {
        $this->forget($category);

        $category->update([
            'image_path' => null,
            'image_credit' => null,
            'image_source' => null,
        ]);

        $this->bump();

        return response()->json([
            'message' => 'Görsel kaldırıldı.',
            'data' => $this->present($category),
        ]);
    }

    /**
     * Anasayfada gosterilen birimler: kokler ve 2. seviye hizmet basliklari.
     */
    private function inventoryQuery()
    {
        return Category::query()
            ->where('is_active', true)
            ->where(fn ($q) => $q
                ->whereNull('parent_id')
                ->orWhereHas('parent', fn ($p) => $p->whereNull('parent_id')->where('kind', 'service')));
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function inventory(): array
    {
        return $this->inventoryQuery()
            ->with('parent:id,name')
            ->orderBy('sort_order')
            ->get(['id', 'parent_id', 'slug', 'name', 'icon', 'color', 'image_path', 'image_credit', 'image_source'])
            ->map(fn (Category $c) => $this->present($c))
            ->all();
    }

    /**
     * @return array<string, mixed>
     */
    private function present(Category $category): array
    {
        return [
            'id' => $category->id,
            'slug' => $category->slug,
            'name' => $category->name,
            'icon' => $category->icon,
            'color' => $category->color,
            'parent' => $category->parent?->name,
            'image_url' => $category->image_path ? "/api/category-images/{$category->id}" : null,
            'image_credit' => $category->image_credit,
            'image_source' => $category->image_source,
        ];
    }

    /**
     * @return array<string, string>
     */
    private function copy(): array
    {
        $out = [];

        foreach (AppSettings::EDITABLE as $anahtar => $varsayilan) {
            if (! str_starts_with($anahtar, 'home.') || $anahtar === 'home.popular_pinned') {
                continue;
            }

            $out[substr($anahtar, 5)] = AppSettings::get($anahtar, $varsayilan) ?? '';
        }

        return $out;
    }

    /**
     * @return array<int, string>
     */
    private function pinned(): array
    {
        $ham = AppSettings::get('home.popular_pinned', '') ?? '';

        return array_values(array_filter(array_map('trim', explode(',', $ham))));
    }

    /** Eski dosyayi diskte birakmayiz; kapak degisince yer kaplar. */
    private function forget(Category $category): void
    {
        if ($category->image_path && Storage::disk(self::DISK)->exists($category->image_path)) {
            Storage::disk(self::DISK)->delete($category->image_path);
        }
    }

    /**
     * Katalog onbellegini gecersizlestirir.
     *
     * Metin degisiklikleri onbellek anahtarindaki ozete zaten yansiyor
     * ama gorsel degisikligi yansimiyor; sayac ikisini de kapsiyor.
     */
    private function bump(): void
    {
        AppSettings::forget();
        Cache::increment(self::VERSION_KEY) ?: Cache::forever(self::VERSION_KEY, 1);
    }
}
