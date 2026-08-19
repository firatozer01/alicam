<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SellerCredit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SellerCreditController extends Controller
{
    public function show(Request $request): JsonResponse
    {
        $seller = $request->user();
        $wallet = SellerCredit::query()->firstOrCreate(
            ['user_id' => $seller->id],
            ['balance' => 0],
        );
        $transactions = $seller->creditTransactions()
            ->latest()
            ->limit(15)
            ->get()
            ->map(fn ($transaction) => [
                'id' => $transaction->id,
                'type' => $transaction->type,
                'amount' => $transaction->amount,
                'balance_after' => $transaction->balance_after,
                'reference_type' => $transaction->reference_type,
                'reference_id' => $transaction->reference_id,
                'metadata' => $transaction->metadata,
                'created_at' => $transaction->created_at->toIso8601String(),
            ]);

        $spentThisMonth = abs((int) $seller->creditTransactions()
            ->where('type', 'spend')
            ->whereBetween('created_at', [now()->startOfMonth(), now()->endOfMonth()])
            ->sum('amount'));

        return response()->json([
            'data' => [
                'balance' => $wallet->balance,
                'spent_this_month' => $spentThisMonth,
                'transactions' => $transactions,
            ],
        ]);
    }
}
