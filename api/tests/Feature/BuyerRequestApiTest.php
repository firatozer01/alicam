<?php

namespace Tests\Feature;

use App\Models\City;
use App\Models\Role;
use App\Models\User;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class BuyerRequestApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_verified_buyer_can_publish_a_request_with_schema_snapshot(): void
    {
        $this->seed(DatabaseSeeder::class);
        $user = User::factory()->create([
            'phone' => '+905551234567',
            'phone_verified_at' => now(),
        ]);
        $user->roles()->attach(Role::query()->where('name', 'buyer')->firstOrFail());
        $city = City::query()->where('code', '34')->with('districts')->firstOrFail();

        $this->actingAs($user)
            ->postJson('/api/requests', [
                'category_slug' => 'hizmet',
                'title' => 'Ev için boya ustası arıyorum',
                'description' => 'İki odalı dairenin duvarları ve tavanı boyanacak.',
                'budget_min' => 10000,
                'budget_max' => 18000,
                'city_id' => $city->id,
                'district_id' => $city->districts->first()->id,
                'attributes' => [
                    'hizmet_turu' => 'Boya ustası',
                    'baslangic' => '1 hafta içinde',
                ],
            ])
            ->assertCreated()
            ->assertJsonPath('data.category.slug', 'hizmet')
            ->assertJsonPath('data.status', 'open')
            ->assertJsonPath('data.attributes.hizmet_turu', 'Boya ustası');

        $this->assertDatabaseCount('requests', 1);
        $this->assertDatabaseHas('requests', ['user_id' => $user->id, 'status' => 'open']);
        $this->assertNotEmpty(
            json_decode((string) $this->app['db']->table('requests')->value('attribute_schema_snapshot'), true),
        );
    }

    public function test_unverified_buyer_cannot_publish_a_request(): void
    {
        $this->seed(DatabaseSeeder::class);
        $user = User::factory()->unverified()->create(['phone' => '+905559876543']);

        $this->actingAs($user)
            ->postJson('/api/requests', [])
            ->assertForbidden()
            ->assertJsonPath('code', 'contact_verification_required');

        $this->assertDatabaseCount('requests', 0);
    }
}
