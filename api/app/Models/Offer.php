<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Offer extends Model
{
    protected $fillable = [
        'request_id', 'seller_id', 'price', 'message', 'status', 'reviewed_at', 'accepted_at',
        'seller_listing_id', 'listing_snapshot',
    ];

    protected function casts(): array
    {
        return [
            'price' => 'decimal:2',
            'reviewed_at' => 'datetime',
            'accepted_at' => 'datetime',
            'listing_snapshot' => 'array',
        ];
    }

    public function buyerRequest(): BelongsTo
    {
        return $this->belongsTo(BuyerRequest::class, 'request_id');
    }

    public function seller(): BelongsTo
    {
        return $this->belongsTo(User::class, 'seller_id');
    }

    /**
     * Teklife iliktirilen urun; satici silerse null'a duser.
     *
     * Gosterimde listing_snapshot esastir: baglanti canli haldeki
     * ilani gosterir ama alici teklifi gorurken urun baska bir sey
     * olabilir.
     */
    public function listing(): BelongsTo
    {
        return $this->belongsTo(SellerListing::class, 'seller_listing_id');
    }

    public function review(): HasOne
    {
        return $this->hasOne(SellerReview::class);
    }
}
