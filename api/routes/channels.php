<?php

use App\Models\Conversation;
use App\Models\User;
use Illuminate\Support\Facades\Broadcast;

/**
 * Konusma kanali yalnizca o konusmanin iki tarafina acilir. Kanal adindaki
 * kimlige guvenilmez; katilimci olup olmadigi her abonelikte veritabanindan
 * dogrulanir.
 */
Broadcast::channel('conversation.{conversationId}', function (User $user, int $conversationId): bool {
    $conversation = Conversation::query()->find($conversationId);

    return $conversation !== null && $conversation->isParticipant($user->id);
});
