<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\SellerWorkspaceResource;
use App\Models\Category;
use App\Models\District;
use App\Models\Role;
use App\Models\SellerLocation;
use App\Models\SellerProfile;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class SellerProfileController extends Controller
{
    public function show(Request $request): JsonResponse
    {
        return $this->workspaceResponse($request);
    }

    public function update(Request $request): JsonResponse
    {
        $data = $request->validate([
            'profile_type' => ['required', Rule::in(['individual', 'company'])],
            'company_name' => ['nullable', 'required_if:profile_type,company', 'string', 'max:160'],
            'tax_no' => ['nullable', 'required_if:profile_type,company', 'regex:/^[0-9]{10,11}$/'],
            'description' => ['required', 'string', 'min:50', 'max:2000'],
        ], [
            'company_name.required_if' => 'Firma hesabı için firma unvanı zorunludur.',
            'tax_no.required_if' => 'Firma hesabı için vergi veya T.C. kimlik numarası zorunludur.',
            'tax_no.regex' => 'Vergi veya T.C. kimlik numarası 10 ya da 11 haneli olmalıdır.',
        ]);

        $user = $request->user();
        $existing = $user->sellerProfile()->first();
        $this->ensureNotSuspended($existing);

        if ($data['profile_type'] === 'individual') {
            $data['company_name'] = null;
            $data['tax_no'] = null;
        }

        DB::transaction(function () use ($user, $data): void {
            SellerProfile::query()->updateOrCreate(
                ['user_id' => $user->id],
                [...$data, ...$this->draftState()],
            );

            $sellerRole = Role::query()->where('name', 'seller')->firstOrFail();
            $user->roles()->syncWithoutDetaching([$sellerRole->id]);
        });

        return $this->workspaceResponse($request, 'Profil taslağı kaydedildi.');
    }

    public function updateCategories(Request $request): JsonResponse
    {
        $data = $request->validate([
            'category_ids' => ['required', 'array', 'min:1', 'max:20'],
            'category_ids.*' => ['required', 'integer', 'distinct', 'exists:categories,id'],
        ]);

        $this->requireEditableProfile($request);

        $activeCount = Category::query()
            ->whereIn('id', $data['category_ids'])
            ->where('is_active', true)
            ->count();

        if ($activeCount !== count($data['category_ids'])) {
            throw ValidationException::withMessages([
                'category_ids' => 'Seçilen kategorilerden biri kullanıma açık değil.',
            ]);
        }

        DB::transaction(function () use ($request, $data): void {
            $request->user()->sellerCategories()->sync($data['category_ids']);
            $request->user()->sellerProfile()->update($this->draftState());
        });

        return $this->workspaceResponse($request, 'Hizmet kategorileri kaydedildi.');
    }

    public function updateLocations(Request $request): JsonResponse
    {
        $data = $request->validate([
            'locations' => ['required', 'array', 'min:1', 'max:200'],
            'locations.*.city_id' => ['required', 'integer', 'exists:cities,id'],
            'locations.*.district_id' => ['required', 'integer', 'distinct', 'exists:districts,id'],
        ]);

        $this->requireEditableProfile($request);

        foreach ($data['locations'] as $index => $location) {
            $valid = District::query()
                ->whereKey($location['district_id'])
                ->where('city_id', $location['city_id'])
                ->where('is_active', true)
                ->exists();

            if (! $valid) {
                throw ValidationException::withMessages([
                    "locations.{$index}.district_id" => 'Seçilen ilçe seçilen şehre ait değil.',
                ]);
            }
        }

        DB::transaction(function () use ($request, $data): void {
            SellerLocation::query()->where('seller_id', $request->user()->id)->delete();

            foreach ($data['locations'] as $location) {
                SellerLocation::query()->create([
                    'seller_id' => $request->user()->id,
                    ...$location,
                ]);
            }

            $request->user()->sellerProfile()->update($this->draftState());
        });

        return $this->workspaceResponse($request, 'Hizmet bölgeleri kaydedildi.');
    }

    public function submit(Request $request): JsonResponse
    {
        $user = $request->user()->load(['sellerProfile', 'sellerCategories', 'sellerLocations']);
        $profile = $user->sellerProfile;

        if (! $profile) {
            throw ValidationException::withMessages(['profile' => 'Önce satıcı profilini tamamlayın.']);
        }

        $this->ensureNotSuspended($profile);

        $profileComplete = mb_strlen(trim($profile->description)) >= 50
            && ($profile->profile_type === 'individual' || ($profile->company_name && $profile->tax_no));

        if (! $profileComplete || $user->sellerCategories->isEmpty() || $user->sellerLocations->isEmpty()) {
            throw ValidationException::withMessages([
                'profile' => 'Başvuru göndermeden önce profil, kategori ve hizmet bölgesi adımlarını tamamlayın.',
            ]);
        }

        $profile->update([
            'approval_status' => 'pending',
            'rejection_reason' => null,
            'submitted_at' => now(),
            'reviewed_at' => null,
            'reviewed_by' => null,
        ]);

        return $this->workspaceResponse($request, 'Satıcı başvurunuz incelemeye gönderildi.');
    }

    private function workspaceResponse(Request $request, ?string $message = null): JsonResponse
    {
        $user = $request->user()->fresh()->load([
            'sellerProfile',
            'sellerCategories',
            'sellerLocations.city',
            'sellerLocations.district',
        ]);

        return response()->json(array_filter([
            'message' => $message,
            'data' => new SellerWorkspaceResource($user),
        ]));
    }

    private function requireEditableProfile(Request $request): SellerProfile
    {
        $profile = $request->user()->sellerProfile()->first();

        if (! $profile) {
            throw ValidationException::withMessages([
                'profile' => 'Önce temel satıcı profilini kaydedin.',
            ]);
        }

        $this->ensureNotSuspended($profile);

        return $profile;
    }

    private function ensureNotSuspended(?SellerProfile $profile): void
    {
        abort_if($profile?->approval_status === 'suspended', 403, 'Askıya alınmış satıcı profili düzenlenemez.');
    }

    private function draftState(): array
    {
        return [
            'approval_status' => 'draft',
            'rejection_reason' => null,
            'submitted_at' => null,
            'reviewed_at' => null,
            'reviewed_by' => null,
        ];
    }
}
