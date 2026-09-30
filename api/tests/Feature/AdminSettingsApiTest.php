<?php

namespace Tests\Feature;

use App\Models\Role;
use App\Models\User;
use App\Services\AppSettings;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AdminSettingsApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_site_settings_endpoint_is_public_and_lists_default_social_links(): void
    {
        $response = $this->getJson('/api/site-settings')->assertOk();

        $response->assertJsonCount(4, 'data.social')
            ->assertJsonPath('data.social.0.platform', 'instagram')
            ->assertJsonPath('data.social.0.url', 'https://www.instagram.com/alicamnet');

        // Facebook ve LinkedIn varsayilan olarak bos; hesabi olmayan platform listeye girmez.
        $this->assertSame(
            ['instagram', 'youtube', 'tiktok', 'x'],
            array_column($response->json('data.social'), 'platform'),
        );
    }

    public function test_site_settings_endpoint_leaks_no_other_setting(): void
    {
        AppSettings::put([
            'mail.host' => 'smtp.gizli.test',
            'mail.username' => 'gizli-kullanici',
        ]);

        $response = $this->getJson('/api/site-settings')->assertOk();

        $this->assertStringNotContainsString('smtp.gizli.test', $response->getContent());
        $this->assertStringNotContainsString('gizli-kullanici', $response->getContent());
        $this->assertSame(['data'], array_keys($response->json()));
        $this->assertSame(['social'], array_keys($response->json('data')));
    }

    public function test_admin_can_update_social_links(): void
    {
        $response = $this->actingAs($this->admin())->putJson('/api/admin/settings', [
            'social' => ['instagram' => 'https://www.instagram.com/alicamnet.destek'],
        ])->assertOk();

        $this->assertSame(
            'https://www.instagram.com/alicamnet.destek',
            $response->json('data')['social.instagram'],
        );

        $this->getJson('/api/site-settings')
            ->assertOk()
            ->assertJsonPath('data.social.0.url', 'https://www.instagram.com/alicamnet.destek');
    }

    public function test_cleared_social_link_disappears_instead_of_falling_back_to_default(): void
    {
        $this->actingAs($this->admin())->putJson('/api/admin/settings', [
            'social' => ['instagram' => ''],
        ])->assertOk();

        // AppSettings::get() bos degeri varsayilana dusurur. Uc bu yolu kullanirsa
        // yoneticinin sildigi hesap varsayilan adresle sessizce geri gelir.
        $platforms = array_column(
            $this->getJson('/api/site-settings')->assertOk()->json('data.social'),
            'platform',
        );

        $this->assertNotContains('instagram', $platforms);
        $this->assertContains('youtube', $platforms);
    }

    public function test_social_link_without_scheme_gets_https_prefix(): void
    {
        $response = $this->actingAs($this->admin())->putJson('/api/admin/settings', [
            'social' => ['instagram' => 'instagram.com/alicamnet'],
        ])->assertOk();

        $this->assertSame('https://instagram.com/alicamnet', $response->json('data')['social.instagram']);

        $this->getJson('/api/site-settings')
            ->assertOk()
            ->assertJsonPath('data.social.0.url', 'https://instagram.com/alicamnet');
    }

    public function test_social_link_with_dangerous_scheme_is_rejected(): void
    {
        $admin = $this->admin();

        // Kaydedilen deger dogrudan bir <a href> icine giriyor.
        foreach (['javascript:alert(1)', 'data:text/html,<script>alert(1)</script>'] as $address) {
            $this->actingAs($admin)->putJson('/api/admin/settings', [
                'social' => ['instagram' => $address],
            ])->assertStatus(422);
        }

        $this->getJson('/api/site-settings')
            ->assertOk()
            ->assertJsonPath('data.social.0.url', 'https://www.instagram.com/alicamnet');
    }

    public function test_social_link_without_a_hostname_dot_is_rejected(): void
    {
        // filter_var "https://alicamnet" adresini gecerli sayiyor; hesap
        // adresi yerine yalnizca kullanici adini yazan yonetici boylece
        // cozulemeyen bir baglanti yayinlardi.
        $this->actingAs($this->admin())->putJson('/api/admin/settings', [
            'social' => ['instagram' => 'alicamnet'],
        ])->assertStatus(422)->assertJsonValidationErrors('social.instagram');

        $this->getJson('/api/site-settings')
            ->assertOk()
            ->assertJsonPath('data.social.0.url', 'https://www.instagram.com/alicamnet');
    }

    public function test_site_settings_response_is_not_marked_publicly_cacheable(): void
    {
        // statefulApi() yuzunden bu yanit oturum cerezi tasiyabiliyor;
        // paylasimli bir onbellekte saklanirsa bir ziyaretcinin oturumu
        // baskasina servis edilir.
        $header = $this->getJson('/api/site-settings')->assertOk()->headers->get('Cache-Control');

        $this->assertStringContainsString('private', (string) $header);
        $this->assertStringNotContainsString('public', (string) $header);

        // Sureli bir onbellek yoneticinin kaydettigi degisikligi tarayicida
        // saklar ve kayit islememis gibi gosterir; tarayici her seferinde
        // sunucuya sormali.
        $this->assertStringContainsString('must-revalidate', (string) $header);
        $this->assertMatchesRegularExpression('/(^|[\s,])max-age=0([\s,]|$)/', (string) $header);
    }

    public function test_non_admin_cannot_update_settings(): void
    {
        $payload = ['social' => ['instagram' => 'https://www.instagram.com/baskasi']];

        // Misafir istegi once gonderilir: actingAs oturumu testin sonuna kadar acik birakir.
        $this->putJson('/api/admin/settings', $payload)->assertUnauthorized();

        $this->actingAs(User::factory()->create())
            ->putJson('/api/admin/settings', $payload)
            ->assertForbidden()
            ->assertJsonPath('code', 'role_required');
    }

    private function admin(): User
    {
        $admin = User::factory()->create();
        // Ayar uclari kategori agacina ve konum verisine dokunmadigi icin tam
        // tohumlama yerine yalnizca gereken rol olusturulur.
        $admin->roles()->attach(Role::query()->firstOrCreate(['name' => 'admin'], ['label' => 'Yönetici']));

        return $admin;
    }
}
