<?php

namespace Tests\Feature;

use App\Models\User;
use App\Models\VerificationCode;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class AuthenticationApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_user_can_register_with_a_buyer_role(): void
    {
        $this->seed(DatabaseSeeder::class);
        $this->withHeader('Origin', 'http://localhost:3000');

        $payload = [
            'name' => 'Ayşe Yılmaz',
            'email' => 'ayse@example.com',
            'phone' => '+905551112233',
            'password' => 'guvenli123',
            'password_confirmation' => 'guvenli123',
        ];

        $this->postJson('/api/register', $payload)
            ->assertCreated()
            ->assertJsonPath('data.email', 'ayse@example.com')
            ->assertJsonPath('data.roles.0', 'buyer')
            ->assertJsonPath('data.verification.complete', false);

        $this->assertDatabaseHas('users', ['email' => 'ayse@example.com', 'phone' => '+905551112233']);
        $this->assertDatabaseCount('verification_codes', 2);
    }

    public function test_user_can_login_with_a_session(): void
    {
        $user = User::factory()->create([
            'name' => 'Ayşe Yılmaz',
            'email' => 'ayse@example.com',
            'phone' => '+905551112233',
            'password' => 'guvenli123',
        ]);
        $this->withHeader('Origin', 'http://localhost:3000');

        $this->postJson('/api/login', [
            'email' => 'ayse@example.com',
            'password' => 'guvenli123',
        ])->assertOk()->assertJsonPath('data.name', 'Ayşe Yılmaz');

        $this->assertAuthenticatedAs($user);
    }

    public function test_user_can_logout(): void
    {
        $user = User::factory()->create(['phone' => '+905551112233']);
        $this->actingAs($user);
        $this->withHeader('Origin', 'http://localhost:3000');

        $this->postJson('/api/logout')
            ->assertOk()
            ->assertJsonPath('message', 'Oturum kapatıldı.');
    }

    public function test_email_and_phone_codes_can_be_verified(): void
    {
        $this->seed(DatabaseSeeder::class);
        $user = User::factory()->unverified()->create(['phone' => '+905551234567']);
        $this->actingAs($user);

        foreach (['email', 'phone'] as $channel) {
            $this->postJson('/api/verification/send', ['channel' => $channel])->assertOk();

            $record = VerificationCode::query()
                ->where('user_id', $user->id)
                ->where('channel', $channel)
                ->latest('id')
                ->firstOrFail();

            $record->update(['code_hash' => Hash::make('123456')]);

            $this->postJson('/api/verification/verify', [
                'channel' => $channel,
                'code' => '123456',
            ])->assertOk();
        }

        $this->getJson('/api/me')
            ->assertOk()
            ->assertJsonPath('data.verification.complete', true);
    }
}
