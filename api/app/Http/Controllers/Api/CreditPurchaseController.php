<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CreditPackage;
use App\Models\PaymentOrder;
use App\Services\PaytrService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

class CreditPurchaseController extends Controller
{
    public function __construct(private readonly PaytrService $paytr) {}

    public function packages(): JsonResponse
    {
        $packages = CreditPackage::query()
            ->where('is_active', true)
            ->orderBy('sort_order')
            ->get()
            ->map(fn (CreditPackage $package) => [
                'id' => $package->id,
                'name' => $package->name,
                'credit_amount' => $package->credit_amount,
                'bonus_credit' => $package->bonus_credit,
                'total_credit' => $package->credit_amount + $package->bonus_credit,
                'price' => $package->price,
            ]);

        return response()->json(['data' => $packages]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'package_id' => ['required', 'integer', 'exists:credit_packages,id'],
        ]);
        $package = CreditPackage::query()->findOrFail($data['package_id']);
        $result = $this->paytr->createOrder($request->user(), $package, $request);

        return response()->json([
            'message' => 'Güvenli ödeme oturumu hazırlandı.',
            'data' => [
                'merchant_oid' => $result['order']->merchant_oid,
                'status' => $result['order']->status,
                'iframe_url' => $result['iframe_url'],
            ],
        ], 201);
    }

    public function show(Request $request, string $merchantOid): JsonResponse
    {
        $order = PaymentOrder::query()
            ->where('merchant_oid', $merchantOid)
            ->where('user_id', $request->user()->id)
            ->firstOrFail();

        return response()->json(['data' => [
            'merchant_oid' => $order->merchant_oid,
            'status' => $order->status,
            'credit_amount' => $order->credit_amount_snapshot,
            'bonus_credit' => $order->bonus_snapshot,
            'price' => $order->price_snapshot,
            'currency' => $order->currency,
            'paid_at' => $order->paid_at?->toIso8601String(),
            'failed_reason' => $order->failed_reason_message,
        ]]);
    }

    public function callback(Request $request): Response
    {
        $payload = $request->validate([
            'merchant_oid' => ['required', 'string', 'max:64'],
            'status' => ['required', 'string', 'max:24'],
            'total_amount' => ['required', 'integer', 'min:0'],
            'hash' => ['required', 'string', 'max:255'],
            'currency' => ['sometimes', 'string', 'max:3'],
            'failed_reason_code' => ['sometimes', 'nullable', 'string', 'max:32'],
            'failed_reason_msg' => ['sometimes', 'nullable', 'string', 'max:500'],
        ]);
        $result = $this->paytr->handleCallback($payload);

        return response($result['message'], $result['status'])
            ->header('Content-Type', 'text/plain; charset=UTF-8');
    }
}
