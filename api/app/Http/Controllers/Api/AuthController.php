<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\UserResource;
use App\Models\Role;
use App\Models\User;
use App\Services\VerificationCodeService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rules\Password;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function __construct(private readonly VerificationCodeService $verificationCodes) {}

    public function register(Request $request): JsonResponse
    {
        $request->merge([
            'phone' => $this->normalizePhone((string) $request->input('phone')),
        ]);

        $data = $request->validate([
            'name' => ['required', 'string', 'min:2', 'max:100'],
            'email' => ['required', 'string', 'lowercase', 'email', 'max:255', 'unique:users,email'],
            'phone' => ['required', 'string', 'regex:/^\+90[1-9][0-9]{9}$/', 'unique:users,phone'],
            'password' => ['required', 'confirmed', Password::min(8)->letters()->numbers()],
        ], [
            'phone.regex' => 'Telefon numarası +90 ile başlayan uluslararası formatta olmalıdır.',
        ]);

        $data['email'] = Str::lower($data['email']);

        $user = DB::transaction(function () use ($data): User {
            $user = User::query()->create($data);
            $buyerRole = Role::query()->where('name', 'buyer')->firstOrFail();
            $user->roles()->attach($buyerRole);

            return $user;
        });

        Auth::guard('web')->login($user);
        $request->session()->regenerate();

        $previewCodes = [
            'email' => $this->verificationCodes->issue($user, 'email'),
            'phone' => $this->verificationCodes->issue($user, 'phone'),
        ];

        return response()->json([
            'data' => new UserResource($user->load('roles')),
            'verification_preview' => (object) array_filter($previewCodes),
        ], 201);
    }

    public function login(Request $request): JsonResponse
    {
        $credentials = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
            'remember' => ['sometimes', 'boolean'],
        ]);

        $remember = (bool) ($credentials['remember'] ?? false);
        unset($credentials['remember']);

        if (! Auth::guard('web')->attempt($credentials, $remember)) {
            throw ValidationException::withMessages([
                'email' => 'E-posta veya şifre hatalı.',
            ]);
        }

        if ($request->user()->status !== 'active') {
            Auth::guard('web')->logout();

            throw ValidationException::withMessages([
                'email' => 'Bu hesap şu anda kullanıma açık değil.',
            ]);
        }

        $request->session()->regenerate();

        return response()->json([
            'data' => new UserResource($request->user()->load('roles')),
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        Auth::guard('web')->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return response()->json(['message' => 'Oturum kapatıldı.']);
    }

    public function me(Request $request): JsonResponse
    {
        return response()->json([
            'data' => new UserResource($request->user()->load('roles')),
        ]);
    }

    private function normalizePhone(string $phone): string
    {
        $digits = preg_replace('/\D+/', '', $phone) ?? '';

        if (str_starts_with($digits, '90') && strlen($digits) === 12) {
            return '+'.$digits;
        }

        if (str_starts_with($digits, '0') && strlen($digits) === 11) {
            return '+90'.substr($digits, 1);
        }

        if (strlen($digits) === 10) {
            return '+90'.$digits;
        }

        return $phone;
    }
}
