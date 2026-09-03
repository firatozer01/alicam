<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SellerPortfolioImage;
use App\Models\SellerPortfolioItem;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class SellerPortfolioController extends Controller
{
    /** Görseller herkese açık disk yerine uygulama üzerinden servis edilir. */
    private const DISK = 'local';

    public function index(Request $request): JsonResponse
    {
        $items = SellerPortfolioItem::query()
            ->where('user_id', $request->user()->id)
            ->with(['category:id,name,slug,icon,color', 'images'])
            ->orderBy('sort_order')
            ->latest()
            ->get();

        return response()->json(['data' => $items->map(fn (SellerPortfolioItem $item) => self::present($item))->values()]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->validated($request);
        $data['user_id'] = $request->user()->id;

        $item = SellerPortfolioItem::query()->create($data);
        // Veritabanı varsayılanları (is_published) bellekteki örneğe yansısın.
        $item->refresh()->load(['category:id,name,slug,icon,color', 'images']);

        return response()->json([
            'message' => 'Çalışma galerine eklendi.',
            'data' => self::present($item),
        ], 201);
    }

    public function update(Request $request, SellerPortfolioItem $portfolioItem): JsonResponse
    {
        abort_unless($portfolioItem->user_id === $request->user()->id, 403);

        $portfolioItem->update($this->validated($request));
        $portfolioItem->load(['category:id,name,slug,icon,color', 'images']);

        return response()->json([
            'message' => 'Çalışma güncellendi.',
            'data' => self::present($portfolioItem),
        ]);
    }

    public function destroy(Request $request, SellerPortfolioItem $portfolioItem): JsonResponse
    {
        abort_unless($portfolioItem->user_id === $request->user()->id, 403);

        foreach ($portfolioItem->images as $image) {
            Storage::disk(self::DISK)->delete($image->path);
        }

        $portfolioItem->delete();

        return response()->json(['message' => 'Çalışma galeriden kaldırıldı.']);
    }

    public function uploadImage(Request $request, SellerPortfolioItem $portfolioItem): JsonResponse
    {
        abort_unless($portfolioItem->user_id === $request->user()->id, 403);
        abort_if($portfolioItem->images()->count() >= 8, 422, 'Bir çalışmaya en fazla 8 görsel eklenebilir.');

        $request->validate([
            'image' => ['required', 'image', 'mimes:jpeg,jpg,png,webp', 'max:4096'],
        ]);

        $path = $request->file('image')->store("portfolio/{$portfolioItem->user_id}", self::DISK);

        $image = SellerPortfolioImage::query()->create([
            'portfolio_item_id' => $portfolioItem->id,
            'path' => $path,
            'sort_order' => (int) $portfolioItem->images()->max('sort_order') + 1,
        ]);

        return response()->json([
            'message' => 'Görsel yüklendi.',
            'data' => ['id' => $image->id, 'url' => self::imageUrl($image)],
        ], 201);
    }

    public function destroyImage(Request $request, SellerPortfolioImage $portfolioImage): JsonResponse
    {
        abort_unless($portfolioImage->item->user_id === $request->user()->id, 403);

        Storage::disk(self::DISK)->delete($portfolioImage->path);
        $portfolioImage->delete();

        return response()->json(['message' => 'Görsel kaldırıldı.']);
    }

    /** Görseli uygulama üzerinden akıtır; public disk sembolik bağı gerekmez. */
    public function showImage(SellerPortfolioImage $portfolioImage): StreamedResponse
    {
        abort_unless(Storage::disk(self::DISK)->exists($portfolioImage->path), 404);

        return Storage::disk(self::DISK)->response(
            $portfolioImage->path,
            null,
            ['Cache-Control' => 'public, max-age=604800'],
        );
    }

    /**
     * @return array<string, mixed>
     */
    private function validated(Request $request): array
    {
        return $request->validate([
            'title' => ['required', 'string', 'max:140'],
            'description' => ['required', 'string', 'max:2000'],
            'category_id' => ['sometimes', 'nullable', 'integer', 'exists:categories,id'],
            'location' => ['sometimes', 'nullable', 'string', 'max:120'],
            'duration' => ['sometimes', 'nullable', 'string', 'max:60'],
            'area' => ['sometimes', 'nullable', 'string', 'max:60'],
            'budget' => ['sometimes', 'nullable', 'numeric', 'min:0', 'max:9999999999'],
            'client_type' => ['sometimes', 'nullable', 'string', 'max:60'],
            'highlights' => ['sometimes', 'nullable', 'array', 'max:8'],
            'highlights.*' => ['string', 'max:120'],
            'completed_at' => ['sometimes', 'nullable', 'date'],
            'is_published' => ['sometimes', 'boolean'],
            'sort_order' => ['sometimes', 'integer', 'min:0'],
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    public static function present(SellerPortfolioItem $item): array
    {
        return [
            'id' => $item->id,
            'title' => $item->title,
            'description' => $item->description,
            'location' => $item->location,
            'duration' => $item->duration,
            'area' => $item->area,
            'budget' => $item->budget,
            'client_type' => $item->client_type,
            'highlights' => $item->highlights ?? [],
            'completed_at' => $item->completed_at?->toDateString(),
            'is_published' => $item->is_published,
            'category' => $item->category ? [
                'id' => $item->category->id,
                'name' => $item->category->name,
                'slug' => $item->category->slug,
                'icon' => $item->category->icon,
                'color' => $item->category->color,
            ] : null,
            'images' => $item->images->map(fn (SellerPortfolioImage $image) => [
                'id' => $image->id,
                'url' => self::imageUrl($image),
            ])->values(),
        ];
    }

    private static function imageUrl(SellerPortfolioImage $image): string
    {
        return "/api/portfolio-images/{$image->id}";
    }
}
