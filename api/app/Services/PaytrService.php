<?php

namespace App\Services;

use App\Exceptions\PaymentProviderException;
use App\Models\CreditPackage;
use App\Models\PaymentCallback;
use App\Models\PaymentOrder;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Throwable;

class PaytrService
{
    public function __construct(private readonly SellerCreditService $credits) {}

    /** @return array{order: PaymentOrder, iframe_url: string} */
    public function createOrder(User $user, CreditPackage $package, Request $request): array
    {
        $this->ensureConfigured();

        if (! $package->is_active) {
            throw new PaymentProviderException('Bu kontör paketi satışa açık değil.', 'credit_package_inactive', 422);
        }

        if (! filter_var($user->email, FILTER_VALIDATE_EMAIL) || preg_match('/[^\x20-\x7E]/', $user->email)) {
            throw new PaymentProviderException('Ödeme için geçerli, ASCII karakterli bir e-posta adresi gerekir.', 'invalid_payment_email', 422);
        }

        $merchantOid = $this->newMerchantOid($user);
        $amount = (int) round((float) $package->price * 100);
        $price = number_format((float) $package->price, 2, '.', '');
        $basket = base64_encode(json_encode([
            [$package->name.' Kontör Paketi', $price, 1],
        ], JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR));

        $order = PaymentOrder::query()->create([
            'merchant_oid' => $merchantOid,
            'user_id' => $user->id,
            'credit_package_id' => $package->id,
            'credit_amount_snapshot' => $package->credit_amount,
            'bonus_snapshot' => $package->bonus_credit,
            'price_snapshot' => $package->price,
            'currency' => 'TL',
            'status' => 'pending',
            'user_ip' => $request->ip(),
            'test_mode' => (bool) config('services.paytr.test_mode'),
        ]);

        $fields = [
            'merchant_id' => (string) config('services.paytr.merchant_id'),
            'user_ip' => (string) ($request->ip() ?: '127.0.0.1'),
            'merchant_oid' => $merchantOid,
            'email' => $user->email,
            'payment_amount' => $amount,
            'paytr_token' => '',
            'user_basket' => $basket,
            'debug_on' => (int) config('services.paytr.debug_on'),
            'no_installment' => (int) config('services.paytr.no_installment'),
            'max_installment' => (int) config('services.paytr.max_installment'),
            'user_name' => $user->name,
            'user_address' => 'Belirtilmedi',
            'user_phone' => $user->phone,
            'merchant_ok_url' => rtrim((string) config('services.paytr.frontend_url'), '/').'/odeme/basarili?order='.$merchantOid,
            'merchant_fail_url' => rtrim((string) config('services.paytr.frontend_url'), '/').'/odeme/basarisiz?order='.$merchantOid,
            'timeout_limit' => (int) config('services.paytr.timeout_limit'),
            'currency' => 'TL',
            'test_mode' => (int) config('services.paytr.test_mode'),
            'lang' => 'tr',
        ];
        $fields['paytr_token'] = $this->tokenForOrder($fields);

        try {
            $response = Http::asForm()
                ->acceptJson()
                ->timeout(20)
                ->post((string) config('services.paytr.token_url'), $fields);
            $payload = $response->json();
        } catch (Throwable $exception) {
            $order->update(['status' => 'failed', 'failed_reason_message' => 'Ödeme kuruluşuna ulaşılamadı.']);
            report($exception);
            throw new PaymentProviderException('Ödeme kuruluşuna şu anda ulaşılamıyor.', 'payment_provider_unavailable', 503);
        }

        if (! $response->successful() || ! is_array($payload) || ($payload['status'] ?? null) !== 'success' || empty($payload['token'])) {
            $reason = is_array($payload) ? ($payload['reason'] ?? 'Token alınamadı.') : 'Token alınamadı.';
            $order->update(['status' => 'failed', 'failed_reason_message' => Str::limit((string) $reason, 500)]);
            throw new PaymentProviderException('Ödeme oturumu başlatılamadı: '.$reason, 'payment_token_failed', 502);
        }

        return [
            'order' => $order,
            'iframe_url' => rtrim((string) config('services.paytr.iframe_base_url'), '/').'/'.$payload['token'],
        ];
    }

    /** @return array{ok: bool, status: int, message: string} */
    public function handleCallback(array $payload): array
    {
        if (! config('services.paytr.merchant_key') || ! config('services.paytr.merchant_salt')) {
            return ['ok' => false, 'status' => 503, 'message' => 'PAYTR notification failed: provider not configured'];
        }

        $expected = base64_encode(hash_hmac(
            'sha256',
            ($payload['merchant_oid'] ?? '').config('services.paytr.merchant_salt').($payload['status'] ?? '').($payload['total_amount'] ?? ''),
            (string) config('services.paytr.merchant_key'),
            true,
        ));
        $hashValid = isset($payload['hash']) && hash_equals($expected, (string) $payload['hash']);
        $callback = PaymentCallback::query()->create([
            'provider' => 'paytr',
            'merchant_oid' => (string) ($payload['merchant_oid'] ?? ''),
            'payload' => $payload,
            'hash_valid' => $hashValid,
            'created_at' => now(),
        ]);

        if (! $hashValid) {
            return ['ok' => false, 'status' => 400, 'message' => 'PAYTR notification failed: bad hash'];
        }

        return DB::transaction(function () use ($payload, $callback): array {
            $order = PaymentOrder::query()
                ->where('merchant_oid', $payload['merchant_oid'])
                ->lockForUpdate()
                ->first();

            if (! $order) {
                return ['ok' => false, 'status' => 404, 'message' => 'PAYTR notification failed: order not found'];
            }

            if (in_array($order->status, ['paid', 'failed'], true)) {
                $callback->update(['processed_at' => now()]);

                return ['ok' => true, 'status' => 200, 'message' => 'OK'];
            }

            if (($payload['status'] ?? null) !== 'success') {
                $order->update([
                    'status' => 'failed',
                    'failed_reason_code' => Str::limit((string) ($payload['failed_reason_code'] ?? ''), 32),
                    'failed_reason_message' => Str::limit((string) ($payload['failed_reason_msg'] ?? 'Ödeme başarısız.'), 500),
                ]);
                $callback->update(['processed_at' => now()]);

                return ['ok' => true, 'status' => 200, 'message' => 'OK'];
            }

            $expectedAmount = (int) round((float) $order->price_snapshot * 100);
            if ((int) ($payload['total_amount'] ?? -1) !== $expectedAmount
                || (isset($payload['currency']) && $payload['currency'] !== $order->currency)) {
                return ['ok' => false, 'status' => 422, 'message' => 'PAYTR notification failed: amount mismatch'];
            }

            $this->credits->creditPaidOrder($order);
            $order->update(['status' => 'paid', 'paid_at' => now()]);
            $callback->update(['processed_at' => now()]);

            return ['ok' => true, 'status' => 200, 'message' => 'OK'];
        }, 3);
    }

    private function tokenForOrder(array $fields): string
    {
        $input = $fields['merchant_id'].$fields['user_ip'].$fields['merchant_oid'].$fields['email']
            .$fields['payment_amount'].$fields['user_basket'].$fields['no_installment']
            .$fields['max_installment'].$fields['currency'].$fields['test_mode']
            .config('services.paytr.merchant_salt');

        return base64_encode(hash_hmac('sha256', $input, (string) config('services.paytr.merchant_key'), true));
    }

    private function ensureConfigured(): void
    {
        if (! config('services.paytr.merchant_id')
            || ! config('services.paytr.merchant_key')
            || ! config('services.paytr.merchant_salt')) {
            throw new PaymentProviderException('PayTR mağaza bilgileri henüz yapılandırılmamış.', 'paytr_not_configured', 503);
        }
    }

    private function newMerchantOid(User $user): string
    {
        do {
            $oid = 'ALC'.now()->format('ymdHis').$user->id.Str::upper(Str::random(8));
        } while (PaymentOrder::query()->where('merchant_oid', $oid)->exists());

        return $oid;
    }
}
