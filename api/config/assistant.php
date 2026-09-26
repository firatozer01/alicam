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

    // Giris yapmamis ziyaretcinin panelinde baslik altinda yazar. Calisma
    // modundan (yapay zeka bagli mi) hic soz edilmez: ziyaretcinin isine
    // yaramayan bir ic ayrinti.
    'guest_subtitle' => 'Sık sorulan konular',

    /*
     * Giris yapmis kullaniciya saate gore selamlama. {ad} adin ilk parcasiyla
     * degistirilir. Araliklar [from, to) seklindedir ve gece yarisini asan
     * aralik ('gece') ayrica ele alinir.
     */
    'greetings' => [
        ['from' => 0, 'to' => 5, 'text' => 'Gece gece hoş geldin {ad}. Ne lazımsa buradayım.'],
        ['from' => 5, 'to' => 11, 'text' => 'Günaydın {ad}! Bugün nereden başlayalım?'],
        ['from' => 11, 'to' => 14, 'text' => 'İyi günler {ad}! Neye bakmak istersin?'],
        ['from' => 14, 'to' => 18, 'text' => 'Merhaba {ad}! Takıldığın yeri anlat, birlikte çözelim.'],
        ['from' => 18, 'to' => 22, 'text' => 'İyi akşamlar {ad}! Nasıl yardımcı olayım?'],
        ['from' => 22, 'to' => 0, 'text' => 'İyi geceler {ad}! Hâlâ buradayım, sorabilirsin.'],
    ],

    'fallback' => 'Bunu tam anlayamadım. Aşağıdaki başlıklardan birini seçersen adım adım anlatabilirim.',

    // Uye panelindeki kart gruplari, gosterim sirasiyla.
    'groups' => [
        ['key' => 'talep-ac', 'title' => 'Talep aç, teklif topla'],
        ['key' => 'teklif-iletisim', 'title' => 'Gelen teklifler ve iletişim'],
        ['key' => 'hizmet-veren', 'title' => 'Hizmet veren olarak iş al'],
        ['key' => 'kontor', 'title' => 'Kontör, ücret ve ödeme'],
        ['key' => 'hesap', 'title' => 'Hesabın ve çalışma alanların'],
    ],

    // Panelin ustundeki hizli sorgulama kutusu (yalnizca uye).
    'lookup' => [
        'label' => 'HIZLI SORGULA',
        'placeholder' => 'Talep referansı (örn. ALC-DEMO-001)',
        'action' => 'Sorgula',
    ],

    'topics' => [
        [
            'key' => 'nedir',
            'title' => 'alıcam.net nedir?',
            'audience' => 'all',
            'group' => 'talep-ac',
            'icon' => '🔄',
            'summary' => 'Ters pazaryeri mantığı, üç adımda özet',
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
            'group' => 'talep-ac',
            'icon' => '📝',
            'summary' => 'Dört adımda talep aç, yayınlamak ücretsiz',
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
            'group' => 'talep-ac',
            'icon' => '📂',
            'summary' => 'Üç seviyeli listede doğru başlığı bul',
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
            'group' => 'talep-ac',
            'icon' => '🏬',
            'summary' => 'Beğendiğin firmadan doğrudan teklif iste',
            'keywords' => ['mağaza', 'vitrin', 'firma', 'belirli', 'direkt', 'doğrudan teklif'],
            'answer' => "Evet. Hizmet verenin vitrinine girip “Teklif iste” dediğinde sayfadan çıkmadan bir pencere açılır; "
                ."o firmanın çalıştığı başlıklardan birini seçip kısa bir brief bırakırsın.\n\n"
                .'Talep doğrudan o mağazaya iletilir ve panelinde “Sana özel” olarak işaretlenir. Uygun diğer hizmet verenler de görebilir.',
        ],
        [
            'key' => 'teklifleri-karsilastir',
            'title' => 'Gelen teklifleri nasıl karşılaştırırım?',
            'audience' => 'user',
            'group' => 'teklif-iletisim',
            'icon' => '⚖️',
            'summary' => 'Fiyatları yan yana gör, birini kabul et',
            'keywords' => ['teklif', 'karşılaştır', 'seç', 'kabul', 'hangi teklif'],
            'answer' => "Alıcı panelindeki talebine girip “Teklifleri karşılaştır” dersen fiyat, kapsam ve hizmet verenin puanı "
                ."yan yana gelir; en düşük teklif ayrıca işaretlenir.\n\n"
                .'Bir teklifi kabul ettiğinde iletişim bilgileri iki tarafa da açılır ve diğer teklifler otomatik kapanır.',
        ],
        [
            'key' => 'gizlilik',
            'title' => 'İletişim bilgilerim kimlere görünüyor?',
            'audience' => 'all',
            'group' => 'teklif-iletisim',
            'icon' => '🔒',
            'summary' => 'Telefonun ve adresin ne zaman açılır',
            'keywords' => ['gizlilik', 'telefon', 'numara', 'iletişim', 'güvenli', 'adres'],
            'answer' => "Telefon, e-posta ve açık adres talep özetinde gösterilmez. Hizmet veren talebin detayını "
                ."kontör harcayarak açtığında ya da teklifini kabul ettiğinde açılır.\n\n"
                .'Talep listesinde yalnızca kategori, bütçe aralığı, ilçe ve senin yazdığın kısa özet görünür.',
        ],
        [
            'key' => 'kontor',
            'title' => 'Kontör nedir, kim öder?',
            'audience' => 'all',
            'group' => 'kontor',
            'icon' => '⚡',
            'summary' => 'Alıcıya ücretsiz; kontörü satıcı öder',
            'keywords' => ['kontör', 'kontor', 'jeton', 'ücret', 'para', 'ödeme', 'fiyat'],
            'answer' => "Alıcı için her şey ücretsiz: talep açmak da teklif almak da para istemez.\n\n"
                .'Kontörü hizmet verenler kullanır; bir talebin detayını açmak ve teklif göndermek için kategoriye göre değişen bir kontör bedeli öderler.',
        ],
        [
            'key' => 'satici-ol',
            'title' => 'Hizmet veren olarak nasıl kayıt olurum?',
            'audience' => 'all',
            'group' => 'hizmet-veren',
            'icon' => '🏢',
            'summary' => 'Dört adımda firma başvurusu gönder',
            'keywords' => ['satıcı', 'hizmet veren', 'firma', 'kayıt', 'üye ol', 'başvuru'],
            'answer' => "Hesabını açtıktan sonra profil menüsünden “Hizmet vermeye başla” diyorsun. Firma bilgilerini, "
                ."çalıştığın kategorileri ve hizmet bölgelerini giriyorsun.\n\n"
                .'Başvurun onaylandığında eşleşen talepler panelinde listelenmeye başlar; vitrinini hizmet ve galeri ekleyerek doldurabilirsin.',
        ],
        [
            'key' => 'vitrin',
            'title' => 'Vitrinimi nasıl düzenlerim?',
            'audience' => 'user',
            'group' => 'hizmet-veren',
            'icon' => '🖼️',
            'summary' => 'Hizmet kartların ve galerin nasıl dolar',
            'keywords' => ['vitrin', 'mağaza', 'galeri', 'portföy', 'hizmet ekle', 'çalışma ekle'],
            'answer' => "Satıcı panelinde “Firma” menüsünden Hizmetlerim ve Galerim bölümlerine giriyorsun.\n\n"
                ."Hizmet kartlarına kapak görseli ve başlangıç fiyatı, galerideki çalışmalara ise süre, alan, iş bedeli "
                .'ve sekize kadar fotoğraf ekleyebilirsin. Doldurdukça vitrinin daha çok teklif çeker.',
        ],
        [
            'key' => 'dogrulama',
            'title' => 'Hesabımı doğrulamak zorunda mıyım?',
            'audience' => 'all',
            'group' => 'hesap',
            'icon' => '✅',
            'summary' => 'E-posta ve telefon kodunu doğrula',
            'keywords' => ['doğrula', 'doğrulama', 'onay', 'sms', 'kod', 'e-posta doğrula'],
            'answer' => "Kayıt olurken doğrulama zorunlu değil, hesabını hemen kullanmaya başlayabilirsin. "
                .'Talep açmak ve teklif göndermek gibi adımlar için e-posta ve telefon doğrulaması isteniyor; bunu Hesap ayarları sayfasından istediğin zaman tamamlayabilirsin.',
        ],
        [
            'key' => 'hesap',
            'title' => 'Hesap bilgilerimi nereden değiştiririm?',
            'audience' => 'user',
            'group' => 'hesap',
            'icon' => '⚙️',
            'summary' => 'Ad, telefon ve parolanı buradan değiştir',
            'keywords' => ['hesap', 'ayarlar', 'şifre', 'parola', 'profil', 'bilgilerim'],
            'answer' => "Sağ üstteki profil menüsünden “Hesap ayarları”na giriyorsun. Orada üç sekme var: "
                .'Hesap bilgileri (ad, telefon), Güvenlik (parola değiştirme) ve Çalışma alanları (alıcı ve hizmet veren panelleri arasında geçiş).',
        ],
        [
            'key' => 'panel-gecis',
            'title' => 'Alıcı ve satıcı panelleri arasında nasıl geçerim?',
            'audience' => 'user',
            'group' => 'hesap',
            'icon' => '🔀',
            'summary' => 'Alıcı ve hizmet veren alanı arasında geç',
            'keywords' => ['panel', 'geçiş', 'alıcı', 'satıcı', 'çalışma alanı'],
            'answer' => 'Sağ üstteki profil menüsünde “Çalışma alanları” başlığı var. Bir hesap hem alıcı hem hizmet veren olabilir; '
                .'henüz hizmet veren değilsen aynı menüden başvuru adımına geçebilirsin.',
        ],
        [
            'key' => 'mesajlasma',
            'title' => 'Karşı tarafa nasıl mesaj atarım?',
            'audience' => 'all',
            'group' => 'teklif-iletisim',
            'icon' => '💬',
            'summary' => 'Sağ kenardaki panelden yazışmayı başlat',
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
            'group' => 'kontor',
            'icon' => '🪙',
            'summary' => 'İlk mesaj kontör düşer, sonrası ücretsiz',
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
            'group' => 'kontor',
            'icon' => '💳',
            'summary' => 'Paketi seç, kartla öde, bakiye anında',
            'keywords' => ['kontör yükle', 'kontor yukle', 'bakiye', 'satın al', 'paket', 'kredi kartı', 'yükle'],
            'answer' => "Satıcı panelindeki “Kontör” bölümünden yükleme sayfasına geçiyorsun. Orada hazır "
                ."paketlerden birini seçip kredi kartıyla ödüyorsun.

"
                .'Ödeme onaylandığında bakiyen anında güncellenir; harcamalarını aynı sayfadaki hareket listesinden takip edebilirsin.',
        ],
        [
            'key' => 'talep-durumu',
            'title' => 'Talebim ne durumda?',
            'audience' => 'user',
            'group' => 'talep-ac',
            'icon' => '🔎',
            'summary' => 'Referansla ara, durum etiketini oku',
            'keywords' => ['talep durumu', 'durum', 'referans', 'ALC', 'takip', 'ne oldu', 'nerede kaldı', 'ne kadar sürer', 'yayında', 'teklif alıyor', 'süre'],
            'answer' => "Alıcı panelindeki “Taleplerim” listesinde her talebin başlığının üstünde kategorisi ve ALC- ile başlayan referans kodu yazar. Listenin üstündeki arama kutusuna bu kodu, talep başlığını, kategoriyi ya da konumu yazabilir; Tümü / Aktif / Sonuçlanan düğmeleriyle listeyi daraltabilirsin. Birden fazla kategoride talebin varsa yanında kategori seçimi de çıkar.\n\nDurum etiketleri şöyle okunur:\n\n• Yayında: talep açık, yanıtını bekleyen teklif yok.\n• Teklif alıyor: yanıtını bekleyen en az bir teklif var.\n• Anlaşma sağlandı: bir teklifi kabul ettin.\n• İptal edildi: talebi sen kapattın.\n\nKartın içindeki şerit nerede kaldığını gösterir: talep yayınlandı → kaç teklif geldi → hizmet veren seçildi.\n\nTalepler yayınlandıktan 30 gün sonra süresini doldurur ve hizmet verenlerin listesinde görünmez.",
        ],
        [
            'key' => 'talep-iptal',
            'title' => 'Talebimi nasıl iptal ederim?',
            'audience' => 'user',
            'group' => 'talep-ac',
            'icon' => '🚫',
            'summary' => 'Yayındaki talebi kart altından kapat',
            'keywords' => ['iptal', 'talebi kapat', 'vazgeç', 'sil', 'kaldır', 'yayından kaldır', 'talep iptal'],
            'answer' => "Alıcı panelinde talep kartının altındaki “Talebi iptal et” düğmesini kullanıyorsun. Bu düğme yalnızca Yayında ve Teklif alıyor durumundaki taleplerde çıkar.\n\nİptal ettiğinde talep hizmet verenlerin listesinden düşer ve o talepte yanıt bekleyen tüm teklifler reddedilmiş sayılır.\n\nBir teklifi kabul ettiysen talep artık iptal edilemez. Aynı iş için yeniden teklif toplamak istersen yeni bir talep açman gerekir; talep açmak ücretsiz.",
        ],
        [
            'key' => 'degerlendirme',
            'title' => 'Hizmet vereni nasıl değerlendiririm?',
            'audience' => 'user',
            'group' => 'teklif-iletisim',
            'icon' => '⭐',
            'summary' => 'Kabul ettiğin teklife puan ve yorum ver',
            'keywords' => ['değerlendirme', 'değerlendir', 'puan', 'puanla', 'yıldız', 'yorum', 'geri bildirim', 'memnuniyet'],
            'answer' => "Bir teklifi kabul ettikten sonra “Teklifleri karşılaştır” ekranında o teklifin kartında, iletişim bilgileriyle birlikte “Hizmeti değerlendir ★” düğmesi çıkar. 1-5 arası yıldız seçiyorsun; istersen en az 10 karakterlik kısa bir yorum da yazabilirsin.\n\nHer kabul edilmiş teklif için bir kez değerlendirme yapılır. Gönderdikten sonra kartta yıldızların ve yorumun görünür; sonradan değiştiremezsin.\n\nDeğerlendirmen hizmet verenin vitrinindeki puan ortalamasına, yıldız dağılımına ve “Müşteri yorumları” bölümüne yansır; diğer alıcılar da görür.",
        ],
        [
            'key' => 'teklif-ver',
            'title' => 'Bir talebe nasıl teklif veririm?',
            'audience' => 'user',
            'group' => 'hizmet-veren',
            'icon' => '📤',
            'summary' => 'Talebi kontörle aç, sonra teklifini yaz',
            'keywords' => ['teklif ver', 'teklif gönder', 'talebi aç', 'kilidi aç', 'detayı aç', 'fiyat ver', 'teklifimi güncelle', 'teklif düzenle'],
            'answer' => "Satıcı panelindeki “Gelen talepler” listesinde kategorine ve hizmet bölgene düşen açık talepler var. Kartta kategori, rekabet yoğunluğu, başlık, konum, gelen teklif sayısı ve tahmini bütçe görünür; açıklama ve iletişim bilgisi kapalıdır.\n\n1. Kartın altındaki “Aç · N ⚡” düğmesiyle detayı kontörle açıyorsun. Bedel kategoriye göre değişir; açıldığında talebin tüm açıklaması, kategoriye özel alanları, alıcının iletişim bilgisi ve alıcı girdiyse açık adresi gelir.\n2. Sonra “Teklif ver” deyip fiyatını ve en az 20 karakterlik teklif notunu yazıyorsun. Talep zaten açıldığı için teklif göndermek ek kontör düşürmez.\n\nGönderdiğin teklifler “Tekliflerim” bölümünde toplanır. Alıcı yanıtlamadığı sürece “Teklifi düzenle” ile fiyatını ve notunu güncelleyebilirsin; güncelleme de kontör düşürmez.\n\nListeyi kategori, şehir ve bütçeye göre filtreleyebilir; en yeni, bütçe, en az rekabet ya da en çok teklif alan sıralamalarını kullanabilirsin.",
        ],
        [
            'key' => 'talep-favori',
            'title' => 'Bir talebi nasıl takibe alırım?',
            'audience' => 'user',
            'group' => 'hizmet-veren',
            'icon' => '🔖',
            'summary' => 'Yıldızla işaretle, Favorilerim\'de bul',
            'keywords' => ['favori', 'favorilerim', 'yıldız', 'işaretle', 'kaydet', 'takip', 'sonra bakarım'],
            'answer' => "Satıcı panelinde talep kartının üstündeki yıldıza (☆) basmak talebi favorilerine ekler. Bunun için kontör harcamazsın; detayı açmadan önce ilgini çekenleri bir kenara ayırman için var.\n\nListenin üstündeki “Görünüm” seçiminden ya da Talepler menüsündeki “Favorilerim” başlığından yalnızca işaretlediklerini görebilirsin.\n\nYıldıza tekrar basarsan favorilerden çıkar.",
        ],
        [
            'key' => 'one-cik',
            'title' => 'Vitrinde nasıl öne çıkarım?',
            'audience' => 'user',
            'group' => 'hizmet-veren',
            'icon' => '✨',
            'summary' => 'Kontörle ana sayfa vitrinine gir',
            'keywords' => ['öne çık', 'öne çıkan', 'vitrin paketi', 'görünürlük', 'tanıtım', 'reklam', 'paket', 'üst sıra'],
            'answer' => "Satıcı panelinde Firma menüsündeki “Öne çık” bölümünde kontörle alınan vitrin paketleri var: 7, 14 ve 30 günlük. Her paketin kontör bedeli kendi kartında yazar.\n\nPaketi etkinleştirdiğinde bedel bakiyenden düşer ve profilin ana sayfadaki öne çıkan hizmet verenler bölümünde “★ ÖNE ÇIKAN” rozetiyle görünür; hizmet verenler listesinde de öne çıkanlar sıralamasında üst sıralara gelir.\n\nSüren dolmadan yeni paket alırsan gün sayısı mevcut sürenin üzerine eklenir; sayfanın üstündeki rozette vitrinde kalacağın son tarih yazar.\n\nBakiyen pakete yetmiyorsa düğme “Bakiye yetersiz” der; aynı sayfadaki bağlantıdan kontör yükleyebilirsin.",
        ],
        [
            'key' => 'hizmet-veren-bul',
            'title' => 'Hizmet verenleri nasıl incelerim?',
            'audience' => 'all',
            'group' => 'talep-ac',
            'icon' => '🧭',
            'summary' => 'Firma ara, vitrin ve yorumları incele',
            'keywords' => ['hizmet veren', 'firma bul', 'rehber', 'kimler var', 'ara', 'liste', 'puanı yüksek', 'yorum', 'referans işler', 'satıcı bul'],
            'answer' => "Üst menüdeki “Hizmet verenler” sayfasında onaylı firmalar listelenir. Kartta firma adı, kurumsal mı bireysel mi olduğu, puanı ve değerlendirme sayısı, çalıştığı kategoriler ile kaç iş ve kaç hizmet paylaştığı görünür.\n\nSoldaki filtrelerden uzmanlık alanını, şehri ve minimum puanı (4★ ve üzeri gibi) seçebilir, arama kutusuna firma adı ya da uzmanlık yazabilirsin. Sıralamayı öne çıkanlar, puanı en yüksek, en çok değerlendirilen, en çok işi olan ya da en yeni katılan olarak değiştirebilir; istersen yalnızca öne çıkanları gösterebilirsin.\n\nBir firmaya tıkladığında vitrini açılır: Hizmetler (kapak görselli kartlar ve başlangıç fiyatları), Yaptığı işler (tamamlanan çalışmalar ve fotoğrafları) ve Müşteri yorumları.\n\nBeğendiysen aynı sayfadaki “Teklif iste” düğmesiyle sayfadan çıkmadan brief bırakabilirsin; bunun için giriş yapmış olman gerekir.",
        ],
        [
            'key' => 'basvuru-durumu',
            'title' => 'Hizmet veren başvurum ne oldu?',
            'audience' => 'user',
            'group' => 'hizmet-veren',
            'icon' => '📋',
            'summary' => 'İnceleme, onay ve ret sonrası adımlar',
            'keywords' => ['başvuru', 'başvurum', 'onay', 'inceleniyor', 'incelemede', 'bekliyor', 'reddedildi', 'onaylanmadı', 'ne zaman onaylanır'],
            'answer' => "Başvuruyu gönderebilmek için önce e-posta ve telefon doğrulamanı tamamlaman gerekir; eksikse son adımda “Doğrulama gerekli” uyarısı çıkar ve seni doğrulama ekranına yönlendiririz.\n\nGönderdikten sonra “Hizmet vermeye başla” sayfası “İNCELEMEDE” durumuna geçer. Her başvuru profil bütünlüğü ve iletişim doğrulaması açısından elle incelenir.\n\nBaşvurun reddedilirse aynı sayfada ret gerekçesi yazar; bilgileri düzeltip yeniden gönderebilirsin.\n\nGüncel durumu her zaman Hesap ayarları → Çalışma alanları sekmesinde görebilirsin: Tamamlanmadı, İnceleniyor, Onaylandı ya da Reddedildi. Onaylandığında sana uygun talepler satıcı panelinde listelenmeye başlar.",
        ],
    ],
];
