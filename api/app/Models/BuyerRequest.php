<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class BuyerRequest extends Model
{
    protected $table = 'requests';

    protected $fillable = [
        'public_reference', 'user_id', 'category_id', 'city_id', 'district_id',
        'title', 'description', 'budget_min', 'budget_max', 'lat', 'lng',
        'full_address', 'attributes', 'attribute_schema_snapshot', 'status', 'expires_at',
    ];

    protected function casts(): array
    {
        return [
            'budget_min' => 'decimal:2',
            'budget_max' => 'decimal:2',
            'lat' => 'decimal:7',
            'lng' => 'decimal:7',
            'attributes' => 'array',
            'attribute_schema_snapshot' => 'array',
            'expires_at' => 'datetime',
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

    public function city(): BelongsTo
    {
        return $this->belongsTo(City::class);
    }

    public function district(): BelongsTo
    {
        return $this->belongsTo(District::class);
    }

    public function unlocks(): HasMany
    {
        return $this->hasMany(RequestUnlock::class, 'request_id');
    }

    public function offers(): HasMany
    {
        return $this->hasMany(Offer::class, 'request_id');
    }
}
