<?php

namespace App\Support;

use App\Models\Category;
use Illuminate\Support\Facades\Cache;

/**
 * Kategori agaci artik uc seviyeli (kok -> alt kategori -> yaprak). Eslesme ve
 * filtreleme bu yuzden tek bir id'ye degil soy zincirine bakmak zorunda:
 * "Temizlik Hizmetleri"ne abone bir satici "Ev Temizligi" talebini gormeli.
 */
class CategoryTree
{
    private const CACHE_KEY = 'category-tree:parents';

    private const CACHE_TTL = 300;

    /**
     * Bir kategorinin kendisi ve tum ust kategorileri.
     *
     * @return array<int, int>
     */
    public static function ancestors(int $categoryId): array
    {
        $parents = self::parentMap();
        $chain = [$categoryId];
        $current = $categoryId;
        $guard = 0;

        while (isset($parents[$current]) && $parents[$current] !== null && $guard++ < 10) {
            $current = $parents[$current];
            $chain[] = $current;
        }

        return array_values(array_unique($chain));
    }

    /**
     * Bir kategorinin kendisi ve tum alt kategorileri.
     *
     * @return array<int, int>
     */
    public static function descendants(int $categoryId): array
    {
        $children = [];
        foreach (self::parentMap() as $id => $parentId) {
            if ($parentId !== null) {
                $children[$parentId][] = $id;
            }
        }

        $out = [];
        $stack = [$categoryId];
        $guard = 0;

        while ($stack && $guard++ < 10000) {
            $id = array_pop($stack);
            if (isset($out[$id])) {
                continue;
            }
            $out[$id] = true;
            foreach ($children[$id] ?? [] as $child) {
                $stack[] = $child;
            }
        }

        return array_keys($out);
    }

    /**
     * Slug'dan baslayarak kendisi ve alt kategorilerinin id listesi.
     *
     * @return array<int, int>
     */
    public static function descendantsOfSlug(string $slug): array
    {
        $id = Category::query()->where('slug', $slug)->value('id');

        return $id ? self::descendants((int) $id) : [];
    }

    /**
     * Bir kategorinin gecerli alan seti: ust kategorilerden mirasla birlesik.
     * Ayni key alt kategoride yeniden tanimlanirsa alttaki kazanir.
     *
     * @return \Illuminate\Support\Collection<int, \App\Models\CategoryAttribute>
     */
    public static function effectiveAttributes(Category $category): \Illuminate\Support\Collection
    {
        $ids = array_reverse(self::ancestors($category->id));

        return Category::query()
            ->whereIn('id', $ids)
            ->with('attributes')
            ->get()
            ->sortBy(fn (Category $node) => array_search($node->id, $ids, true))
            ->flatMap(fn (Category $node) => $node->attributes)
            ->keyBy('key')
            ->values();
    }

    /**
     * Iki kategori ayni soy hattinda mi: biri digerinin ustu ya da kendisi mi.
     */
    public static function related(int $a, int $b): bool
    {
        return in_array($b, self::ancestors($a), true)
            || in_array($a, self::ancestors($b), true);
    }

    /**
     * @return array<int, int|null> id => parent_id
     */
    private static function parentMap(): array
    {
        return Cache::remember(
            self::CACHE_KEY,
            self::CACHE_TTL,
            fn () => Category::query()->pluck('parent_id', 'id')->all(),
        );
    }

    public static function forget(): void
    {
        Cache::forget(self::CACHE_KEY);
    }
}
