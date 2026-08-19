<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class OfferResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $profile = $this->seller->sellerProfile;
        $data = [
            'id' => $this->id,
            'request_id' => $this->request_id,
            'price' => $this->price,
            'message' => $this->message,
            'status' => $this->status,
            'seller' => [
                'id' => $this->seller->id,
                'name' => $this->seller->name,
                'company_name' => $profile?->company_name,
                'profile_type' => $profile?->profile_type,
                'description' => $profile?->description,
            ],
            'reviewed_at' => $this->reviewed_at?->toIso8601String(),
            'accepted_at' => $this->accepted_at?->toIso8601String(),
            'created_at' => $this->created_at->toIso8601String(),
            'updated_at' => $this->updated_at->toIso8601String(),
        ];

        if ($this->status === 'accepted') {
            $data['seller']['contact'] = [
                'email' => $this->seller->email,
                'phone' => $this->seller->phone,
            ];
        }

        return $data;
    }
}
