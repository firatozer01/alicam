<?php

namespace App\Providers;

use App\Services\AppSettings;
use Illuminate\Support\Facades\Schema;

use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // Panelden girilen SMTP bilgileri her istekte uygulanir; e-posta
        // baglamak icin .env duzenleyip konteyner yeniden baslatmak gerekmez.
        if (Schema::hasTable('app_settings')) {
            AppSettings::applyMailConfig();
        }

        //
    }
}
