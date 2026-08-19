<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SellerService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SellerServiceController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        return response()->json([
            'data' => $request->user()->sellerServices()
                ->with('category:id,name,slug,icon,color')
                ->latest()
                ->get(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->validated($request);
        $this->ensureCategoryBelongsToSeller($request, $data['category_id']);
        $service = $request->user()->sellerServices()->create($data);

        return response()->json([
            'message' => 'Hizmetiniz kataloğa eklendi.',
            'data' => $service->load('category:id,name,slug,icon,color'),
        ], 201);
    }

    public function update(Request $request, SellerService $sellerService): JsonResponse
    {
        $this->ensureOwner($request, $sellerService);
        $data = $this->validated($request);
        $this->ensureCategoryBelongsToSeller($request, $data['category_id']);
        $sellerService->update($data);

        return response()->json([
            'message' => 'Hizmetiniz güncellendi.',
            'data' => $sellerService->fresh('category:id,name,slug,icon,color'),
        ]);
    }

    public function destroy(Request $request, SellerService $sellerService): JsonResponse
    {
        $this->ensureOwner($request, $sellerService);
        $sellerService->delete();

        return response()->json(['message' => 'Hizmet katalogdan kaldırıldı.']);
    }

    private function validated(Request $request): array
    {
        return $request->validate([
            'category_id' => ['required', 'integer', 'exists:categories,id'],
            'title' => ['required', 'string', 'min:5', 'max:120'],
            'description' => ['required', 'string', 'min:30', 'max:2000'],
            'price_from' => ['nullable', 'numeric', 'min:0', 'max:9999999999'],
            'delivery_time' => ['nullable', 'string', 'max:80'],
            'is_active' => ['required', 'boolean'],
        ]);
    }

    private function ensureOwner(Request $request, SellerService $sellerService): void
    {
        abort_unless($sellerService->user_id === $request->user()->id, 404);
    }

    private function ensureCategoryBelongsToSeller(Request $request, int $categoryId): void
    {
        abort_unless(
            $request->user()->sellerCategories()->whereKey($categoryId)->exists(),
            422,
            'Yalnızca onaylı hizmet kategorilerinize hizmet ekleyebilirsiniz.',
        );
    }
}
