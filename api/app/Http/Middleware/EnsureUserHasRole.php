<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureUserHasRole
{
    public function handle(Request $request, Closure $next, string $role): Response
    {
        if (! $request->user()?->hasRole($role)) {
            return new JsonResponse([
                'message' => 'Bu işlem için yetkiniz bulunmuyor.',
                'code' => 'role_required',
            ], 403);
        }

        return $next($request);
    }
}
