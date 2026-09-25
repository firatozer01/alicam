<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('request_categories', function (Blueprint $table) {
            // Bir talep birden fazla kategoride yer alabilir: "mutfak yenileme"
            // hem tadilat hem mutfak dolabi altinda gorunsun, iki taraftaki
            // saticilar da gorsun. Form ve kontor bedeli birincil kategoriden
            // gelir; digerleri yalnizca erisimi genisletir.
            $table->foreignId('request_id')->constrained('requests')->cascadeOnDelete();
            $table->foreignId('category_id')->constrained()->cascadeOnDelete();
            $table->boolean('is_primary')->default(false);
            $table->unsignedInteger('sort_order')->default(0);

            $table->primary(['request_id', 'category_id']);
            $table->index(['category_id', 'request_id']);
        });

        // Mevcut talepler tek kategorileriyle birincil satira tasinir.
        DB::statement('
            insert into request_categories (request_id, category_id, is_primary, sort_order)
            select id, category_id, true, 0 from requests
            on conflict do nothing
        ');
    }

    public function down(): void
    {
        Schema::dropIfExists('request_categories');
    }
};
