<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Ilan galerisindeki tek bir fotograf.
 *
 * Disk yolu istemciye hicbir zaman verilmez; yalnizca akis adresi.
 */
class SellerListingImage extends Model
{
    protected $fillable = ['seller_listing_id', 'path', 'sort_order'];

    protected $hidden = ['path'];

    protected $appends = ['url'];

    protected function url(): Attribute
    {
        return Attribute::get(fn () => "/api/listing-images/{$this->id}");
    }

    public function listing(): BelongsTo
    {
        return $this->belongsTo(SellerListing::class, 'seller_listing_id');
    }
}
