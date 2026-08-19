<?php

namespace App\Exceptions;

use Exception;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class InsufficientCreditsException extends Exception
{
    public function __construct(
        public readonly int $balance,
        public readonly int $required,
    ) {
        parent::__construct('Bu talebi açmak için yeterli kontörünüz bulunmuyor.');
    }

    public function render(Request $request): JsonResponse
    {
        return response()->json([
            'message' => $this->getMessage(),
            'code' => 'insufficient_credits',
            'balance' => $this->balance,
            'required' => $this->required,
        ], 422);
    }
}
