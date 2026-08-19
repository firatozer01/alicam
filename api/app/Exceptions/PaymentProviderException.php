<?php

namespace App\Exceptions;

use Exception;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PaymentProviderException extends Exception
{
    public function __construct(
        string $message,
        public readonly string $errorCode = 'payment_provider_error',
        public readonly int $httpStatus = 502,
    ) {
        parent::__construct($message);
    }

    public function render(Request $request): JsonResponse
    {
        return response()->json([
            'message' => $this->getMessage(),
            'code' => $this->errorCode,
        ], $this->httpStatus);
    }
}
