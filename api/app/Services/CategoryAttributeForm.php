<?php

namespace App\Services;

use App\Models\Category;
use App\Support\CategoryTree;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

/**
 * Kategoriye bagli serbest alanlarin dogrulanmasi ve sema anlik goruntusu.
 *
 * Ayni is iki yerde yapiliyor: alici bir talep olustururken ve satici
 * vitrinine bir ilan koyarken. Ikisi de ayni kategori agacindan besleniyor,
 * bu yuzden kurallar tek yerde duruyor.
 *
 * Sema anlik goruntusu neden saklaniyor: yonetici bir kategorinin
 * alanlarini sonradan degistirdiginde eski kayitlarin cevaplari
 * okunamaz hale gelmesin. Kayit, o an gecerli olan alan tanimlarini
 * yaninda tasir.
 */
class CategoryAttributeForm
{
    /**
     * Girdiyi kategorinin alan setine gore dogrular.
     *
     * $baglam etiket dilini secer. Mevcut etiketler aliciya sorulan
     * sorular ("Kac oda + salon olsun?"); ilan tarafinda ayni alanin
     * bildirim kipindeki adi gerekiyor ("Oda Sayisi"). Kategoriye
     * listing_label girilmediyse label kullanilir.
     *
     * @param  array<string, mixed>  $girdi  ham 'attributes' dizisi
     * @return array{attributes: array<string, mixed>, snapshot: array<int, array<string, mixed>>}
     */
    public function resolve(Category $category, array $girdi, string $baglam = 'request'): array
    {
        // Alan seti kalitimlidir: yaprak kategoride sorulanlar ust
        // kategorilerin alanlarini da icerir, yoksa derin agacta hicbir
        // alan dogrulanmaz.
        $etkin = $this->fields($category, $baglam);

        return [
            'attributes' => $this->validated($etkin, $girdi),
            'snapshot' => $this->snapshot($etkin, $baglam),
        ];
    }

    /**
     * Bu baglamda sorulacak alanlar.
     *
     * @return \Illuminate\Support\Collection<int, \App\Models\CategoryAttribute>
     */
    public function fields(Category $category, string $baglam = 'request')
    {
        $etkin = CategoryTree::effectiveAttributes($category);

        if ($baglam === 'listing') {
            // Ilan tarafinda YALNIZCA listing_label'i olan alanlar
            // sorulur. Mevcut alan setleri aliciya gore yazilmis ve
            // buyuk kismi bir satici ilaninda anlamsiz: "Butcen ne
            // kadar?", "Ne zaman tasinmayi planliyorsun?", "Kimden
            // teklif almak istersin?".
            //
            // Tek sutun iki soruyu birden yanitliyor: bu alan ilana
            // uyar mi, ve orada adi ne. Yonetici paneli bu alani
            // duzenleyebildigi icin liste kodda donmus degil.
            $etkin = $etkin->filter(fn ($alan) => filled($alan->listing_label))->values();
        }

        return $etkin;
    }

    /**
     * @param  \Illuminate\Support\Collection<int, \App\Models\CategoryAttribute>  $etkin
     * @param  array<string, mixed>  $girdi
     * @return array<string, mixed>
     */
    private function validated($etkin, array $girdi): array
    {
        $kurallar = [];
        $izinli = $etkin->pluck('key')->all();

        // array:a,b,c tanimsiz anahtari reddeder; alan yoksa serbest dizi.
        $kurallar['attributes'] = $izinli === []
            ? ['array']
            : ['array:'.implode(',', $izinli)];

        foreach ($etkin as $alan) {
            $anahtar = 'attributes.'.$alan->key;

            // Zorunlu bir boolean alanda "Hayir" (false) cevabi da
            // gecerlidir; Laravel'de required false'u bos sayip
            // reddettigi icin present kullanilir.
            $varlik = $alan->is_required
                ? ($alan->type === 'boolean' ? 'present' : 'required')
                : 'nullable';

            $kural = [$varlik];

            match ($alan->type) {
                'number', 'range' => $kural[] = 'numeric',
                'boolean' => $kural[] = 'boolean',
                'date' => $kural[] = 'date',
                'select' => $kural[] = Rule::in($alan->options ?? []),
                'multiselect' => $kural[] = 'array',
                'textarea' => $kural[] = 'string',
                default => $kural[] = 'string',
            };

            if (in_array($alan->type, ['text', 'select'], true)) {
                $kural[] = 'max:500';
            }

            if ($alan->type === 'textarea') {
                $kural[] = 'max:2000';
            }

            $kurallar[$anahtar] = $kural;

            if ($alan->type === 'multiselect') {
                $kurallar[$anahtar.'.*'] = [Rule::in($alan->options ?? [])];
            }
        }

        return Validator::make(['attributes' => $girdi], $kurallar)->validate()['attributes'];
    }

    /**
     * @param  \Illuminate\Support\Collection<int, \App\Models\CategoryAttribute>  $etkin
     * @return array<int, array<string, mixed>>
     */
    private function snapshot($etkin, string $baglam): array
    {
        return $etkin->map(fn ($alan) => [
            'key' => $alan->key,
            'label' => $baglam === 'listing' ? $alan->listing_label : $alan->label,
            'type' => $alan->type,
            'options' => $alan->options,
            'unit' => $alan->unit,
            'is_private' => $alan->is_private,
            'show_in_summary' => $alan->show_in_summary,
        ])->values()->all();
    }
}
