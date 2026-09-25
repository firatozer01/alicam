<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Category;
use App\Support\CategoryTree;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class CategoryController extends Controller
{
    /**
     * Kok kategoriler. Agac buyudugu icin iki secmeli parametre eklendi:
     *   kind=service|listing  -> hizmet talepleri / ilan talepleri ayrimi
     *   tree=1                -> alt kategorileri de gomulu dondurur
     */
    public function index(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'kind' => ['sometimes', Rule::in(['service', 'listing'])],
            'tree' => ['sometimes'],
            'parent' => ['sometimes', 'string', 'max:90'],
        ]);

        $query = Category::query()
            ->active()
            ->with('creditCost')
            ->orderBy('sort_order')
            ->orderBy('name');

        if (isset($filters['parent'])) {
            $parent = Category::query()->active()->where('slug', $filters['parent'])->firstOrFail();
            $query->where('parent_id', $parent->id);
        } else {
            $query->whereNull('parent_id');
        }

        if (isset($filters['kind'])) {
            $query->where('kind', $filters['kind']);
        }

        if ($request->boolean('tree')) {
            // Iki seviye yeter: kok -> alt kategori -> yaprak.
            $query->with(['children' => fn ($child) => $child->where('is_active', true)
                ->with(['children' => fn ($leaf) => $leaf->where('is_active', true)])]);
        }

        return response()->json(['data' => $query->get()]);
    }

    public function attributes(Category $category): JsonResponse
    {
        abort_unless($category->is_active, 404);

        $category->load(['attributes', 'creditCost', 'parent.attributes']);

        return response()->json([
            'data' => $category,
            // Alan setleri kalitimlidir: yaprakta sorulanlar ust kategorininkini
            // de icerir, boylece form tek listeden kurulur.
            'effective_attributes' => CategoryTree::effectiveAttributes($category),
        ]);
    }
}
