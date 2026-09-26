<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Casts\Attribute as EloquentAttribute;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

#[Fillable(['name', 'email', 'phone', 'password', 'status'])]
#[Hidden(['password', 'remember_token', 'avatar_path'])]
class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, Notifiable;

    /**
     * Profil fotografi adresi.
     *
     * $appends ile OTOMATIK EKLENMEZ, bilerek. SellerMatchingService her
     * talep satirinda alicinin User modelini yukluyor; model butun olarak
     * serilestirilirse bu adres kilidi acilmamis talebe de duser ve
     * icindeki kullanici id'si saticiya aliciya ulasma yolu verir.
     * Oysa kilit acilana kadar alicinin adi bile donmuyor.
     *
     * Bu yuzden her Resource bu alani ACIKCA istemek zorunda.
     *
     * avatar_path da Fillable listesinde degil: toplu atamayla
     * degistirilebilen bir alan olmamali, yalnizca kendi yukleme
     * ucundan yazilir.
     */
    protected function avatarUrl(): EloquentAttribute
    {
        if ($this->avatar_path === null) {
            return EloquentAttribute::get(fn () => null);
        }

        // Surum damgasi: fotograf degisince adres de degisir, yoksa
        // tarayici eskisini onbellekten gostermeye devam eder.
        $damga = $this->updated_at?->timestamp ?? 0;

        return EloquentAttribute::get(fn () => "/api/avatars/{$this->id}?v={$damga}");
    }

    public function roles(): BelongsToMany
    {
        return $this->belongsToMany(Role::class);
    }

    public function verificationCodes(): HasMany
    {
        return $this->hasMany(VerificationCode::class);
    }

    public function buyerRequests(): HasMany
    {
        return $this->hasMany(BuyerRequest::class);
    }

    public function sellerProfile(): HasOne
    {
        return $this->hasOne(SellerProfile::class);
    }

    public function sellerCategories(): BelongsToMany
    {
        return $this->belongsToMany(Category::class, 'seller_categories', 'seller_id', 'category_id')
            ->withTimestamps();
    }

    public function sellerLocations(): HasMany
    {
        return $this->hasMany(SellerLocation::class, 'seller_id');
    }

    public function sellerCredit(): HasOne
    {
        return $this->hasOne(SellerCredit::class);
    }

    public function requestUnlocks(): HasMany
    {
        return $this->hasMany(RequestUnlock::class, 'seller_id');
    }

    public function creditTransactions(): HasMany
    {
        return $this->hasMany(CreditTransaction::class);
    }

    public function paymentOrders(): HasMany
    {
        return $this->hasMany(PaymentOrder::class);
    }

    public function sellerOffers(): HasMany
    {
        return $this->hasMany(Offer::class, 'seller_id');
    }

    public function sellerServices(): HasMany
    {
        return $this->hasMany(SellerService::class);
    }

    public function portfolioItems(): HasMany
    {
        return $this->hasMany(SellerPortfolioItem::class);
    }

    public function sellerReviews(): HasMany
    {
        return $this->hasMany(SellerReview::class, 'seller_id');
    }

    public function buyerReviews(): HasMany
    {
        return $this->hasMany(SellerReview::class, 'buyer_id');
    }

    public function sellerPromotions(): HasMany
    {
        return $this->hasMany(SellerPromotion::class, 'seller_id');
    }

    public function activeSellerPromotions(): HasMany
    {
        return $this->sellerPromotions()
            ->where('starts_at', '<=', now())
            ->where('expires_at', '>', now());
    }

    public function hasRole(string $role): bool
    {
        return $this->roles()->where('name', $role)->exists();
    }

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'phone_verified_at' => 'datetime',
            'password' => 'hashed',
        ];
    }
}
