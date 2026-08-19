<?php

namespace Tests\Feature;

use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CategoryApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_active_categories_are_publicly_listed(): void
    {
        $this->seed(DatabaseSeeder::class);

        $this->getJson('/api/categories')
            ->assertOk()
            ->assertJsonCount(3, 'data')
            ->assertJsonPath('data.0.slug', 'hizmet')
            ->assertJsonPath('data.2.credit_cost.unlock_cost', 5);
    }

    public function test_category_form_schema_is_available_by_slug(): void
    {
        $this->seed(DatabaseSeeder::class);

        $this->getJson('/api/categories/tadilat/attributes')
            ->assertOk()
            ->assertJsonPath('data.slug', 'tadilat')
            ->assertJsonPath('data.attributes.0.key', 'is_turu');
    }
}
