<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Category;
use App\Models\CategoryAttribute;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class AdminCategoryAttributeController extends Controller
{
    public function store(Request $request, Category $category): JsonResponse
    {
        $data = $this->validated($request, $category);

        $attribute = DB::transaction(function () use ($request, $category, $data): CategoryAttribute {
            $attribute = $category->attributes()->create($data);
            $category->increment('schema_version');
            $this->audit($request, 'category_attribute.created', $attribute, null, $attribute->toArray());

            return $attribute;
        });

        return response()->json([
            'message' => 'Form alanı eklendi.',
            'data' => $attribute,
            'schema_version' => $category->fresh()->schema_version,
        ], 201);
    }

    public function update(Request $request, CategoryAttribute $categoryAttribute): JsonResponse
    {
        $category = $categoryAttribute->category;
        $data = $this->validated($request, $category, $categoryAttribute);

        DB::transaction(function () use ($request, $category, $categoryAttribute, $data): void {
            $oldValues = $categoryAttribute->toArray();
            $categoryAttribute->update($data);
            $category->increment('schema_version');
            $this->audit($request, 'category_attribute.updated', $categoryAttribute, $oldValues, $categoryAttribute->fresh()->toArray());
        });

        return response()->json([
            'message' => 'Form alanı güncellendi.',
            'data' => $categoryAttribute->fresh(),
            'schema_version' => $category->fresh()->schema_version,
        ]);
    }

    public function destroy(Request $request, CategoryAttribute $categoryAttribute): JsonResponse
    {
        $category = $categoryAttribute->category;

        DB::transaction(function () use ($request, $category, $categoryAttribute): void {
            $oldValues = $categoryAttribute->toArray();
            $this->audit($request, 'category_attribute.deleted', $categoryAttribute, $oldValues, null);
            $categoryAttribute->delete();
            $category->increment('schema_version');
        });

        return response()->json([
            'message' => 'Form alanı kaldırıldı. Eski taleplerin şema kopyaları korunur.',
            'schema_version' => $category->fresh()->schema_version,
        ]);
    }

    private function validated(Request $request, Category $category, ?CategoryAttribute $attribute = null): array
    {
        $selectType = in_array($request->input('type'), ['select', 'multiselect'], true);

        $data = $request->validate([
            'key' => [
                'required', 'string', 'min:2', 'max:80', 'regex:/^[a-z][a-z0-9_]*$/',
                Rule::unique('category_attributes', 'key')
                    ->where('category_id', $category->id)
                    ->ignore($attribute?->id),
            ],
            'label' => ['required', 'string', 'min:2', 'max:120'],
            'type' => ['required', Rule::in(['text', 'select', 'multiselect', 'number', 'range', 'boolean', 'date'])],
            'options' => [$selectType ? 'required' : 'nullable', 'array', 'max:50'],
            'options.*' => ['string', 'min:1', 'max:80', 'distinct'],
            'unit' => ['nullable', 'string', 'max:24'],
            'help_text' => ['nullable', 'string', 'max:255'],
            'is_required' => ['required', 'boolean'],
            'is_filterable' => ['required', 'boolean'],
            'show_in_summary' => ['required', 'boolean'],
            'is_private' => ['required', 'boolean'],
            'sort_order' => ['required', 'integer', 'min:0', 'max:10000'],
        ]);

        if (! $selectType) {
            $data['options'] = null;
        }

        return $data;
    }

    private function audit(Request $request, string $action, CategoryAttribute $attribute, ?array $oldValues, ?array $newValues): void
    {
        AuditLog::query()->create([
            'actor_id' => $request->user()->id,
            'action' => $action,
            'auditable_type' => CategoryAttribute::class,
            'auditable_id' => $attribute->id,
            'old_values' => $oldValues,
            'new_values' => $newValues,
            'ip_address' => $request->ip(),
            'created_at' => now(),
        ]);
    }
}
