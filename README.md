# alıcam.net

Talep bazlı iki taraflı pazaryeri. Alıcı ihtiyacını ücretsiz paylaşır; uygun
hizmet verenler kategori bazlı kontör harcayarak talebi açar ve teklif gönderir.

## Proje yapısı

```text
web/                 Next.js 16 web uygulaması ve kullanıcı panelleri
api/                 Laravel 13 REST API
docker/nginx/        API ağ geçidi yapılandırması
compose.yaml         PostgreSQL ve Redis dahil yerel/Ubuntu çalışma ortamı
statik_tasarimlar_prototipler/  Bağlayıcı görsel tasarım referansları
```

## Yerel adresler

- Web: `http://localhost:3000`
- API: `http://localhost:8091/api`
- Sağlık kontrolü: `http://localhost:8091/api/health`

`8080` ve `8000` portları bu projede kullanılmaz. PostgreSQL ve Redis host
makineye açılmaz.

## İlk kurulum

1. Kök `.env.example` dosyasını `.env` olarak kopyalayın.
2. Güvenli bir Laravel anahtarı üretip `.env` içine `APP_KEY=...` olarak ekleyin.
3. `docker compose up --build` ile servisleri başlatın.

Yerel geliştirmede e-posta/SMS sağlayıcısı bağlanmadan doğrulama akışını görmek
için `.env` içindeki `APP_ENV=local` ve `VERIFICATION_EXPOSE_CODES=true`
yapılabilir. Bu ayar üretimde kesinlikle `false` kalmalıdır.

Ubuntu üretim kurulumunda alan adı, TLS, gerçek PostgreSQL parolası, PayTR
bilgileri ve harici yedekleme hedefi ayrıca tanımlanmalıdır. HTTPS devreye
alındığında `SESSION_SECURE_COOKIE=true` yapılmalıdır.

## Mevcut ürün dilimleri

- Sahibinden benzeri filtreli ve sıralanabilir canlı talep pazaryeri ana sayfası
- Puanı yüksek ve kontörle sponsorlu hizmet veren vitrini
- Dört adımlı, dinamik kategori sorulu talep oluşturma deneyimi
- Laravel Sanctum çerez tabanlı üyelik, giriş ve çıkış akışı
- Hash saklamalı e-posta/telefon doğrulama kodu altyapısı
- Doğrulanmış kullanıcının talebini PostgreSQL'e kaydetmesi
- Oturum gerektiğinde kaybolmayan geçici talep taslağı
- Çoklu rol ve dinamik kategori şeması
- Hizmet, Nakliye ve Tadilat seed verileri
- Türkiye geneli 81 il ve 973 ilçe/merkez referans verisi
- Dört adımlı hizmet veren başvurusu: profil, kategori, hizmet bölgesi ve kontrol
- Manuel satıcı onayı/red akışı, admin rol koruması ve denetim kaydı
- Yönetici sayfalarında Next.js sunucu tarafı oturum/rol koruması ve Laravel yetki kontrolü
- Onaylı satıcılar için kategori + ilçe kesişimli talep eşleştirmesi
- Kilitli talepte PII maskeleme, güvenli anonim özet ve özel alan gizleme
- Transaction güvenli kontör cüzdanı, hareket defteri ve maliyet snapshot'ı
- Aynı talebi ikinci kez ücretsiz gösteren benzersiz kilit açma kaydı
- Kontörlü teklif oluşturma/güncelleme ve alıcı kabul/red yaşam döngüsü
- Hizmet veren katalog yönetimi: hizmet ekleme, düzenleme, yayından kaldırma
- Kontörle 7, 14 veya 30 günlük ana sayfa öne çıkarma paketleri
- Tamamlanan işlerde gerçek alıcı puanı ve değerlendirme akışı
- Dört paketli PayTR iframe siparişi, imzalı/idempotent callback ve bonus yükleme
- Gelişmiş müşteri paneli: `http://localhost:3000/musteri-panel`
- Responsive hizmet veren paneli: `http://localhost:3000/satici-paneli`
- PayTR kontör sayfası: `http://localhost:3000/kontor-yukle`
- Operasyon özetli admin paneli: `http://localhost:3000/admin`
- Kimlikten ödeme ve teklife uzanan API test paketi
- Sağlayıcı bağımsız Ubuntu/Docker çalışma yapısı

## Tasarım standardı

`statik_tasarimlar_prototipler/` altındaki ekranlar görsel standarttır. Yeni
sayfalar bu sistemden sapmamalıdır:

- Ana renkler: violet `#7C3AED`, indigo `#4F46E5`, cyan `#06B6D4`
- Durum vurguları: pink `#EC4899`, orange `#F59E0B`, green `#16A34A`
- Zemin `#F6F5FC`, kart `#FFFFFF`, metin `#15162D`, çizgi `#E7E5F5`
- Başlıklar Fraunces, gövde Inter, metrik ve referanslar IBM Plex Mono
- Beyaz üst menü, açık lavanta tuval, mor–indigo geçişler ve cyan vurgular
- 10–18 px yuvarlatılmış, yoğun bilgi taşıyan beyaz kartlar ve hafif mor gölge

Kahverengi, petrol veya genel koyu yeşil bir tema ürün dilinin parçası değildir.

## Demo pazaryeri verisi

Yerel ya da test ortamına örnek müşteri, hizmet veren, hizmet, talep, teklif,
puan ve öne çıkarma kayıtlarını eklemek için:

```text
docker compose exec -T api php artisan db:seed --class=DemoMarketplaceSeeder --force
```

Seeder tekrar çalıştırılabilir; aynı demo referanslarını çoğaltmaz.

## PayTR yapılandırması

`.env` içinde `PAYTR_MERCHANT_ID`, `PAYTR_MERCHANT_KEY` ve
`PAYTR_MERCHANT_SALT` değerlerini PayTR mağaza panelindeki bilgilerle doldurun.
Yerel doğrulamada `PAYTR_TEST_MODE=true`, canlı ortamda `false` kullanın.
PayTR bildirim URL'i aşağıdaki dışarıdan erişilebilir HTTPS adresine ayarlanır:

```text
https://alan-adiniz.example/api/payments/paytr/callback
```

Tarayıcının başarı sayfası ödeme kanıtı sayılmaz. Kontör yalnızca PayTR'nin
imzalı sunucu bildirimi doğrulandıktan sonra, aynı sipariş için bir kez yüklenir.

## Konum verisi

İl ve ilçe referansları İçişleri Bakanlığının valilik/kaymakamlık verisinden
üretilir. Resmî listede yer alan 922 kaymakamlık ilçesine, büyükşehir olmayan
51 ilin merkez ilçesi eklenerek kullanıcıya sunulan toplam 973 ilçe/merkez
kaydı oluşturulmuştur. Seed kaynağı ve üretim özeti
`api/database/data/turkey_locations.json` dosyasının `_meta` alanında tutulur.

## Sonraki iş paketi

- Talep ve teklif durum değişikliği bildirimleri
- Alıcı–hizmet veren mesajlaşması
- Gelişmiş moderasyon, iade talepleri ve denetim ekranları
