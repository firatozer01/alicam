<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\CreditPackage;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Kredi paketleri: hizmet verenin satin aldigi paketlerin adi, kredisi,
 * bonusu ve FIYATI.
 *
 * Bu tablonun daha once hicbir yonetim ucu yoktu; fiyatlarin yazili oldugu
 * tek yer tohumlama dosyasiydi. Yani kampanya yapmak, zam yapmak ya da bir
 * paketi kapatmak icin kod dagitimi gerekiyordu. Urunun tek gelir kalemi
 * icin kabul edilemez.
 */
class AdminCreditPackageController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json([
            'data' => CreditPackage::query()
                ->withCount('paymentOrders')
                ->orderBy('sort_order')
                ->orderBy('id')
                ->get(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->validated($request);

        $package = CreditPackage::query()->create($data);

        $this->audit($request, 'credit_package.created', $package, null, $data);

        return response()->json([
            'message' => 'Paket oluşturuldu.',
            'data' => $package,
        ], 201);
    }

    public function update(Request $request, CreditPackage $creditPackage): JsonResponse
    {
        $data = $this->validated($request, $creditPackage);

        $eski = $creditPackage->only(['name', 'credit_amount', 'bonus_credit', 'price', 'is_active', 'sort_order']);

        $creditPackage->update($data);

        $this->audit($request, 'credit_package.updated', $creditPackage, $eski, $data);

        return response()->json([
            'message' => 'Paket güncellendi.',
            'data' => $creditPackage->fresh(),
        ]);
    }

    /**
     * Paket SILINMEZ, yayindan kaldirilir.
     *
     * payment_orders tablosu bu pakete bakiyor; silinirse gecmis siparisin
     * hangi pakete ait oldugu kaybolur (yabanci anahtar null'a duser) ve
     * muhasebe kaydi eksik kalir. Yayindan kalkan paket satin alma
     * ekraninda gorunmez, gecmisi ise bozulmaz.
     */
    public function destroy(Request $request, CreditPackage $creditPackage): JsonResponse
    {
        if (! $creditPackage->is_active) {
            return response()->json(['message' => 'Paket zaten yayında değil.'], 422);
        }

        $creditPackage->update(['is_active' => false]);

        $this->audit($request, 'credit_package.retired', $creditPackage, ['is_active' => true], ['is_active' => false]);

        return response()->json([
            'message' => 'Paket yayından kaldırıldı.',
            'data' => $creditPackage->fresh(),
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function validated(Request $request, ?CreditPackage $package = null): array
    {
        return $request->validate([
            'name' => ['required', 'string', 'min:2', 'max:80', Rule::unique('credit_packages', 'name')->ignore($package?->id)],
            'credit_amount' => ['required', 'integer', 'min:1', 'max:100000'],
            'bonus_credit' => ['required', 'integer', 'min:0', 'max:100000'],
            // Kurus hassasiyeti: sutun numeric(10,2).
            'price' => ['required', 'numeric', 'min:0', 'max:99999999.99'],
            'is_active' => ['required', 'boolean'],
            'sort_order' => ['required', 'integer', 'min:0', 'max:10000'],
        ], [], [
            'name' => 'paket adı',
            'credit_amount' => 'kredi',
            'bonus_credit' => 'bonus kredi',
            'price' => 'fiyat',
            'sort_order' => 'sıra',
        ]);
    }

    /**
     * @param  array<string, mixed>|null  $oldValues
     * @param  array<string, mixed>  $newValues
     */
    private function audit(Request $request, string $action, CreditPackage $package, ?array $oldValues, array $newValues): void
    {
        AuditLog::query()->create([
            'actor_id' => $request->user()->id,
            'action' => $action,
            'auditable_type' => CreditPackage::class,
            'auditable_id' => $package->id,
            'old_values' => $oldValues,
            'new_values' => $newValues,
            'ip_address' => $request->ip(),
            'created_at' => now(),
        ]);
    }
}
