<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PaymentOrder extends Model
{
    protected $fillable = [
        'merchant_oid', 'user_id', 'credit_package_id', 'credit_amount_snapshot',
        'bonus_snapshot', 'price_snapshot', 'currency', 'status', 'user_ip',
        'test_mode', 'paid_at', 'failed_reason_code', 'failed_reason_message',
    ];

    protected function casts(): array
    {
        return [
            'credit_amount_snapshot' => 'integer',
            'bonus_snapshot' => 'integer',
            'price_snapshot' => 'decimal:2',
            'test_mode' => 'boolean',
            'paid_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function creditPackage(): BelongsTo
    {
        return $this->belongsTo(CreditPackage::class);
    }
}
