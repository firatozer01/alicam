<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Scope;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Category extends Model
{
    use HasFactory;

    protected $fillable = [
        'parent_id', 'name', 'slug', 'icon', 'color', 'schema_version',
        'is_active', 'sort_order',
    ];

    protected function casts(): array
    {
        return ['is_active' => 'boolean'];
    }

    #[Scope]
    protected function active(Builder $query): void
    {
        $query->where('is_active', true);
    }

    public function parent(): BelongsTo
    {
        return $this->belongsTo(self::class, 'parent_id');
    }

    public function children(): HasMany
    {
        return $this->hasMany(self::class, 'parent_id')->orderBy('sort_order');
    }

    public function attributes(): HasMany
    {
        return $this->hasMany(CategoryAttribute::class)->orderBy('sort_order');
    }

    public function creditCost(): HasOne
    {
        return $this->hasOne(CategoryCreditCost::class);
    }

    public function sellers(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'seller_categories', 'category_id', 'seller_id')
            ->withTimestamps();
    }
}
