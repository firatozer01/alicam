<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class SellerWorkspaceResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $profile = $this->sellerProfile;
        $categories = $this->sellerCategories;
        $locations = $this->sellerLocations;

        $profileComplete = $profile !== null
            && mb_strlen(trim($profile->description)) >= 50
            && ($profile->profile_type === 'individual'
                || ($profile->company_name && $profile->tax_no));

        return [
            'user' => [
                'id' => $this->id,
                'name' => $this->name,
                'email' => $this->email,
                'phone' => $this->phone,
                'verification' => [
                    'email' => $this->email_verified_at !== null,
                    'phone' => $this->phone_verified_at !== null,
                    'complete' => $this->email_verified_at !== null && $this->phone_verified_at !== null,
                ],
            ],
            'profile' => $profile ? [
                'profile_type' => $profile->profile_type,
                'company_name' => $profile->company_name,
                'tax_no' => $profile->tax_no,
                'description' => $profile->description,
                'logo_path' => $profile->logo_path,
                'approval_status' => $profile->approval_status,
                'rejection_reason' => $profile->rejection_reason,
                'submitted_at' => $profile->submitted_at?->toIso8601String(),
                'reviewed_at' => $profile->reviewed_at?->toIso8601String(),
            ] : null,
            'categories' => $categories->map(fn ($category) => [
                'id' => $category->id,
                'name' => $category->name,
                'slug' => $category->slug,
                'icon' => $category->icon,
                'color' => $category->color,
            ])->values(),
            'locations' => $locations->map(fn ($location) => [
                'city_id' => $location->city_id,
                'city_name' => $location->city->name,
                'district_id' => $location->district_id,
                'district_name' => $location->district->name,
            ])->values(),
            'completion' => [
                'profile' => $profileComplete,
                'categories' => $categories->isNotEmpty(),
                'locations' => $locations->isNotEmpty(),
                'verification' => $this->email_verified_at !== null && $this->phone_verified_at !== null,
                'can_submit' => $profileComplete
                    && $categories->isNotEmpty()
                    && $locations->isNotEmpty()
                    && $this->email_verified_at !== null
                    && $this->phone_verified_at !== null,
            ],
        ];
    }
}
