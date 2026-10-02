<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\BuyerRequestResource;
use App\Models\BuyerRequest;
use App\Models\Category;
use App\Models\District;
use App\Models\User;
use App\Services\CategoryAttributeForm;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class BuyerRequestController extends Controller
{
    public function __construct(
        private readonly CategoryAttributeForm $attributeForm,
    ) {}

    public function store(Request $request): JsonResponse
    {
        $base = $request->validate([
            'category_slug' => ['required', 'string', 'exists:categories,slug'],
            // Ek kategoriler talebin erisimini genisletir; form ve kredi
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
            // Yeni sihirbazin alanlari; uculu de istege bagli.
            'timing' => ['sometimes', 'nullable', Rule::in(['urgent', 'this_week', 'this_month', 'flexible'])],
            'budget_flexible' => ['sometimes', 'boolean'],
            'contact_preferences' => ['sometimes', 'array', 'max:3'],
            'contact_preferences.*' => [Rule::in(['message', 'phone', 'whatsapp'])],
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

        // Alan dogrulamasi ve sema anlik goruntusu satici ilanlariyla
        // ortak; kurallar CategoryAttributeForm'da tek yerde duruyor.
        ['attributes' => $validatedAttributes, 'snapshot' => $snapshot] =
            $this->attributeForm->resolve($category, $request->input('attributes', []));

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
            'timing' => $base['timing'] ?? null,
            'budget_flexible' => $base['budget_flexible'] ?? false,
            // Bos dizi ile null ayni sey degil: bos dizi "hicbiri"
            // demek, null "sorulmadi". Ikisini de saklayabilmek icin
            // anahtar gonderilmediyse null biraktik.
            'contact_preferences' => $base['contact_preferences'] ?? null,
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
            'data' => new BuyerRequestResource($buyerRequest->load(['category', 'categories', 'invitedSellers', 'city', 'district', 'user'])),
        ], 201);
    }

    public function mine(Request $request): JsonResponse
    {
        $items = BuyerRequest::query()
            ->where('user_id', $request->user()->id)
            ->with(['category', 'city', 'district', 'user'])
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
            'data' => new BuyerRequestResource($buyerRequest->fresh()->load(['category', 'city', 'district', 'user'])->loadCount('offers')),
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
