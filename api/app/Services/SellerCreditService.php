<?php

namespace App\Services;

use App\Exceptions\InsufficientCreditsException;
use App\Models\BuyerRequest;
use App\Models\CreditTransaction;
use App\Models\PaymentOrder;
use App\Models\RequestUnlock;
use App\Models\SellerCredit;
use App\Models\SellerPromotion;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class SellerCreditService
{
    /** @return array<string, array{label: string, days: int, credits: int}> */
    public function promotionPackages(): array
    {
        return [
            'week' => ['label' => '7 gün', 'days' => 7, 'credits' => 25],
            'fortnight' => ['label' => '14 gün', 'days' => 14, 'credits' => 45],
            'month' => ['label' => '30 gün', 'days' => 30, 'credits' => 80],
        ];
    }

    /** @return array{featured_until: Carbon, balance: int, credit_spent: int} */
    public function promote(User $seller, string $packageKey): array
    {
        $package = $this->promotionPackages()[$packageKey];

        return DB::transaction(function () use ($seller, $package, $packageKey): array {
            SellerCredit::query()->firstOrCreate(['user_id' => $seller->id], ['balance' => 0]);
            $wallet = SellerCredit::query()->where('user_id', $seller->id)->lockForUpdate()->firstOrFail();

            if ($wallet->balance < $package['credits']) {
                throw new InsufficientCreditsException($wallet->balance, $package['credits']);
            }

            $latestExpiry = SellerPromotion::query()
                ->where('seller_id', $seller->id)
                ->where('expires_at', '>', now())
                ->max('expires_at');
            $startsAt = $latestExpiry ? Carbon::parse($latestExpiry) : now();
            $expiresAt = $startsAt->copy()->addDays($package['days']);
            $balance = $wallet->balance - $package['credits'];

            $promotion = SellerPromotion::query()->create([
                'seller_id' => $seller->id,
                'credit_cost' => $package['credits'],
                'starts_at' => $startsAt,
                'expires_at' => $expiresAt,
            ]);
            $wallet->update(['balance' => $balance]);
            CreditTransaction::query()->create([
                'user_id' => $seller->id,
                'type' => 'spend',
                'amount' => -$package['credits'],
                'reference_type' => 'seller_promotion',
                'reference_id' => $promotion->id,
                'balance_after' => $balance,
                'metadata' => [
                    'package' => $packageKey,
                    'days' => $package['days'],
                    'featured_until' => $expiresAt->toIso8601String(),
                ],
            ]);

            return [
                'featured_until' => $expiresAt,
                'balance' => $balance,
                'credit_spent' => $package['credits'],
            ];
        }, 3);
    }

    /**
     * @return array{unlock: RequestUnlock, already_unlocked: bool, balance: int}
     */
    public function unlock(User $seller, BuyerRequest $buyerRequest): array
    {
        return DB::transaction(function () use ($seller, $buyerRequest): array {
            SellerCredit::query()->firstOrCreate(
                ['user_id' => $seller->id],
                ['balance' => 0],
            );

            $wallet = SellerCredit::query()
                ->where('user_id', $seller->id)
                ->lockForUpdate()
                ->firstOrFail();

            $existing = RequestUnlock::query()
                ->where('seller_id', $seller->id)
                ->where('request_id', $buyerRequest->id)
                ->first();

            if ($existing) {
                return [
                    'unlock' => $existing,
                    'already_unlocked' => true,
                    'balance' => $wallet->balance,
                ];
            }

            $lockedRequest = BuyerRequest::query()
                ->whereKey($buyerRequest->id)
                ->lockForUpdate()
                ->with('category.creditCost')
                ->firstOrFail();

            abort_unless(
                in_array($lockedRequest->status, ['open', 'in_negotiation'], true)
                    && ($lockedRequest->expires_at === null || $lockedRequest->expires_at->isFuture()),
                422,
                'Bu talep artık açılmaya uygun değil.',
            );

            $cost = (int) ($lockedRequest->category->creditCost?->unlock_cost ?? 0);

            if ($wallet->balance < $cost) {
                throw new InsufficientCreditsException($wallet->balance, $cost);
            }

            $newBalance = $wallet->balance - $cost;
            $wallet->update(['balance' => $newBalance]);

            $unlock = RequestUnlock::query()->create([
                'seller_id' => $seller->id,
                'request_id' => $lockedRequest->id,
                'credit_spent' => $cost,
                'unlocked_at' => now(),
            ]);

            CreditTransaction::query()->create([
                'user_id' => $seller->id,
                'type' => 'spend',
                'amount' => -$cost,
                'reference_type' => 'request_unlock',
                'reference_id' => $unlock->id,
                'balance_after' => $newBalance,
                'metadata' => [
                    'request_id' => $lockedRequest->id,
                    'public_reference' => $lockedRequest->public_reference,
                    'unlock_cost_snapshot' => $cost,
                ],
            ]);

            return [
                'unlock' => $unlock,
                'already_unlocked' => false,
                'balance' => $newBalance,
            ];
        }, 3);
    }

    public function creditPaidOrder(PaymentOrder $paymentOrder): int
    {
        SellerCredit::query()->firstOrCreate(
            ['user_id' => $paymentOrder->user_id],
            ['balance' => 0],
        );

        $wallet = SellerCredit::query()
            ->where('user_id', $paymentOrder->user_id)
            ->lockForUpdate()
            ->firstOrFail();

        $balance = $wallet->balance + $paymentOrder->credit_amount_snapshot;
        CreditTransaction::query()->create([
            'user_id' => $paymentOrder->user_id,
            'type' => 'purchase',
            'amount' => $paymentOrder->credit_amount_snapshot,
            'reference_type' => 'payment_order',
            'reference_id' => $paymentOrder->id,
            'balance_after' => $balance,
            'metadata' => ['merchant_oid' => $paymentOrder->merchant_oid],
        ]);

        if ($paymentOrder->bonus_snapshot > 0) {
            $balance += $paymentOrder->bonus_snapshot;
            CreditTransaction::query()->create([
                'user_id' => $paymentOrder->user_id,
                'type' => 'bonus',
                'amount' => $paymentOrder->bonus_snapshot,
                'reference_type' => 'payment_order',
                'reference_id' => $paymentOrder->id,
                'balance_after' => $balance,
                'metadata' => ['merchant_oid' => $paymentOrder->merchant_oid],
            ]);
        }

        $wallet->update(['balance' => $balance]);

        return $balance;
    }
}
