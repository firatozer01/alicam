<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RequestFavorite extends Model
{
    protected $fillable = [
        'user_id',
        'request_id',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function buyerRequest(): BelongsTo
    {
        return $this->belongsTo(BuyerRequest::class, 'request_id');
    }
}
