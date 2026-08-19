<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\BuyerRequestResource;
use App\Models\BuyerRequest;
use App\Models\Category;
use App\Models\District;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class BuyerRequestController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        $base = $request->validate([
            'category_slug' => ['required', 'string', 'exists:categories,slug'],
            'title' => ['required', 'string', 'min:10', 'max:120'],
            'description' => ['required', 'string', 'min:20', 'max:3000'],
            'budget_min' => ['required', 'numeric', 'min:0', 'max:9999999999'],
            'budget_max' => ['required', 'numeric', 'gte:budget_min', 'max:9999999999'],
            'city_id' => ['required', 'integer', 'exists:cities,id'],
            'district_id' => ['required', 'integer', 'exists:districts,id'],
            'full_address' => ['nullable', 'string', 'max:500'],
            'attributes' => ['present', 'array'],
        ]);

        $category = Category::query()
            ->where('slug', $base['category_slug'])
            ->where('is_active', true)
            ->with('attributes')
            ->firstOrFail();

        $districtBelongsToCity = District::query()
            ->whereKey($base['district_id'])
            ->where('city_id', $base['city_id'])
            ->where('is_active', true)
            ->exists();

        Validator::make(
            ['district_id' => $districtBelongsToCity],
            ['district_id' => ['accepted']],
            ['district_id.accepted' => 'Seçilen ilçe seçilen şehre ait değil.'],
        )->validate();

        $attributeRules = [];
        $allowedKeys = $category->attributes->pluck('key')->all();
        $attributeRules['attributes'] = ['array:'.implode(',', $allowedKeys)];

        foreach ($category->attributes as $attribute) {
            $key = 'attributes.'.$attribute->key;
            $rules = [$attribute->is_required ? 'required' : 'nullable'];

            match ($attribute->type) {
                'number', 'range' => $rules[] = 'numeric',
                'boolean' => $rules[] = 'boolean',
                'date' => $rules[] = 'date',
                'select' => $rules[] = Rule::in($attribute->options ?? []),
                'multiselect' => $rules[] = 'array',
                default => $rules[] = 'string',
            };

            if (in_array($attribute->type, ['text', 'select'], true)) {
                $rules[] = 'max:500';
            }

            $attributeRules[$key] = $rules;

            if ($attribute->type === 'multiselect') {
                $attributeRules[$key.'.*'] = [Rule::in($attribute->options ?? [])];
            }
        }

        $validatedAttributes = Validator::make(
            ['attributes' => $request->input('attributes', [])],
            $attributeRules,
        )->validate()['attributes'];

        $snapshot = $category->attributes->map(fn ($attribute) => [
            'key' => $attribute->key,
            'label' => $attribute->label,
            'type' => $attribute->type,
            'options' => $attribute->options,
            'unit' => $attribute->unit,
            'is_private' => $attribute->is_private,
            'show_in_summary' => $attribute->show_in_summary,
        ])->values()->all();

        $buyerRequest = DB::transaction(fn () => BuyerRequest::query()->create([
            'public_reference' => $this->newReference(),
            'user_id' => $request->user()->id,
            'category_id' => $category->id,
            'city_id' => $base['city_id'],
            'district_id' => $base['district_id'],
            'title' => $base['title'],
            'description' => $base['description'],
            'budget_min' => $base['budget_min'],
            'budget_max' => $base['budget_max'],
            'full_address' => $base['full_address'] ?? null,
            'attributes' => $validatedAttributes,
            'attribute_schema_snapshot' => $snapshot,
            'status' => 'open',
            'expires_at' => now()->addDays(30),
        ]));

        return response()->json([
            'data' => new BuyerRequestResource($buyerRequest->load(['category', 'city', 'district'])),
        ], 201);
    }

    public function mine(Request $request): JsonResponse
    {
        $items = BuyerRequest::query()
            ->where('user_id', $request->user()->id)
            ->with(['category', 'city', 'district'])
            ->withCount('offers')
            ->latest()
            ->paginate(15);

        return response()->json([
            'data' => BuyerRequestResource::collection($items->items()),
            'meta' => [
                'current_page' => $items->currentPage(),
                'last_page' => $items->lastPage(),
                'total' => $items->total(),
            ],
        ]);
    }

    public function cancel(Request $request, BuyerRequest $buyerRequest): JsonResponse
    {
        abort_unless($buyerRequest->user_id === $request->user()->id, 404);
        abort_unless(in_array($buyerRequest->status, ['open', 'in_negotiation'], true), 422, 'Bu talep artık iptal edilemez.');

        DB::transaction(function () use ($buyerRequest): void {
            $buyerRequest->offers()->where('status', 'pending')->update([
                'status' => 'rejected',
                'reviewed_at' => now(),
            ]);
            $buyerRequest->update(['status' => 'cancelled']);
        });

        return response()->json([
            'message' => 'Talep iptal edildi.',
            'data' => new BuyerRequestResource($buyerRequest->fresh()->load(['category', 'city', 'district'])->loadCount('offers')),
        ]);
    }

    private function newReference(): string
    {
        do {
            $reference = 'ALC-'.now()->format('ymd').'-'.Str::upper(Str::random(6));
        } while (BuyerRequest::query()->where('public_reference', $reference)->exists());

        return $reference;
    }
}
