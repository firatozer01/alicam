<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SellerPortfolioImage extends Model
{
    protected $fillable = [
        'portfolio_item_id',
        'path',
        'sort_order',
    ];

    public function item(): BelongsTo
    {
        return $this->belongsTo(SellerPortfolioItem::class, 'portfolio_item_id');
    }
}
