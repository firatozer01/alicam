<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            // Profil fotografi herkeste var: alicinin fotografi kendi
            // talebinde, saticininki vitrininde ve tekliflerinde gorunur.
            //
            // Dosya diskte durur, sutunda yalnizca yolu tasinir; istemciye
            // hicbir zaman yol degil akis adresi verilir.
            $table->string('avatar_path', 255)->nullable()->after('email');
        });

        Schema::table('seller_profiles', function (Blueprint $table) {
            // Vitrinin ustundeki genis kapak gorseli. logo_path zaten
            // vardi ve profil/logo icin kullaniliyor; bu onun yerine
            // gecmiyor, yanina geliyor.
            $table->string('banner_path', 255)->nullable()->after('logo_path');
        });
    }

    public function down(): void
    {
        Schema::table('seller_profiles', function (Blueprint $table) {
            $table->dropColumn('banner_path');
        });

        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('avatar_path');
        });
    }
};
