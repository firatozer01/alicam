<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PaymentCallback extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'provider', 'merchant_oid', 'payload', 'hash_valid', 'processed_at', 'created_at',
    ];

    protected function casts(): array
    {
        return [
            'payload' => 'array',
            'hash_valid' => 'boolean',
            'processed_at' => 'datetime',
            'created_at' => 'datetime',
        ];
    }
}
