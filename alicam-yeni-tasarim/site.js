/* alıcam.net — Ortak veri + menü/alt bilgi + yardımcılar
   Tüm sayfalarda <header data-site-header> ve <footer data-site-footer> bu dosyayla doldurulur. */
(function () {
  "use strict";

  /* ================= VERİ ================= */
  var VERTICALS = [
    { id: "hizmet", name: "Hizmet", emo: "🛠️", c: "#1B5CFF", desc: "Usta, tamir, temizlik, nakliyat, ders", who: "ustalar ve firmalar", count: 177 },
    { id: "emlak", name: "Emlak", emo: "🏠", c: "#0E9F5A", desc: "Kiralık, satılık daire, ev, işyeri, arsa", who: "emlakçılar ve ev sahipleri", count: 8 },
    { id: "vasita", name: "Vasıta", emo: "🚗", c: "#F2600C", desc: "Otomobil, SUV, motosiklet, ticari araç", who: "galeriler ve araç sahipleri", count: 8 },
    { id: "alisveris", name: "Alışveriş", emo: "🛍️", c: "#7A5AF8", desc: "Telefon, bilgisayar, beyaz eşya, mobilya", who: "mağazalar ve satıcılar", count: 9 },
    { id: "makine", name: "İş Makineleri", emo: "🚜", c: "#F5A524", desc: "Kiralık / satılık iş makinesi, tarım, sanayi", who: "makine firmaları", count: 6 },
    { id: "eleman", name: "Eleman", emo: "💼", c: "#0EA5B7", desc: "Bakıcı, şoför, garson, usta eleman", who: "iş arayanlar ve ajanslar", count: 6 },
    { id: "hayvan", name: "Hayvanlar", emo: "🐾", c: "#E8488A", desc: "Kedi, köpek, kuş, akvaryum, çiftlik", who: "üreticiler ve sahiplendirenler", count: 5 }
  ];

  var HIZMET_AREAS = [
    { name: "Tadilat, Dekorasyon ve İnşaat", emo: "🏗️", n: 20, subs: [["🎨", "Boya, Badana ve Sıva"], ["🧱", "Zemin ve Duvar Kaplama"], ["🚿", "Mutfak ve Banyo Tadilatı"], ["🚪", "Kapı ve Pencere"], ["🪟", "Cam Balkon ve Teras Kapatma"], ["🦟", "Panjur, Sineklik, Tente ve Pergole"], ["🏠", "Çatı, Dış Cephe ve Yalıtım"], ["📐", "İç Mimari, Proje ve Mühendislik"]] },
    { name: "Montaj, Tamir ve Teknik Servis", emo: "🔧", n: 20, subs: [["🔥", "Kombi, Doğalgaz ve Isıtma Sistemleri"], ["💨", "Klima ve Havalandırma"], ["🧊", "Beyaz Eşya Servisi"], ["☕", "Küçük Ev Aletleri Tamiri"], ["⚡", "Elektrik Tesisatı ve Aydınlatma"], ["🚿", "Su Tesisatı, Sıhhi Tesisat ve Su Arıtma"], ["🪑", "Mobilya Montaj ve Tamiri"]] },
    { name: "Temizlik Hizmetleri", emo: "🧹", n: 18, subs: [["🏠", "Ev ve Daire Temizliği"], ["🏢", "Apartman, Site ve Bina Temizliği"], ["🏬", "İşyeri ve Ticari Alan Temizliği"], ["🪟", "Cam ve Cephe Temizliği"], ["🛋️", "Halı ve Koltuk Yıkama"], ["🧺", "Tekstil, Yorgan ve Perde Yıkama"], ["♨️", "Buharlı Temizlik Hizmetleri"]] },
    { name: "Nakliyat ve Depolama", emo: "🚚", n: 17, subs: [["🏠", "Evden Eve Nakliyat"], ["🏢", "Ofis ve İşyeri Taşıma"], ["🪑", "Parça Eşya ve Beyaz Eşya Taşıma"], ["🌍", "Uluslararası Nakliyat"], ["📦", "Eşya Depolama ve Depo Kiralama"], ["🛻", "Kamyonet ve Panelvan Nakliye"]] },
    { name: "Özel Ders ve Eğitim", emo: "🎓", n: 20, subs: [["📘", "Akademik Özel Ders"], ["✏️", "Sınava Hazırlık"], ["🗣️", "Yabancı Dil Dersleri"], ["🎯", "Eğitim ve Öğrenci Koçluğu"], ["🎹", "Müzik Dersleri"], ["💃", "Dans Dersleri"], ["🧩", "Özel Eğitim ve Destek"]] },
    { name: "Sağlık, Güzellik ve Spor", emo: "💆", n: 14, subs: [["🧠", "Psikoloji ve Terapi"], ["🥗", "Diyet ve Beslenme"], ["🩺", "Fizik Tedavi ve Rehabilitasyon"], ["🏥", "Evde Hasta ve Yaşlı Bakımı"], ["🏋️", "Kişisel Antrenör ve Fitness"], ["🧘", "Pilates, Yoga ve Meditasyon"], ["💄", "Cilt Bakımı, Makyaj ve Epilasyon"]] },
    { name: "Düğün ve Organizasyon", emo: "💒", n: 17, subs: [["💍", "Düğün, Nişan ve Söz Organizasyonu"], ["💐", "Evlilik Teklifi"], ["🥳", "Özel Gün Organizasyonu"], ["🕌", "Mevlüt ve Dini Tören"], ["🍽️", "Catering ve Yemek"], ["🎂", "Pasta, Tatlı ve İkramlık"], ["📸", "Fotoğraf ve Video Çekimi"]] },
    { name: "Kurumsal ve Profesyonel", emo: "💼", n: 20, subs: [["💻", "Web ve Yazılım Geliştirme"], ["📈", "Dijital Pazarlama ve Reklam"], ["🎨", "Grafik ve Marka Tasarımı"], ["🧊", "3B Modelleme, Render ve Teknik Çizim"], ["🎬", "Video, Ses ve Animasyon Prodüksiyonu"], ["🖨️", "Matbaa ve Baskı"], ["⚖️", "Hukuk ve Danışmanlık"]] },
    { name: "Oto ve Araç Hizmetleri", emo: "🚙", n: 20, subs: [["🧰", "Periyodik Bakım"], ["⚙️", "Motor ve Mekanik Tamir"], ["🔩", "Şanzıman ve Aktarma Organları"], ["🛑", "Fren, Rot ve Süspansiyon"], ["🛞", "Lastik ve Jant"], ["🎨", "Kaporta ve Boya"], ["🧽", "Oto Yıkama ve Detaylı Temizlik"]] },
    { name: "Evcil Hayvan Hizmetleri", emo: "🐕", n: 11, subs: [["✂️", "Pet Kuaför ve Tıraş"], ["🏨", "Otel ve Pansiyon"], ["🚶", "Evde Bakım ve Gezdirme"], ["🩺", "Veteriner ve Sağlık"], ["🎓", "Eğitim ve Davranış"], ["🪟", "Kedi Teli ve Güvenlik Filesi"]] }
  ];

  var CATS = {
    emlak: [["🏢", "Kiralık Daire"], ["🔑", "Satılık Daire"], ["🏡", "Müstakil Ev ve Villa"], ["🏬", "İşyeri ve Dükkan"], ["🗂️", "Ofis ve Büro"], ["🌾", "Arsa ve Tarla"], ["🏖️", "Günlük Kiralık ve Yazlık"], ["🔁", "Devren Satılık İşyeri"]],
    vasita: [["🚗", "Otomobil"], ["🚙", "Arazi, SUV ve Pickup"], ["🏍️", "Motosiklet"], ["🚐", "Minivan ve Panelvan"], ["🚚", "Ticari Araç ve Kamyon"], ["🔑", "Kiralık Araç"], ["🚌", "Karavan"], ["⚙️", "Yedek Parça ve Aksesuar"]],
    alisveris: [["📱", "Cep Telefonu"], ["💻", "Bilgisayar ve Tablet"], ["🧊", "Beyaz Eşya"], ["🛋️", "Mobilya ve Ev Dekorasyonu"], ["📺", "TV, Ses ve Görüntü"], ["🎮", "Oyun ve Konsol"], ["🚲", "Spor ve Outdoor"], ["🍼", "Anne ve Bebek"], ["🎸", "Hobi ve Müzik Aletleri"]],
    makine: [["🏗️", "Kiralık İş Makinesi"], ["🚜", "Satılık İş Makinesi"], ["🌾", "Tarım Makineleri ve Traktör"], ["🏭", "Sanayi Ekipmanı"], ["📦", "Forklift ve İstif Makinesi"], ["🔌", "Jeneratör ve Kompresör"]],
    eleman: [["👶", "Çocuk Bakıcısı"], ["👵", "Yaşlı ve Hasta Bakıcısı"], ["🏠", "Ev Yardımcısı"], ["🚘", "Özel Şoför"], ["🍽️", "Garson ve Aşçı"], ["🧰", "Usta ve Teknik Eleman"]],
    hayvan: [["🐈", "Kedi"], ["🐕", "Köpek"], ["🦜", "Kuş"], ["🐠", "Akvaryum Balığı"], ["🐄", "Çiftlik Hayvanları"]]
  };
  CATS.hizmet = [];
  HIZMET_AREAS.forEach(function (a) { a.subs.forEach(function (s) { CATS.hizmet.push([s[0], s[1], a.name]); }); });

  var ILLER = ["Adana", "Adıyaman", "Afyonkarahisar", "Ağrı", "Aksaray", "Amasya", "Ankara", "Antalya", "Ardahan", "Artvin", "Aydın", "Balıkesir", "Bartın", "Batman", "Bayburt", "Bilecik", "Bingöl", "Bitlis", "Bolu", "Burdur", "Bursa", "Çanakkale", "Çankırı", "Çorum", "Denizli", "Diyarbakır", "Düzce", "Edirne", "Elazığ", "Erzincan", "Erzurum", "Eskişehir", "Gaziantep", "Giresun", "Gümüşhane", "Hakkari", "Hatay", "Iğdır", "Isparta", "İstanbul", "İzmir", "Kahramanmaraş", "Karabük", "Karaman", "Kars", "Kastamonu", "Kayseri", "Kilis", "Kırıkkale", "Kırklareli", "Kırşehir", "Kocaeli", "Konya", "Kütahya", "Malatya", "Manisa", "Mardin", "Mersin", "Muğla", "Muş", "Nevşehir", "Niğde", "Ordu", "Osmaniye", "Rize", "Sakarya", "Samsun", "Şanlıurfa", "Siirt", "Sinop", "Sivas", "Şırnak", "Tekirdağ", "Tokat", "Trabzon", "Tunceli", "Uşak", "Van", "Yalova", "Yozgat", "Zonguldak"];

  var MARKALAR = ["Audi", "BMW", "Citroën", "Dacia", "Fiat", "Ford", "Honda", "Hyundai", "Kia", "Mercedes-Benz", "Nissan", "Opel", "Peugeot", "Renault", "Seat", "Skoda", "Tesla", "Togg", "Toyota", "Volkswagen", "Volvo", "Diğer"];

  function findVertical(id) { for (var i = 0; i < VERTICALS.length; i++) if (VERTICALS[i].id === id) return VERTICALS[i]; return null; }

  /* ================= YARDIMCILAR ================= */
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var fold = function (s) {
    return String(s).toLocaleLowerCase("tr-TR").replace(/ı/g, "i").replace(/ş/g, "s").replace(/ğ/g, "g").replace(/ü/g, "u").replace(/ö/g, "o").replace(/ç/g, "c").replace(/â/g, "a").replace(/î/g, "i").replace(/û/g, "u");
  };
  var fmt = function (n) { return Number(n).toLocaleString("tr-TR"); };
  var qs = function (obj) {
    return Object.keys(obj).filter(function (k) { return obj[k] !== "" && obj[k] != null; })
      .map(function (k) { return encodeURIComponent(k) + "=" + encodeURIComponent(obj[k]); }).join("&");
  };
  var talepUrl = function (obj) { var q = qs(obj || {}); return "talep-olustur.html" + (q ? "?" + q : ""); };
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function toast(msg) {
    var t = $(".toast");
    if (!t) { t = document.createElement("div"); t.className = "toast"; t.setAttribute("role", "status"); document.body.appendChild(t); }
    t.textContent = msg;
    requestAnimationFrame(function () { t.classList.add("show"); });
    clearTimeout(t._h);
    t._h = setTimeout(function () { t.classList.remove("show"); }, 3200);
  }

  var LOGO = '<svg viewBox="0 0 30 30" fill="none" aria-hidden="true"><path d="M4 10 L14 4 L14 10 Z" fill="#1B5CFF"/><path d="M26 20 L16 26 L16 20 Z" fill="#F2600C"/><path d="M14 7 H16 V23 H14 Z" fill="#0A1433"/></svg>';
  var LOGO_LIGHT = '<svg viewBox="0 0 30 30" fill="none" aria-hidden="true"><path d="M4 10 L14 4 L14 10 Z" fill="#7EA2FF"/><path d="M26 20 L16 26 L16 20 Z" fill="#FF8A4C"/><path d="M14 7 H16 V23 H14 Z" fill="#fff"/></svg>';

  /* ================= ÜST MENÜ ================= */
  function renderHeader(el) {
    var min = el.hasAttribute("data-minimal");
    var page = document.body.dataset.page || "";
    if (min) {
      el.className = "header header-min";
      el.innerHTML = '<div class="wrap header-in"><a class="brand" href="index.html">' + LOGO + '<b>alıcam<span>.net</span></b></a>' +
        '<a class="btn btn-line btn-sm" href="index.html">' + esc(el.dataset.minimal || "Vazgeç") + "</a></div>";
      return;
    }
    el.className = "header";
    el.innerHTML =
      '<div class="wrap header-in">' +
      '<a class="brand" href="index.html" aria-label="alıcam.net ana sayfa">' + LOGO + "<b>alıcam<span>.net</span></b></a>" +
      '<nav class="nav" id="nav" aria-label="Ana menü">' +
      '<a href="index.html#kategoriler"><i>🛠️</i>Hizmet</a>' +
      '<a href="index.html#kategoriler" data-v="emlak"><i>🏠</i>Emlak</a>' +
      '<a href="index.html#kategoriler" data-v="vasita"><i>🚗</i>Vasıta</a>' +
      '<a href="index.html#kategoriler" data-v="alisveris"><i>🛍️</i>Alışveriş</a>' +
      '<a href="index.html#nasil-calisir">Nasıl çalışır?</a>' +
      '<a href="index.html#teklif-ver">Teklif ver, kazan</a>' +
      '<div class="nav-drawer-foot"><a class="btn btn-soft" href="giris.html">Giriş yap</a><a class="btn btn-line" href="giris.html?kayit=veren">Teklif veren ol</a><a class="btn btn-cta" href="talep-olustur.html">＋ Ücretsiz talep oluştur</a></div>' +
      "</nav>" +
      '<div class="header-actions">' +
      '<a class="header-link" href="giris.html"' + (page === "giris" ? ' aria-current="page"' : "") + ">Giriş yap</a>" +
      '<a class="btn btn-cta btn-sm" href="talep-olustur.html">＋ Talep oluştur</a>' +
      '<button class="burger" id="burger" type="button" aria-label="Menüyü aç" aria-expanded="false" aria-controls="nav"><span></span><span></span><span></span></button>' +
      "</div></div>";

    var burger = $("#burger", el), nav = $("#nav", el);
    function setNav(open) {
      nav.classList.toggle("open", open);
      document.body.classList.toggle("nav-open", open);
      burger.setAttribute("aria-expanded", open);
      burger.setAttribute("aria-label", open ? "Menüyü kapat" : "Menüyü aç");
    }
    burger.addEventListener("click", function (e) { e.stopPropagation(); setNav(!nav.classList.contains("open")); });
    nav.addEventListener("click", function (e) {
      var a = e.target.closest("a");
      if (!a) return;
      if (a.dataset.v) try { sessionStorage.setItem("alicam-v", a.dataset.v); } catch (_) {}
      if (a.dataset.v && window.ALICAM_SELECT_VERTICAL && location.pathname.match(/(index\.html|\/)$/)) window.ALICAM_SELECT_VERTICAL(a.dataset.v);
      setNav(false);
    });
    document.addEventListener("click", function (e) { if (nav.classList.contains("open") && !e.target.closest("#nav")) setNav(false); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") setNav(false); });
  }

  /* ================= ALT BİLGİ ================= */
  var ICONS = {
    instagram: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="17.5" cy="6.5" r="1.3" fill="currentColor"/></svg>',
    youtube: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M21.6 7.2a2.5 2.5 0 0 0-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4A2.5 2.5 0 0 0 2.4 7.2 26 26 0 0 0 2 12a26 26 0 0 0 .4 4.8 2.5 2.5 0 0 0 1.8 1.8C5.8 19 12 19 12 19s6.2 0 7.8-.4a2.5 2.5 0 0 0 1.8-1.8A26 26 0 0 0 22 12a26 26 0 0 0-.4-4.8ZM10 15V9l5.2 3L10 15Z"/></svg>',
    tiktok: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M16.6 5.8A4.3 4.3 0 0 1 15.5 3h-3.1v12.4a2.6 2.6 0 1 1-2.6-2.6c.3 0 .5 0 .8.1V9.7a5.8 5.8 0 1 0 5 5.7V9.1a7.4 7.4 0 0 0 4.3 1.4V7.4a4.3 4.3 0 0 1-3.3-1.6Z"/></svg>',
    apple: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M16.4 12.6c0-2.6 2.1-3.8 2.2-3.9-1.2-1.8-3.1-2-3.7-2-1.6-.2-3.1.9-3.9.9-.8 0-2-.9-3.4-.9-1.7 0-3.3 1-4.2 2.6-1.8 3.1-.5 7.7 1.3 10.2.9 1.2 1.9 2.6 3.2 2.6 1.3-.1 1.8-.8 3.3-.8 1.6 0 2 .8 3.4.8 1.4 0 2.3-1.3 3.1-2.5 1-1.4 1.4-2.8 1.4-2.9 0 0-2.7-1-2.7-4.1ZM13.9 5.1c.7-.9 1.2-2.1 1.1-3.3-1 0-2.3.7-3 1.6-.7.8-1.3 2-1.1 3.2 1.1.1 2.3-.6 3-1.5Z"/></svg>',
    play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#34A853" d="M3.6 2.3c-.3.3-.4.7-.4 1.2v17c0 .5.2.9.4 1.2l9.6-9.7-9.6-9.7Z"/><path fill="#FBBC04" d="m16.4 15.2-3.2-3.2 3.2-3.2 3.7 2.1c1 .6 1 1.6 0 2.2l-3.7 2.1Z"/><path fill="#EA4335" d="M16.4 15.2 13.2 12l-9.6 9.7c.4.4 1 .4 1.7 0l11.1-6.5Z"/><path fill="#4285F4" d="M16.4 8.8 5.3 2.3c-.7-.4-1.3-.4-1.7 0l9.6 9.7 3.2-3.2Z"/></svg>',
    gallery: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="1.5" y="1.5" width="21" height="21" rx="6" fill="#C8102E"/><path fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" d="M8 8.5a4 4 0 0 0 8 0"/></svg>',
    x: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M17.8 3h3.1l-6.8 7.8L22 21h-6.2l-4.9-6.4L5.3 21H2.2l7.3-8.3L2 3h6.4l4.4 5.8L17.8 3Zm-1.1 16.2h1.7L7.4 4.7H5.6l11.1 14.5Z"/></svg>'
  };
  // Alt bilgideki kayan şerit için örnek talepler
  var TICKER = [
    ["🏠", "3+1 kiralık daire", "Ataşehir", 6], ["🔧", "Kombi bakımı", "Kadıköy", 3], ["🚗", "Otomatik dizel otomobil", "Çankaya", 4],
    ["📱", "iPhone 15 128 GB", "Karşıyaka", 5], ["🚚", "Evden eve nakliyat", "Nilüfer", 9], ["🧊", "Çamaşır makinesi", "Muratpaşa", 7],
    ["🎨", "Boya badana 2+1", "Bornova", 8], ["🏗️", "Kiralık mini ekskavatör", "Gebze", 2], ["📘", "LGS matematik dersi", "Şahinbey", 8],
    ["🔑", "Satılık 3+1, okula yakın", "Bornova", 3], ["👶", "Yarı zamanlı bakıcı", "Ataşehir", 5], ["📸", "Düğün fotoğrafçısı", "Seyhan", 10]
  ];

  function renderFooter(el) {
    el.className = "footer";
    var vchips = VERTICALS.map(function (v) { return '<a href="' + talepUrl({ tip: v.id }) + '" style="--c:' + v.c + '"><i>' + v.emo + "</i>" + v.name + "</a>"; }).join("");
    var tick = TICKER.map(function (t) { return '<span class="tk"><i>' + t[0] + "</i><b>" + t[1] + "</b><em>" + t[2] + "</em><u>" + t[3] + " teklif</u></span>"; }).join("");
    el.innerHTML =
      // 1) Kayan canlı talep şeridi
      '<div class="ticker" aria-label="Örnek açık talepler"><div class="ticker-label"><i class="tk-dot"></i>Şu an açık</div>' +
      '<div class="ticker-track"><div class="ticker-move">' + tick + '</div><div class="ticker-move" aria-hidden="true">' + tick + "</div></div></div>" +

      '<div class="wrap">' +
      // 2) Büyük söz + hızlı başlat
      '<div class="footer-hero">' +
      '<div class="fh-copy"><span class="fh-kicker">Sen iste,</span><h2>onlar teklif<br><em>versin.</em></h2>' +
      "<p>Usta, daire, araç ya da telefon. Ne istediğini bir kez yaz; gerisini alıcam.net halletsin.</p></div>" +
      '<form class="fh-form" action="talep-olustur.html" method="get">' +
      '<label for="fhQ">Ne istiyorsun?</label>' +
      '<div class="fh-row"><input id="fhQ" name="hizmet" placeholder="Örn. 3+1 kiralık daire, kombi bakımı…" autocomplete="off" required>' +
      '<button class="btn btn-cta" type="submit">Teklif al →</button></div>' +
      '<div class="fh-chips">' + vchips + "</div></form></div>" +

      // 3) Linkler
      '<div class="footer-top">' +
      '<div class="footer-about"><a class="brand" href="index.html">' + LOGO_LIGHT + "<b>alıcam<span>.net</span></b></a>" +
      "<p>Talep tabanlı pazaryeri. İlan aramak yok; ihtiyacını yaz, teklifler sana gelsin.</p>" +
      '<div class="footer-social">' +
      '<a href="https://www.instagram.com/alicamnet" aria-label="Instagram" rel="noopener" target="_blank">' + ICONS.instagram + "</a>" +
      '<a href="https://www.youtube.com/@alicamnet" aria-label="YouTube" rel="noopener" target="_blank">' + ICONS.youtube + "</a>" +
      '<a href="https://www.tiktok.com/@alicamnet" aria-label="TikTok" rel="noopener" target="_blank">' + ICONS.tiktok + "</a>" +
      '<a href="https://x.com/alicamnet" aria-label="X" rel="noopener" target="_blank">' + ICONS.x + "</a></div></div>" +
      '<nav class="footer-col"><h4>Talep oluştur</h4><a href="' + talepUrl({ tip: "hizmet" }) + '">Usta ve hizmet</a><a href="' + talepUrl({ tip: "emlak", kategori: "Kiralık Daire" }) + '">Kiralık daire</a><a href="' + talepUrl({ tip: "emlak", kategori: "Satılık Daire" }) + '">Satılık daire</a><a href="' + talepUrl({ tip: "vasita" }) + '">Araç</a><a href="' + talepUrl({ tip: "alisveris" }) + '">Ürün ve elektronik</a></nav>' +
      '<nav class="footer-col"><h4>Teklif verenler</h4><a href="giris.html?kayit=veren">Teklif veren ol</a><a href="index.html#teklif-ver">Nasıl kazanırım?</a><a href="index.html#teklif-ver">Kontör paketleri</a><a href="index.html#son-talepler">Açık talepler</a></nav>' +
      '<nav class="footer-col"><h4>alıcam.net</h4><a href="index.html#nasil-calisir">Nasıl çalışır?</a><a href="index.html#guven">Neden alıcam.net?</a><a href="index.html#sss">Sık sorulanlar</a><a href="mailto:destek@alicam.net">Destek</a></nav>' +
      '<nav class="footer-col"><h4>Hesabın</h4><a href="giris.html">Giriş yap</a><a href="giris.html?kayit=alici">Ücretsiz üye ol</a><a href="talep-olustur.html">Talep oluştur</a></nav>' +
      "</div>" +
      // Uygulama şeridi: sade, çerçeveli mağaza rozetleri (gerçek mağaza bağlantıları henüz yok: data-soon)
      '<div class="footer-app">' +
      '<div class="fa-copy"><span class="fa-phone" aria-hidden="true">📱</span><div><strong>Talebin cebinde</strong><small>Yeni teklif gelince anında bildirim al, her yerden karşılaştır.</small></div></div>' +
      '<div class="footer-apps">' +
      '<a class="store" href="#" data-soon aria-label="App Store\'dan indirebilirsiniz">' + ICONS.apple + "<span><b>App Store'dan</b><small>İndirebilirsiniz</small></span></a>" +
      '<a class="store" href="#" data-soon aria-label="Google Play\'den indirebilirsiniz">' + ICONS.play + "<span><b>Google Play'den</b><small>İndirebilirsiniz</small></span></a>" +
      '<a class="store" href="#" data-soon aria-label="AppGallery\'den indirebilirsiniz">' + ICONS.gallery + "<span><b>AppGallery'den</b><small>İndirebilirsiniz</small></span></a>" +
      "</div></div>" +
      "</div>" +

      // 4) Dev imza yazısı
      '<div class="footer-mark" aria-hidden="true"><span>alıcam<em>.net</em></span></div>' +

      // 5) Alt çizgi
      '<div class="wrap footer-bottom"><span>© 2026 alıcam.net · Sen iste, onlar teklif versin.</span>' +
      '<nav><a href="kullanim-kosullari.html">Kullanım koşulları</a><a href="gizlilik.html">Gizlilik politikası</a><a href="mailto:destek@alicam.net">destek@alicam.net</a></nav>' +
      '<button class="to-top" type="button" aria-label="Sayfanın başına dön">↑</button></div>';

    // Dev yazı: fare nereye giderse ışık oraya
    var mark = $(".footer-mark", el);
    mark.addEventListener("pointermove", function (e) {
      var r = mark.getBoundingClientRect();
      mark.style.setProperty("--mx", ((e.clientX - r.left) / r.width * 100).toFixed(1) + "%");
      mark.style.setProperty("--my", ((e.clientY - r.top) / r.height * 100).toFixed(1) + "%");
      mark.classList.add("live");
    });
    mark.addEventListener("pointerleave", function () { mark.classList.remove("live"); });
    // Ekrana girince yazı alt çizgiden yükselsin
    if ("IntersectionObserver" in window && !reduceMotion) {
      mark.classList.add("rise");
      var mio = new IntersectionObserver(function (en) {
        if (en[0].isIntersecting) { mark.classList.add("up"); mio.disconnect(); }
      }, { threshold: .35 });
      mio.observe(mark);
    }
    $$("[data-soon]", el).forEach(function (a) {
      a.addEventListener("click", function (e) { e.preventDefault(); toast("alıcam.net uygulaması çok yakında mağazalarda!"); });
    });
    $(".to-top", el).addEventListener("click", function () { window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" }); });
    // Hızlı başlat formu: tür bilinmediği için hizmet olarak başlat, sihirbazda değiştirilebilir
    $(".fh-form", el).addEventListener("submit", function (e) {
      e.preventDefault();
      var v = $("#fhQ", el).value.trim();
      if (!v) return $("#fhQ", el).focus();
      var hit = null;
      if (v.length >= 3) Object.keys(CATS).some(function (k) { return CATS[k].some(function (c) { if (fold(c[1]).indexOf(fold(v)) > -1 || fold(v).indexOf(fold(c[1])) > -1) { hit = { tip: k, name: c[1] }; return true; } }); });
      window.location.href = hit ? talepUrl(hit.tip === "hizmet" ? { tip: "hizmet", hizmet: hit.name } : { tip: hit.tip, kategori: hit.name }) : talepUrl({ tip: "hizmet", hizmet: v });
    });
  }

  /* ================= Görünür olunca ================= */
  function reveal(selector) {
    var els = $$(selector);
    if (!("IntersectionObserver" in window) || reduceMotion) return;
    els.forEach(function (el) { el.classList.add("reveal"); });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        var el = en.target;
        el.classList.add("shown");
        setTimeout(function () { el.classList.remove("reveal", "shown"); }, 700);
        io.unobserve(el);
      });
    }, { threshold: .1, rootMargin: "0px 0px -30px 0px" });
    els.forEach(function (el) { io.observe(el); });
  }

  document.addEventListener("DOMContentLoaded", function () {
    $$("[data-site-header]").forEach(renderHeader);
    $$("[data-site-footer]").forEach(renderFooter);

    // Yasal sayfalarda içindekiler: okunan bölümü işaretle
    var toc = $(".toc");
    if (toc && "IntersectionObserver" in window) {
      var links = $$("a[href^='#']", toc);
      var spy = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (!en.isIntersecting) return;
          links.forEach(function (a) {
            var on = a.getAttribute("href") === "#" + en.target.id;
            a.classList.toggle("active", on);
            // Mobilde yatay içindekiler çubuğunda aktif bölümü görünür tut
            if (on && toc.scrollWidth > toc.clientWidth) toc.scrollTo({ left: a.offsetLeft - 16, behavior: reduceMotion ? "auto" : "smooth" });
          });
        });
      }, { rootMargin: "-20% 0px -70% 0px" });
      links.forEach(function (a) { var s = $(a.getAttribute("href")); if (s) spy.observe(s); });
    }
  });

  window.ALICAM = {
    VERTICALS: VERTICALS, HIZMET_AREAS: HIZMET_AREAS, CATS: CATS, ILLER: ILLER, MARKALAR: MARKALAR,
    findVertical: findVertical, $: $, $$: $$, esc: esc, fold: fold, fmt: fmt, talepUrl: talepUrl,
    toast: toast, reveal: reveal, reduceMotion: reduceMotion
  };
})();
