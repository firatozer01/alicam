<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Saticinin vitrinindeki urun/ilan.
 *
 * Emlakci bir daireyi, galerici bir araci buraya koyar. Kategoriye bagli
 * serbest alanlar (Marka, Yil, KM / m2, Oda Sayisi, Isitma) taleplerle
 * ayni sekilde jsonb olarak tutulur.
 */
class SellerListing extends Model
{
    protected $fillable = [
        'user_id', 'category_id', 'city_id', 'district_id', 'public_reference',
        'title', 'description', 'price', 'attributes', 'attribute_schema_snapshot',
        'status', 'sort_order',
    ];

    protected $appends = ['cover_url'];

    protected function casts(): array
    {
        return [
            'price' => 'decimal:2',
            'attributes' => 'array',
            'attribute_schema_snapshot' => 'array',
        ];
    }

    /** Vitrinde gorunen tek durum; digerleri saticiya ozel. */
    public function scopePublished($query)
    {
        return $query->where('status', 'published');
    }

    /**
     * Kapak: ilk siradaki gorsel.
     *
     * Iliski onceden yuklenmisse tekrar sorgu acmaz; ilan listelerinde
     * bu fark N+1 demek.
     */
    protected function coverUrl(): Attribute
    {
        return Attribute::get(function () {
            // id ikinci olcut: iki gorsel ayni siraya duserse kapak
            // istekten istege degismesin.
            $kapak = $this->relationLoaded('images')
                ? $this->images->sortBy([['sort_order', 'asc'], ['id', 'asc']])->first()
                : $this->images()->orderBy('sort_order')->orderBy('id')->first();

            return $kapak ? "/api/listing-images/{$kapak->id}" : null;
        });
    }

    public function seller(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class);
    }

    public function city(): BelongsTo
    {
        return $this->belongsTo(City::class);
    }

    public function district(): BelongsTo
    {
        return $this->belongsTo(District::class);
    }

    public function images(): HasMany
    {
        return $this->hasMany(SellerListingImage::class)->orderBy('sort_order')->orderBy('id');
    }

    public function offers(): HasMany
    {
        return $this->hasMany(Offer::class);
    }
}
