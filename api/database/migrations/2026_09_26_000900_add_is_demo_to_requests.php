<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('requests', function (Blueprint $table) {
            // Vitrini canli gostermek icin uretilmis ornek talep.
            //
            // Isaretlenmesinin sebebi para: hizmet veren bir talebin
            // detayini acarken GERCEK kontor oduyor. Ornek bir talep icin
            // odeme yapmasi kabul edilemez, bu yuzden demo talepler
            // bedelsiz acilir ve arayuzde acikca etiketlenir.
            $table->boolean('is_demo')->default(false)->after('status');
        });

        // Daha once uretilmis toplu demo icerigi geriye donuk isaretle.
        DB::table('requests')
            ->where('public_reference', 'like', 'ALC-VOL-%')
            ->update(['is_demo' => true]);

        // Kismi index: demo olmayanlar sorgularda cogunluk, index yalnizca
        // isaretli satirlari tasisin.
        DB::statement('create index requests_demo_idx on requests (id) where is_demo = true');
    }

    public function down(): void
    {
        DB::statement('drop index if exists requests_demo_idx');

        Schema::table('requests', function (Blueprint $table) {
            $table->dropColumn('is_demo');
        });
    }
};
