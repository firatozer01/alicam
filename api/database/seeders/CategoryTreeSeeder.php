<?php

namespace Database\Seeders;

use App\Models\Category;
use App\Support\CategoryTree;
use Illuminate\Support\Facades\Cache;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

/**
 * Kategori agacini database/data/categories.json dosyasindan kurar.
 *
 * Dosya, armut.com'un herkese acik hizmet katalogundan ve sahibinden.com'un
 * robots.txt ile ilan edilen kategori sitemap'lerinden cikarilan yapinin
 * alicam semasina uyarlanmis halidir.
 *
 * Seeder idempotenttir: slug uzerinden updateOrCreate calisir, mevcut
 * kategorilerin id'lerini korur, var olan talepleri bozmaz.
 */
class CategoryTreeSeeder extends Seeder
{
    private const FINGERPRINT_KEY = 'category-tree:fingerprint';

    /** @var array<string, int> slug => id */
    private array $created = [];

    private int $attributeCount = 0;

    public function run(): void
    {
        $path = database_path('data/categories.json');

        if (! is_file($path)) {
            $this->command?->warn('categories.json bulunamadi, kategori agaci atlandi.');

            return;
        }

        $raw = file_get_contents($path);
        $fingerprint = md5($raw);

        // Konteyner her acilista db:seed calistiriyor. Agac 5.600 satir oldugu
        // icin bu her seferinde dakikalar suruyor ve es zamanli iki seeder
        // birbirini kilitleyebiliyor. Dosya degismediyse is atlanir.
        if (Cache::get(self::FINGERPRINT_KEY) === $fingerprint && Category::query()->count() > 100) {
            $this->command?->info('Kategori agaci guncel, atlandi.');

            return;
        }

        $verticals = json_decode($raw, true, flags: JSON_THROW_ON_ERROR);

        DB::transaction(function () use ($verticals): void {
            foreach ($verticals as $order => $vertical) {
                $this->seedVertical($vertical, $order + 1);
            }
        });

        $this->retireLegacyRoots();

        Cache::forever(self::FINGERPRINT_KEY, $fingerprint);

        // Soy zinciri onbellegi agac degistigi icin bosaltilir.
        CategoryTree::forget();

        $this->command?->info(sprintf(
            'Kategori agaci hazir: %d kategori, %d alan.',
            count($this->created),
            $this->attributeCount,
        ));
    }

    /**
     * Ilk surumun uc genel kategorisi (hizmet, nakliye, tadilat) yeni agacla
     * ayni listede iki kez gorunmesin diye pasife alinir. Satir silinmez:
     * mevcut talepler ve satici abonelikleri bu id'lere bagli.
     */
    private function retireLegacyRoots(): void
    {
        if (count($this->created) < 10) {
            return; // Agac kurulmadiysa eskisi tek secenek olarak kalmali.
        }

        foreach (['hizmet', 'nakliye', 'tadilat'] as $slug) {
            if (isset($this->created[$slug])) {
                continue; // Yeni agac ayni slug'i kullaniyorsa dokunma.
            }

            Category::query()
                ->where('slug', $slug)
                ->whereNull('parent_id')
                ->update(['is_active' => false]);
        }
    }

    /**
     * @param  array<string, mixed>  $vertical
     */
    private function seedVertical(array $vertical, int $sortOrder): void
    {
        $main = $vertical['main'];

        $root = $this->upsert(
            slug: $main['slug'],
            name: $main['name'],
            kind: $main['kind'] ?? 'service',
            icon: $main['icon'] ?? null,
            color: $main['color'] ?? null,
            parentId: null,
            sortOrder: $sortOrder,
        );

        $root->creditCost()->updateOrCreate([], [
            'unlock_cost' => max(1, min(20, (int) ($main['unlock_cost'] ?? 3))),
        ]);

        $this->syncAttributes($root, $vertical['main_attributes'] ?? []);

        foreach ($vertical['subcategories'] ?? [] as $subOrder => $sub) {
            $branch = $this->upsert(
                slug: $this->childSlug($main['slug'], $sub['slug']),
                name: $sub['name'],
                kind: $main['kind'] ?? 'service',
                icon: $sub['icon'] ?? $main['icon'] ?? null,
                color: $main['color'] ?? null,
                parentId: $root->id,
                sortOrder: $subOrder + 1,
            );

            $this->syncAttributes($branch, $sub['attributes'] ?? []);

            foreach ($sub['leaves'] ?? [] as $leafOrder => $leaf) {
                $this->upsert(
                    slug: $this->childSlug($branch->slug, $leaf['slug']),
                    name: $leaf['name'],
                    kind: $main['kind'] ?? 'service',
                    icon: $sub['icon'] ?? $main['icon'] ?? null,
                    color: $main['color'] ?? null,
                    parentId: $branch->id,
                    sortOrder: $leafOrder + 1,
                );
            }
        }
    }

    /**
     * Cocuk slug'i ebeveynle on eklenir: farkli dikeylerde ayni isim
     * ("diger", "satilik") cakismasin, slug tablo genelinde benzersiz kalsin.
     */
    private function childSlug(string $parentSlug, string $ownSlug): string
    {
        $slug = str_starts_with($ownSlug, $parentSlug.'-') ? $ownSlug : $parentSlug.'-'.$ownSlug;

        if (strlen($slug) <= 90) {
            return $slug;
        }

        // 90 karakter siniri: kuyruga kisa bir ozet eklenerek benzersizlik korunur.
        return substr($slug, 0, 82).'-'.substr(md5($slug), 0, 7);
    }

    private function upsert(
        string $slug,
        string $name,
        string $kind,
        ?string $icon,
        ?string $color,
        ?int $parentId,
        int $sortOrder,
    ): Category {
        $category = Category::query()->updateOrCreate(
            ['slug' => $slug],
            [
                'parent_id' => $parentId,
                'name' => mb_substr($name, 0, 80),
                'kind' => $kind,
                'icon' => $icon,
                'color' => $color,
                'is_active' => true,
                'sort_order' => $sortOrder,
            ],
        );

        $this->created[$slug] = $category->id;

        return $category;
    }

    /**
     * @param  array<int, array<string, mixed>>  $attributes
     */
    private function syncAttributes(Category $category, array $attributes): void
    {
        foreach ($attributes as $order => $attribute) {
            if (empty($attribute['key']) || empty($attribute['label']) || empty($attribute['type'])) {
                continue;
            }

            $options = $attribute['options'] ?? null;

            // Secenekli tiplerde bos liste kullanilamaz: alan serbest metne duser.
            $type = $attribute['type'];
            if (in_array($type, ['select', 'multiselect'], true) && empty($options)) {
                $type = 'text';
                $options = null;
            }

            $category->attributes()->updateOrCreate(
                ['key' => $attribute['key']],
                [
                    'label' => mb_substr($attribute['label'], 0, 120),
                    'type' => $type,
                    'options' => $options ?: null,
                    'unit' => $attribute['unit'] ?? null,
                    'help_text' => isset($attribute['help_text'])
                        ? mb_substr($attribute['help_text'], 0, 255)
                        : null,
                    'is_required' => (bool) ($attribute['is_required'] ?? false),
                    'is_filterable' => (bool) ($attribute['is_filterable'] ?? false),
                    'show_in_summary' => (bool) ($attribute['show_in_summary'] ?? true),
                    'sort_order' => $order + 1,
                ],
            );

            $this->attributeCount++;
        }
    }
}
