<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('seller_services', function (Blueprint $table) {
            // Vitrin kartında gösterilen kapak görseli (yerel diskteki yol).
            $table->string('cover_path', 255)->nullable()->after('delivery_time');
        });
    }

    public function down(): void
    {
        Schema::table('seller_services', function (Blueprint $table) {
            $table->dropColumn('cover_path');
        });
    }
};
