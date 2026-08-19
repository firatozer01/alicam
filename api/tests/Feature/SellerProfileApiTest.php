<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\City;
use App\Models\Role;
use App\Models\User;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SellerProfileApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_verified_user_can_complete_and_submit_seller_profile(): void
    {
        $this->seed(DatabaseSeeder::class);
        $user = $this->verifiedUser();
        $category = Category::query()->where('slug', 'hizmet')->firstOrFail();
        $city = City::query()->where('code', '34')->with('districts')->firstOrFail();

        $this->actingAs($user);

        $this->putJson('/api/seller/profile', [
            'profile_type' => 'company',
            'company_name' => 'Örnek Ustalar Ltd. Şti.',
            'tax_no' => '1234567890',
            'description' => 'İstanbul genelinde boya, badana ve küçük tadilat hizmetleri sunan deneyimli bir ekibiz.',
        ])->assertOk()->assertJsonPath('data.profile.approval_status', 'draft');

        $this->putJson('/api/seller/categories', [
            'category_ids' => [$category->id],
        ])->assertOk()->assertJsonPath('data.completion.categories', true);

        $this->putJson('/api/seller/locations', [
            'locations' => [[
                'city_id' => $city->id,
                'district_id' => $city->districts->first()->id,
            ]],
        ])->assertOk()->assertJsonPath('data.completion.locations', true);

        $this->postJson('/api/seller/submit')
            ->assertOk()
            ->assertJsonPath('data.profile.approval_status', 'pending')
            ->assertJsonPath('data.completion.can_submit', true);

        $this->assertTrue($user->fresh()->hasRole('seller'));
    }

    public function test_admin_can_approve_pending_seller_and_audit_is_recorded(): void
    {
        $this->seed(DatabaseSeeder::class);
        $seller = $this->verifiedUser();
        $category = Category::query()->where('slug', 'hizmet')->firstOrFail();
        $city = City::query()->where('code', '06')->with('districts')->firstOrFail();

        $seller->sellerProfile()->create([
            'profile_type' => 'individual',
            'description' => 'Ankara genelinde uzun süredir profesyonel bakım ve onarım hizmetleri veriyorum.',
            'approval_status' => 'pending',
            'submitted_at' => now(),
        ]);
        $seller->sellerCategories()->attach($category);
        $seller->sellerLocations()->create([
            'city_id' => $city->id,
            'district_id' => $city->districts->first()->id,
        ]);

        $admin = $this->verifiedUser(['email' => 'admin@example.com', 'phone' => '+905559999999']);
        $admin->roles()->attach(Role::query()->where('name', 'admin')->firstOrFail());

        $this->actingAs($admin)
            ->patchJson("/api/admin/seller-approvals/{$seller->id}", [
                'decision' => 'approved',
            ])
            ->assertOk()
            ->assertJsonPath('data.profile.approval_status', 'approved');

        $this->assertDatabaseHas('audit_logs', [
            'actor_id' => $admin->id,
            'action' => 'seller.approved',
            'auditable_id' => $seller->id,
        ]);
    }

    public function test_non_admin_cannot_access_seller_approvals(): void
    {
        $this->seed(DatabaseSeeder::class);
        $user = $this->verifiedUser();

        $this->actingAs($user)
            ->getJson('/api/admin/seller-approvals')
            ->assertForbidden()
            ->assertJsonPath('code', 'role_required');
    }

    private function verifiedUser(array $attributes = []): User
    {
        return User::factory()->create([
            'phone' => '+905551234567',
            'phone_verified_at' => now(),
            ...$attributes,
        ]);
    }
}
