<?php

namespace Database\Seeders;

use App\Models\BuyerRequest;
use App\Models\Category;
use App\Models\City;
use App\Models\CreditTransaction;
use App\Models\Offer;
use App\Models\Role;
use App\Models\SellerCredit;
use App\Models\SellerLocation;
use App\Models\SellerProfile;
use App\Models\SellerPromotion;
use App\Models\SellerReview;
use App\Models\SellerService;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class DemoMarketplaceSeeder extends Seeder
{
    public function run(): void
    {
        DB::transaction(function (): void {
            $roles = Role::query()->whereIn('name', ['admin', 'buyer', 'seller'])->get()->keyBy('name');
            $admin = $this->user('admin@alicam.net', 'Alıcam Yönetici', '+905550000101');
            $admin->roles()->syncWithoutDetaching([$roles['admin']->id]);

            $mainBuyer = $this->user('musteri@alicam.net', 'Test Müşteri', '+905550000103');
            $mainBuyer->roles()->syncWithoutDetaching([$roles['buyer']->id]);

            $buyers = collect([$mainBuyer]);
            foreach (range(1, 10) as $index) {
                $buyer = $this->user(
                    sprintf('demo.musteri%02d@alicam.test', $index),
                    ['Ayşe Yıldız', 'Mehmet Kaya', 'Zeynep Arslan', 'Emre Demir', 'Selin Aksoy', 'Can Öz', 'Ece Şahin', 'Mert Aydın', 'Derya Koç', 'Burak Tunç'][$index - 1],
                    sprintf('+90555920%04d', $index),
                );
                $buyer->roles()->syncWithoutDetaching([$roles['buyer']->id]);
                $buyers->push($buyer);
            }

            $categories = Category::query()->with('attributes')->get()->keyBy('slug');
            $sellerDefinitions = [
                ['Merkez Yapı', 'Murat Karaca', ['tadilat'], '34', 'kadikoy', 4.9],
                ['Ada Nakliyat', 'Ali Yalçın', ['nakliye'], '34', 'kadikoy', 4.8],
                ['Nova Dijital', 'Nehir Kılıç', ['hizmet'], '34', 'kadikoy', 4.9],
                ['Usta Evi', 'Orhan Şen', ['tadilat', 'hizmet'], '06', null, 4.7],
                ['Ege Taşıma', 'Cenk Ergin', ['nakliye'], '35', null, 4.8],
                ['İnce İşler Atölyesi', 'Seda Eren', ['tadilat'], '34', 'uskudar', 5.0],
                ['Pusula Hizmet', 'Barış Tekin', ['hizmet'], '16', null, 4.6],
                ['Akdeniz Usta', 'Gökhan Acar', ['tadilat', 'nakliye'], '07', null, 4.7],
            ];

            $sellers = collect();
            foreach ($sellerDefinitions as $index => [$company, $name, $slugs, $cityCode, $districtSlug, $rating]) {
                $seller = $this->user(
                    sprintf('demo.satici%02d@alicam.test', $index + 1),
                    $name,
                    sprintf('+90555910%04d', $index + 1),
                );
                $seller->roles()->syncWithoutDetaching([$roles['seller']->id]);
                SellerProfile::query()->updateOrCreate(['user_id' => $seller->id], [
                    'profile_type' => 'company',
                    'company_name' => $company,
                    'tax_no' => sprintf('90000000%02d', $index + 1),
                    'description' => "{$company}, doğrulanmış ekibiyle zamanında teslim, şeffaf fiyatlandırma ve güçlü müşteri iletişimi sunar.",
                    'approval_status' => 'approved',
                    'submitted_at' => now()->subMonths(4),
                    'reviewed_at' => now()->subMonths(4)->addDay(),
                    'reviewed_by' => $admin->id,
                ]);
                $seller->sellerCategories()->sync(collect($slugs)->map(fn ($slug) => $categories[$slug]->id));

                $city = City::query()->where('code', $cityCode)->with('districts')->firstOrFail();
                $district = $districtSlug
                    ? $city->districts->firstWhere('slug', $districtSlug)
                    : $city->districts->first();
                SellerLocation::query()->updateOrCreate(
                    ['seller_id' => $seller->id, 'district_id' => $district->id],
                    ['city_id' => $city->id],
                );

                SellerCredit::query()->updateOrCreate(['user_id' => $seller->id], ['balance' => 300 + ($index * 35)]);
                foreach ($slugs as $serviceIndex => $slug) {
                    $category = $categories[$slug];
                    SellerService::query()->updateOrCreate(
                        ['user_id' => $seller->id, 'title' => $this->serviceTitle($slug, $company, $serviceIndex)],
                        [
                            'category_id' => $category->id,
                            'description' => $this->serviceDescription($slug, $company),
                            'price_from' => [3500, 8500, 14500][($index + $serviceIndex) % 3],
                            'delivery_time' => ['Aynı gün', '2–3 gün', '1 hafta içinde'][($index + $serviceIndex) % 3],
                            'is_active' => true,
                        ],
                    );
                }
                $sellers->push(['user' => $seller, 'slugs' => $slugs, 'rating' => $rating]);
            }

            $testSeller = User::query()->where('email', 'satici@alicam.net')->first();
            if ($testSeller) {
                foreach ($categories as $category) {
                    SellerService::query()->updateOrCreate(
                        ['user_id' => $testSeller->id, 'title' => "{$category->name} için test hizmeti"],
                        [
                            'category_id' => $category->id,
                            'description' => 'Panelde hizmet yönetimi, düzenleme ve görünürlük akışlarını denemek için hazırlanmış örnek hizmet kaydıdır.',
                            'price_from' => 5000,
                            'delivery_time' => '3–5 gün',
                            'is_active' => true,
                        ],
                    );
                }
            }

            $this->seedPromotions($sellers);
            $this->seedRequestsAndOffers($buyers, $sellers, $categories);
        });
    }

    private function user(string $email, string $name, string $phone): User
    {
        $user = User::query()->firstOrCreate(['email' => $email], [
            'name' => $name,
            'phone' => $phone,
            'password' => Str::password(24),
            'status' => 'active',
        ]);
        $user->forceFill([
            'email_verified_at' => $user->email_verified_at ?? now(),
            'phone_verified_at' => $user->phone_verified_at ?? now(),
        ])->save();

        return $user;
    }

    private function seedPromotions($sellers): void
    {
        foreach ($sellers->take(4) as $index => $definition) {
            $seller = $definition['user'];
            $promotion = SellerPromotion::query()->updateOrCreate(
                ['seller_id' => $seller->id, 'starts_at' => now()->startOfDay()],
                [
                    'credit_cost' => 25,
                    'expires_at' => now()->addDays(7 + $index)->endOfDay(),
                ],
            );
            $wallet = SellerCredit::query()->where('user_id', $seller->id)->firstOrFail();
            CreditTransaction::query()->updateOrCreate(
                ['user_id' => $seller->id, 'reference_type' => 'seller_promotion', 'reference_id' => $promotion->id],
                [
                    'type' => 'spend',
                    'amount' => -25,
                    'balance_after' => $wallet->balance,
                    'metadata' => ['package' => 'week', 'demo' => true],
                ],
            );
        }
    }

    private function seedRequestsAndOffers($buyers, $sellers, $categories): void
    {
        $titles = [
            ['tadilat', '2+1 daire için komple boya ve badana', 24000, 38000],
            ['nakliye', 'Kadıköy’den Üsküdar’a ev taşıma', 18000, 27000],
            ['hizmet', 'Küçük işletme için sosyal medya yönetimi', 9000, 15000],
            ['tadilat', 'Mutfak dolaplarının yenilenmesi', 45000, 70000],
            ['nakliye', 'Ofis eşyaları şehir içi taşıma', 14000, 22000],
            ['hizmet', 'Kurumsal web sitesi içerik hazırlığı', 12000, 20000],
            ['tadilat', 'Banyo seramik ve tesisat yenileme', 55000, 85000],
            ['nakliye', 'Parça eşya Ankara nakliyesi', 8000, 13000],
            ['hizmet', 'Aylık ön muhasebe desteği', 6000, 10000],
            ['tadilat', 'Salon için parke döşeme', 28000, 42000],
            ['nakliye', 'Öğrenci evi taşınması', 10000, 16000],
            ['hizmet', 'Ürün fotoğraf çekimi', 7500, 12500],
        ];
        $istanbul = City::query()->where('code', '34')->with('districts')->firstOrFail();
        $kadikoy = $istanbul->districts->firstWhere('slug', 'kadikoy');

        foreach (range(1, 36) as $number) {
            [$slug, $title, $budgetMin, $budgetMax] = $titles[($number - 1) % count($titles)];
            $category = $categories[$slug];
            $buyer = $number <= 9 ? $buyers->first() : $buyers[($number - 1) % $buyers->count()];
            $status = $number % 7 === 0 ? 'open' : ($number % 5 === 0 ? 'accepted' : 'in_negotiation');
            $request = BuyerRequest::query()->updateOrCreate(
                ['public_reference' => sprintf('ALC-DEMO-%03d', $number)],
                [
                    'user_id' => $buyer->id,
                    'category_id' => $category->id,
                    'city_id' => $istanbul->id,
                    'district_id' => $kadikoy->id,
                    'title' => $title.($number > count($titles) ? ' · '.(int) ceil($number / count($titles)) : ''),
                    'description' => 'İşin kapsamını yerinde değerlendirebilecek, iletişimi güçlü ve takvime sadık bir profesyonelden ayrıntılı teklif bekliyorum.',
                    'budget_min' => $budgetMin + ($number * 150),
                    'budget_max' => $budgetMax + ($number * 250),
                    'full_address' => 'Kadıköy, İstanbul — açık adres yalnızca kontörle açılır.',
                    'attributes' => $this->attributes($slug),
                    'attribute_schema_snapshot' => $category->attributes->map(fn ($attribute) => [
                        'key' => $attribute->key,
                        'label' => $attribute->label,
                        'type' => $attribute->type,
                        'options' => $attribute->options,
                        'unit' => $attribute->unit,
                        'is_private' => $attribute->is_private,
                        'show_in_summary' => $attribute->show_in_summary,
                    ])->values()->all(),
                    'status' => $status,
                    'expires_at' => now()->addDays(30),
                ],
            );
            $request->forceFill(['created_at' => now()->subHours($number * 3)])->save();

            $eligible = $sellers->filter(fn ($definition) => in_array($slug, $definition['slugs'], true))->values();
            if ($status === 'open') {
                continue;
            }

            foreach ($eligible->take(3) as $offerIndex => $definition) {
                $accepted = $status === 'accepted' && $offerIndex === 0;
                $offer = Offer::query()->updateOrCreate(
                    ['request_id' => $request->id, 'seller_id' => $definition['user']->id],
                    [
                        'price' => $budgetMin + ($offerIndex * 2100) + ($number * 90),
                        'message' => 'Keşif, işçilik ve planlama dahil şeffaf kapsam sunuyoruz. Uygunluk sonrası ayrıntılı çalışma takvimini aynı gün paylaşabiliriz.',
                        'status' => $accepted ? 'accepted' : ($status === 'accepted' ? 'rejected' : 'pending'),
                        'reviewed_at' => $status === 'accepted' ? now()->subDays(2) : null,
                        'accepted_at' => $accepted ? now()->subDays(2) : null,
                        'created_at' => $request->created_at->copy()->addHour(),
                    ],
                );

                if ($accepted) {
                    $baseRating = (float) $definition['rating'];
                    $rating = $number % 3 === 0 ? max(1, (int) floor($baseRating)) : 5;
                    SellerReview::query()->updateOrCreate(['offer_id' => $offer->id], [
                        'buyer_id' => $buyer->id,
                        'seller_id' => $definition['user']->id,
                        'rating' => $rating,
                        'comment' => 'İletişim, zamanlama ve iş kalitesi beklentimi karşıladı. Tekrar ihtiyaç duyduğumda değerlendireceğim.',
                    ]);
                }
            }
        }
    }

    private function attributes(string $slug): array
    {
        return match ($slug) {
            'nakliye' => ['tasima_turu' => 'Ev taşıma', 'kat_bilgisi' => 3],
            'tadilat' => ['is_turu' => ['Boya', 'Parke'], 'metrekare' => 95],
            default => ['hizmet_turu' => 'Profesyonel destek', 'baslangic' => '1 hafta içinde'],
        };
    }

    private function serviceTitle(string $slug, string $company, int $index): string
    {
        return match ($slug) {
            'nakliye' => "{$company} güvenli taşıma paketi",
            'tadilat' => "{$company} anahtar teslim yenileme",
            default => "{$company} profesyonel destek".($index ? " {$index}" : ''),
        };
    }

    private function serviceDescription(string $slug, string $company): string
    {
        return match ($slug) {
            'nakliye' => "{$company} paketleme, sigortalı taşıma ve planlı teslim adımlarını tek hizmette sunar.",
            'tadilat' => "{$company} keşiften malzeme planına ve temiz teslim aşamasına kadar tüm yenileme sürecini yönetir.",
            default => "{$company} ihtiyaca özel plan, düzenli ilerleme raporu ve ölçülebilir teslim kapsamıyla çalışır.",
        };
    }
}
