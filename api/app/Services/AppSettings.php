<?php

namespace App\Services;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;

/**
 * Calisma zamani ayarlari. Yonetici panelinden girilen SMTP bilgileri
 * burada saklanir ve her istekte mail yapilandirmasina uygulanir; boylece
 * e-posta baglamak icin .env duzenlemek ve konteyner yeniden baslatmak
 * gerekmez.
 *
 * SMS saglayicisi eklendiginde ayni tabloya sms.* anahtarlariyla girecek.
 */
class AppSettings
{
    private const CACHE_KEY = 'app-settings:all';

    private const CACHE_TTL = 300;

    /** Gizli alanlar sifrelenerek saklanir ve panele maskelenmis doner. */
    public const SECRET_KEYS = ['mail.password', 'sms.api_key', 'sms.password', 'assistant.gemini_key'];

    /** Panelden yonetilebilen alanlar ve varsayilanlari. */
    public const EDITABLE = [
        'mail.enabled' => '0',
        'mail.host' => '',
        'mail.port' => '587',
        'mail.encryption' => 'tls',
        'mail.username' => '',
        'mail.password' => '',
        'mail.from_address' => '',
        'mail.from_name' => 'alıcam.net',
        // Bos birakilirsa asistan hazir cevap modunda calisir.
        'assistant.gemini_key' => '',
        'assistant.model' => 'gemini-3-flash',
    ];

    /**
     * @return array<string, string|null>
     */
    public static function all(): array
    {
        return Cache::remember(self::CACHE_KEY, self::CACHE_TTL, function (): array {
            $rows = DB::table('app_settings')->get();
            $out = [];

            foreach ($rows as $row) {
                $out[$row->key] = $row->is_secret && $row->value
                    ? self::decrypt($row->value)
                    : $row->value;
            }

            return $out;
        });
    }

    public static function get(string $key, ?string $fallback = null): ?string
    {
        $value = self::all()[$key] ?? null;

        return ($value === null || $value === '') ? $fallback : $value;
    }

    public static function enabled(string $key): bool
    {
        return in_array(self::get($key), ['1', 'true', 'on'], true);
    }

    /**
     * @param  array<string, string|null>  $values
     */
    public static function put(array $values): void
    {
        foreach ($values as $key => $value) {
            if (! array_key_exists($key, self::EDITABLE)) {
                continue;
            }

            $secret = in_array($key, self::SECRET_KEYS, true);

            // Gizli alan bos gonderildiyse mevcut deger korunur: panel
            // maskelenmis gosterdigi icin kullanici her kayitta yeniden
            // yazmak zorunda kalmasin.
            if ($secret && ($value === null || $value === '')) {
                continue;
            }

            DB::table('app_settings')->updateOrInsert(
                ['key' => $key],
                [
                    'value' => $secret ? Crypt::encryptString((string) $value) : $value,
                    'is_secret' => $secret,
                    'updated_at' => now(),
                    'created_at' => now(),
                ],
            );
        }

        self::forget();
    }

    public static function forget(): void
    {
        Cache::forget(self::CACHE_KEY);
    }

    /**
     * Panelde gosterilecek hal: gizli alanlar deger yerine "dolu mu" bilgisi
     * tasir.
     *
     * @return array<string, mixed>
     */
    public static function forAdmin(): array
    {
        $all = self::all();
        $out = [];

        foreach (self::EDITABLE as $key => $default) {
            if (in_array($key, self::SECRET_KEYS, true)) {
                $out[$key] = '';
                $out[$key.'_set'] = ($all[$key] ?? '') !== '';

                continue;
            }

            $out[$key] = $all[$key] ?? $default;
        }

        return $out;
    }

    /** Kayitli SMTP bilgisi varsa mail yapilandirmasina uygular. */
    public static function applyMailConfig(): void
    {
        if (! self::enabled('mail.enabled')) {
            return;
        }

        $host = self::get('mail.host');

        if (! $host) {
            return;
        }

        config([
            'mail.default' => 'smtp',
            'mail.mailers.smtp.host' => $host,
            'mail.mailers.smtp.port' => (int) self::get('mail.port', '587'),
            'mail.mailers.smtp.encryption' => self::get('mail.encryption', 'tls'),
            'mail.mailers.smtp.username' => self::get('mail.username'),
            'mail.mailers.smtp.password' => self::get('mail.password'),
            'mail.from.address' => self::get('mail.from_address', config('mail.from.address')),
            'mail.from.name' => self::get('mail.from_name', config('mail.from.name')),
        ]);
    }

    private static function decrypt(string $value): ?string
    {
        try {
            return Crypt::decryptString($value);
        } catch (\Throwable) {
            // APP_KEY degistiyse eski deger cozulemez; alan bos sayilir.
            return null;
        }
    }
}
