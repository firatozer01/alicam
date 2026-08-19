<?php

namespace Tests\Feature;

use App\Models\BuyerRequest;
use App\Models\Category;
use App\Models\City;
use App\Models\Offer;
use App\Models\Role;
use App\Models\SellerCredit;
use App\Models\User;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class MarketplaceDiscoveryApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_public_marketplace_lists_requests_without_private_buyer_data(): void
    {
        $this->seed(DatabaseSeeder::class);
        [$seller, $buyerRequest] = $this->marketplace();

        $this->getJson('/api/marketplace')
            ->assertOk()
            ->assertJsonPath('data.requests.0.title', $buyerRequest->title)
            ->assertJsonPath('data.stats.active_requests', 1)
            ->assertJsonMissing(['full_address' => $buyerRequest->full_address])
            ->assertJsonMissing(['email' => $buyerRequest->user->email]);

        $this->assertSame('approved', $seller->sellerProfile->approval_status);
    }

    public function test_approved_seller_can_manage_service_catalog(): void
    {
        $this->seed(DatabaseSeeder::class);
        [$seller] = $this->marketplace();
        $category = $seller->sellerCategories->first();

        $response = $this->actingAs($seller)->postJson('/api/seller/services', [
            'category_id' => $category->id,
            'title' => 'Anahtar teslim boya hizmeti',
            'description' => 'Keşif, malzeme planı, boya uygulaması ve temiz teslim adımlarının tamamını kapsar.',
            'price_from' => 12500,
            'delivery_time' => '3–5 gün',
            'is_active' => true,
        ])->assertCreated()->assertJsonPath('data.category.slug', $category->slug);

        $serviceId = $response->json('data.id');
        $this->actingAs($seller)->putJson("/api/seller/services/{$serviceId}", [
            'category_id' => $category->id,
            'title' => 'Premium boya ve badana',
            'description' => 'Ücretsiz keşif, yüzey hazırlığı, malzeme planı ve temiz teslim adımlarını kapsar.',
            'price_from' => 14500,
            'delivery_time' => '4–6 gün',
            'is_active' => true,
        ])->assertOk()->assertJsonPath('data.title', 'Premium boya ve badana');

        $this->actingAs($seller)->deleteJson("/api/seller/services/{$serviceId}")->assertOk();
        $this->assertDatabaseMissing('seller_services', ['id' => $serviceId]);
    }

    public function test_featured_package_spends_credits_and_creates_ledger_entry(): void
    {
        $this->seed(DatabaseSeeder::class);
        [$seller] = $this->marketplace();
        SellerCredit::query()->create(['user_id' => $seller->id, 'balance' => 100]);

        $this->actingAs($seller)->postJson('/api/seller/featured', ['package' => 'week'])
            ->assertCreated()
            ->assertJsonPath('data.balance', 75)
            ->assertJsonPath('data.credit_spent', 25);

        $this->assertDatabaseHas('seller_credits', ['user_id' => $seller->id, 'balance' => 75]);
        $this->assertDatabaseHas('seller_promotions', ['seller_id' => $seller->id, 'credit_cost' => 25]);
        $this->assertDatabaseHas('credit_transactions', [
            'user_id' => $seller->id,
            'type' => 'spend',
            'amount' => -25,
            'reference_type' => 'seller_promotion',
        ]);

        $this->actingAs($seller)->getJson('/api/seller/credits')
            ->assertOk()
            ->assertJsonPath('data.balance', 75)
            ->assertJsonPath('data.spent_this_month', 25);
    }

    public function test_buyer_can_review_accepted_offer_and_rating_appears_publicly(): void
    {
        $this->seed(DatabaseSeeder::class);
        [$seller, $buyerRequest] = $this->marketplace();
        $buyerRequest->update(['status' => 'accepted']);
        $offer = Offer::query()->create([
            'request_id' => $buyerRequest->id,
            'seller_id' => $seller->id,
            'price' => 15000,
            'message' => 'Kabul edilmiş test hizmeti için ayrıntılı teklif açıklaması burada yer alır.',
            'status' => 'accepted',
            'reviewed_at' => now(),
            'accepted_at' => now(),
        ]);

        $this->actingAs($buyerRequest->user)->postJson("/api/offers/{$offer->id}/review", [
            'rating' => 5,
            'comment' => 'İletişimi güçlü, işi temiz ve zamanında tamamlayan bir ekipti.',
        ])->assertCreated()->assertJsonPath('data.rating', 5);

        $this->getJson('/api/marketplace')
            ->assertOk()
            ->assertJsonFragment(['id' => $seller->id, 'rating' => 5]);
    }

    private function marketplace(): array
    {
        $seller = User::factory()->create([
            'email' => 'discovery-seller@example.com',
            'phone' => '+905553331111',
            'phone_verified_at' => now(),
        ]);
        $seller->roles()->attach(Role::query()->where('name', 'seller')->firstOrFail());
        $seller->sellerProfile()->create([
            'profile_type' => 'company',
            'company_name' => 'Keşif Usta Ltd.',
            'tax_no' => '1234567890',
            'description' => str_repeat('Doğrulanmış ve deneyimli hizmet ekibi. ', 3),
            'approval_status' => 'approved',
        ]);
        $category = Category::query()->where('slug', 'hizmet')->firstOrFail();
        $city = City::query()->where('code', '34')->with('districts')->firstOrFail();
        $district = $city->districts->first();
        $seller->sellerCategories()->attach($category);
        $seller->sellerLocations()->create(['city_id' => $city->id, 'district_id' => $district->id]);

        $buyer = User::factory()->create([
            'email' => 'discovery-buyer@example.com',
            'phone' => '+905553332222',
        ]);
        $buyerRequest = BuyerRequest::query()->create([
            'public_reference' => 'ALC-DISCOVERY-TEST',
            'user_id' => $buyer->id,
            'category_id' => $category->id,
            'city_id' => $city->id,
            'district_id' => $district->id,
            'title' => 'Ev için profesyonel temizlik hizmeti',
            'description' => 'Taşınma öncesi ayrıntılı ev temizliği için güvenilir bir ekip arıyorum.',
            'budget_min' => 5000,
            'budget_max' => 8500,
            'full_address' => 'Gizli Sokak No: 7',
            'attributes' => ['hizmet_turu' => 'Temizlik'],
            'attribute_schema_snapshot' => [],
            'status' => 'open',
            'expires_at' => now()->addDays(30),
        ])->load('user');

        return [$seller->fresh(['sellerProfile', 'sellerCategories']), $buyerRequest];
    }
}
