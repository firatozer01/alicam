<?php

namespace Database\Seeders;

use App\Models\Category;
use App\Models\City;
use App\Models\District;
use App\Models\Role;
use App\Support\CategoryTree;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

/**
 * Katalogu canlandiran toplu demo icerik: binlerce alici ve talep.
 *
 * Amac anasayfadaki "populer" ve "trend" siralamalarinin gercek bir sinyale
 * dayanmasi. Talepler yapraklara ZIPF benzeri bir dagilimla serpilir; birkac
 * baslik cok, uzun kuyruk az talep alir. Duz dagitmak her kategoriyi esit
 * gosterir ve siralamayi anlamsizlastirir.
 *
 * Tarihler son gunlere yiginlidir ki talepler suresi dolmamis olsun ve
 * "bu hafta trendde" hesabi calissin.
 *
 * Uretilen her sey iki onekle isaretlidir (ALC-VOL- / demo.alici); clear()
 * tek olcutle hepsini geri alir.
 *
 * Kullanim:
 *   php artisan db:seed --class=DemoRequestVolumeSeeder
 *   DEMO_REQUEST_COUNT=8000 DEMO_BUYER_COUNT=2500 php artisan db:seed --class=DemoRequestVolumeSeeder
 */
class DemoRequestVolumeSeeder extends Seeder
{
    private const REFERENCE_PREFIX = 'ALC-VOL-';

    private const BUYER_PREFIX = 'demo.alici';

    /** Tek seferde yazilan satir sayisi; bellek ile tur sayisi arasindaki denge. */
    private const CHUNK = 500;

    public function run(): void
    {
        $hedefTalep = max(1, (int) env('DEMO_REQUEST_COUNT', 5000));
        $hedefAlici = max(1, (int) env('DEMO_BUYER_COUNT', 2000));

        $yapraklar = $this->serviceLeaves();
        if ($yapraklar->isEmpty()) {
            $this->command?->warn('Hizmet yapragi bulunamadi; kategori agaci tohumlandi mi?');

            return;
        }

        $this->command?->info("Hedef: {$hedefAlici} alici, {$hedefTalep} talep, {$yapraklar->count()} yaprak uzerine.");

        $aliciIds = $this->seedBuyers($hedefAlici);
        $this->command?->info('  aliciler hazir: '.count($aliciIds));

        $eklenen = $this->widenSellerCoverage();
        $this->command?->info("  demo saticilarin hizmet bolgesi genisletildi: +{$eklenen} ilce");

        $this->seedRequests($hedefTalep, $yapraklar, $aliciIds);
    }

    /** Uretilen tum toplu demo icerigi siler. */
    public static function clear(): array
    {
        $talepIds = DB::table('requests')
            ->where('public_reference', 'like', self::REFERENCE_PREFIX.'%')
            ->pluck('id');

        DB::table('request_categories')->whereIn('request_id', $talepIds)->delete();
        DB::table('offers')->whereIn('request_id', $talepIds)->delete();
        DB::table('request_unlocks')->whereIn('request_id', $talepIds)->delete();
        DB::table('request_favorites')->whereIn('request_id', $talepIds)->delete();
        $talep = DB::table('requests')->whereIn('id', $talepIds)->delete();

        $aliciIds = DB::table('users')
            ->where('email', 'like', self::BUYER_PREFIX.'%@alicam.test')
            ->pluck('id');

        DB::table('role_user')->whereIn('user_id', $aliciIds)->delete();
        $alici = DB::table('users')->whereIn('id', $aliciIds)->delete();

        return ['talep' => $talep, 'alici' => $alici];
    }

    /**
     * Demo saticilarin hizmet bolgesini genisletir.
     *
     * Eslestirme ilceyi birebir istiyor (seller_locations.district_id =
     * requests.district_id) ve "tum sehir" diye bir secenek yok. Tek ilcede
     * duran demo satici, binlerce talep arasindan neredeyse hicbirini
     * gormuyor ve panel bos duruyor. Demo hesaplarin kendi sehirlerindeki
     * ilcelere yayilmasi bunu gercege yaklastirir.
     *
     * Yalnizca demo hesaplara dokunur; gercek bir satici varsa kapsami
     * degistirilmez.
     */
    private function widenSellerCoverage(int $ilcePerSehir = 12): int
    {
        $saticiIds = DB::table('users')
            ->where('email', 'like', 'demo.satici%@alicam.test')
            ->orWhere('email', 'satici@alicam.net')
            ->pluck('id');

        if ($saticiIds->isEmpty()) {
            return 0;
        }

        $mevcut = DB::table('seller_locations')
            ->whereIn('seller_id', $saticiIds)
            ->get(['seller_id', 'city_id', 'district_id']);

        $sehirIlce = District::query()->get(['id', 'city_id'])
            ->groupBy('city_id')->map(fn ($g) => $g->pluck('id')->all())->all();

        $varolan = $mevcut->map(fn ($r) => $r->seller_id.':'.$r->district_id)->flip();
        $yeni = [];

        foreach ($mevcut->groupBy('seller_id') as $saticiId => $satirlar) {
            foreach ($satirlar->pluck('city_id')->unique() as $sehirId) {
                foreach (array_slice($sehirIlce[$sehirId] ?? [], 0, $ilcePerSehir) as $ilceId) {
                    if ($varolan->has($saticiId.':'.$ilceId)) {
                        continue;
                    }

                    $yeni[] = [
                        'seller_id' => $saticiId,
                        'city_id' => $sehirId,
                        'district_id' => $ilceId,
                        'created_at' => now(),
                        'updated_at' => now(),
                    ];
                    $varolan[$saticiId.':'.$ilceId] = true;
                }
            }
        }

        foreach (array_chunk($yeni, self::CHUNK) as $parca) {
            DB::table('seller_locations')->insert($parca);
        }

        return count($yeni);
    }

    /**
     * Demo alicilari toplu yazar.
     *
     * @return array<int, int>
     */
    private function seedBuyers(int $hedef): array
    {
        $rolId = Role::query()->where('name', 'buyer')->value('id');
        $sifre = Hash::make('demo-'.bin2hex(random_bytes(8)));
        $simdi = now();

        $mevcut = DB::table('users')
            ->where('email', 'like', self::BUYER_PREFIX.'%@alicam.test')
            ->pluck('id', 'email');

        $yazilacak = [];
        for ($i = 1; $i <= $hedef; $i++) {
            $eposta = sprintf('%s%05d@alicam.test', self::BUYER_PREFIX, $i);
            if ($mevcut->has($eposta)) {
                continue;
            }

            $yazilacak[] = [
                'name' => $this->buyerName($i),
                'email' => $eposta,
                'password' => $sifre,
                'email_verified_at' => $simdi,
                'phone_verified_at' => $simdi,
                'created_at' => $simdi,
                'updated_at' => $simdi,
            ];
        }

        foreach (array_chunk($yazilacak, self::CHUNK) as $parca) {
            DB::table('users')->insert($parca);
        }

        $ids = DB::table('users')
            ->where('email', 'like', self::BUYER_PREFIX.'%@alicam.test')
            ->pluck('id')
            ->all();

        // Rolu olmayanlara buyer rolu verilir; ikinci calistirmada coklamasin.
        if ($rolId) {
            $roluOlan = DB::table('role_user')->whereIn('user_id', $ids)->where('role_id', $rolId)->pluck('user_id')->all();
            $eksik = array_diff($ids, $roluOlan);

            foreach (array_chunk($eksik, self::CHUNK) as $parca) {
                DB::table('role_user')->insert(array_map(
                    fn ($id) => ['user_id' => $id, 'role_id' => $rolId],
                    $parca,
                ));
            }
        }

        return $ids;
    }

    /**
     * @param  \Illuminate\Support\Collection<int, Category>  $yapraklar
     * @param  array<int, int>  $aliciIds
     */
    private function seedRequests(int $hedef, $yapraklar, array $aliciIds): void
    {
        $ilceler = District::query()->get(['id', 'city_id'])->groupBy('city_id')
            ->map(fn ($g) => $g->pluck('id')->all())->all();
        $sehirler = $this->weightedCities();

        // Zipf: siradaki her yaprak bir oncekinden az talep alir.
        $agirliklar = [];
        $toplam = 0.0;
        foreach ($yapraklar as $i => $_) {
            $a = 1 / ($i + 1) ** 0.8;
            $agirliklar[] = $a;
            $toplam += $a;
        }

        $sira = (int) DB::table('requests')
            ->where('public_reference', 'like', self::REFERENCE_PREFIX.'%')
            ->count();

        $semaOnbellek = [];
        $talepYigini = [];
        $yazilan = 0;

        for ($n = 1; $n <= $hedef; $n++) {
            $yaprak = $this->weightedPick($yapraklar, $agirliklar, $toplam);

            if (! isset($semaOnbellek[$yaprak->id])) {
                $semaOnbellek[$yaprak->id] = $this->schemaFor($yaprak);
            }
            [$sema, $degerler] = $semaOnbellek[$yaprak->id];

            $sehirId = $sehirler[array_rand($sehirler)];
            $ilceId = isset($ilceler[$sehirId]) ? $ilceler[$sehirId][array_rand($ilceler[$sehirId])] : null;
            $olusturma = $this->skewedDate();
            [$min, $max] = $this->budget($yaprak->id);

            $sira++;

            $talepYigini[] = [
                'public_reference' => self::REFERENCE_PREFIX.str_pad((string) $sira, 6, '0', STR_PAD_LEFT),
                'user_id' => $aliciIds[array_rand($aliciIds)],
                'category_id' => $yaprak->id,
                'city_id' => $sehirId,
                'district_id' => $ilceId,
                'title' => $this->title($yaprak->name),
                'description' => $this->description($yaprak->name),
                'budget_min' => $min,
                'budget_max' => $max,
                'full_address' => null,
                'attributes' => json_encode($degerler, JSON_UNESCAPED_UNICODE),
                'attribute_schema_snapshot' => json_encode($sema, JSON_UNESCAPED_UNICODE),
                'status' => $this->status(),
                // Ornek talep: hizmet veren bunu bedelsiz acar ve arayuzde
                // rozetle ayirt eder.
                'is_demo' => true,
                'expires_at' => $olusturma->copy()->addDays(30),
                'created_at' => $olusturma,
                'updated_at' => $olusturma,
            ];

            if (count($talepYigini) >= self::CHUNK) {
                $yazilan += $this->flush($talepYigini);
                $talepYigini = [];
                $this->command?->info("  {$yazilan}/{$hedef} talep yazildi");
            }
        }

        if ($talepYigini) {
            $yazilan += $this->flush($talepYigini);
        }

        $this->command?->info("Toplu demo talep hazir: {$yazilan} kayit.");
    }

    /**
     * Yigini yazar ve eslestirme tablosunu doldurur.
     *
     * @param  array<int, array<string, mixed>>  $yigin
     */
    private function flush(array $yigin): int
    {
        return DB::transaction(function () use ($yigin): int {
            DB::table('requests')->insert($yigin);

            $referanslar = array_column($yigin, 'public_reference');
            $eslesme = DB::table('requests')
                ->whereIn('public_reference', $referanslar)
                ->pluck('id', 'public_reference');

            $pivot = [];
            foreach ($yigin as $satir) {
                $id = $eslesme[$satir['public_reference']] ?? null;
                if ($id === null) {
                    continue;
                }

                // Eslestirme request_categories uzerinden calisir; bu satir
                // olmadan talep hicbir saticinin ekranina dusmez.
                $pivot[] = [
                    'request_id' => $id,
                    'category_id' => $satir['category_id'],
                    'is_primary' => true,
                    'sort_order' => 0,
                ];
            }

            if ($pivot) {
                DB::table('request_categories')->insert($pivot);
            }

            return count($yigin);
        }, 3);
    }

    /**
     * Talebin baglanacagi yapraklar: aktif hizmet agacinin en alt seviyesi.
     *
     * @return \Illuminate\Support\Collection<int, Category>
     */
    private function serviceLeaves()
    {
        $kokler = Category::query()
            ->whereNull('parent_id')->where('kind', 'service')->where('is_active', true)
            ->pluck('id');

        $ikinci = Category::query()
            ->whereIn('parent_id', $kokler)->where('is_active', true)
            ->pluck('id');

        return Category::query()
            ->whereIn('parent_id', $ikinci)->where('is_active', true)
            ->get(['id', 'name', 'parent_id'])
            ->shuffle()
            ->values();
    }

    /**
     * Yaprak icin nitelik semasi ve o semaya uyan ornek degerler.
     *
     * @return array{0: array<int, array<string, mixed>>, 1: array<string, mixed>}
     */
    private function schemaFor(Category $yaprak): array
    {
        $nitelikler = CategoryTree::effectiveAttributes($yaprak);

        $sema = $nitelikler->map(fn ($n) => [
            'key' => $n->key,
            'label' => $n->label,
            'type' => $n->type,
            'options' => $n->options,
            'unit' => $n->unit,
            'is_private' => (bool) $n->is_private,
            'show_in_summary' => (bool) $n->show_in_summary,
        ])->values()->all();

        $degerler = [];
        foreach ($nitelikler as $n) {
            $degerler[$n->key] = $this->sampleValue($n);
        }

        return [$sema, $degerler];
    }

    private function sampleValue(object $nitelik): mixed
    {
        $secenekler = is_array($nitelik->options) ? array_values($nitelik->options) : [];

        return match ($nitelik->type) {
            'select' => $secenekler ? $secenekler[array_rand($secenekler)] : 'Belirtilmedi',
            'multiselect' => $secenekler
                ? array_slice($secenekler, 0, min(2, count($secenekler)))
                : [],
            'boolean' => (bool) random_int(0, 1),
            'number' => random_int(1, 250),
            'date' => now()->addDays(random_int(3, 60))->toDateString(),
            'textarea' => 'Detayları yerinde konuşalım; esnek bir takvimim var.',
            default => 'Belirtilmedi',
        };
    }

    /**
     * @param  \Illuminate\Support\Collection<int, Category>  $yapraklar
     * @param  array<int, float>  $agirliklar
     */
    private function weightedPick($yapraklar, array $agirliklar, float $toplam): Category
    {
        $hedef = (mt_rand() / mt_getrandmax()) * $toplam;
        $biriken = 0.0;

        foreach ($agirliklar as $i => $agirlik) {
            $biriken += $agirlik;
            if ($biriken >= $hedef) {
                return $yapraklar[$i];
            }
        }

        return $yapraklar->last();
    }

    /**
     * Sehir havuzu, nufusa yakin agirlikla.
     *
     * Duz dagitinca 81 ilin her birine esit talep dusuyor ve hizmet verenin
     * ekrani bos kaliyor: satici birkac ilde calisiyor, talep ise her yerde.
     * Buyuk sehirleri havuzda tekrarlayarak gercege yakin bir yogunluk kurulur.
     *
     * @return array<int, int>
     */
    private function weightedCities(): array
    {
        $tumIller = City::query()->pluck('id')->all();

        // il adi => havuzdaki tekrar sayisi
        $agirlik = [
            'İstanbul' => 30, 'Ankara' => 12, 'İzmir' => 10, 'Bursa' => 6,
            'Antalya' => 6, 'Adana' => 4, 'Konya' => 3, 'Gaziantep' => 3,
            'Kocaeli' => 3, 'Mersin' => 3, 'Kayseri' => 2, 'Eskişehir' => 2,
            'Samsun' => 2, 'Denizli' => 2, 'Sakarya' => 2,
        ];

        $havuz = $tumIller; // her il en az bir kez temsil edilir
        foreach (City::query()->whereIn('name', array_keys($agirlik))->get(['id', 'name']) as $sehir) {
            $havuz = array_merge($havuz, array_fill(0, $agirlik[$sehir->name], $sehir->id));
        }

        return $havuz;
    }

    /** Son gunlere yiginli tarih: talepler taze ve suresi dolmamis olsun. */
    private function skewedDate(): Carbon
    {
        $oran = (mt_rand() / mt_getrandmax()) ** 2;
        $gun = (int) round($oran * 27);

        return now()->subDays($gun)->subMinutes(random_int(0, 1439));
    }

    /** @return array{0: int, 1: int} */
    private function budget(int $tohum): array
    {
        $taban = [1500, 3000, 5000, 8000, 12000, 20000, 35000][$tohum % 7];
        $min = $taban + random_int(0, $taban);

        return [$min, $min + random_int((int) ($taban * 0.4), $taban * 2)];
    }

    private function status(): string
    {
        return match (random_int(1, 10)) {
            1, 2 => 'in_negotiation',
            3 => 'accepted',
            default => 'open',
        };
    }

    private function title(string $kategori): string
    {
        $kaliplar = [
            '%s için usta arıyorum',
            '%s hizmeti verecek firma',
            'Acil %s ihtiyacım var',
            '%s için fiyat teklifi',
            'Hafta içi %s yapılsın',
            '%s konusunda destek arıyorum',
            'Uygun fiyatlı %s',
            '%s için profesyonel ekip',
        ];

        return mb_substr(sprintf($kaliplar[array_rand($kaliplar)], $kategori), 0, 120);
    }

    private function description(string $kategori): string
    {
        $kaliplar = [
            'İşin kapsamını yerinde görüp net fiyat verebilecek, takvime sadık bir ekip arıyorum.',
            'Daha önce benzer işler yapmış, referans gösterebilen firmalardan teklif bekliyorum.',
            'Malzeme dahil ve hariç iki ayrı fiyat alırsam karşılaştırmam kolay olur.',
            'Hafta içi çalışılabilir. Detayları telefonda netleştirebiliriz.',
            'Fiyatın yanında tahmini süreyi de yazarsanız değerlendirmem hızlanır.',
        ];

        return $kategori.' işi için teklif topluyorum. '.$kaliplar[array_rand($kaliplar)];
    }

    private function buyerName(int $i): string
    {
        $adlar = ['Ahmet', 'Ayşe', 'Mehmet', 'Elif', 'Mustafa', 'Zeynep', 'Emre', 'Fatma',
            'Burak', 'Merve', 'Hakan', 'Seda', 'Kemal', 'Deniz', 'Onur', 'Ece',
            'Serkan', 'Gamze', 'Barış', 'Pınar', 'Cem', 'Sinem', 'Tolga', 'Buse'];
        $soyadlar = ['Yılmaz', 'Kaya', 'Demir', 'Çelik', 'Şahin', 'Yıldız', 'Aydın', 'Öztürk',
            'Arslan', 'Doğan', 'Kılıç', 'Aslan', 'Çetin', 'Kurt', 'Özdemir', 'Koç',
            'Şimşek', 'Erdoğan', 'Polat', 'Korkmaz'];

        return $adlar[$i % count($adlar)].' '.$soyadlar[intdiv($i, count($adlar)) % count($soyadlar)];
    }
}
