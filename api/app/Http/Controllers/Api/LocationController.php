<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\City;
use Illuminate\Http\JsonResponse;

class LocationController extends Controller
{
    public function index(): JsonResponse
    {
        $cities = City::query()
            ->where('is_active', true)
            ->with(['districts' => fn ($query) => $query->where('is_active', true)])
            ->orderBy('name')
            ->get();

        return response()->json(['data' => $cities]);
    }
}
