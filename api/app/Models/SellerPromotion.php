<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SellerPromotion extends Model
{
    protected $fillable = ['seller_id', 'credit_cost', 'starts_at', 'expires_at'];

    protected function casts(): array
    {
        return [
            'credit_cost' => 'integer',
            'starts_at' => 'datetime',
            'expires_at' => 'datetime',
        ];
    }

    public function seller(): BelongsTo
    {
        return $this->belongsTo(User::class, 'seller_id');
    }
}
