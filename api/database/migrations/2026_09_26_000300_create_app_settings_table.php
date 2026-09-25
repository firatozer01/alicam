<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('app_settings', function (Blueprint $table) {
            // Calisma zamaninda degistirilebilen ayarlar: SMTP baglantisi
            // simdilik, SMS saglayicisi eklendiginde ayni tabloya girecek.
            // Sifre ve api anahtari gibi degerler is_secret ile isaretlenir
            // ve kayit sirasinda sifrelenir; panele asla duz metin donmez.
            $table->string('key', 80)->primary();
            $table->text('value')->nullable();
            $table->boolean('is_secret')->default(false);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('app_settings');
    }
};
