<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SellerPortfolioItem extends Model
{
    protected $fillable = [
        'user_id',
        'category_id',
        'title',
        'description',
        'location',
        'duration',
        'area',
        'budget',
        'client_type',
        'highlights',
        'completed_at',
        'is_published',
        'sort_order',
    ];

    protected function casts(): array
    {
        return [
            'completed_at' => 'date',
            'highlights' => 'array',
            'is_published' => 'boolean',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class);
    }

    public function images(): HasMany
    {
        return $this->hasMany(SellerPortfolioImage::class, 'portfolio_item_id')->orderBy('sort_order');
    }
}
