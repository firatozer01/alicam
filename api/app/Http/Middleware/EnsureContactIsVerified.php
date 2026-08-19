<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureContactIsVerified
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (! $user?->email_verified_at || ! $user?->phone_verified_at) {
            return new JsonResponse([
                'message' => 'Talep yayınlamak için e-posta ve telefon doğrulaması gerekir.',
                'code' => 'contact_verification_required',
                'verification' => [
                    'email' => $user?->email_verified_at !== null,
                    'phone' => $user?->phone_verified_at !== null,
                ],
            ], 403);
        }

        return $next($request);
    }
}
