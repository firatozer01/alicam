<?php

namespace App\Services;

use Illuminate\Support\Facades\Storage;

/**
 * Kategori kapak fotograflarini kart olcusune indirip diske yazar.
 *
 * Iki yerden cagriliyor: Commons/Openverse/Pexels'ten indirilen dosyalar
 * (FetchCategoryImages) ve yoneticinin panelden yukledigi dosyalar
 * (AdminHomeController). Ikisi de ayni olcuden gecsin ki anasayfa yukunun
 * ne oldugu tek bir sabite baksin.
 *
 * Sekillendirmenin kendisi ImageShaper'da; burasi yalnizca kategoriye
 * ozel yol ve preset secimi.
 */
class CategoryImage
{
    private const DISK = 'local';

    public function __construct(
        private readonly ImageShaper $shaper,
    ) {}

    /**
     * Ham baytlari kucultup diske yazar ve yolu doner.
     *
     * Cozulemeyen dosyada ham hali yazilir: bir kapak ugruna islemi
     * bastan bosa dusurmenin anlami yok, gorsel yine de gosterilebilir.
     */
    public function store(string $bytes, int $categoryId): string
    {
        $yol = "category-images/{$categoryId}.jpg";

        Storage::disk(self::DISK)->put($yol, $this->shaper->shape($bytes, 'category') ?? $bytes);

        return $yol;
    }
}
