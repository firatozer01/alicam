<?php

namespace App\Exceptions;

use Exception;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Kilitli konusmada engellenen islem.
 *
 * Iki durumda atilir: hizmet veren konusmayi acmadan yanit yazmaya
 * calistiginda, ya da alici konusma acilmadan izin verilenden fazla mesaj
 * yazmaya calistiginda.
 */
class ConversationLockedException extends Exception
{
    public function __construct(
        public readonly string $reason,
        string $message,
        public readonly ?int $unlockCost = null,
    ) {
        parent::__construct($message);
    }

    public static function sellerMustUnlock(int $cost): self
    {
        return new self(
            'seller_must_unlock',
            'Bu konuşmayı yanıtlamak için önce açman gerekiyor.',
            $cost,
        );
    }

    public static function buyerLimitReached(int $limit): self
    {
        return new self(
            'buyer_limit',
            "Hizmet veren konuşmayı açana kadar en fazla {$limit} mesaj gönderebilirsin.",
        );
    }

    public function render(Request $request): JsonResponse
    {
        return response()->json([
            'message' => $this->getMessage(),
            'code' => $this->reason,
            'unlock_cost' => $this->unlockCost,
        ], 422);
    }
}
