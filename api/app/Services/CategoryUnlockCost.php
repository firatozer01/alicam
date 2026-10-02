<?php

namespace App\Services;

use App\Models\Category;
use App\Models\CategoryCreditCost;
use Illuminate\Support\Facades\Cache;

/**
 * Bir kategorinin GECERLI kilit acma bedeli.
 *
 * Bedel kaydi yalnizca KOK kategorilerde tutuluyor; yonetim panelindeki
 * kategori ekrani da zaten yalnizca koklari listeliyor. Alici ise talebini
 * her zaman bir ALT kategoriye acar. Bedel ustten miras alinmayinca alt
 * kategorideki her talep bedelsiz aciliyordu: canlidaki 47 gercek talebin
 * tamami 0 krediydi ve 15 tanesi bedava acilmisti. Urunun tek gelir kalemi
 * fiilen kapaliydi.
 *
 * Burada her kategori icin EN YAKIN ustteki kayit bulunur. Agac uc kademe:
 * 21 kok, 312 orta, 5356 yaprak.
 */
class CategoryUnlockCost
{
    private const CACHE_KEY = 'category-unlock-costs';

    private const CACHE_TTL = 300;

    /**
     * Kategori kimligi -> gecerli bedel.
     *
     * Tablonun tamami tek seferde cozulup onbellege alinir. Talep listeleri
     * sayfa basina onlarca kategori gosteriyor; kategori basina sorgu acmak
     * yerine iki sorguyla tum agacin cevabi hazirlanir.
     *
     * @return array<int, int>
     */
    public static function map(): array
    {
        return Cache::remember(self::CACHE_KEY, self::CACHE_TTL, function (): array {
            $kayitli = [];

            foreach (CategoryCreditCost::query()->select(['category_id', 'unlock_cost'])->cursor() as $satir) {
                $kayitli[(int) $satir->category_id] = (int) $satir->unlock_cost;
            }

            $ebeveyn = [];

            foreach (Category::query()->select(['id', 'parent_id'])->cursor() as $satir) {
                $ebeveyn[(int) $satir->id] = $satir->parent_id === null ? null : (int) $satir->parent_id;
            }

            $cozum = [];

            foreach (array_keys($ebeveyn) as $kimlik) {
                self::coz($kimlik, $kayitli, $ebeveyn, $cozum);
            }

            return $cozum;
        });
    }

    public static function forCategory(?Category $category): int
    {
        return self::forId($category?->getKey());
    }

    public static function forId(int|string|null $categoryId): int
    {
        if ($categoryId === null) {
            return 0;
        }

        return self::map()[(int) $categoryId] ?? 0;
    }

    /**
     * Yonetici bir kategorinin bedelini degistirdiginde cagrilir.
     */
    public static function forget(): void
    {
        Cache::forget(self::CACHE_KEY);
    }

    /**
     * Kendi kaydi varsa onu, yoksa ustunun cozumunu dondurur.
     *
     * @param  array<int, int>  $kayitli
     * @param  array<int, int|null>  $ebeveyn
     * @param  array<int, int>  $cozum
     */
    private static function coz(int $kimlik, array $kayitli, array $ebeveyn, array &$cozum): int
    {
        if (array_key_exists($kimlik, $cozum)) {
            return $cozum[$kimlik];
        }

        // Bozuk veri yuzunden ebeveyn zinciri kendine donerse sonsuz
        // dongude kalmayalim: once 0 yazilir, cozum bulununca uzerine gelir.
        $cozum[$kimlik] = 0;

        if (array_key_exists($kimlik, $kayitli)) {
            return $cozum[$kimlik] = $kayitli[$kimlik];
        }

        $ust = $ebeveyn[$kimlik] ?? null;

        if ($ust === null) {
            return $cozum[$kimlik] = 0;
        }

        return $cozum[$kimlik] = self::coz($ust, $kayitli, $ebeveyn, $cozum);
    }
}
