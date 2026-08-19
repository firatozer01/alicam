<?php

namespace Tests\Feature;

use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class LocationApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_all_turkey_provinces_and_districts_are_seeded(): void
    {
        $this->seed(DatabaseSeeder::class);

        $this->assertDatabaseCount('cities', 81);
        $this->assertDatabaseCount('districts', 973);

        $this->getJson('/api/locations')
            ->assertOk()
            ->assertJsonCount(81, 'data');

        $istanbul = $this->app['db']->table('cities')->where('code', '34')->first();
        $this->assertSame(39, $this->app['db']->table('districts')->where('city_id', $istanbul->id)->count());
    }
}
