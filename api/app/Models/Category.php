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

    protected static function booted(): void
    {
        // Arama sutunu adla birlikte tutulur; yonetici panelinden bir
        // kategori yeniden adlandirilinca aramanin bozulmamasi icin.
        static::saving(function (self $kategori): void {
            $kategori->search_name = self::fold($kategori->name);
        });
    }

    /**
     * Aramada kullanilan sadelestirilmis bicim: kucuk harf + Turkce
     * harflerin ASCII karsiligi.
     *
     * Kullanicilarin cogu telefonda Turkce karakter yazmiyor; katlama
     * olmadan "camasir" arayan "Çamaşır Makinesi"ni bulamiyor.
     */
    public static function fold(?string $deger): string
    {
        $katlanmis = str_replace(
            ['Ç', 'ç', 'Ğ', 'ğ', 'İ', 'ı', 'Ö', 'ö', 'Ş', 'ş', 'Ü', 'ü', 'Â', 'â', 'Î', 'î', 'Û', 'û'],
            ['c', 'c', 'g', 'g', 'i', 'i', 'o', 'o', 's', 's', 'u', 'u', 'a', 'a', 'i', 'i', 'u', 'u'],
            (string) $deger,
        );

        return mb_strtolower(trim($katlanmis), 'UTF-8');
    }

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

    public function buyerRequests(): HasMany
    {
        return $this->hasMany(BuyerRequest::class);
    }

    public function sellerServices(): HasMany
    {
        return $this->hasMany(SellerService::class);
    }
}
