<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use App\Support\Text;
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
            'title' => Text::redactContacts($this->title),
            'summary' => Str::limit(Text::redactContacts($this->description), 220),
            'status' => $this->status,
            'budget' => [
                'min' => $this->budget_min,
                'max' => $this->budget_max,
                'flexible' => (bool) $this->budget_flexible,
            ],
            // Aciliyet kimlik tasimaz ve teklif verenin en cok isine
            // yarayan bilgilerden biri; kilit oncesi de gorunur.
            'timing' => $this->timing,
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
            'offer_count' => (int) ($this->offers_count ?? 0),
            'is_unlocked' => $isUnlocked,
            // Alici bu talebi dogrudan bu saticinin vitrininden actiysa isaretlenir.
            'is_invited' => (bool) $this->getAttribute('invited_for_seller'),
            'is_favorite' => (bool) $this->getAttribute('favorited_by_seller'),
            'unlock_cost' => $isUnlocked
                ? null
                : ($this->is_demo ? 0 : (int) ($this->category->creditCost?->unlock_cost ?? 0)),
            // Arayuz bunu rozetle gosterir; ornek talep gercek isle
            // karistirilmasin.
            'is_demo' => (bool) $this->is_demo,
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
                    // Nasil ulasilsin: tek basina kimlik tasimasa da
                    // iletisim bilgisinin parcasi, onunla birlikte acilir.
                    'preferences' => $this->contact_preferences ?? [],
                    // Fotograf da kimliktir ve bu blok KILIT ACILINCA
                    // doluyor. Kilit oncesi alicinin adi bile donmuyor;
                    // avatari yukari tasimak, satici kredi odemeden
                    // aliciyi taniyabilsin demek olurdu.
                    //
                    // Adres kullanici id'si tasidigi icin ayrica onemli:
                    // disari ciktigi anda mesajlasma uzerinden odemesiz
                    // bir kanal acilirdi.
                    'avatar_url' => $this->user->avatar_url,
                ],
            ];
        }

        return $data;
    }
}
