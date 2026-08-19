<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class BuyerRequestResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'reference' => $this->public_reference,
            'title' => $this->title,
            'description' => $this->description,
            'status' => $this->status,
            'budget' => [
                'min' => $this->budget_min,
                'max' => $this->budget_max,
            ],
            'category' => [
                'id' => $this->category->id,
                'name' => $this->category->name,
                'slug' => $this->category->slug,
                'icon' => $this->category->icon,
                'color' => $this->category->color,
            ],
            'location' => [
                'city' => ['id' => $this->city->id, 'name' => $this->city->name],
                'district' => ['id' => $this->district->id, 'name' => $this->district->name],
            ],
            'attributes' => $this->attributes,
            'offer_count' => (int) ($this->getAttribute('offers_count') ?? 0),
            'expires_at' => $this->expires_at?->toIso8601String(),
            'created_at' => $this->created_at->toIso8601String(),
        ];
    }
}
