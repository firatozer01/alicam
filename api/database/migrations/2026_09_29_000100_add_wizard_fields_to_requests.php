<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('requests', function (Blueprint $table) {
            // Yeni talep sihirbazinin sordugu uc alan.

            // Ne zamana kadar: urgent | this_week | this_month | flexible.
            // Teklif veren icin en degerli bilgilerden biri ve kimlik
            // tasimadigi icin kilit ONCESI de gosterilebilir.
            $table->string('timing', 16)->nullable()->after('budget_max');

            // "Butcem esnek, iyi teklifleri gormek isterim". Butce
            // araligini gecersiz kilmaz; yaninda bir not olarak durur.
            $table->boolean('budget_flexible')->default(false)->after('timing');

            // Aliciya nasil ulasilsin: message | phone | whatsapp.
            // KILIT ARDINDA kalir: tek basina kimlik tasimasa da
            // iletisim bilgisinin parcasi ve orayla birlikte aciliyor.
            $table->jsonb('contact_preferences')->nullable()->after('budget_flexible');
        });
    }

    public function down(): void
    {
        Schema::table('requests', function (Blueprint $table) {
            $table->dropColumn(['timing', 'budget_flexible', 'contact_preferences']);
        });
    }
};
