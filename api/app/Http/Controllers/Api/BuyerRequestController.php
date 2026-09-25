<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\BuyerRequestResource;
use App\Models\BuyerRequest;
use App\Models\Category;
use App\Models\District;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use App\Support\CategoryTree;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class BuyerRequestController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        $base = $request->validate([
            'category_slug' => ['required', 'string', 'exists:categories,slug'],
            // Ek kategoriler talebin erisimini genisletir; form ve kontor
            // bedeli her zaman birincil kategoriden gelir.
            'extra_category_slugs' => ['sometimes', 'array', 'max:4'],
            'extra_category_slugs.*' => ['string', 'distinct', 'exists:categories,slug'],
            // Vitrinden gelen dogrudan teklif istegi: talep bu saticilara yonlendirilir.
            'invited_seller_ids' => ['sometimes', 'array', 'max:5'],
            'invited_seller_ids.*' => ['integer', 'distinct', 'exists:users,id'],
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

        // Alan seti kalitimlidir: yaprak kategoride sorulanlar ust kategorilerin
        // alanlarini da icerir, yoksa derin agacta hicbir alan dogrulanmaz.
        $effectiveAttributes = CategoryTree::effectiveAttributes($category);

        $attributeRules = [];
        $allowedKeys = $effectiveAttributes->pluck('key')->all();
        $attributeRules['attributes'] = $allowedKeys === []
            ? ['array']
            : ['array:'.implode(',', $allowedKeys)];

        foreach ($effectiveAttributes as $attribute) {
            $key = 'attributes.'.$attribute->key;

            // Zorunlu bir boolean alanda "Hayir" (false) cevabi da gecerlidir;
            // Laravel'de required false'u bos sayip reddettigi icin present kullanilir.
            $presence = $attribute->is_required
                ? ($attribute->type === 'boolean' ? 'present' : 'required')
                : 'nullable';
            $rules = [$presence];

            match ($attribute->type) {
                'number', 'range' => $rules[] = 'numeric',
                'boolean' => $rules[] = 'boolean',
                'date' => $rules[] = 'date',
                'select' => $rules[] = Rule::in($attribute->options ?? []),
                'multiselect' => $rules[] = 'array',
                'textarea' => $rules[] = 'string',
                default => $rules[] = 'string',
            };

            if (in_array($attribute->type, ['text', 'select'], true)) {
                $rules[] = 'max:500';
            }

            if ($attribute->type === 'textarea') {
                $rules[] = 'max:2000';
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

        $snapshot = $effectiveAttributes->map(fn ($attribute) => [
            'key' => $attribute->key,
            'label' => $attribute->label,
            'type' => $attribute->type,
            'options' => $attribute->options,
            'unit' => $attribute->unit,
            'is_private' => $attribute->is_private,
            'show_in_summary' => $attribute->show_in_summary,
        ])->values()->all();

        // Yalnizca onayli hizmet verenler davet edilebilir.
        $invitedSellers = empty($base['invited_seller_ids']) ? [] : User::query()
            ->whereIn('id', $base['invited_seller_ids'])
            ->where('id', '!=', $request->user()->id)
            ->whereHas('sellerProfile', fn ($query) => $query->where('approval_status', 'approved'))
            ->pluck('id')
            ->all();

        $extraCategories = Category::query()
            ->whereIn('slug', array_diff($base['extra_category_slugs'] ?? [], [$category->slug]))
            ->where('is_active', true)
            ->pluck('id')
            ->all();

        $buyerRequest = DB::transaction(function () use ($request, $base, $category, $extraCategories, $invitedSellers, $validatedAttributes, $snapshot) {
            $created = BuyerRequest::query()->create([
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
            ]);

            $pivot = [$category->id => ['is_primary' => true, 'sort_order' => 0]];
            foreach (array_values($extraCategories) as $index => $categoryId) {
                $pivot[$categoryId] = ['is_primary' => false, 'sort_order' => $index + 1];
            }
            $created->categories()->sync($pivot);

            if ($invitedSellers !== []) {
                $created->invitedSellers()->sync(array_fill_keys($invitedSellers, ['source' => 'storefront']));
            }

            return $created;
        });

        return response()->json([
            'data' => new BuyerRequestResource($buyerRequest->load(['category', 'categories', 'invitedSellers', 'city', 'district'])),
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
