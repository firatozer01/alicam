<?php

namespace Tests\Feature;

use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/**
 * Site logosunun panelden yonetilmesi.
 *
 * Gomulu dosyalar (web/public/logo.png vb.) her zaman calisan bir
 * varsayilan; yonetici yukleme yapmadikca uc null doner ve on yuz
 * gomulu dosyayi kullanir. Yukleme yapildiginda sira /api/branding/*
 * adresine gecer.
 */
class BrandingApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_branding_defaults_to_bundled_files(): void
    {
        $response = $this->getJson('/api/site-settings')->assertOk();

        $branding = $response->json('data.branding');

        // Anahtarlarin varligi da onemli: alan hic basilmazsa assertJsonPath
        // null gorur ve test yanlis yere gecerdi.
        $this->assertIsArray($branding);
        $this->assertArrayHasKey('logo', $branding);
        $this->assertArrayHasKey('logo_light', $branding);
        $this->assertArrayHasKey('mark', $branding);

        // Hicbir sey yuklenmemisken uc adres uretmez; on yuz gomulu
        // dosyaya duser.
        $this->assertNull($branding['logo']);
        $this->assertNull($branding['logo_light']);
        $this->assertNull($branding['mark']);

        // Alt bilgideki sosyal baglantilar ayni ucten geliyor; branding
        // eklenirken bu alanin dusmedigi de burada guvenceye aliniyor.
        $this->assertNotEmpty($response->json('data.social'));
    }

    public function test_admin_can_upload_a_logo_and_it_becomes_public(): void
    {
        Storage::fake('local');

        $this->actingAs($this->admin())->post('/api/admin/branding/logo', [
            'file' => UploadedFile::fake()->image('logo.png', 939, 148),
        ])->assertOk();

        $adres = $this->getJson('/api/site-settings')->assertOk()->json('data.branding.logo');

        $this->assertIsString($adres);
        $this->assertStringStartsWith('/api/branding/logo', $adres);

        // Damga olmadan tarayici eski logoyu sinirsiz sure gosterir.
        $this->assertStringContainsString('?v=', $adres);

        // Logo alt bilgide ve giris ekraninda, yani oturum acmamis
        // ziyaretcinin gordugu yerlerde basiliyor.
        $this->app['auth']->forgetGuards();
        $this->get('/api/branding/logo')->assertOk();
    }

    public function test_uploading_again_replaces_the_old_file_and_bumps_the_version(): void
    {
        Storage::fake('local');

        $admin = $this->admin();

        $this->actingAs($admin)->post('/api/admin/branding/logo', [
            'file' => UploadedFile::fake()->image('ilk.png', 939, 148),
        ])->assertOk();

        $ilk = (string) $this->getJson('/api/site-settings')->assertOk()->json('data.branding.logo');

        $this->actingAs($admin)->post('/api/admin/branding/logo', [
            'file' => UploadedFile::fake()->image('ikinci.png', 939, 148),
        ])->assertOk();

        $ikinci = (string) $this->getJson('/api/site-settings')->assertOk()->json('data.branding.logo');

        // Adres sabit kalirsa yonetici logoyu degistirdigini tarayicisinda
        // goremez; damganin her yuklemede degismesi sart.
        $this->assertNotSame('', $this->damga($ilk));
        $this->assertNotSame($this->damga($ilk), $this->damga($ikinci));

        // Eski dosya silinmezse her yukleme diskte birikir.
        $this->assertCount(1, Storage::disk('local')->allFiles('branding'));
    }

    public function test_admin_can_reset_to_the_bundled_default(): void
    {
        Storage::fake('local');

        $admin = $this->admin();

        $this->actingAs($admin)->post('/api/admin/branding/logo', [
            'file' => UploadedFile::fake()->image('logo.png', 939, 148),
        ])->assertOk();

        $this->actingAs($admin)->deleteJson('/api/admin/branding/logo')->assertOk();

        // Silme islemi ayari bosaltmali; yoksa uc olmayan bir dosyanin
        // adresini vermeye devam eder ve logo kirik gorunur.
        $this->assertNull($this->getJson('/api/site-settings')->assertOk()->json('data.branding.logo'));

        $this->get('/api/branding/logo')->assertNotFound();
    }

    public function test_svg_and_oversized_files_are_rejected(): void
    {
        Storage::fake('local');

        $admin = $this->admin();

        // SVG satir ici servis edildiginde icindeki betik calisir; logo
        // her sayfada basildigi icin bu tum siteyi etkilerdi.
        $this->actingAs($admin)->post('/api/admin/branding/logo', [
            'file' => UploadedFile::fake()->create('logo.svg', 10, 'image/svg+xml'),
        ])->assertStatus(422);

        $this->actingAs($admin)->post('/api/admin/branding/logo', [
            'file' => UploadedFile::fake()->image('buyuk.png')->size(4096),
        ])->assertStatus(422);

        $this->assertNull($this->getJson('/api/site-settings')->assertOk()->json('data.branding.logo'));
        $this->assertSame([], Storage::disk('local')->allFiles('branding'));
    }

    public function test_unknown_branding_kind_is_rejected(): void
    {
        Storage::fake('local');

        // Tur Rule::in ile dogrulandigi icin bilinmeyen deger dogrulama
        // hatasina duser; serbest birakilirsa yonetici diske istedigi adla
        // dosya yazdirabilirdi.
        $this->actingAs($this->admin())->post('/api/admin/branding/favicon', [
            'file' => UploadedFile::fake()->image('favicon.png', 939, 148),
        ])->assertStatus(422);

        $this->get('/api/branding/favicon')->assertNotFound();
    }

    public function test_only_admin_can_change_branding(): void
    {
        Storage::fake('local');

        // Misafir istegi once gonderilir: actingAs oturumu testin sonuna
        // kadar acik birakir.
        $this->postJson('/api/admin/branding/logo')->assertUnauthorized();

        $this->actingAs(User::factory()->create())
            ->post('/api/admin/branding/logo', [
                'file' => UploadedFile::fake()->image('logo.png', 939, 148),
            ])
            ->assertForbidden()
            ->assertJsonPath('code', 'role_required');
    }

    /** Adresteki onbellek damgasi (?v=...). */
    private function damga(string $adres): string
    {
        parse_str((string) parse_url($adres, PHP_URL_QUERY), $sorgu);

        return (string) ($sorgu['v'] ?? '');
    }

    private function admin(): User
    {
        $admin = User::factory()->create();
        // Marka uclari kategori agacina ve konum verisine dokunmadigi icin
        // tam tohumlama yerine yalnizca gereken rol olusturulur.
        $admin->roles()->attach(Role::query()->firstOrCreate(['name' => 'admin'], ['label' => 'Yönetici']));

        return $admin;
    }
}
