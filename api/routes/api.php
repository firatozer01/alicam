<?php

use App\Http\Controllers\Api\AdminCategoryAttributeController;
use App\Http\Controllers\Api\AdminCategoryController;
use App\Http\Controllers\Api\AdminDashboardController;
use App\Http\Controllers\Api\AdminSellerApprovalController;
use App\Http\Controllers\Api\AdminSettingsController;
use App\Http\Controllers\Api\AssistantController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\BuyerRequestController;
use App\Http\Controllers\Api\CategoryController;
use App\Http\Controllers\Api\ConversationController;
use App\Http\Controllers\Api\CreditPurchaseController;
use App\Http\Controllers\Api\LocationController;
use App\Http\Controllers\Api\MarketplaceController;
use App\Http\Controllers\Api\NotificationController;
use App\Http\Controllers\Api\OfferController;
use App\Http\Controllers\Api\SellerCreditController;
use App\Http\Controllers\Api\SellerProfileController;
use App\Http\Controllers\Api\SellerRequestController;
use App\Http\Controllers\Api\SellerReviewController;
use App\Http\Controllers\Api\SellerServiceController;
use App\Http\Controllers\Api\VerificationController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Broadcast;
use Illuminate\Support\Facades\Route;

Route::get('/health', fn () => response()->json([
    'status' => 'ok',
    'service' => 'alicam-api',
]));

Route::get('/categories', [CategoryController::class, 'index']);
Route::get('/categories/search', [CategoryController::class, 'search'])
    ->middleware('throttle:120,1');
Route::get('/categories/{category:slug}/attributes', [CategoryController::class, 'attributes']);
Route::get('/locations', [LocationController::class, 'index']);
Route::get('/credits/packages', [CreditPurchaseController::class, 'packages']);
Route::get('/marketplace', MarketplaceController::class);
// Anasayfanin hizmet katalogu. /categories?tree=1 burada KULLANILMAZ:
// 5689 dugumun tamamini tasidigi icin yaklasik 1,9 MB yanit uretiyor.
Route::get('/service-catalog', App\Http\Controllers\Api\ServiceCatalogController::class);
// Alt bilgideki sosyal medya baglantilari ve marka gorselleri; her sayfada okundugu icin oturum gerektirmez.
Route::get('/site-settings', App\Http\Controllers\Api\SiteSettingsController::class);
// Yoneticinin yukledigi logo. Her sayfada, misafire de basiliyor.
//
// Oturum bilerek devre disi: yanit adresindeki surum damgasi sayesinde
// "public, immutable" ve cok uzun sureli onbellekleniyor. Bootstrap'taki
// statefulApi() butun /api grubuna uygulandigi icin auth:sanctum grubunun
// disinda olmak yetmiyor; on yuzden gelen istek yine StartSession'dan
// geciyor ve yanita oturum cerezi basiliyordu. Paylasimli bir onbellek
// (CDN, kurum vekili) boyle bir yaniti bir yil saklayip bir sonraki
// ziyaretciye baskasinin oturumunu servis ederdi.
Route::get('/branding/{kind}', [App\Http\Controllers\Api\BrandingController::class, 'show'])
    ->withoutMiddleware(Laravel\Sanctum\Http\Middleware\EnsureFrontendRequestsAreStateful::class);

// Asistan: oturum zorunlu degil, varsa kullaniciya ozel konular acilir.
/**
 * Canli tasiyici ayarlari. Anahtar null donerse arayuz soket acmaz ve
 * yoklamada kalir; boylece Reverb kapaliyken de mesajlasma calisir.
 * Derleme aninda gomulmedigi icin tek web imaji her ortamda dogru adresi alir.
 */
Route::get('/realtime', fn () => response()->json([
    'key' => config('realtime.enabled') ? config('realtime.key') : null,
    'host' => config('realtime.host'),
    'port' => config('realtime.port'),
    'scheme' => config('realtime.scheme'),
]));

Route::get('/assistant', [AssistantController::class, 'intro']);
Route::post('/assistant/ask', [AssistantController::class, 'ask'])->middleware('throttle:30,1');
Route::post('/payments/paytr/callback', [CreditPurchaseController::class, 'callback'])
    ->middleware('throttle:120,1');

Route::middleware('throttle:10,1')->group(function () {
    Route::post('/register', [AuthController::class, 'register']);
    Route::post('/login', [AuthController::class, 'login']);
});

// Vitrin herkese acik degil: yalnizca kendisine teklif vermis hizmet
// verenler, saticinin kendisi ve yonetici gorebilir. Karari denetleyici
// verir; misafir her zaman 404 alir.
Route::get('/sellers/{user}', [App\Http\Controllers\Api\PublicSellerController::class, 'show']);
Route::get('/category-images/{category}', App\Http\Controllers\Api\CategoryImageController::class);

Route::middleware('auth:sanctum')->group(function () {
    Route::get('/me', [AuthController::class, 'me']);
    Route::put('/me', [AuthController::class, 'updateProfile'])->middleware('throttle:20,1');
    Route::put('/me/password', [AuthController::class, 'updatePassword'])->middleware('throttle:10,1');
    Route::post('/logout', [AuthController::class, 'logout']);

    // Profil fotografi: HERKES icin, satici grubunda degil. Alici da
    // yukleyebilmeli.
    Route::post('/avatar', [App\Http\Controllers\Api\AvatarController::class, 'store'])
        ->middleware('throttle:20,1');
    Route::delete('/avatar', [App\Http\Controllers\Api\AvatarController::class, 'destroy']);

    // Gorsel akislari bilerek oturum ICINDE ve her biri vitrin
    // kapisindan geciyor.
    //
    // Id'ler sirayla artiyor: denetimsiz birakilan bir akis ucu,
    // kapali bir vitrinin butun fotograflarini disaridan tek tek
    // cekilebilir hale getirir. Vitrinin JSON'unu kapatip
    // gorsellerini acik birakmak, kapiyi hic koymamak demek.
    Route::get('/avatars/{user}', [App\Http\Controllers\Api\AvatarController::class, 'show']);
    Route::get('/seller-banners/{user}', [App\Http\Controllers\Api\SellerBrandingController::class, 'show'])
        ->defaults('kind', 'banner');
    Route::get('/seller-logos/{user}', [App\Http\Controllers\Api\SellerBrandingController::class, 'show'])
        ->defaults('kind', 'logo');
    Route::get('/listing-images/{sellerListingImage}', App\Http\Controllers\Api\ListingImageController::class);
    // Bu ikisi eskiden oturum disindaydi ve hicbir denetim
    // yapmiyordu; kapali bir vitrinin fotograflari id denenerek
    // disaridan cekilebiliyordu. Artik ilan gorselleriyle ayni yerde.
    Route::get('/portfolio-images/{portfolioImage}', [App\Http\Controllers\Api\SellerPortfolioController::class, 'showImage']);
    Route::get('/service-covers/{sellerService}', [App\Http\Controllers\Api\SellerServiceController::class, 'showCover']);

    // Vitrindeki bir ilanin detayi: fotograf galerisi ve ozellik
    // tablosu. Vitrinin kendisiyle ayni kapiya bagli.
    Route::get('/listings/{sellerListing}', [App\Http\Controllers\Api\PublicListingController::class, 'show']);

    // Asistanin hizli sorgulamasi: yalnizca uyeye acik, kendi talebi ya da
    // teklif verdigi talep disinda bir sey dondurmez.
    Route::post('/assistant/lookup', [AssistantController::class, 'lookup'])
        ->middleware('throttle:20,1');

    // Ust cubuktaki zil. Sayac her sayfa yuklemesinde okundugu icin
    // listeden ayri ve ucuz bir uc olarak durur.
    Route::get('/notifications/count', [NotificationController::class, 'count']);
    Route::get('/notifications', [NotificationController::class, 'index']);
    Route::post('/notifications/read', [NotificationController::class, 'read'])
        ->middleware('throttle:60,1');

    // Ozel kanal yetkilendirmesi. Laravel bunu kokte de sunar ama arayuz
    // yalnizca /api/* yolunu proxy'ledigi icin burada da acilir.
    Route::post('/broadcasting/auth', fn (Request $request) => Broadcast::auth($request));

    // Mesajlasma. Soket kurulamazsa arayuz /poll ucuna duser.
    Route::get('/conversations', [ConversationController::class, 'index']);
    // Talep acmakla ayni esik: dogrulanmamis hesap konusma baslatamaz,
    // yoksa tek hesapla dakikada onlarca hizmet verene mesaj atilabilirdi.
    Route::post('/conversations', [ConversationController::class, 'store'])
        ->middleware(['contact.verified', 'throttle:20,1']);
    Route::get('/conversations/{conversation}', [ConversationController::class, 'show']);
    Route::get('/conversations/{conversation}/poll', [ConversationController::class, 'poll']);
    // Hizmet veren konusmayi acar: kredi duser, mesajlar gorunur olur.
    Route::post('/conversations/{conversation}/unlock', [ConversationController::class, 'unlock'])
        ->middleware('throttle:20,1');
    Route::post('/conversations/{conversation}/messages', [ConversationController::class, 'send'])
        ->middleware(['contact.verified', 'throttle:60,1']);

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
            Route::post('/requests/{buyerRequest}/favorite', [SellerRequestController::class, 'toggleFavorite'])
                ->middleware('throttle:60,1');

            Route::get('/portfolio', [App\Http\Controllers\Api\SellerPortfolioController::class, 'index']);
            Route::post('/portfolio', [App\Http\Controllers\Api\SellerPortfolioController::class, 'store']);
            Route::put('/portfolio/{portfolioItem}', [App\Http\Controllers\Api\SellerPortfolioController::class, 'update']);
            Route::delete('/portfolio/{portfolioItem}', [App\Http\Controllers\Api\SellerPortfolioController::class, 'destroy']);
            Route::post('/portfolio/{portfolioItem}/images', [App\Http\Controllers\Api\SellerPortfolioController::class, 'uploadImage'])
                ->middleware('throttle:30,1');
            Route::delete('/portfolio-images/{portfolioImage}', [App\Http\Controllers\Api\SellerPortfolioController::class, 'destroyImage']);

            Route::post('/services/{sellerService}/cover', [App\Http\Controllers\Api\SellerServiceController::class, 'uploadCover'])
                ->middleware('throttle:30,1');
            Route::delete('/services/{sellerService}/cover', [App\Http\Controllers\Api\SellerServiceController::class, 'destroyCover']);
            // Vitrin gorselleri: genis kapak ve firma logosu.
            Route::post('/branding/{kind}', [App\Http\Controllers\Api\SellerBrandingController::class, 'store'])
                ->middleware('throttle:20,1');
            Route::delete('/branding/{kind}', [App\Http\Controllers\Api\SellerBrandingController::class, 'destroy']);

            // Urun/ilanlar: emlakci bir daireyi, galerici bir araci
            // vitrinine koyar ve teklif verirken iliktirir.
            Route::get('/listings', [App\Http\Controllers\Api\SellerListingController::class, 'index']);
            Route::get('/listings/pickable', [App\Http\Controllers\Api\SellerListingController::class, 'pickable']);
            Route::post('/listings', [App\Http\Controllers\Api\SellerListingController::class, 'store'])
                ->middleware('throttle:30,1');
            Route::get('/listings/{sellerListing}', [App\Http\Controllers\Api\SellerListingController::class, 'show']);
            Route::put('/listings/{sellerListing}', [App\Http\Controllers\Api\SellerListingController::class, 'update']);
            Route::patch('/listings/{sellerListing}/status', [App\Http\Controllers\Api\SellerListingController::class, 'setStatus']);
            Route::delete('/listings/{sellerListing}', [App\Http\Controllers\Api\SellerListingController::class, 'destroy']);
            Route::post('/listings/{sellerListing}/images', [App\Http\Controllers\Api\SellerListingController::class, 'uploadImage'])
                ->middleware('throttle:60,1');
            Route::delete('/listing-images/{sellerListingImage}', [App\Http\Controllers\Api\SellerListingController::class, 'destroyImage']);
            Route::patch('/listing-images/{sellerListingImage}/cover', [App\Http\Controllers\Api\SellerListingController::class, 'makeCover']);

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
        Route::get('/settings', [AdminSettingsController::class, 'show']);
        Route::put('/settings', [AdminSettingsController::class, 'update']);
        Route::post('/settings/mail-test', [AdminSettingsController::class, 'test'])
            ->middleware('throttle:5,1');
        Route::get('/home', [App\Http\Controllers\Api\AdminHomeController::class, 'show']);
        Route::put('/home', [App\Http\Controllers\Api\AdminHomeController::class, 'update']);
        Route::post('/home/categories/{category}/image', [App\Http\Controllers\Api\AdminHomeController::class, 'uploadImage']);
        Route::post('/home/categories/{category}/fetch-image', [App\Http\Controllers\Api\AdminHomeController::class, 'fetchImage'])
            ->middleware('throttle:30,1');
        Route::delete('/home/categories/{category}/image', [App\Http\Controllers\Api\AdminHomeController::class, 'destroyImage']);
        // Marka gorselleri: kaldirilinca arayuz gomulu dosyaya doner.
        Route::post('/branding/{kind}', [App\Http\Controllers\Api\AdminBrandingController::class, 'store'])
            ->middleware('throttle:20,1');
        Route::delete('/branding/{kind}', [App\Http\Controllers\Api\AdminBrandingController::class, 'destroy']);
        Route::get('/seller-approvals', [AdminSellerApprovalController::class, 'index']);
        Route::patch('/seller-approvals/{seller}', [AdminSellerApprovalController::class, 'update']);
    });
});
