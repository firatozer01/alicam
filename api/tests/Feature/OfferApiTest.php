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

class OfferApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_first_offer_spends_category_credit_once_and_can_be_updated_for_free(): void
    {
        $this->seed(DatabaseSeeder::class);
        [$seller, $buyerRequest] = $this->marketplace();
        SellerCredit::query()->create(['user_id' => $seller->id, 'balance' => 5]);

        $response = $this->actingAs($seller)->postJson('/api/seller/offers', [
            'request_id' => $buyerRequest->id,
            'price' => 14500,
            'message' => 'Malzeme ve işçilik dahil olacak şekilde iki günde tamamlayabiliriz.',
        ])->assertCreated()
            ->assertJsonPath('balance', 4)
            ->assertJsonPath('credit_spent', 1)
            ->assertJsonPath('data.status', 'pending');

        $offerId = $response->json('data.id');
        $this->actingAs($seller)->putJson("/api/seller/offers/{$offerId}", [
            'price' => 13800,
            'message' => 'Güncel teklifimiz malzeme, işçilik ve iki günlük teslimi kapsar.',
        ])->assertOk()->assertJsonPath('data.price', '13800.00');

        $this->assertDatabaseHas('requests', ['id' => $buyerRequest->id, 'status' => 'in_negotiation']);
        $this->assertDatabaseHas('seller_credits', ['user_id' => $seller->id, 'balance' => 4]);
        $this->assertDatabaseCount('request_unlocks', 1);
        $this->assertDatabaseCount('credit_transactions', 1);
    }

    public function test_buyer_can_accept_offer_and_seller_contact_is_then_returned(): void
    {
        $this->seed(DatabaseSeeder::class);
        [$seller, $buyerRequest] = $this->marketplace();
        SellerCredit::query()->create(['user_id' => $seller->id, 'balance' => 5]);
        $offerId = $this->actingAs($seller)->postJson('/api/seller/offers', [
            'request_id' => $buyerRequest->id,
            'price' => 14500,
            'message' => 'Malzeme ve işçilik dahil, planlanan tarihte hizmet verebiliriz.',
        ])->json('data.id');

        $this->actingAs($buyerRequest->user)
            ->getJson("/api/requests/{$buyerRequest->id}/offers")
            ->assertOk()
            ->assertJsonMissingPath('data.0.seller.contact');

        $this->actingAs($buyerRequest->user)
            ->patchJson("/api/offers/{$offerId}", ['decision' => 'accepted'])
            ->assertOk()
            ->assertJsonPath('data.status', 'accepted')
            ->assertJsonPath('data.seller.contact.phone', $seller->phone);

        $this->assertDatabaseHas('requests', ['id' => $buyerRequest->id, 'status' => 'accepted']);
    }

    public function test_rejecting_only_offer_reopens_request(): void
    {
        $this->seed(DatabaseSeeder::class);
        [$seller, $buyerRequest] = $this->marketplace();
        SellerCredit::query()->create(['user_id' => $seller->id, 'balance' => 5]);
        $offerId = $this->actingAs($seller)->postJson('/api/seller/offers', [
            'request_id' => $buyerRequest->id,
            'price' => 14500,
            'message' => 'Malzeme ve işçilik dahil, planlanan tarihte hizmet verebiliriz.',
        ])->json('data.id');

        $this->actingAs($buyerRequest->user)
            ->patchJson("/api/offers/{$offerId}", ['decision' => 'rejected'])
            ->assertOk()
            ->assertJsonPath('data.status', 'rejected');

        $this->assertSame('open', $buyerRequest->fresh()->status);
    }

    public function test_offer_is_not_created_when_seller_has_insufficient_credits(): void
    {
        $this->seed(DatabaseSeeder::class);
        [$seller, $buyerRequest] = $this->marketplace();
        SellerCredit::query()->create(['user_id' => $seller->id, 'balance' => 0]);

        $this->actingAs($seller)->postJson('/api/seller/offers', [
            'request_id' => $buyerRequest->id,
            'price' => 14500,
            'message' => 'Malzeme ve işçilik dahil, planlanan tarihte hizmet verebiliriz.',
        ])->assertUnprocessable()->assertJsonPath('code', 'insufficient_credits');

        $this->assertDatabaseCount('offers', 0);
        $this->assertDatabaseCount('request_unlocks', 0);
    }

    private function marketplace(): array
    {
        $seller = User::factory()->create([
            'email' => 'offer-seller@example.com',
            'phone' => '+905551111111',
            'phone_verified_at' => now(),
        ]);
        $seller->roles()->attach(Role::query()->where('name', 'seller')->firstOrFail());
        $seller->sellerProfile()->create([
            'profile_type' => 'company',
            'company_name' => 'Usta Hizmet Ltd.',
            'tax_no' => '1234567890',
            'description' => str_repeat('Profesyonel hizmet sağlayan onaylı firma. ', 3),
            'approval_status' => 'approved',
        ]);
        $category = Category::query()->where('slug', 'hizmet')->firstOrFail();
        $city = City::query()->where('code', '34')->with('districts')->firstOrFail();
        $district = $city->districts->first();
        $seller->sellerCategories()->attach($category);
        $seller->sellerLocations()->create(['city_id' => $city->id, 'district_id' => $district->id]);

        $buyer = User::factory()->create(['email' => 'offer-buyer@example.com', 'phone' => '+905552222222']);
        $buyerRequest = BuyerRequest::query()->create([
            'public_reference' => 'ALC-OFFER-TEST',
            'user_id' => $buyer->id,
            'category_id' => $category->id,
            'city_id' => $city->id,
            'district_id' => $district->id,
            'title' => 'Ev için boya ustası arıyorum',
            'description' => 'İki odalı dairenin duvar ve tavanları için boya hizmeti gerekiyor.',
            'budget_min' => 10000,
            'budget_max' => 18000,
            'full_address' => 'Test Mahallesi No: 3',
            'attributes' => ['hizmet_turu' => 'Boya'],
            'attribute_schema_snapshot' => [],
            'status' => 'open',
            'expires_at' => now()->addDays(30),
        ])->load('user');

        return [$seller, $buyerRequest];
    }
}
