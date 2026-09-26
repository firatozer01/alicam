<?php

namespace App\Console\Commands;

use App\Http\Controllers\Api\AdminHomeController;
use App\Models\Category;
use App\Services\CategoryImage;
use App\Services\StockImageSearch;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Cache;

/**
 * Kategori kapak fotograflarini indirir.
 *
 * Arama ve eleme StockImageSearch'te; bu komut yalnizca hangi
 * kategorilerin islenecegine karar verir ve sonucu kaydeder.
 *
 * Arama sorgulari config/category_images.php icinde elle yazilmistir:
 * baslik adini otomatik cevirmek alakasiz sonuc uretiyordu.
 */
class FetchCategoryImages extends Command
{
    protected $signature = 'categories:fetch-images
        {--only= : Yalnizca bu slug(lar); virgulle ayrilir}
        {--limit=0 : En fazla bu kadar kategori islensin (0 = sinirsiz)}
        {--force : Gorseli olanlari da yeniden indir}
        {--dry-run : Indirme, yalnizca ne bulundugunu yaz}';

    protected $description = 'Kategori kapak fotograflarini internetten indirir';

    public function __construct(
        private readonly StockImageSearch $arama,
        private readonly CategoryImage $gorsel,
    ) {
        parent::__construct();
    }

    public function handle(): int
    {
        // GD cozulen goruntuyu bellekte ham tutuyor: 4000x3000'lik bir
        // dosya ~48 MB. Varsayilan 128 MB sinirinda toplu indirme 63.
        // gorselde dusmustu. Yalnizca bu komut icin yukseltiliyor.
        ini_set('memory_limit', '512M');

        $sorgular = config('category_images.queries', []);
        $kategoriler = $this->targets();

        if ($kategoriler->isEmpty()) {
            $this->info('Islenecek kategori yok.');

            return self::SUCCESS;
        }

        $this->info("{$kategoriler->count()} kategori islenecek.");

        $basarili = 0;
        $basarisiz = [];

        foreach ($kategoriler as $kategori) {
            $sorgu = $sorgular[$kategori->slug] ?? $this->fallbackQuery($kategori->name);
            $aday = $this->arama->find($sorgu);

            if ($aday === null) {
                $basarisiz[] = "{$kategori->slug} (sorgu: {$sorgu})";
                $this->line("  <fg=red>✗</> {$kategori->name} — sonuc yok [{$sorgu}]");

                continue;
            }

            $etiket = "{$aday['source']} · {$aday['license']}";

            if ($this->option('dry-run')) {
                $this->line("  <fg=cyan>?</> {$kategori->name} → {$aday['title']} [{$etiket}]");
                $basarili++;

                continue;
            }

            $bayt = $this->arama->download($aday['url']);

            if ($bayt === null) {
                $basarisiz[] = "{$kategori->slug} (indirilemedi)";
                $this->line("  <fg=red>✗</> {$kategori->name} — indirilemedi");

                continue;
            }

            $kategori->update([
                'image_path' => $this->gorsel->store($bayt, $kategori->id),
                // Atif metni kartin altinda degil kaynak kaydinda durur;
                // amac lisans zincirini kaybetmemek.
                'image_credit' => trim(mb_substr($aday['credit'].' / '.$aday['license'], 0, 240), ' /'),
                'image_source' => mb_substr($aday['page'], 0, 490),
            ]);

            $basarili++;
            $this->line("  <fg=green>✓</> {$kategori->name} → {$aday['title']} [{$etiket}]");

            // Kaynaklara saniyede birden fazla istek yuklemiyoruz.
            usleep(400_000);
        }

        // Katalog onbellegi gorsel degisikligini kendiliginden fark etmez;
        // surum sayaci artirilmazsa yeni fotograflar 10 dakika gorunmez.
        if ($basarili > 0 && ! $this->option('dry-run')) {
            Cache::increment(AdminHomeController::VERSION_KEY) ?: Cache::forever(AdminHomeController::VERSION_KEY, 1);
        }

        $this->newLine();
        $this->info("Tamamlanan: {$basarili}");

        if ($basarisiz !== []) {
            $this->warn('Bulunamayan '.count($basarisiz).':');
            foreach (array_slice($basarisiz, 0, 30) as $satir) {
                $this->line("  - {$satir}");
            }
        }

        return self::SUCCESS;
    }

    /**
     * Islenecek kategoriler: kokler ve 2. seviye hizmet basliklari.
     * Anasayfada gorunen birimler bunlar.
     *
     * @return \Illuminate\Support\Collection<int, Category>
     */
    private function targets()
    {
        $sorgu = Category::query()
            ->where('is_active', true)
            ->where(fn ($q) => $q
                ->whereNull('parent_id')
                ->orWhereHas('parent', fn ($p) => $p->whereNull('parent_id')->where('kind', 'service')))
            ->orderBy('sort_order');

        if ($only = $this->option('only')) {
            $sorgu->whereIn('slug', array_filter(array_map('trim', explode(',', $only))));
        } elseif (! $this->option('force')) {
            $sorgu->whereNull('image_path');
        }

        if (($limit = (int) $this->option('limit')) > 0) {
            $sorgu->limit($limit);
        }

        return $sorgu->get();
    }

    /**
     * Sorgusu tanimlanmamis baslik icin sozluk temelli sorgu uretir.
     * Zayiftir; config'e sorgu yazmak her zaman daha iyi sonuc verir.
     */
    private function fallbackQuery(string $ad): string
    {
        $sozluk = config('category_images.fallback_words', []);
        $kelimeler = preg_split('/[\s,]+/u', Category::fold($ad)) ?: [];

        $cikti = [];

        foreach ($kelimeler as $kelime) {
            if ($kelime !== '' && $kelime !== 've' && isset($sozluk[$kelime])) {
                $cikti[] = $sozluk[$kelime];
            }
        }

        return $cikti === [] ? 'professional service work' : implode(' ', array_unique($cikti));
    }
}
