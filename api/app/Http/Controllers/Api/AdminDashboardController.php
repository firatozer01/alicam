<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\BuyerRequest;
use App\Models\Offer;
use App\Models\PaymentOrder;
use App\Models\SellerProfile;
use App\Models\User;
use Illuminate\Http\JsonResponse;

class AdminDashboardController extends Controller
{
    public function __invoke(): JsonResponse
    {
        $paidOrders = PaymentOrder::query()->where('status', 'paid');

        return response()->json(['data' => [
            'stats' => [
                'users' => User::query()->count(),
                'requests' => BuyerRequest::query()->count(),
                'active_requests' => BuyerRequest::query()->whereIn('status', ['open', 'in_negotiation'])->count(),
                'offers' => Offer::query()->count(),
                'pending_sellers' => SellerProfile::query()->where('approval_status', 'pending')->count(),
                'paid_revenue' => (string) (clone $paidOrders)->sum('price_snapshot'),
                'credits_sold' => (int) (clone $paidOrders)->sum('credit_amount_snapshot')
                    + (int) (clone $paidOrders)->sum('bonus_snapshot'),
            ],
            'recent_requests' => BuyerRequest::query()
                ->with(['category', 'city', 'district', 'user'])
                ->withCount('offers')
                ->latest()
                ->limit(6)
                ->get()
                ->map(fn (BuyerRequest $item) => [
                    'id' => $item->id,
                    'reference' => $item->public_reference,
                    'title' => $item->title,
                    'status' => $item->status,
                    'buyer' => $item->user->name,
                    'category' => $item->category->name,
                    'location' => $item->district->name.', '.$item->city->name,
                    'offer_count' => $item->offers_count,
                    'created_at' => $item->created_at->toIso8601String(),
                ]),
            'recent_payments' => PaymentOrder::query()
                ->with(['user', 'creditPackage'])
                ->latest()
                ->limit(6)
                ->get()
                ->map(fn (PaymentOrder $order) => [
                    'merchant_oid' => $order->merchant_oid,
                    'user' => $order->user->name,
                    'package' => $order->creditPackage?->name,
                    'price' => $order->price_snapshot,
                    'status' => $order->status,
                    'created_at' => $order->created_at->toIso8601String(),
                ]),
        ]]);
    }
}
