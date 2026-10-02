<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            // Ticari elektronik ileti onayi. BOOLEAN DEGIL zaman damgasi:
            // 6563 sayili kanun onayin varligini degil, NE ZAMAN alindigini
            // ispat etmeyi gerektiriyor (ve geri alindiginda da tarihi
            // gerekiyor). null = onay yok.
            $table->timestamp('marketing_consent_at')->nullable()->after('phone_verified_at');
            // Geri alma tarihi ayri tutuluyor: onay verilip sonra geri
            // alindiginda ikisi birden kayitli kalsin, gecmis silinmesin.
            $table->timestamp('marketing_revoked_at')->nullable()->after('marketing_consent_at');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['marketing_consent_at', 'marketing_revoked_at']);
        });
    }
};
