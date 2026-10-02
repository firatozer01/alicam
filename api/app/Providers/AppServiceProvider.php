<?php

namespace App\Providers;

use App\Services\AppSettings;
use App\Services\StorefrontAccess;
use Illuminate\Support\Facades\Schema;

use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        // Istek boyunca tek ornek: vitrin erisim karari bir ilan
        // galerisinde onlarca kez soruluyor ve servis karari kendi
        // icinde belliyor. Yeni ornek uretilse bellek her seferinde
        // bostan baslardi.
        $this->app->scoped(StorefrontAccess::class);
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // Panelden girilen SMTP bilgileri her istekte uygulanir; e-posta
        // baglamak icin .env duzenleyip konteyner yeniden baslatmak gerekmez.
        //
        // Imaj derlenirken (package:discover) ve ilk gocten once veritabani
        // yoktur; boot bu yuzden hicbir kosulda patlamamali.
        try {
            if (Schema::hasTable('app_settings')) {
                AppSettings::applyMailConfig();
                // PayTR de ayni yolu izliyor: panelden girilen bilgi .env'i
                // ezer, panel bos ise .env gecerli kalir.
                AppSettings::applyPaytrConfig();
            }
        } catch (\Throwable) {
            // Veritabani hazir degil: .env'deki mail ve odeme ayarlari
            // gecerli kalir.
        }

        //
    }
}
