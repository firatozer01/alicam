<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('seller_portfolio_items', function (Blueprint $table) {
            // Vitrinde kunye olarak gosterilen is ayrintilari.
            $table->string('duration', 60)->nullable()->after('location');
            $table->string('area', 60)->nullable()->after('duration');
            $table->decimal('budget', 12, 2)->nullable()->after('area');
            $table->string('client_type', 60)->nullable()->after('budget');
            // Yapilan islerin madde madde listesi.
            $table->json('highlights')->nullable()->after('client_type');
        });
    }

    public function down(): void
    {
        Schema::table('seller_portfolio_items', function (Blueprint $table) {
            $table->dropColumn(['duration', 'area', 'budget', 'client_type', 'highlights']);
        });
    }
};
