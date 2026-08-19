<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\SellerCreditService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class SellerPromotionController extends Controller
{
    public function __construct(private readonly SellerCreditService $credits) {}

    public function show(Request $request): JsonResponse
    {
        $seller = $request->user();
        $featuredUntil = $seller->sellerPromotions()
            ->where('expires_at', '>', now())
            ->max('expires_at');

        return response()->json([
            'data' => [
                'is_featured' => $seller->activeSellerPromotions()->exists(),
                'featured_until' => $featuredUntil,
                'packages' => $this->credits->promotionPackages(),
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'package' => ['required', Rule::in(array_keys($this->credits->promotionPackages()))],
        ]);
        $result = $this->credits->promote($request->user(), $data['package']);

        return response()->json([
            'message' => 'Öne çıkarma paketi etkinleştirildi.',
            'data' => [
                'featured_until' => $result['featured_until']->toIso8601String(),
                'balance' => $result['balance'],
                'credit_spent' => $result['credit_spent'],
            ],
        ], 201);
    }
}
