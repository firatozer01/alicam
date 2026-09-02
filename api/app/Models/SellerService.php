<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SellerService extends Model
{
    protected $fillable = [
        'user_id', 'category_id', 'title', 'description', 'price_from',
        'delivery_time', 'cover_path', 'is_active',
    ];

    /** Disk yolu dışa sızmaz; istemciye yalnızca akış URL'si verilir. */
    protected $hidden = ['cover_path'];

    protected $appends = ['cover_url'];

    protected function casts(): array
    {
        return [
            'price_from' => 'decimal:2',
            'is_active' => 'boolean',
        ];
    }

    protected function coverUrl(): Attribute
    {
        return Attribute::get(fn () => $this->cover_path ? "/api/service-covers/{$this->id}" : null);
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
