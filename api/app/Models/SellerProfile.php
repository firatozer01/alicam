<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SellerProfile extends Model
{
    protected $primaryKey = 'user_id';

    public $incrementing = false;

    protected $fillable = [
        'user_id', 'profile_type', 'company_name', 'tax_no', 'description',
        'approval_status', 'rejection_reason', 'submitted_at',
        'reviewed_at', 'reviewed_by',
    ];

    // Gorsel yollari toplu atamayla degil kendi yukleme uclarindan
    // yazilir; istemciye de yol degil akis adresi doner.
    protected $hidden = ['logo_path', 'banner_path'];

    protected $appends = ['logo_url', 'banner_url'];

    protected function casts(): array
    {
        return [
            'submitted_at' => 'datetime',
            'reviewed_at' => 'datetime',
        ];
    }

    protected function logoUrl(): Attribute
    {
        return Attribute::get(fn () => $this->mediaUrl('seller-logos', $this->logo_path));
    }

    protected function bannerUrl(): Attribute
    {
        return Attribute::get(fn () => $this->mediaUrl('seller-banners', $this->banner_path));
    }

    /**
     * Surum damgali akis adresi.
     *
     * Adres model id'sine bagli oldugu icin icerik degisse bile ayni
     * kalirdi ve tarayici bir hafta eski gorseli gostermeye devam
     * ederdi; damga bunu kirar.
     */
    private function mediaUrl(string $segment, ?string $yol): ?string
    {
        if ($yol === null) {
            return null;
        }

        return "/api/{$segment}/{$this->user_id}?v=".($this->updated_at?->timestamp ?? 0);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }
}
