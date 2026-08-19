<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class CreditPackage extends Model
{
    protected $fillable = [
        'name', 'credit_amount', 'bonus_credit', 'price', 'is_active', 'sort_order',
    ];

    protected function casts(): array
    {
        return [
            'credit_amount' => 'integer',
            'bonus_credit' => 'integer',
            'price' => 'decimal:2',
            'is_active' => 'boolean',
        ];
    }

    public function paymentOrders(): HasMany
    {
        return $this->hasMany(PaymentOrder::class);
    }
}
