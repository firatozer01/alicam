<?php

use App\Http\Controllers\Api\AdminCategoryAttributeController;
use App\Http\Controllers\Api\AdminCategoryController;
use App\Http\Controllers\Api\AdminDashboardController;
use App\Http\Controllers\Api\AdminSellerApprovalController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\BuyerRequestController;
use App\Http\Controllers\Api\CategoryController;
use App\Http\Controllers\Api\CreditPurchaseController;
use App\Http\Controllers\Api\LocationController;
use App\Http\Controllers\Api\MarketplaceController;
use App\Http\Controllers\Api\OfferController;
use App\Http\Controllers\Api\SellerCreditController;
use App\Http\Controllers\Api\SellerProfileController;
use App\Http\Controllers\Api\SellerPromotionController;
use App\Http\Controllers\Api\SellerRequestController;
use App\Http\Controllers\Api\SellerReviewController;
use App\Http\Controllers\Api\SellerServiceController;
use App\Http\Controllers\Api\VerificationController;
use Illuminate\Support\Facades\Route;

Route::get('/health', fn () => response()->json([
    'status' => 'ok',
    'service' => 'alicam-api',
]));

Route::get('/categories', [CategoryController::class, 'index']);
Route::get('/categories/{category:slug}/attributes', [CategoryController::class, 'attributes']);
Route::get('/locations', [LocationController::class, 'index']);
Route::get('/credits/packages', [CreditPurchaseController::class, 'packages']);
Route::get('/marketplace', MarketplaceController::class);
Route::post('/payments/paytr/callback', [CreditPurchaseController::class, 'callback'])
    ->middleware('throttle:120,1');

Route::middleware('throttle:10,1')->group(function () {
    Route::post('/register', [AuthController::class, 'register']);
    Route::post('/login', [AuthController::class, 'login']);
});

Route::middleware('auth:sanctum')->group(function () {
    Route::get('/me', [AuthController::class, 'me']);
    Route::post('/logout', [AuthController::class, 'logout']);

    Route::post('/verification/send', [VerificationController::class, 'send'])
        ->middleware('throttle:5,1');
    Route::post('/verification/verify', [VerificationController::class, 'verify'])
        ->middleware('throttle:10,1');

    Route::get('/requests/mine', [BuyerRequestController::class, 'mine']);
    Route::get('/requests/{buyerRequest}/offers', [OfferController::class, 'buyerIndex']);
    Route::patch('/requests/{buyerRequest}/cancel', [BuyerRequestController::class, 'cancel']);
    Route::patch('/offers/{offer}', [OfferController::class, 'decide']);
    Route::post('/offers/{offer}/review', [SellerReviewController::class, 'store']);
    Route::post('/requests', [BuyerRequestController::class, 'store'])
        ->middleware(['contact.verified', 'throttle:10,1']);

    Route::prefix('seller')->group(function () {
        Route::get('/profile', [SellerProfileController::class, 'show']);
        Route::put('/profile', [SellerProfileController::class, 'update']);
        Route::put('/categories', [SellerProfileController::class, 'updateCategories']);
        Route::put('/locations', [SellerProfileController::class, 'updateLocations']);
        Route::post('/submit', [SellerProfileController::class, 'submit'])
            ->middleware(['contact.verified', 'throttle:5,1']);

        Route::middleware(['role:seller', 'seller.approved'])->group(function () {
            Route::get('/requests', [SellerRequestController::class, 'index']);
            Route::get('/requests/{buyerRequest}', [SellerRequestController::class, 'show']);
            Route::post('/requests/{buyerRequest}/unlock', [SellerRequestController::class, 'unlock'])
                ->middleware('throttle:15,1');
            Route::get('/credits', [SellerCreditController::class, 'show']);
            Route::post('/credits/purchase', [CreditPurchaseController::class, 'store'])
                ->middleware('throttle:10,1');
            Route::get('/payments/{merchantOid}', [CreditPurchaseController::class, 'show']);
            Route::get('/offers', [OfferController::class, 'sellerIndex']);
            Route::post('/offers', [OfferController::class, 'store'])
                ->middleware('throttle:15,1');
            Route::put('/offers/{offer}', [OfferController::class, 'update']);
            Route::get('/services', [SellerServiceController::class, 'index']);
            Route::post('/services', [SellerServiceController::class, 'store']);
            Route::put('/services/{sellerService}', [SellerServiceController::class, 'update']);
            Route::delete('/services/{sellerService}', [SellerServiceController::class, 'destroy']);
            Route::get('/featured', [SellerPromotionController::class, 'show']);
            Route::post('/featured', [SellerPromotionController::class, 'store']);
        });
    });

    Route::prefix('admin')->middleware('role:admin')->group(function () {
        Route::get('/dashboard', AdminDashboardController::class);
        Route::get('/categories', [AdminCategoryController::class, 'index']);
        Route::post('/categories', [AdminCategoryController::class, 'store']);
        Route::put('/categories/{category}', [AdminCategoryController::class, 'update']);
        Route::post('/categories/{category}/attributes', [AdminCategoryAttributeController::class, 'store']);
        Route::put('/category-attributes/{categoryAttribute}', [AdminCategoryAttributeController::class, 'update']);
        Route::delete('/category-attributes/{categoryAttribute}', [AdminCategoryAttributeController::class, 'destroy']);
        Route::get('/seller-approvals', [AdminSellerApprovalController::class, 'index']);
        Route::patch('/seller-approvals/{seller}', [AdminSellerApprovalController::class, 'update']);
    });
});
