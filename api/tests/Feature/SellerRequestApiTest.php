<?php

namespace Tests\Feature;

use App\Models\BuyerRequest;
use App\Models\Category;
use App\Models\City;
use App\Models\Role;
use App\Models\SellerCredit;
use App\Models\User;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SellerRequestApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_approved_seller_only_sees_matching_requests_as_anonymous_summaries(): void
    {
        $this->seed(DatabaseSeeder::class);
        [$seller, $category, $city, $district] = $this->approvedSeller();
        $matching = $this->buyerRequest($category, $city, $district, [
            'description' => 'Boya işi için arayın: 0555 123 45 67 veya buyer@example.com',
            'full_address' => 'Test Mahallesi, Gizli Sokak No: 5',
        ]);

        $otherCategory = Category::query()->where('slug', 'nakliye')->firstOrFail();
        $this->buyerRequest($otherCategory, $city, $district, ['public_reference' => 'ALC-OTHER-CAT']);
        $otherDistrict = $city->districts()->whereKeyNot($district->id)->firstOrFail();
        $this->buyerRequest($category, $city, $otherDistrict, ['public_reference' => 'ALC-OTHER-LOC']);

        $response = $this->actingAs($seller)
            ->getJson('/api/seller/requests')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $matching->id)
            ->assertJsonPath('data.0.is_unlocked', false)
            ->assertJsonPath('data.0.unlock_cost', 1)
            ->assertJsonMissingPath('data.0.details');

        $payload = $response->json('data.0');
        $this->assertStringNotContainsString('0555 123 45 67', $payload['summary']);
        $this->assertStringNotContainsString('buyer@example.com', $payload['summary']);
        $this->assertStringContainsString('[telefon gizlendi]', $payload['summary']);
        $this->assertStringContainsString('[e-posta gizlendi]', $payload['summary']);
        $this->assertArrayNotHasKey('full_address', $payload);
        $this->assertArrayNotHasKey('contact', $payload);
    }

    public function test_unlock_spends_snapshot_cost_once_and_returns_private_details(): void
    {
        $this->seed(DatabaseSeeder::class);
        [$seller, $category, $city, $district] = $this->approvedSeller();
        $buyerRequest = $this->buyerRequest($category, $city, $district);
        SellerCredit::query()->create(['user_id' => $seller->id, 'balance' => 10]);

        $this->actingAs($seller)
            ->postJson("/api/seller/requests/{$buyerRequest->id}/unlock")
            ->assertOk()
            ->assertJsonPath('already_unlocked', false)
            ->assertJsonPath('balance', 9)
            ->assertJsonPath('data.is_unlocked', true)
            ->assertJsonPath('data.details.contact.phone', $buyerRequest->user->phone)
            ->assertJsonPath('data.details.full_address', $buyerRequest->full_address);

        $this->actingAs($seller)
            ->postJson("/api/seller/requests/{$buyerRequest->id}/unlock")
            ->assertOk()
            ->assertJsonPath('already_unlocked', true)
            ->assertJsonPath('balance', 9);

        $this->assertDatabaseCount('request_unlocks', 1);
        $this->assertDatabaseCount('credit_transactions', 1);
        $this->assertDatabaseHas('credit_transactions', [
            'user_id' => $seller->id,
            'type' => 'spend',
            'amount' => -1,
            'balance_after' => 9,
        ]);
    }

    public function test_unlock_fails_without_enough_credits(): void
    {
        $this->seed(DatabaseSeeder::class);
        [$seller, $category, $city, $district] = $this->approvedSeller();
        $buyerRequest = $this->buyerRequest($category, $city, $district);
        SellerCredit::query()->create(['user_id' => $seller->id, 'balance' => 0]);

        $this->actingAs($seller)
            ->postJson("/api/seller/requests/{$buyerRequest->id}/unlock")
            ->assertUnprocessable()
            ->assertJsonPath('code', 'insufficient_credits')
            ->assertJsonPath('balance', 0)
            ->assertJsonPath('required', 1);

        $this->assertDatabaseCount('request_unlocks', 0);
        $this->assertDatabaseCount('credit_transactions', 0);
    }

    public function test_unapproved_seller_cannot_access_request_feed(): void
    {
        $this->seed(DatabaseSeeder::class);
        $seller = User::factory()->create(['phone' => '+905553333333']);
        $seller->roles()->attach(Role::query()->where('name', 'seller')->firstOrFail());
        $seller->sellerProfile()->create([
            'profile_type' => 'individual',
            'description' => str_repeat('Onay bekleyen hizmet veren profili. ', 3),
            'approval_status' => 'pending',
        ]);

        $this->actingAs($seller)
            ->getJson('/api/seller/requests')
            ->assertForbidden()
            ->assertJsonPath('code', 'seller_approval_required');
    }

    private function approvedSeller(): array
    {
        $seller = User::factory()->create([
            'email' => 'seller@example.com',
            'phone' => '+905551111111',
            'phone_verified_at' => now(),
        ]);
        $seller->roles()->attach(Role::query()->where('name', 'seller')->firstOrFail());
        $seller->sellerProfile()->create([
            'profile_type' => 'individual',
            'description' => str_repeat('Profesyonel hizmet veren profili. ', 3),
            'approval_status' => 'approved',
        ]);

        $category = Category::query()->where('slug', 'hizmet')->firstOrFail();
        $city = City::query()->where('code', '34')->firstOrFail();
        $district = $city->districts()->orderBy('id')->firstOrFail();
        $seller->sellerCategories()->attach($category);
        $seller->sellerLocations()->create([
            'city_id' => $city->id,
            'district_id' => $district->id,
        ]);

        return [$seller, $category, $city, $district];
    }

    private function buyerRequest(Category $category, City $city, $district, array $attributes = []): BuyerRequest
    {
        $buyer = User::factory()->create([
            'email' => fake()->unique()->safeEmail(),
            'phone' => '+90555'.fake()->unique()->numerify('#######'),
            'phone_verified_at' => now(),
        ]);

        return BuyerRequest::query()->create([
            'public_reference' => 'ALC-'.fake()->unique()->numerify('########'),
            'user_id' => $buyer->id,
            'category_id' => $category->id,
            'city_id' => $city->id,
            'district_id' => $district->id,
            'title' => 'Eşleşen test talebi',
            'description' => 'Daire için profesyonel ve zamanında boya hizmeti almak istiyorum.',
            'budget_min' => 10000,
            'budget_max' => 18000,
            'full_address' => 'Test Mahallesi, Gizli Sokak No: 5',
            'attributes' => ['hizmet_turu' => 'Boya', 'baslangic' => '1 hafta içinde'],
            'attribute_schema_snapshot' => [
                ['key' => 'hizmet_turu', 'label' => 'Hizmet türü', 'unit' => null, 'show_in_summary' => true, 'is_private' => false],
                ['key' => 'baslangic', 'label' => 'Başlangıç', 'unit' => null, 'show_in_summary' => true, 'is_private' => true],
            ],
            'status' => 'open',
            'expires_at' => now()->addDays(30),
            ...$attributes,
        ])->load('user');
    }
}
