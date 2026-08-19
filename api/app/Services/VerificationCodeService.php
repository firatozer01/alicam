<?php

namespace App\Services;

use App\Models\User;
use App\Models\VerificationCode;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Validation\ValidationException;

class VerificationCodeService
{
    public function issue(User $user, string $channel): ?string
    {
        $destination = $channel === 'email' ? $user->email : $user->phone;

        if (! $destination) {
            throw ValidationException::withMessages([
                'channel' => 'Bu doğrulama kanalı için kayıtlı iletişim bilgisi bulunamadı.',
            ]);
        }

        VerificationCode::query()
            ->where('user_id', $user->id)
            ->where('channel', $channel)
            ->whereNull('consumed_at')
            ->update(['consumed_at' => now()]);

        $code = (string) random_int(100000, 999999);

        VerificationCode::query()->create([
            'user_id' => $user->id,
            'channel' => $channel,
            'destination' => $destination,
            'code_hash' => Hash::make($code),
            'expires_at' => now()->addMinutes(config('verification.expires_minutes')),
        ]);

        $this->deliver($channel, $destination, $code);

        return config('verification.expose_codes') ? $code : null;
    }

    public function verify(User $user, string $channel, string $code): void
    {
        $record = VerificationCode::query()
            ->where('user_id', $user->id)
            ->where('channel', $channel)
            ->whereNull('consumed_at')
            ->latest('id')
            ->first();

        if (! $record || $record->expires_at->isPast()) {
            throw ValidationException::withMessages([
                'code' => 'Kod geçersiz veya süresi dolmuş. Yeni bir kod isteyin.',
            ]);
        }

        if ($record->attempts >= config('verification.max_attempts')) {
            throw ValidationException::withMessages([
                'code' => 'Deneme sınırı aşıldı. Yeni bir kod isteyin.',
            ]);
        }

        if (! Hash::check($code, $record->code_hash)) {
            $record->increment('attempts');

            throw ValidationException::withMessages([
                'code' => 'Doğrulama kodu hatalı.',
            ]);
        }

        $record->update(['consumed_at' => now()]);

        if ($channel === 'email') {
            $user->forceFill(['email_verified_at' => now()])->save();
        } else {
            $user->forceFill(['phone_verified_at' => now()])->save();
        }
    }

    private function deliver(string $channel, string $destination, string $code): void
    {
        if ($channel === 'email') {
            $expiresMinutes = config('verification.expires_minutes');
            Mail::raw(
                "alıcam.net doğrulama kodunuz: {$code}\n\nBu kod {$expiresMinutes} dakika geçerlidir.",
                fn ($message) => $message->to($destination)->subject('alıcam.net doğrulama kodu'),
            );

            return;
        }

        Log::info('Phone verification code issued', [
            'phone' => $destination,
            'code' => $code,
        ]);
    }
}
