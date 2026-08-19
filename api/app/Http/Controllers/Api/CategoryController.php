<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Category;
use Illuminate\Http\JsonResponse;

class CategoryController extends Controller
{
    public function index(): JsonResponse
    {
        $categories = Category::query()
            ->active()
            ->whereNull('parent_id')
            ->with('creditCost')
            ->orderBy('sort_order')
            ->get();

        return response()->json(['data' => $categories]);
    }

    public function attributes(Category $category): JsonResponse
    {
        abort_unless($category->is_active, 404);

        $category->load(['attributes', 'creditCost']);

        return response()->json(['data' => $category]);
    }
}
