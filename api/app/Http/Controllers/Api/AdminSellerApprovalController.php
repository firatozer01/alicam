<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\SellerWorkspaceResource;
use App\Models\AuditLog;
use App\Models\SellerCredit;
use App\Models\SellerProfile;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class AdminSellerApprovalController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $data = $request->validate([
            'status' => ['sometimes', Rule::in(['pending', 'approved', 'rejected', 'suspended'])],
        ]);
        $status = $data['status'] ?? 'pending';

        $sellers = User::query()
            ->whereHas('sellerProfile', fn ($query) => $query->where('approval_status', $status))
            ->with([
                'sellerProfile',
                'sellerCategories',
                'sellerLocations.city',
                'sellerLocations.district',
            ])
            ->orderByDesc(
                SellerProfile::query()
                    ->select('submitted_at')
                    ->whereColumn('seller_profiles.user_id', 'users.id')
                    ->limit(1),
            )
            ->paginate(20);

        return response()->json([
            'data' => $sellers->getCollection()
                ->map(fn ($seller) => (new SellerWorkspaceResource($seller))->resolve($request)),
            'meta' => [
                'current_page' => $sellers->currentPage(),
                'last_page' => $sellers->lastPage(),
                'total' => $sellers->total(),
                'status' => $status,
            ],
        ]);
    }

    public function update(Request $request, User $seller): JsonResponse
    {
        $data = $request->validate([
            'decision' => ['required', Rule::in(['approved', 'rejected'])],
            'reason' => ['nullable', 'required_if:decision,rejected', 'string', 'min:5', 'max:500'],
        ]);

        DB::transaction(function () use ($request, $seller, $data): void {
            $profile = SellerProfile::query()
                ->where('user_id', $seller->id)
                ->lockForUpdate()
                ->firstOrFail();

            abort_unless($profile->approval_status === 'pending', 422, 'Yalnızca bekleyen başvurular incelenebilir.');

            $oldValues = [
                'approval_status' => $profile->approval_status,
                'rejection_reason' => $profile->rejection_reason,
            ];

            $profile->update([
                'approval_status' => $data['decision'],
                'rejection_reason' => $data['decision'] === 'rejected' ? $data['reason'] : null,
                'reviewed_at' => now(),
                'reviewed_by' => $request->user()->id,
            ]);

            if ($data['decision'] === 'approved') {
                SellerCredit::query()->firstOrCreate(
                    ['user_id' => $seller->id],
                    ['balance' => 0],
                );
            }

            AuditLog::query()->create([
                'actor_id' => $request->user()->id,
                'action' => 'seller.'.$data['decision'],
                'auditable_type' => SellerProfile::class,
                'auditable_id' => $seller->id,
                'old_values' => $oldValues,
                'new_values' => [
                    'approval_status' => $data['decision'],
                    'rejection_reason' => $profile->rejection_reason,
                ],
                'ip_address' => $request->ip(),
                'created_at' => now(),
            ]);
        });

        $seller->load([
            'sellerProfile',
            'sellerCategories',
            'sellerLocations.city',
            'sellerLocations.district',
        ]);

        return response()->json([
            'message' => $data['decision'] === 'approved'
                ? 'Satıcı başvurusu onaylandı.'
                : 'Satıcı başvurusu reddedildi.',
            'data' => new SellerWorkspaceResource($seller),
        ]);
    }
}
