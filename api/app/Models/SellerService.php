<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SellerService extends Model
{
    protected $fillable = [
        'user_id', 'category_id', 'title', 'description', 'price_from',
        'delivery_time', 'is_active',
    ];

    protected function casts(): array
    {
        return [
            'price_from' => 'decimal:2',
            'is_active' => 'boolean',
        ];
    }

    public function seller(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class);
    }
}
