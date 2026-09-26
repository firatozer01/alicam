<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class OfferResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $profile = $this->seller->sellerProfile;
        $data = [
            'id' => $this->id,
            'request_id' => $this->request_id,
            'price' => $this->price,
            'message' => $this->message,
            'status' => $this->status,
            'seller' => [
                'id' => $this->seller->id,
                'name' => $this->seller->name,
                'company_name' => $profile?->company_name,
                'profile_type' => $profile?->profile_type,
                'description' => $profile?->description,
                // Teklifi veren taraf aliciya zaten aciktir: teklif
                // vermek vitrini o aliciya acan eylem.
                'avatar_url' => $this->seller->avatar_url,
                'logo_url' => $profile?->logo_url,
            ],
            'listing' => $this->listingBlock(),
            'reviewed_at' => $this->reviewed_at?->toIso8601String(),
            'accepted_at' => $this->accepted_at?->toIso8601String(),
            'created_at' => $this->created_at->toIso8601String(),
            'updated_at' => $this->updated_at->toIso8601String(),
        ];

        if ($this->status === 'accepted') {
            $data['seller']['contact'] = [
                'email' => $this->seller->email,
                'phone' => $this->seller->phone,
            ];
        }

        if ($this->relationLoaded('review')) {
            $data['review'] = $this->review ? [
                'rating' => $this->review->rating,
                'comment' => $this->review->comment,
                'created_at' => $this->review->created_at->toIso8601String(),
            ] : null;
        }

        return $data;
    }

    /**
     * Teklife iliktirilen urun.
     *
     * Gosterilen sey ANLIK GORUNTU, canli ilan degil: satici teklifi
     * verdikten sonra ilani duzenleyebilir ya da silebilir, ama alici
     * neyi teklif aldigini gormeye devam etmeli. Canli baglanti
     * yalnizca "hala duruyor mu" sorusunu yanitlar ve ilan sayfasina
     * gitmek icin kullanilir.
     *
     * @return array<string, mixed>|null
     */
    private function listingBlock(): ?array
    {
        $anlik = $this->listing_snapshot;

        if (! is_array($anlik) || $anlik === []) {
            return null;
        }

        $canli = $this->relationLoaded('listing') ? $this->listing : null;

        return [
            'reference' => $anlik['reference'] ?? null,
            'title' => $anlik['title'] ?? null,
            'price' => $anlik['price'] ?? null,
            'cover_url' => $anlik['cover_url'] ?? null,
            'category' => $anlik['category'] ?? null,
            'location' => $anlik['location'] ?? null,
            // Tabloda yalnizca ozet satirlar; tamami ilan sayfasinda.
            'attributes' => array_slice($anlik['attributes'] ?? [], 0, 6),
            // Silinmis ya da yayindan kaldirilmis olabilir.
            'is_available' => $canli !== null && in_array($canli->status, ['published', 'sold'], true),
            // Satilmis urun hala gorunur ama alici bunu bilmeli:
            // "hala duruyor" ile "baskasina satilmis" ayni sey degil.
            'is_sold' => $canli?->status === 'sold',
            'listing_id' => $canli?->id,
        ];
    }
}
