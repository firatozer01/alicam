<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Conversation extends Model
{
    protected $fillable = ['buyer_id', 'seller_id', 'request_id', 'last_message_at', 'buyer_unread', 'seller_unread'];

    protected function casts(): array
    {
        return ['last_message_at' => 'datetime'];
    }

    public function buyer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'buyer_id');
    }

    public function seller(): BelongsTo
    {
        return $this->belongsTo(User::class, 'seller_id');
    }

    public function buyerRequest(): BelongsTo
    {
        return $this->belongsTo(BuyerRequest::class, 'request_id');
    }

    public function messages(): HasMany
    {
        return $this->hasMany(Message::class);
    }

    /** Konusmadaki diger taraf. */
    public function counterpartFor(int $userId): ?User
    {
        return $userId === $this->buyer_id ? $this->seller : $this->buyer;
    }

    public function isParticipant(int $userId): bool
    {
        return in_array($userId, [$this->buyer_id, $this->seller_id], true);
    }
}
