<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CategoryCreditCost extends Model
{
    use HasFactory;

    protected $primaryKey = 'category_id';

    public $incrementing = false;

    protected $fillable = ['category_id', 'unlock_cost'];

    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class);
    }
}
