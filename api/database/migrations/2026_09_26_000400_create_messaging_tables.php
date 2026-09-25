<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('conversations', function (Blueprint $table) {
            // Birebir konusma: her zaman bir alici ve bir hizmet veren.
            // Talep uzerinden basladiysa request_id dolu olur; vitrinden
            // dogrudan yazildiysa bos kalir.
            $table->id();
            $table->foreignId('buyer_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('seller_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('request_id')->nullable()->constrained('requests')->nullOnDelete();
            $table->timestamp('last_message_at')->nullable();
            $table->unsignedInteger('buyer_unread')->default(0);
            $table->unsignedInteger('seller_unread')->default(0);
            $table->timestamps();

            $table->index(['buyer_id', 'last_message_at']);
            $table->index(['seller_id', 'last_message_at']);
        });

        // PostgreSQL'de NULL'lar birbirinden farkli sayildigi icin duz bir
        // unique index talepsiz konusmalarin coklamasini engellemez.
        DB::statement('
            create unique index conversations_participants_unique
            on conversations (buyer_id, seller_id, coalesce(request_id, 0))
        ');

        Schema::create('messages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('conversation_id')->constrained()->cascadeOnDelete();
            $table->foreignId('sender_id')->constrained('users')->cascadeOnDelete();
            $table->text('body');
            // Saticinin bir konusmadaki ILK mesaji kontor dusurur; ne kadar
            // dustugu burada saklanir, sonraki mesajlar ucretsizdir.
            $table->unsignedInteger('credit_spent')->default(0);
            $table->timestamp('read_at')->nullable();
            // Karsi taraf cevrimici degilse e-posta gonderilir; iki kez
            // gonderilmesin diye damga tutulur.
            $table->timestamp('notified_at')->nullable();
            $table->timestamps();

            $table->index(['conversation_id', 'id']);
            $table->index(['read_at', 'notified_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('messages');
        Schema::dropIfExists('conversations');
    }
};
