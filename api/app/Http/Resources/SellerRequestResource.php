<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Str;

class SellerRequestResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $isUnlocked = (bool) $this->getAttribute('unlocked_by_seller');
        $schema = collect($this->attribute_schema_snapshot)->keyBy('key');
        $attributes = collect($this->attributes);

        $summaryAttributes = $schema
            ->filter(fn ($definition) => ($definition['show_in_summary'] ?? false)
                && ! ($definition['is_private'] ?? false)
                && $attributes->has($definition['key']))
            ->map(fn ($definition) => [
                'key' => $definition['key'],
                'label' => $definition['label'],
                'value' => $attributes->get($definition['key']),
                'unit' => $definition['unit'] ?? null,
            ])
            ->values();

        $data = [
            'id' => $this->id,
            'reference' => $this->public_reference,
            'title' => $this->redact($this->title),
            'summary' => Str::limit($this->redact($this->description), 220),
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
            'summary_attributes' => $summaryAttributes,
            'is_unlocked' => $isUnlocked,
            'unlock_cost' => $isUnlocked ? null : (int) ($this->category->creditCost?->unlock_cost ?? 0),
            'expires_at' => $this->expires_at?->toIso8601String(),
            'created_at' => $this->created_at->toIso8601String(),
        ];

        if ($isUnlocked) {
            $data['details'] = [
                'description' => $this->description,
                'full_address' => $this->full_address,
                'attributes' => $schema->map(fn ($definition) => [
                    'key' => $definition['key'],
                    'label' => $definition['label'],
                    'value' => $attributes->get($definition['key']),
                    'unit' => $definition['unit'] ?? null,
                    'is_private' => (bool) ($definition['is_private'] ?? false),
                ])->values(),
                'contact' => [
                    'name' => $this->user->name,
                    'email' => $this->user->email,
                    'phone' => $this->user->phone,
                ],
            ];
        }

        return $data;
    }

    private function redact(string $value): string
    {
        $plain = trim(strip_tags($value));
        $plain = preg_replace('/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/u', '[e-posta gizlendi]', $plain) ?? $plain;
        $plain = preg_replace('/(?:https?:\/\/|www\.)\S+/iu', '[bağlantı gizlendi]', $plain) ?? $plain;

        return preg_replace(
            '/(?<!\d)(?:(?:\+?90|0)[\s().-]*)?[2-5]\d{2}(?:[\s().-]*\d){7}(?!\d)/u',
            '[telefon gizlendi]',
            $plain,
        ) ?? $plain;
    }
}
