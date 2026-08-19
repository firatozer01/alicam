<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\UserResource;
use App\Services\VerificationCodeService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class VerificationController extends Controller
{
    public function __construct(private readonly VerificationCodeService $verificationCodes) {}

    public function send(Request $request): JsonResponse
    {
        $data = $request->validate([
            'channel' => ['required', Rule::in(['email', 'phone'])],
        ]);

        $verifiedAt = $data['channel'].'_verified_at';
        if ($request->user()->{$verifiedAt}) {
            return response()->json(['message' => 'Bu iletişim kanalı zaten doğrulanmış.']);
        }

        $previewCode = $this->verificationCodes->issue($request->user(), $data['channel']);

        return response()->json([
            'message' => 'Yeni doğrulama kodu gönderildi.',
            'verification_preview' => $previewCode,
        ]);
    }

    public function verify(Request $request): JsonResponse
    {
        $data = $request->validate([
            'channel' => ['required', Rule::in(['email', 'phone'])],
            'code' => ['required', 'digits:6'],
        ]);

        $this->verificationCodes->verify($request->user(), $data['channel'], $data['code']);

        return response()->json([
            'message' => 'İletişim bilgisi doğrulandı.',
            'data' => new UserResource($request->user()->fresh()->load('roles')),
        ]);
    }
}
