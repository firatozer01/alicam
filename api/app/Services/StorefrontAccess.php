<?php

namespace App\Services;

use App\Models\Offer;
use App\Models\User;

/**
 * Bir vitrini kimin gorebildigi.
 *
 * Kural isin kendisinden geliyor: alicilar hizmet verenleri gezmiyor.
 * Bir saticinin vitrini ancak o satici aliciya TEKLIF VERDIKTEN sonra
 * o aliciya acilir — "bana teklif veren bu firma kimmis" sorusunu
 * yanitlamak icin.
 *
 * Ayri bir servis olmasinin sebebi: ayni karar artik uc yerde
 * veriliyor (vitrin JSON'u, ilan gorselleri, ilan detayi). Kapinin
 * yalnizca JSON'da durup gorsellerde durmamasi, kapinin hic olmamasi
 * demekti.
 */
class StorefrontAccess
{
    /** @var array<string, bool> istek boyunca karar onbellegi */
    private array $bellek = [];

    public function allows(?User $viewer, User|int $seller): bool
    {
        if ($viewer === null) {
            return false;
        }

        $saticiId = $seller instanceof User ? $seller->id : $seller;
        $anahtar = "{$viewer->id}:{$saticiId}";

        // Bir ilan galerisi tek sayfada onlarca gorsel istegi aciyor;
        // ayni karari her seferinde veritabanina sormuyoruz.
        if (array_key_exists($anahtar, $this->bellek)) {
            return $this->bellek[$anahtar];
        }

        return $this->bellek[$anahtar] = $this->decide($viewer, $saticiId);
    }

    private function decide(User $viewer, int $saticiId): bool
    {
        if ($viewer->id === $saticiId || $viewer->hasRole('admin')) {
            return true;
        }

        // Bu hizmet veren, ziyaretcinin taleplerinden birine teklif
        // vermis mi. Teklifin durumuna bakilmiyor: reddedilmis bir
        // teklif de "bu firma bana ulasti" demektir.
        return Offer::query()
            ->where('offers.seller_id', $saticiId)
            ->whereExists(fn ($query) => $query
                ->selectRaw('1')
                ->from('requests')
                ->whereColumn('requests.id', 'offers.request_id')
                ->where('requests.user_id', $viewer->id))
            ->exists();
    }
}
