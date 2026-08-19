<?php

namespace Tests\Feature;

use App\Models\CreditPackage;
use App\Models\PaymentOrder;
use App\Models\Role;
use App\Models\User;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class PaymentApiTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        config()->set('services.paytr.merchant_id', '123456');
        config()->set('services.paytr.merchant_key', 'test-key');
        config()->set('services.paytr.merchant_salt', 'test-salt');
        config()->set('services.paytr.test_mode', true);
        config()->set('services.paytr.token_url', 'https://www.paytr.com/odeme/api/get-token');
        config()->set('services.paytr.iframe_base_url', 'https://www.paytr.com/odeme/guvenli');
        config()->set('services.paytr.frontend_url', 'http://localhost:3000');
    }

    public function test_approved_seller_can_create_a_signed_paytr_payment_session(): void
    {
        $this->seed(DatabaseSeeder::class);
        $seller = $this->approvedSeller();
        $package = CreditPackage::query()->where('name', 'Standart')->firstOrFail();
        Http::fake(['www.paytr.com/*' => Http::response(['status' => 'success', 'token' => 'secure-test-token'])]);

        $response = $this->actingAs($seller)
            ->withServerVariables(['REMOTE_ADDR' => '203.0.113.12'])
            ->postJson('/api/seller/credits/purchase', ['package_id' => $package->id])
            ->assertCreated()
            ->assertJsonPath('data.status', 'pending')
            ->assertJsonPath('data.iframe_url', 'https://www.paytr.com/odeme/guvenli/secure-test-token');

        $order = PaymentOrder::query()->where('merchant_oid', $response->json('data.merchant_oid'))->firstOrFail();
        $this->assertSame(60, $order->credit_amount_snapshot);
        $this->assertSame(10, $order->bonus_snapshot);
        $this->assertSame('1200.00', $order->price_snapshot);

        Http::assertSent(function (Request $request) use ($order): bool {
            $basket = $request['user_basket'];
            $hashInput = '123456'.'203.0.113.12'.$order->merchant_oid.$order->user->email
                .'120000'.$basket.'0'.'0'.'TL'.'1'.'test-salt';
            $expected = base64_encode(hash_hmac('sha256', $hashInput, 'test-key', true));

            return $request->url() === 'https://www.paytr.com/odeme/api/get-token'
                && $request['payment_amount'] === 120000
                && $request['paytr_token'] === $expected;
        });
    }

    public function test_valid_success_callback_credits_purchase_and_bonus_only_once(): void
    {
        $this->seed(DatabaseSeeder::class);
        $seller = $this->approvedSeller();
        $package = CreditPackage::query()->where('name', 'Standart')->firstOrFail();
        $order = $this->order($seller, $package);
        $payload = $this->callbackPayload($order, 'success');

        $this->post('/api/payments/paytr/callback', $payload)->assertOk()->assertSeeText('OK');
        $this->post('/api/payments/paytr/callback', $payload)->assertOk()->assertSeeText('OK');

        $this->assertDatabaseHas('payment_orders', ['id' => $order->id, 'status' => 'paid']);
        $this->assertDatabaseHas('seller_credits', ['user_id' => $seller->id, 'balance' => 70]);
        $this->assertDatabaseCount('credit_transactions', 2);
        $this->assertDatabaseHas('credit_transactions', ['type' => 'purchase', 'amount' => 60, 'balance_after' => 60]);
        $this->assertDatabaseHas('credit_transactions', ['type' => 'bonus', 'amount' => 10, 'balance_after' => 70]);
        $this->assertDatabaseCount('payment_callbacks', 2);
    }

    public function test_invalid_hash_or_amount_never_credits_the_wallet(): void
    {
        $this->seed(DatabaseSeeder::class);
        $seller = $this->approvedSeller();
        $package = CreditPackage::query()->where('name', 'Başlangıç')->firstOrFail();
        $order = $this->order($seller, $package);

        $this->post('/api/payments/paytr/callback', [
            ...$this->callbackPayload($order, 'success'),
            'hash' => 'invalid',
        ])->assertBadRequest();

        $wrongAmount = $this->callbackPayload($order, 'success', 999);
        $this->post('/api/payments/paytr/callback', $wrongAmount)->assertUnprocessable();

        $this->assertDatabaseMissing('seller_credits', ['user_id' => $seller->id]);
        $this->assertDatabaseCount('credit_transactions', 0);
        $this->assertSame('pending', $order->fresh()->status);
    }

    public function test_failed_callback_marks_order_failed_without_crediting_wallet(): void
    {
        $this->seed(DatabaseSeeder::class);
        $seller = $this->approvedSeller();
        $package = CreditPackage::query()->firstOrFail();
        $order = $this->order($seller, $package);

        $payload = [
            ...$this->callbackPayload($order, 'failed'),
            'failed_reason_code' => 'card_declined',
            'failed_reason_msg' => 'İşlem reddedildi',
        ];
        $this->post('/api/payments/paytr/callback', $payload)->assertOk()->assertSeeText('OK');

        $this->assertSame('failed', $order->fresh()->status);
        $this->assertDatabaseCount('credit_transactions', 0);
    }

    private function approvedSeller(): User
    {
        $seller = User::factory()->create(['email' => 'paytr-seller@example.com', 'phone' => '+905551234500']);
        $seller->roles()->attach(Role::query()->where('name', 'seller')->firstOrFail());
        $seller->sellerProfile()->create([
            'profile_type' => 'individual',
            'description' => str_repeat('Onaylı hizmet veren profili. ', 3),
            'approval_status' => 'approved',
        ]);

        return $seller;
    }

    private function order(User $seller, CreditPackage $package): PaymentOrder
    {
        return PaymentOrder::query()->create([
            'merchant_oid' => 'ALCTEST'.$seller->id.$package->id,
            'user_id' => $seller->id,
            'credit_package_id' => $package->id,
            'credit_amount_snapshot' => $package->credit_amount,
            'bonus_snapshot' => $package->bonus_credit,
            'price_snapshot' => $package->price,
            'currency' => 'TL',
            'status' => 'pending',
            'test_mode' => true,
        ]);
    }

    private function callbackPayload(PaymentOrder $order, string $status, ?int $amount = null): array
    {
        $totalAmount = $amount ?? (int) round((float) $order->price_snapshot * 100);
        $hash = base64_encode(hash_hmac(
            'sha256',
            $order->merchant_oid.'test-salt'.$status.$totalAmount,
            'test-key',
            true,
        ));

        return [
            'merchant_oid' => $order->merchant_oid,
            'status' => $status,
            'total_amount' => (string) $totalAmount,
            'currency' => 'TL',
            'hash' => $hash,
        ];
    }
}
