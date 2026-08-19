<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RequestUnlock extends Model
{
    public $timestamps = false;

    protected $fillable = ['seller_id', 'request_id', 'credit_spent', 'unlocked_at'];

    protected function casts(): array
    {
        return [
            'credit_spent' => 'integer',
            'unlocked_at' => 'datetime',
        ];
    }

    public function seller(): BelongsTo
    {
        return $this->belongsTo(User::class, 'seller_id');
    }

    public function buyerRequest(): BelongsTo
    {
        return $this->belongsTo(BuyerRequest::class, 'request_id');
    }
}
