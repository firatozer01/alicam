<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureSellerIsApproved
{
    public function handle(Request $request, Closure $next): Response
    {
        $status = $request->user()?->sellerProfile()->value('approval_status');

        if ($status !== 'approved') {
            return new JsonResponse([
                'message' => 'Bu alanı kullanmak için onaylı bir hizmet veren profili gerekir.',
                'code' => 'seller_approval_required',
                'approval_status' => $status,
            ], 403);
        }

        return $next($request);
    }
}
