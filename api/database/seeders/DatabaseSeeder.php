<?php

namespace Database\Seeders;

use App\Models\Category;
use App\Models\City;
use App\Models\CreditPackage;
use App\Models\Role;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        foreach ([
            'buyer' => 'Alıcı',
            'seller' => 'Hizmet Veren',
            'admin' => 'Yönetici',
            'moderator' => 'Moderatör',
        ] as $name => $label) {
            Role::query()->updateOrCreate(['name' => $name], ['label' => $label]);
        }

        $definitions = [
            [
                'name' => 'Hizmet', 'slug' => 'hizmet', 'icon' => '✦',
                'color' => '#06B6D4', 'unlock_cost' => 1,
                'attributes' => [
                    ['key' => 'hizmet_turu', 'label' => 'Hizmet türü', 'type' => 'text', 'is_required' => true, 'is_filterable' => true],
                    ['key' => 'baslangic', 'label' => 'Başlangıç zamanı', 'type' => 'select', 'options' => ['Hemen', '1 hafta içinde', '1 ay içinde', 'Tarih esnek'], 'is_required' => true],
                ],
            ],
            [
                'name' => 'Nakliye', 'slug' => 'nakliye', 'icon' => '↗',
                'color' => '#16A34A', 'unlock_cost' => 2,
                'attributes' => [
                    ['key' => 'tasima_turu', 'label' => 'Taşıma türü', 'type' => 'select', 'options' => ['Ev taşıma', 'Ofis taşıma', 'Parça eşya'], 'is_required' => true, 'is_filterable' => true],
                    ['key' => 'kat_bilgisi', 'label' => 'Kat bilgisi', 'type' => 'number', 'is_required' => false, 'unit' => 'kat'],
                ],
            ],
            [
                'name' => 'Tadilat', 'slug' => 'tadilat', 'icon' => '⌂',
                'color' => '#7C3AED', 'unlock_cost' => 5,
                'attributes' => [
                    ['key' => 'is_turu', 'label' => 'İş türü', 'type' => 'multiselect', 'options' => ['Boya', 'Parke', 'Mutfak', 'Banyo', 'Komple tadilat'], 'is_required' => true, 'is_filterable' => true],
                    ['key' => 'metrekare', 'label' => 'Yaklaşık alan', 'type' => 'number', 'is_required' => false, 'unit' => 'm²'],
                ],
            ],
        ];

        foreach ($definitions as $sortOrder => $definition) {
            $attributes = $definition['attributes'];
            $unlockCost = $definition['unlock_cost'];
            unset($definition['attributes'], $definition['unlock_cost']);

            $category = Category::query()->updateOrCreate(
                ['slug' => $definition['slug']],
                [...$definition, 'sort_order' => $sortOrder + 1, 'is_active' => true],
            );

            $category->creditCost()->updateOrCreate([], ['unlock_cost' => $unlockCost]);

            foreach ($attributes as $attributeOrder => $attribute) {
                $category->attributes()->updateOrCreate(
                    ['key' => $attribute['key']],
                    [...$attribute, 'sort_order' => $attributeOrder + 1],
                );
            }
        }

        foreach ([
            ['name' => 'Başlangıç', 'credit_amount' => 20, 'bonus_credit' => 0, 'price' => 450],
            ['name' => 'Standart', 'credit_amount' => 60, 'bonus_credit' => 10, 'price' => 1200],
            ['name' => 'Profesyonel', 'credit_amount' => 150, 'bonus_credit' => 30, 'price' => 2700],
            ['name' => 'Kurumsal', 'credit_amount' => 400, 'bonus_credit' => 100, 'price' => 6500],
        ] as $sortOrder => $package) {
            CreditPackage::query()->updateOrCreate(
                ['name' => $package['name']],
                [...$package, 'is_active' => true, 'sort_order' => $sortOrder + 1],
            );
        }

        $locationData = json_decode(
            file_get_contents(database_path('data/turkey_locations.json')),
            true,
            flags: JSON_THROW_ON_ERROR,
        );

        City::query()->update(['is_active' => false]);

        foreach ($locationData['provinces'] as $province) {
            $city = City::query()->updateOrCreate(
                ['code' => $province['code']],
                [
                    'name' => $province['name'],
                    'slug' => str($province['name'])->slug(),
                    'is_active' => true,
                ],
            );

            $city->districts()->update(['is_active' => false]);

            foreach ($province['districts'] as $districtName) {
                $city->districts()->updateOrCreate(
                    ['slug' => str($districtName)->slug()],
                    ['name' => $districtName, 'is_active' => true],
                );
            }
        }
    }
}
