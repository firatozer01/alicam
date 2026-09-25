<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\AppSettings;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Mail;
use Illuminate\Validation\Rule;

/**
 * Yonetim panelinden e-posta (SMTP) baglantisi. SMS saglayicisi
 * secildiginde ayni ucla yonetilecek.
 */
class AdminSettingsController extends Controller
{
    public function show(): JsonResponse
    {
        return response()->json([
            'data' => AppSettings::forAdmin(),
            'meta' => [
                // Panelde "su an hangi surucu kullaniliyor" bilgisi gosterilir.
                'active_mailer' => config('mail.default'),
                'sms_ready' => false,
            ],
        ]);
    }

    public function update(Request $request): JsonResponse
    {
        $data = $request->validate([
            'mail.enabled' => ['sometimes', 'boolean'],
            'mail.host' => ['sometimes', 'nullable', 'string', 'max:190'],
            'mail.port' => ['sometimes', 'nullable', 'integer', 'min:1', 'max:65535'],
            'mail.encryption' => ['sometimes', 'nullable', Rule::in(['tls', 'ssl', 'none'])],
            'mail.username' => ['sometimes', 'nullable', 'string', 'max:190'],
            'mail.password' => ['sometimes', 'nullable', 'string', 'max:190'],
            'mail.from_address' => ['sometimes', 'nullable', 'email', 'max:190'],
            'mail.from_name' => ['sometimes', 'nullable', 'string', 'max:120'],
        ]);

        $flat = [];
        foreach ($data['mail'] ?? [] as $key => $value) {
            $flat['mail.'.$key] = is_bool($value) ? ($value ? '1' : '0') : (string) ($value ?? '');
        }

        // Baglanti acilacaksa asgari alanlar dolu olmali.
        if (($flat['mail.enabled'] ?? null) === '1') {
            $host = $flat['mail.host'] ?? AppSettings::get('mail.host');
            $from = $flat['mail.from_address'] ?? AppSettings::get('mail.from_address');

            if (! $host || ! $from) {
                return response()->json([
                    'message' => 'E-posta gönderimini açmak için sunucu adresi ve gönderen e-posta zorunludur.',
                ], 422);
            }
        }

        AppSettings::put($flat);

        return response()->json([
            'message' => 'E-posta ayarları kaydedildi.',
            'data' => AppSettings::forAdmin(),
        ]);
    }

    /** Kayitli ayarlarla tek bir deneme e-postasi gonderir. */
    public function test(Request $request): JsonResponse
    {
        $data = $request->validate([
            'to' => ['required', 'email', 'max:190'],
        ]);

        AppSettings::applyMailConfig();

        if (config('mail.default') !== 'smtp') {
            return response()->json([
                'message' => 'E-posta gönderimi kapalı. Önce SMTP bilgilerini kaydedip gönderimi açın.',
            ], 422);
        }

        try {
            Mail::raw(
                "alıcam.net e-posta ayarları çalışıyor.\n\nBu ileti yönetim panelindeki test düğmesiyle gönderildi.",
                fn ($message) => $message->to($data['to'])->subject('alıcam.net SMTP testi'),
            );
        } catch (\Throwable $error) {
            return response()->json([
                'message' => 'Gönderilemedi: '.mb_substr($error->getMessage(), 0, 180),
            ], 422);
        }

        return response()->json(['message' => $data['to'].' adresine deneme e-postası gönderildi.']);
    }
}
