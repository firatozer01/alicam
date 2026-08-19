# alıcam.net

Talep bazlı iki taraflı pazaryeri. Alıcı ihtiyacını ücretsiz paylaşır; uygun
hizmet verenler kategori bazlı kontör harcayarak talebi açar ve teklif gönderir.

## Proje yapısı

```text
web/                 Next.js 16 web uygulaması ve yönetim panelleri
api/                 Laravel 13 REST API
docker/nginx/        API ağ geçidi yapılandırması
compose.yaml         PostgreSQL ve Redis dahil yerel/Ubuntu çalışma ortamı
AGENTS.md             Ürün, mimari ve tasarım briefi
alicam-net-*.html    İlk tasarım referansları
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

- Responsive pazarlama ana sayfası
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
- Dört paketli PayTR iframe siparişi, imzalı/idempotent callback ve bonus yükleme
- Responsive alıcı paneli: `http://localhost:3000/panel`
- Responsive hizmet veren paneli: `http://localhost:3000/satici-paneli`
- PayTR kontör sayfası: `http://localhost:3000/kontor-yukle`
- Operasyon özetli admin paneli: `http://localhost:3000/admin`
- Kimlikten ödeme ve teklife uzanan API test paketi
- Sağlayıcı bağımsız Ubuntu/Docker çalışma yapısı

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
