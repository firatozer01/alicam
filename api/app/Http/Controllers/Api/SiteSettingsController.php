<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\AppSettings;
use Illuminate\Http\JsonResponse;

/**
 * Alt bilgideki sosyal medya baglantilari.
 *
 * Panel ucu (GET /admin/settings) yonetici oturumu ister ve SMTP,
 * asistan anahtari, gorsel kaynagi gibi her seyi tasir. Alt bilgi ise her
 * sayfada, misafire de gorunuyor; bu yuzden ayri ve oturumsuz bir uc var.
 *
 * Yanit yalnizca sosyal baglantilari tasir. Ayar tablosunun tamamini
 * herkese acik bir uctan dondurmek, panel ucunun kapisini anlamsiz
 * kilardi.
 */
class SiteSettingsController extends Controller
{
    public function __invoke(): JsonResponse
    {
        // Onbellek bilerek kapali.
        //
        // "public" ISARETLENEMEZ: bootstrap'taki statefulApi() yuzunden on
        // yuzden gelen istek Sanctum'un durum tutan grubundan geciyor ve
        // StartSession her yanita oturum cerezi basiyor. Paylasimli bir
        // onbellek (CDN, kurum vekili) boyle bir yaniti saklarsa bir sonraki
        // ziyaretciye baskasinin oturumunu servis eder.
        //
        // Sureli bir "private" onbellek de ise yaramiyor: yonetici adresi
        // degistirip siteye baktiginda tarayici eski listeyi gosteriyor ve
        // kayit islememis gibi duruyor. Sorgunun maliyeti zaten yok
        // (AppSettings sunucuda onbellekli) ve alt bilgi ayni gezinme
        // icinde modul duzeyinde saklandigi icin sayfa basina tek istek.
        return response()
            ->json(['data' => ['social' => AppSettings::socialLinks()]])
            ->header('Cache-Control', 'private, max-age=0, must-revalidate');
    }
}
