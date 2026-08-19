<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Category;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class AdminCategoryController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json([
            'data' => Category::query()
                ->whereNull('parent_id')
                ->with(['attributes', 'creditCost'])
                ->withCount(['attributes', 'buyerRequests', 'sellers', 'sellerServices'])
                ->orderBy('sort_order')
                ->orderBy('name')
                ->get(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->validated($request);

        $category = DB::transaction(function () use ($request, $data): Category {
            $unlockCost = $data['unlock_cost'];
            unset($data['unlock_cost']);

            $category = Category::query()->create($data);
            $category->creditCost()->create(['unlock_cost' => $unlockCost]);

            $this->audit($request, 'category.created', $category, null, [
                ...$category->only(['name', 'slug', 'icon', 'color', 'is_active', 'sort_order']),
                'unlock_cost' => $unlockCost,
            ]);

            return $category;
        });

        return response()->json([
            'message' => 'Kategori oluşturuldu.',
            'data' => $this->loadCategory($category),
        ], 201);
    }

    public function update(Request $request, Category $category): JsonResponse
    {
        $data = $this->validated($request, $category);

        DB::transaction(function () use ($request, $category, $data): void {
            $oldValues = [
                ...$category->only(['name', 'slug', 'icon', 'color', 'is_active', 'sort_order']),
                'unlock_cost' => $category->creditCost?->unlock_cost,
            ];
            $unlockCost = $data['unlock_cost'];
            unset($data['unlock_cost']);

            $category->update($data);
            $category->creditCost()->updateOrCreate([], ['unlock_cost' => $unlockCost]);

            $this->audit($request, 'category.updated', $category, $oldValues, [
                ...$category->only(['name', 'slug', 'icon', 'color', 'is_active', 'sort_order']),
                'unlock_cost' => $unlockCost,
            ]);
        });

        return response()->json([
            'message' => 'Kategori güncellendi.',
            'data' => $this->loadCategory($category),
        ]);
    }

    private function validated(Request $request, ?Category $category = null): array
    {
        $request->merge([
            'slug' => Str::slug((string) ($request->input('slug') ?: $request->input('name'))),
        ]);

        return $request->validate([
            'name' => ['required', 'string', 'min:2', 'max:80'],
            'slug' => ['required', 'string', 'min:2', 'max:90', 'alpha_dash', Rule::unique('categories', 'slug')->ignore($category?->id)],
            'icon' => ['nullable', 'string', 'max:32'],
            'color' => ['required', 'string', 'regex:/^#[0-9A-Fa-f]{6}$/'],
            'is_active' => ['required', 'boolean'],
            'sort_order' => ['required', 'integer', 'min:0', 'max:10000'],
            'unlock_cost' => ['required', 'integer', 'min:0', 'max:10000'],
        ]);
    }

    private function loadCategory(Category $category): Category
    {
        return $category->fresh()
            ->load(['attributes', 'creditCost'])
            ->loadCount(['attributes', 'buyerRequests', 'sellers', 'sellerServices']);
    }

    private function audit(Request $request, string $action, Category $category, ?array $oldValues, array $newValues): void
    {
        AuditLog::query()->create([
            'actor_id' => $request->user()->id,
            'action' => $action,
            'auditable_type' => Category::class,
            'auditable_id' => $category->id,
            'old_values' => $oldValues,
            'new_values' => $newValues,
            'ip_address' => $request->ip(),
            'created_at' => now(),
        ]);
    }
}
