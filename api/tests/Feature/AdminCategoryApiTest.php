<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Role;
use App\Models\User;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AdminCategoryApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_list_all_categories_with_management_metadata(): void
    {
        $this->seed(DatabaseSeeder::class);

        $this->actingAs($this->admin())
            ->getJson('/api/admin/categories')
            ->assertOk()
            ->assertJsonCount(3, 'data')
            ->assertJsonPath('data.0.attributes_count', 2)
            ->assertJsonPath('data.2.credit_cost.unlock_cost', 5);
    }

    public function test_non_admin_cannot_manage_categories(): void
    {
        $this->seed(DatabaseSeeder::class);

        $this->actingAs(User::factory()->create())
            ->getJson('/api/admin/categories')
            ->assertForbidden()
            ->assertJsonPath('code', 'role_required');
    }

    public function test_admin_can_create_and_update_category_with_credit_cost(): void
    {
        $this->seed(DatabaseSeeder::class);
        $admin = $this->admin();

        $response = $this->actingAs($admin)->postJson('/api/admin/categories', [
            'name' => 'Eğitim',
            'slug' => 'egitim',
            'icon' => '⌘',
            'color' => '#EC4899',
            'is_active' => true,
            'sort_order' => 4,
            'unlock_cost' => 6,
        ])->assertCreated()
            ->assertJsonPath('data.slug', 'egitim')
            ->assertJsonPath('data.credit_cost.unlock_cost', 6);

        $categoryId = $response->json('data.id');

        $this->actingAs($admin)->putJson("/api/admin/categories/{$categoryId}", [
            'name' => 'Eğitim ve Ders',
            'slug' => 'egitim-ders',
            'icon' => '⌘',
            'color' => '#7C3AED',
            'is_active' => false,
            'sort_order' => 5,
            'unlock_cost' => 8,
        ])->assertOk()
            ->assertJsonPath('data.name', 'Eğitim ve Ders')
            ->assertJsonPath('data.is_active', false)
            ->assertJsonPath('data.credit_cost.unlock_cost', 8);

        $this->assertDatabaseHas('audit_logs', [
            'actor_id' => $admin->id,
            'action' => 'category.created',
            'auditable_id' => $categoryId,
        ]);
        $this->assertDatabaseHas('audit_logs', [
            'actor_id' => $admin->id,
            'action' => 'category.updated',
            'auditable_id' => $categoryId,
        ]);
    }

    public function test_admin_can_create_update_and_delete_dynamic_form_attribute(): void
    {
        $this->seed(DatabaseSeeder::class);
        $admin = $this->admin();
        $category = Category::query()->where('slug', 'hizmet')->firstOrFail();
        $initialVersion = $category->schema_version;

        $response = $this->actingAs($admin)->postJson("/api/admin/categories/{$category->id}/attributes", [
            'key' => 'hizmet_seviyesi',
            'label' => 'Hizmet seviyesi',
            'type' => 'select',
            'options' => ['Standart', 'Profesyonel'],
            'unit' => null,
            'help_text' => 'Beklediğiniz hizmet seviyesini seçin.',
            'is_required' => true,
            'is_filterable' => true,
            'show_in_summary' => true,
            'is_private' => false,
            'sort_order' => 3,
        ])->assertCreated()
            ->assertJsonPath('data.key', 'hizmet_seviyesi')
            ->assertJsonPath('schema_version', $initialVersion + 1);

        $attributeId = $response->json('data.id');

        $this->actingAs($admin)->putJson("/api/admin/category-attributes/{$attributeId}", [
            'key' => 'hizmet_seviyesi',
            'label' => 'Beklenen hizmet seviyesi',
            'type' => 'multiselect',
            'options' => ['Standart', 'Profesyonel', 'Kurumsal'],
            'unit' => null,
            'help_text' => null,
            'is_required' => false,
            'is_filterable' => true,
            'show_in_summary' => true,
            'is_private' => false,
            'sort_order' => 3,
        ])->assertOk()
            ->assertJsonPath('data.type', 'multiselect')
            ->assertJsonPath('schema_version', $initialVersion + 2);

        $this->actingAs($admin)
            ->deleteJson("/api/admin/category-attributes/{$attributeId}")
            ->assertOk()
            ->assertJsonPath('schema_version', $initialVersion + 3);

        $this->assertDatabaseMissing('category_attributes', ['id' => $attributeId]);
        $this->assertDatabaseHas('audit_logs', [
            'actor_id' => $admin->id,
            'action' => 'category_attribute.deleted',
            'auditable_id' => $attributeId,
        ]);
    }

    private function admin(): User
    {
        $admin = User::factory()->create();
        $admin->roles()->attach(Role::query()->where('name', 'admin')->firstOrFail());

        return $admin;
    }
}
