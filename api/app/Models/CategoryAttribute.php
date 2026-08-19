<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CategoryAttribute extends Model
{
    use HasFactory;

    protected $fillable = [
        'category_id', 'key', 'label', 'type', 'options', 'validation',
        'unit', 'help_text', 'is_required', 'is_filterable',
        'show_in_summary', 'is_private', 'sort_order',
    ];

    protected function casts(): array
    {
        return [
            'options' => 'array',
            'validation' => 'array',
            'is_required' => 'boolean',
            'is_filterable' => 'boolean',
            'show_in_summary' => 'boolean',
            'is_private' => 'boolean',
        ];
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class);
    }
}
