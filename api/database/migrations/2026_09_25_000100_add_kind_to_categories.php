<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('categories', function (Blueprint $table) {
            // Platform iki tarafi birden tasiyor: hizmet talepleri (usta, nakliye,
            // ders) ve ilan/urun talepleri (emlak, vasita, ikinci el). Arayuz
            // formu ve filtreleri buna gore degistigi icin kok ayrimi burada durur.
            $table->string('kind', 16)->default('service')->after('slug');
            $table->index(['kind', 'is_active']);
        });
    }

    public function down(): void
    {
        Schema::table('categories', function (Blueprint $table) {
            $table->dropIndex(['kind', 'is_active']);
            $table->dropColumn('kind');
        });
    }
};
