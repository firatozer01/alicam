<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('conversations', function (Blueprint $table) {
            // Hizmet veren bir konusmayi okumak ve yanitlamak icin bir kez
            // kontor oder. Odenene kadar gelen mesajlarin govdesi ona
            // gosterilmez; kimden ve ne zaman geldigi gorunur.
            $table->timestamp('unlocked_at')->nullable()->after('seller_unread');
            $table->unsignedInteger('unlock_cost')->nullable()->after('unlocked_at');

            // Kilitliyken alicinin ust uste yazabilecegi mesaj sayisi burada
            // sayilir; kontor odemeye zorlayan bir duvar metin olusmasin.
            $table->unsignedInteger('locked_message_count')->default(0)->after('unlock_cost');
        });

        // Eski kural "saticinin ilk mesaji kontor duser" seklindeydi. O bedeli
        // zaten odemis konusmalar acik sayilir, yoksa satici ayni konusma icin
        // ikinci kez oderdi.
        DB::statement("
            update conversations
            set unlocked_at = coalesce(sub.paid_at, conversations.created_at),
                unlock_cost = sub.paid
            from (
                select conversation_id, min(created_at) as paid_at, sum(credit_spent) as paid
                from messages
                where credit_spent > 0
                group by conversation_id
            ) as sub
            where sub.conversation_id = conversations.id
        ");

        // Saticinin kendi yazdigi ama bedelsiz gecmis konusmalar da acik
        // sayilir: o konusmayi zaten okuyabiliyordu, geriye donuk kilitlemek
        // calisan bir seyi bozmak olurdu.
        DB::statement('
            update conversations
            set unlocked_at = created_at, unlock_cost = 0
            where unlocked_at is null
              and exists (
                select 1 from messages
                where messages.conversation_id = conversations.id
                  and messages.sender_id = conversations.seller_id
              )
        ');
    }

    public function down(): void
    {
        Schema::table('conversations', function (Blueprint $table) {
            $table->dropColumn(['unlocked_at', 'unlock_cost', 'locked_message_count']);
        });
    }
};
