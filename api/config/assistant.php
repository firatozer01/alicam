<?php

/**
 * alıcam asistanı: hazır cevap bilgi bankası.
 *
 * Yapay zekâ bağlı değilken sorular burada aranır. Her başlık bir konu
 * kartıdır; keywords alanı serbest metin sorularını eşleştirmek için
 * kullanılır. Gemini bağlandığında bu metinler modele bağlam olarak
 * verilecek, böylece cevaplar sitenin gerçek akışına sadık kalacak.
 */
return [
    'greeting' => 'Merhaba! alıcam.net’i kullanırken takıldığın her şeyi buradan sorabilirsin.',

    'guest_greeting' => 'Merhaba! alıcam.net hakkında merak ettiklerini buradan yanıtlayabilirim.',

    'fallback' => 'Bunu tam anlayamadım. Aşağıdaki başlıklardan birini seçersen adım adım anlatabilirim.',

    'topics' => [
        [
            'key' => 'nedir',
            'title' => 'alıcam.net nedir?',
            'audience' => 'all',
            'keywords' => ['nedir', 'ne işe yarar', 'nasıl çalışır', 'sistem', 'mantık', 'ters ilan'],
            'answer' => 'alıcam.net ters çalışan bir pazaryeri: ilanı sen vermiyorsun, ihtiyacını yazıyorsun ve '
                ."hizmet verenler sana teklif gönderiyor.\n\n"
                ."1. Talebini oluşturuyorsun (ücretsiz).\n"
                ."2. Talep, o kategoride ve bölgende çalışan doğrulanmış hizmet verenlere düşüyor.\n"
                .'3. Gelen teklifleri fiyat ve kapsam olarak tek ekranda karşılaştırıp seçiyorsun.',
        ],
        [
            'key' => 'talep-olustur',
            'title' => 'Nasıl talep oluştururum?',
            'audience' => 'all',
            'keywords' => ['talep', 'nasıl oluştur', 'ilan ver', 'teklif al', 'talep aç'],
            'answer' => "Üst menüdeki “Ücretsiz talep oluştur” düğmesiyle başlıyorsun. Dört adım var:\n\n"
                ."1. Kategori: önce hizmet mi ürün/ilan mı arıyorsun onu seçiyorsun, sonra başlığı bulana kadar iniyorsun.\n"
                ."2. Detaylar: başlık, açıklama ve o kategoriye özel kısa sorular.\n"
                ."3. Bütçe ve konum.\n"
                .'4. Kontrol edip yayınlıyorsun. Talep yayınlamak tamamen ücretsiz.',
        ],
        [
            'key' => 'kategori-secimi',
            'title' => 'Doğru kategoriyi nasıl bulurum?',
            'audience' => 'all',
            'keywords' => ['kategori', 'alt kategori', 'hangi kategori', 'bulamıyorum'],
            'answer' => "Kategori listesi üç seviyeli: ana başlık, alt başlık ve en alttaki iş kalemi. "
                ."Aradığın tam başlığı bulamazsan bir üst seviyede “genelinde devam et” diyebilirsin; "
                ."talebin yine doğru hizmet verenlere düşer.\n\n"
                .'Talebini birden fazla kategoride de listeleyebilirsin; kategori seçtikten sonra çıkan öneri çiplerinden en fazla dört tane ekleyebilirsin.',
        ],
        [
            'key' => 'magazadan-teklif',
            'title' => 'Belirli bir firmadan teklif isteyebilir miyim?',
            'audience' => 'all',
            'keywords' => ['mağaza', 'vitrin', 'firma', 'belirli', 'direkt', 'doğrudan teklif'],
            'answer' => "Evet. Hizmet verenin vitrinine girip “Teklif iste” dediğinde sayfadan çıkmadan bir pencere açılır; "
                ."o firmanın çalıştığı başlıklardan birini seçip kısa bir brief bırakırsın.\n\n"
                .'Talep doğrudan o mağazaya iletilir ve panelinde “Sana özel” olarak işaretlenir. Uygun diğer hizmet verenler de görebilir.',
        ],
        [
            'key' => 'teklifleri-karsilastir',
            'title' => 'Gelen teklifleri nasıl karşılaştırırım?',
            'audience' => 'user',
            'keywords' => ['teklif', 'karşılaştır', 'seç', 'kabul', 'hangi teklif'],
            'answer' => "Alıcı panelindeki talebine girip “Teklifleri karşılaştır” dersen fiyat, kapsam ve hizmet verenin puanı "
                ."yan yana gelir; en düşük teklif ayrıca işaretlenir.\n\n"
                .'Bir teklifi kabul ettiğinde iletişim bilgileri iki tarafa da açılır ve diğer teklifler otomatik kapanır.',
        ],
        [
            'key' => 'gizlilik',
            'title' => 'İletişim bilgilerim kimlere görünüyor?',
            'audience' => 'all',
            'keywords' => ['gizlilik', 'telefon', 'numara', 'iletişim', 'güvenli', 'adres'],
            'answer' => "Telefon, e-posta ve açık adres talep özetinde gösterilmez. Hizmet veren talebin detayını "
                ."kontör harcayarak açtığında ya da teklifini kabul ettiğinde açılır.\n\n"
                .'Talep listesinde yalnızca kategori, bütçe aralığı, ilçe ve senin yazdığın kısa özet görünür.',
        ],
        [
            'key' => 'kontor',
            'title' => 'Kontör nedir, kim öder?',
            'audience' => 'all',
            'keywords' => ['kontör', 'kontor', 'jeton', 'ücret', 'para', 'ödeme', 'fiyat'],
            'answer' => "Alıcı için her şey ücretsiz: talep açmak da teklif almak da para istemez.\n\n"
                .'Kontörü hizmet verenler kullanır; bir talebin detayını açmak ve teklif göndermek için kategoriye göre değişen bir kontör bedeli öderler.',
        ],
        [
            'key' => 'satici-ol',
            'title' => 'Hizmet veren olarak nasıl kayıt olurum?',
            'audience' => 'all',
            'keywords' => ['satıcı', 'hizmet veren', 'firma', 'kayıt', 'üye ol', 'başvuru'],
            'answer' => "Hesabını açtıktan sonra profil menüsünden “Hizmet vermeye başla” diyorsun. Firma bilgilerini, "
                ."çalıştığın kategorileri ve hizmet bölgelerini giriyorsun.\n\n"
                .'Başvurun onaylandığında eşleşen talepler panelinde listelenmeye başlar; vitrinini hizmet ve galeri ekleyerek doldurabilirsin.',
        ],
        [
            'key' => 'vitrin',
            'title' => 'Vitrinimi nasıl düzenlerim?',
            'audience' => 'user',
            'keywords' => ['vitrin', 'mağaza', 'galeri', 'portföy', 'hizmet ekle', 'çalışma ekle'],
            'answer' => "Satıcı panelinde “Firma” menüsünden Hizmetlerim ve Galerim bölümlerine giriyorsun.\n\n"
                ."Hizmet kartlarına kapak görseli ve başlangıç fiyatı, galerideki çalışmalara ise süre, alan, iş bedeli "
                .'ve sekize kadar fotoğraf ekleyebilirsin. Doldurdukça vitrinin daha çok teklif çeker.',
        ],
        [
            'key' => 'dogrulama',
            'title' => 'Hesabımı doğrulamak zorunda mıyım?',
            'audience' => 'all',
            'keywords' => ['doğrula', 'doğrulama', 'onay', 'sms', 'kod', 'e-posta doğrula'],
            'answer' => "Kayıt olurken doğrulama zorunlu değil, hesabını hemen kullanmaya başlayabilirsin. "
                .'Talep açmak ve teklif göndermek gibi adımlar için e-posta ve telefon doğrulaması isteniyor; bunu Hesap ayarları sayfasından istediğin zaman tamamlayabilirsin.',
        ],
        [
            'key' => 'hesap',
            'title' => 'Hesap bilgilerimi nereden değiştiririm?',
            'audience' => 'user',
            'keywords' => ['hesap', 'ayarlar', 'şifre', 'parola', 'profil', 'bilgilerim'],
            'answer' => "Sağ üstteki profil menüsünden “Hesap ayarları”na giriyorsun. Orada üç sekme var: "
                .'Hesap bilgileri (ad, telefon), Güvenlik (parola değiştirme) ve Çalışma alanları (alıcı ve hizmet veren panelleri arasında geçiş).',
        ],
        [
            'key' => 'panel-gecis',
            'title' => 'Alıcı ve satıcı panelleri arasında nasıl geçerim?',
            'audience' => 'user',
            'keywords' => ['panel', 'geçiş', 'alıcı', 'satıcı', 'çalışma alanı'],
            'answer' => 'Sağ üstteki profil menüsünde “Çalışma alanları” başlığı var. Bir hesap hem alıcı hem hizmet veren olabilir; '
                .'henüz hizmet veren değilsen aynı menüden başvuru adımına geçebilirsin.',
        ],
        [
            'key' => 'mesajlasma',
            'title' => 'Karşı tarafa nasıl mesaj atarım?',
            'audience' => 'all',
            'keywords' => ['mesaj', 'mesajlaş', 'yazış', 'sohbet', 'chat', 'iletişim', 'konuşma', 'ulaş'],
            'answer' => "Sayfanın sağ kenarındaki “Mesajlar” tutamağından paneli açabilir ya da üst menüden "
                ."Mesajlar sayfasına gidebilirsin. Panelin sol kenarından tutup genişliğini ayarlayabilirsin.

"
                ."Bir hizmet verenin vitrininden de doğrudan yazışma başlatılır.

"
                .'Karşı taraf o sırada sitede değilse mesajın birkaç dakika içinde okunmazsa e-posta olarak da haber verilir.',
        ],
        [
            'key' => 'mesaj-kontor',
            'title' => 'Mesajlaşma kontör düşürür mü?',
            'audience' => 'all',
            'keywords' => ['mesaj kontör', 'mesaj ücret', 'ilk mesaj', 'yazışma ücret', 'mesaj jeton'],
            'answer' => "Alıcı için mesajlaşma tamamen ücretsizdir.

"
                ."Hizmet veren, bir konuşmadaki ilk mesajı için kontör öder; aynı konuşmadaki sonraki "
                .'mesajların tamamı ücretsizdir. Yani başlattığın bir yazışmayı sürdürmek için tekrar ödeme yapmazsın.',
        ],
        [
            'key' => 'kontor-yukle',
            'title' => 'Kontörü nasıl yüklerim?',
            'audience' => 'user',
            'keywords' => ['kontör yükle', 'kontor yukle', 'bakiye', 'satın al', 'paket', 'kredi kartı', 'yükle'],
            'answer' => "Satıcı panelindeki “Kontör” bölümünden yükleme sayfasına geçiyorsun. Orada hazır "
                ."paketlerden birini seçip kredi kartıyla ödüyorsun.

"
                .'Ödeme onaylandığında bakiyen anında güncellenir; harcamalarını aynı sayfadaki hareket listesinden takip edebilirsin.',
        ],
    ],
];
