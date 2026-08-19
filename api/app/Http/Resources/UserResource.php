<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class UserResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'email' => $this->email,
            'phone' => $this->phone,
            'status' => $this->status,
            'roles' => $this->roles->pluck('name')->values(),
            'verification' => [
                'email' => $this->email_verified_at !== null,
                'phone' => $this->phone_verified_at !== null,
                'complete' => $this->email_verified_at !== null && $this->phone_verified_at !== null,
            ],
        ];
    }
}
