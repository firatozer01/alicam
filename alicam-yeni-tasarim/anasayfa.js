/* alıcam.net — Ana sayfa etkileşimleri */
document.addEventListener("DOMContentLoaded", function () {
  "use strict";
  var A = window.ALICAM, $ = A.$, $$ = A.$$, esc = A.esc, fold = A.fold;

  /* ================= ARAMA KARTI ================= */
  var YEARS = ["Farketmez"]; for (var y = 2026; y >= 2008; y--) YEARS.push(String(y));
  var IL_TOP = ["Tüm Türkiye", "İstanbul", "Ankara", "İzmir", "Bursa", "Antalya", "Kocaeli", "Konya", "Adana", "Gaziantep", "Mersin", "Kayseri", "Eskişehir", "Samsun", "Tekirdağ", "Muğla", "Diğer iller…"];

  var FINDER = {
    hizmet: { btn: "Teklif al", fields: [
      { id: "hizmet", label: "Ne lazım?", type: "text", ph: "Örn. kombi bakımı, ev temizliği, nakliyat", grow: true, suggest: true },
      { id: "il", label: "Nerede?", type: "select", opts: IL_TOP }
    ], popular: ["Kombi bakımı|Kombi, Doğalgaz ve Isıtma Sistemleri", "Boya badana|Boya, Badana ve Sıva", "Ev temizliği|Ev ve Daire Temizliği", "Evden eve nakliyat|Evden Eve Nakliyat", "Klima montajı|Klima ve Havalandırma"] },
    emlak: { btn: "Teklif al", fields: [
      { id: "islem", label: "Ne arıyorsun?", type: "seg", opts: ["Kiralık", "Satılık"] },
      { id: "kategori", label: "Emlak tipi", type: "select", opts: ["Daire", "Müstakil Ev ve Villa", "İşyeri ve Dükkan", "Ofis ve Büro", "Arsa ve Tarla", "Günlük Kiralık ve Yazlık"] },
      { id: "oda", label: "Oda sayısı", type: "select", opts: ["Farketmez", "1+0", "1+1", "2+1", "3+1", "4+1 ve üzeri"] },
      { id: "il", label: "Nerede?", type: "select", opts: IL_TOP },
      { id: "butce", label: "En fazla", type: "text", ph: "Örn. 25.000 ₺", num: true }
    ], popular: ["3+1 kiralık daire|Kiralık Daire", "Satılık 2+1|Satılık Daire", "Dükkan|İşyeri ve Dükkan", "Yazlık|Günlük Kiralık ve Yazlık"] },
    vasita: { btn: "Teklif al", fields: [
      { id: "kategori", label: "Araç tipi", type: "select", opts: ["Otomobil", "Arazi, SUV ve Pickup", "Motosiklet", "Minivan ve Panelvan", "Ticari Araç ve Kamyon", "Kiralık Araç"] },
      { id: "marka", label: "Marka", type: "select", opts: ["Farketmez"].concat(A.MARKALAR) },
      { id: "yil", label: "En az model yılı", type: "select", opts: YEARS },
      { id: "butce", label: "En fazla", type: "text", ph: "Örn. 1.200.000 ₺", num: true }
    ], popular: ["Otomatik vites otomobil|Otomobil", "SUV|Arazi, SUV ve Pickup", "Motosiklet|Motosiklet", "Kiralık araç|Kiralık Araç"] },
    alisveris: { btn: "Teklif al", fields: [
      { id: "urun", label: "Ne almak istiyorsun?", type: "text", ph: "Örn. iPhone 15, çamaşır makinesi, 3'lü koltuk", grow: true },
      { id: "durum", label: "Durumu", type: "select", opts: ["Farketmez", "Sıfır", "İkinci el"] },
      { id: "butce", label: "En fazla", type: "text", ph: "Örn. 30.000 ₺", num: true }
    ], popular: ["Cep telefonu|Cep Telefonu", "Laptop|Bilgisayar ve Tablet", "Buzdolabı|Beyaz Eşya", "Koltuk takımı|Mobilya ve Ev Dekorasyonu"] },
    makine: { btn: "Teklif al", fields: [
      { id: "urun", label: "Hangi makine?", type: "text", ph: "Örn. mini ekskavatör, forklift, traktör", grow: true },
      { id: "islem", label: "İşlem", type: "seg", opts: ["Kiralık", "Satılık"] },
      { id: "il", label: "Nerede?", type: "select", opts: IL_TOP }
    ], popular: ["Kiralık kepçe|Kiralık İş Makinesi", "Forklift|Forklift ve İstif Makinesi", "Traktör|Tarım Makineleri ve Traktör"] }
  };
  var FINDER_TABS = ["hizmet", "emlak", "vasita", "alisveris", "makine"];
  var tabsEl = $("#finderTabs"), fieldsEl = $("#finderFields"), formEl = $("#finderForm"), popEl = $("#heroPopular");
  var current = "hizmet";

  tabsEl.innerHTML = FINDER_TABS.map(function (id) {
    var v = A.findVertical(id);
    return '<button type="button" role="tab" id="ft-' + id + '" aria-selected="' + (id === current) + '" data-v="' + id + '"><i>' + v.emo + "</i>" + v.name + "</button>";
  }).join("");

  function renderFinder(id) {
    current = id;
    var cfg = FINDER[id];
    $$("button", tabsEl).forEach(function (b) { b.setAttribute("aria-selected", b.dataset.v === id); });
    fieldsEl.innerHTML = cfg.fields.map(function (f) {
      var fid = "f-" + id + "-" + f.id, inner;
      if (f.type === "select") inner = '<select id="' + fid + '" name="' + f.id + '">' + f.opts.map(function (o, i) { return '<option value="' + (i === 0 && /Farketmez|Tüm Türkiye/.test(o) ? "" : esc(o)) + '">' + esc(o) + "</option>"; }).join("") + "</select>";
      else if (f.type === "seg") inner = '<div class="seg-mini" role="group" aria-labelledby="' + fid + '-l">' + f.opts.map(function (o, i) { return '<button type="button" aria-pressed="' + (i === 0) + '" data-seg="' + f.id + '" value="' + esc(o) + '">' + esc(o) + "</button>"; }).join("") + '</div><input type="hidden" name="' + f.id + '" value="' + esc(f.opts[0]) + '">';
      else inner = '<input id="' + fid + '" name="' + f.id + '" type="text" placeholder="' + esc(f.ph) + '"' + (f.num ? ' inputmode="numeric"' : "") + (f.suggest ? ' role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="suggest"' : "") + ">" + (f.suggest ? '<ul class="suggest" id="suggest" role="listbox" hidden></ul>' : "");
      return '<div class="ff' + (f.grow ? " grow" : "") + '"><label for="' + fid + '" id="' + fid + '-l">' + esc(f.label) + "</label>" + inner + "</div>";
    }).join("");
    popEl.innerHTML = "<span>Sık istenenler:</span>" + cfg.popular.map(function (p) {
      var parts = p.split("|");
      var params = { tip: id }; params[id === "hizmet" ? "hizmet" : "kategori"] = parts[1];
      return '<a href="' + A.talepUrl(params) + '">' + esc(parts[0]) + "</a>";
    }).join("");
    if (id === "hizmet") bindSuggest();
  }

  tabsEl.addEventListener("click", function (e) { var b = e.target.closest("button"); if (b) renderFinder(b.dataset.v); });
  tabsEl.addEventListener("keydown", function (e) {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    var i = FINDER_TABS.indexOf(current) + (e.key === "ArrowRight" ? 1 : -1);
    i = (i + FINDER_TABS.length) % FINDER_TABS.length;
    renderFinder(FINDER_TABS[i]); $("#ft-" + FINDER_TABS[i]).focus();
  });
  fieldsEl.addEventListener("click", function (e) {
    var b = e.target.closest("[data-seg]");
    if (b) {
      $$('[data-seg="' + b.dataset.seg + '"]', fieldsEl).forEach(function (x) { x.setAttribute("aria-pressed", x === b); });
      $('input[name="' + b.dataset.seg + '"]', fieldsEl).value = b.value;
      return;
    }
    var ff = e.target.closest(".ff");
    if (ff && e.target === ff) { var inp = $("input:not([type=hidden]), select", ff); if (inp) inp.focus(); }
  });
  fieldsEl.addEventListener("input", function (e) {
    if (e.target.inputMode === "numeric") {
      var d = e.target.value.replace(/\D/g, "");
      e.target.value = d ? A.fmt(d) + " ₺" : "";
    }
  });
  formEl.addEventListener("submit", function (e) {
    e.preventDefault();
    var params = { tip: current };
    $$("input, select", fieldsEl).forEach(function (el) {
      var v = el.value.trim();
      if (el.inputMode === "numeric") v = v.replace(/\D/g, "");
      if (el.name === "il" && v === "Diğer iller…") v = "";
      if (v) params[el.name] = v;
    });
    if (current === "hizmet" && !params.hizmet) { var i = $("#f-hizmet-hizmet"); i.focus(); openSuggest(); return; }
    if (current === "emlak" && params.kategori === "Daire") params.kategori = params.islem === "Satılık" ? "Satılık Daire" : "Kiralık Daire";
    window.location.href = A.talepUrl(params);
  });

  /* Hizmet öneri listesi */
  var INDEX = A.CATS.hizmet.map(function (s) { return { name: s[1], emo: s[0], area: s[2], tip: "hizmet" }; });
  ["emlak", "vasita", "alisveris", "makine"].forEach(function (v) {
    A.CATS[v].forEach(function (s) { INDEX.push({ name: s[1], emo: s[0], area: A.findVertical(v).name, tip: v }); });
  });
  INDEX.forEach(function (x) { x.key = fold(x.name + " " + x.area); });
  var shown = [], active = -1, input, list;

  function openSuggest() {
    if (!input) return;
    var raw = input.value.trim(), v = fold(raw);
    if (!v) {
      shown = INDEX.filter(function (x) { return /Kombi|Ev ve Daire|Boya|Evden Eve|Klima|Özel Ders|Akademik/.test(x.name); }).slice(0, 6);
    } else {
      var words = v.split(/\s+/);
      shown = INDEX.filter(function (x) { return words.every(function (w) { return x.key.indexOf(w) > -1; }); }).slice(0, 8);
    }
    active = -1;
    var html = raw ? "" : '<li class="s-head">Popüler</li>';
    if (!shown.length) html = '<li class="s-head">Başlık bulunamadı — yine de “' + esc(raw) + '” için talep oluşturabilirsin</li>';
    var re = raw ? new RegExp("(" + raw.split(/\s+/).map(function (w) { return w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }).join("|") + ")", "gi") : null;
    html += shown.map(function (x, i) {
      var label = esc(x.name); if (re) label = label.replace(re, "<mark>$1</mark>");
      return '<li role="option" id="sg' + i + '" data-i="' + i + '" aria-selected="false"><span class="s-emo">' + x.emo + "</span><span>" + label + "</span><small>" + esc(x.area) + "</small></li>";
    }).join("");
    list.innerHTML = html; list.hidden = false; input.setAttribute("aria-expanded", "true");
  }
  function closeSuggest() { if (list) { list.hidden = true; input.setAttribute("aria-expanded", "false"); } }
  function pick(x) {
    var p = { tip: x.tip }; p[x.tip === "hizmet" ? "hizmet" : "kategori"] = x.name;
    var il = $("#f-hizmet-il"); if (il && il.value && il.value !== "Diğer iller…") p.il = il.value;
    window.location.href = A.talepUrl(p);
  }
  function bindSuggest() {
    input = $("#f-hizmet-hizmet"); list = $("#suggest");
    input.addEventListener("focus", openSuggest);
    input.addEventListener("input", openSuggest);
    input.addEventListener("keydown", function (e) {
      var items = $$("li[role=option]", list);
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault(); if (list.hidden) openSuggest();
        if (!items.length) return;
        active = (active + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
        items.forEach(function (li, k) { li.setAttribute("aria-selected", k === active); });
        input.setAttribute("aria-activedescendant", "sg" + active); items[active].scrollIntoView({ block: "nearest" });
      } else if (e.key === "Enter" && active > -1) { e.preventDefault(); pick(shown[active]); }
      else if (e.key === "Escape") closeSuggest();
    });
    list.addEventListener("mousedown", function (e) { var li = e.target.closest("li[data-i]"); if (li) { e.preventDefault(); pick(shown[+li.dataset.i]); } });
  }
  document.addEventListener("click", function (e) { if (!e.target.closest(".ff.grow")) closeSuggest(); });
  renderFinder("hizmet");

  /* ================= HERO: CANLI ÖRNEKLER ================= */
  var SAMPLES = [
    { v: "emlak", title: "3+1 kiralık daire, site içinde", loc: "Ataşehir, İstanbul", specs: ["3+1", "120 m²+", "Otoparklı", "Metroya yakın"], budget: "35.000 – 42.000 ₺ / ay",
      offers: [["EG", "#0E9F5A", "Ekin Gayrimenkul", "4,9", "Ataşehir · 3+1 · 125 m²", "39.500 ₺"], ["MY", "#1B5CFF", "Mavi Yapı Emlak", "4,7", "Kozyatağı · 3+1 · 130 m²", "41.000 ₺"], ["SK", "#7A5AF8", "Site sahibi", "5,0", "Ataşehir · 3+1 · 118 m²", "37.000 ₺"]] },
    { v: "vasita", title: "Otomatik vites dizel otomobil", loc: "Çankaya, Ankara", specs: ["2019 ve sonrası", "Dizel", "Otomatik", "150.000 km altı"], budget: "900.000 – 1.150.000 ₺",
      offers: [["AO", "#F2600C", "Anka Otomotiv", "4,8", "2020 · 98.000 km · Hasarsız", "1.090.000 ₺"], ["BG", "#0A1433", "Başkent Galeri", "4,6", "2019 · 121.000 km", "965.000 ₺"], ["SA", "#0EA5B7", "Sahibinden", "4,9", "2021 · 74.000 km", "1.140.000 ₺"]] },
    { v: "hizmet", title: "Kombi yıllık bakımı", loc: "Kadıköy, İstanbul", specs: ["Bu hafta", "Duvar tipi", "Hafta sonu olur"], budget: "1.500 – 2.500 ₺",
      offers: [["IT", "#1B5CFF", "Isı Teknik Servis", "4,9", "212 iş · 2 dk önce", "1.850 ₺"], ["KU", "#0EA5B7", "Kadıköy Usta", "4,8", "96 iş · 5 dk önce", "1.700 ₺"], ["DG", "#0E9F5A", "Doğalgaz Garaj", "5,0", "340 iş · 9 dk önce", "1.650 ₺"]] },
    { v: "alisveris", title: "iPhone 15 128 GB, garantili", loc: "Karşıyaka, İzmir", specs: ["Sıfır veya az kullanılmış", "Garantili", "Kargo olur"], budget: "38.000 – 45.000 ₺",
      offers: [["TM", "#7A5AF8", "Tekno Market", "4,8", "Sıfır · 2 yıl garanti", "44.500 ₺"], ["İK", "#F5A524", "İzmir Telekom", "4,6", "Yenilenmiş · 1 yıl garanti", "39.900 ₺"], ["SB", "#E8488A", "Bireysel satıcı", "4,9", "3 aylık · kutulu", "38.500 ₺"]] }
  ];
  var hvMain = $("#hvMain"), hvStack = $("#hvStack"), hvToast = $("#hvToast"), si = 0, timers = [];
  function clearTimers() { timers.forEach(clearTimeout); timers = []; }
  function showSample(s) {
    var v = A.findVertical(s.v);
    hvMain.classList.add("swap");
    timers.push(setTimeout(function () {
      hvMain.innerHTML =
        '<div class="hv-top"><span class="hv-type" style="--c:' + v.c + '">' + v.emo + " " + v.name + ' talebi</span><span class="hv-live"><i></i>Yayında</span></div>' +
        '<div class="hv-title">' + esc(s.title) + '</div><div class="hv-loc">📍 ' + esc(s.loc) + "</div>" +
        '<div class="hv-specs">' + s.specs.map(function (x) { return "<span>" + esc(x) + "</span>"; }).join("") + "</div>" +
        '<div class="hv-foot"><div class="hv-budget"><small>BÜTÇE</small><b>' + esc(s.budget) + '</b></div><div class="hv-count"><b id="hvN">0</b><small>teklif geldi</small></div></div>';
      hvMain.classList.remove("swap");
      hvStack.innerHTML = "";
      var cheapest = 0;
      s.offers.forEach(function (o, i) { if (parseInt(o[5].replace(/\D/g, ""), 10) < parseInt(s.offers[cheapest][5].replace(/\D/g, ""), 10)) cheapest = i; });
      s.offers.forEach(function (o, i) {
        timers.push(setTimeout(function () {
          var el = document.createElement("div");
          el.className = "offer" + (i === cheapest && i === s.offers.length - 1 ? " best" : "");
          el.innerHTML = '<span class="av" style="--c:' + o[1] + '">' + o[0] + '</span><div class="offer-b"><strong>' + esc(o[2]) + '</strong><small><span class="star">★</span> ' + o[3] + " · " + esc(o[4]) + "</small></div><b>" + o[5] + "</b>";
          hvStack.appendChild(el);
          var n = $("#hvN"); if (n) n.textContent = i + 1;
          hvToast.innerHTML = "<i>🔔</i> Yeni teklif: " + esc(o[2]) + " — " + o[5];
          hvToast.classList.add("show");
          timers.push(setTimeout(function () { hvToast.classList.remove("show"); }, 1600));
          if (i === s.offers.length - 1 && cheapest !== i) hvStack.children[cheapest].classList.add("best");
        }, 900 + i * 1400));
      });
    }, 300));
  }
  function loop() { clearTimers(); showSample(SAMPLES[si]); timers.push(setTimeout(function () { si = (si + 1) % SAMPLES.length; loop(); }, 7600)); }
  if (A.reduceMotion) {
    showSample(SAMPLES[0]);
  } else {
    loop();
    document.addEventListener("visibilitychange", function () { if (document.hidden) clearTimers(); else loop(); });
  }

  /* ================= DİKEY KARTLARI ================= */
  $("#verticals").innerHTML = A.VERTICALS.map(function (v) {
    return '<a class="vcard" style="--c:' + v.c + '" href="' + A.talepUrl({ tip: v.id }) + '"><span class="v-ico">' + v.emo + "</span><strong>" + v.name + "</strong><small>" + v.desc + '</small><span class="v-go">Talep oluştur →</span></a>';
  }).join("");

  /* ================= SON TALEPLER ================= */
  var FEED = [
    ["emlak", "2+1 kiralık daire, eşyalı", "Beşiktaş, İstanbul", ["2+1", "Eşyalı", "Asansörlü"], "28.000 – 34.000 ₺/ay", 6, "4 dk"],
    ["hizmet", "Evden eve nakliyat, 3+1", "Nilüfer, Bursa", ["Asansörlü", "Paketleme dahil", "15 Ekim"], "12.000 – 18.000 ₺", 9, "11 dk"],
    ["vasita", "Aile için 7 kişilik araç", "Selçuklu, Konya", ["2017+", "Dizel", "Otomatik"], "750.000 – 950.000 ₺", 4, "18 dk"],
    ["alisveris", "Çamaşır makinesi, 9 kg", "Muratpaşa, Antalya", ["Sıfır", "A enerji", "Montaj dahil"], "15.000 – 20.000 ₺", 7, "22 dk"],
    ["hizmet", "Banyo komple yenileme", "Çankaya, Ankara", ["6 m²", "Seramik + vitrifiye", "Ekim içinde"], "80.000 – 120.000 ₺", 5, "35 dk"],
    ["emlak", "Satılık 3+1, okula yakın", "Bornova, İzmir", ["3+1", "Krediye uygun", "10 yaş altı"], "4,5 – 5,5 milyon ₺", 3, "41 dk"],
    ["makine", "Kiralık mini ekskavatör, 3 gün", "Gebze, Kocaeli", ["1,5 – 3 ton", "Operatörlü", "Hafta içi"], "Günlük 6.000 ₺'ye kadar", 2, "1 sa"],
    ["hizmet", "LGS matematik özel ders", "Şahinbey, Gaziantep", ["Haftada 2 gün", "Yüz yüze"], "Ders başı 800 – 1.200 ₺", 8, "1 sa"],
    ["alisveris", "Oyun bilgisayarı, RTX 4070", "Kadıköy, İstanbul", ["Hazır sistem", "32 GB RAM", "Faturalı"], "55.000 – 70.000 ₺", 6, "2 sa"],
    ["vasita", "Kiralık araç, 1 hafta", "Dalaman, Muğla", ["Havalimanı teslim", "Otomatik", "Kasko dahil"], "Günlük 1.500 ₺'ye kadar", 11, "2 sa"],
    ["eleman", "Yarı zamanlı çocuk bakıcısı", "Ataşehir, İstanbul", ["Hafta içi 14–19", "Referanslı"], "Aylık 22.000 ₺'ye kadar", 5, "3 sa"],
    ["hizmet", "Düğün fotoğraf + video çekimi", "Seyhan, Adana", ["Kasım", "Drone çekimi", "Albüm"], "25.000 – 40.000 ₺", 10, "3 sa"],
    ["emlak", "Kiralık dükkan, cadde üzeri", "Tepebaşı, Eskişehir", ["80 m²+", "Vitrinli", "Depolu"], "25.000 ₺/ay'a kadar", 4, "3 sa"],
    ["vasita", "Motosiklet, 250 cc", "Konak, İzmir", ["2020+", "Az kullanılmış", "Kasklı"], "150.000 – 200.000 ₺", 6, "4 sa"],
    ["alisveris", "3'lü + 2'li koltuk takımı", "Keçiören, Ankara", ["Sıfır", "Gri tonları", "Teslimat dahil"], "30.000 – 45.000 ₺", 9, "4 sa"],
    ["hayvan", "British Shorthair yavru", "Kartal, İstanbul", ["Aşıları tam", "Sağlık karnesi"], "15.000 ₺'ye kadar", 3, "5 sa"],
    ["emlak", "Yazlık, Ağustos 2 hafta", "Bodrum, Muğla", ["Denize yakın", "3+1", "Havuzlu"], "Haftalık 40.000 ₺'ye kadar", 7, "5 sa"],
    ["vasita", "Hafif ticari, panelvan", "Osmangazi, Bursa", ["2019+", "Dizel", "Faturalı"], "700.000 – 850.000 ₺", 5, "6 sa"],
    ["alisveris", "Laptop, yazılım için", "Maltepe, İstanbul", ["16 GB RAM", "SSD", "Garantili"], "35.000 – 50.000 ₺", 8, "6 sa"],
    ["eleman", "Hafta sonu garson", "Muratpaşa, Antalya", ["Cumartesi–Pazar", "Deneyimli"], "Günlük 1.500 ₺'ye kadar", 4, "7 sa"]
  ];
  var feedEl = $("#feed"), filterEl = $("#feedFilter"), feedV = "all";
  var FILTERS = [["all", "Tümü"], ["hizmet", "🛠️ Hizmet"], ["emlak", "🏠 Emlak"], ["vasita", "🚗 Vasıta"], ["alisveris", "🛍️ Alışveriş"], ["diger", "Diğer"]];
  filterEl.innerHTML = FILTERS.map(function (f) { return '<button type="button" class="chip" aria-pressed="' + (f[0] === "all") + '" data-f="' + f[0] + '">' + f[1] + "</button>"; }).join("");
  // Kaç sütun varsa ona göre tam satırlar göster: yarım satır kalmasın (en fazla 2 satır)
  function feedCols() { return getComputedStyle(feedEl).gridTemplateColumns.split(" ").length || 1; }
  var lastCols = 0;
  function renderFeed() {
    var cols = lastCols = feedCols();
    var list = FEED.filter(function (r) { return feedV === "all" || r[0] === feedV || (feedV === "diger" && ["makine", "eleman", "hayvan"].indexOf(r[0]) > -1); });
    var rows = Math.min(cols === 1 ? 4 : 2, Math.max(1, Math.floor(list.length / cols)));
    list = list.slice(0, Math.min(list.length, rows * cols));
    feedEl.innerHTML = list.map(function (r, i) {
      var v = A.findVertical(r[0]);
      return '<article class="rq"><div class="rq-top"><span class="hv-type" style="--c:' + v.c + '">' + v.emo + " " + v.name + '</span><span class="rq-time">' + r[6] + " önce</span></div>" +
        "<h3>" + esc(r[1]) + '</h3><div class="rq-loc">📍 ' + esc(r[2]) + "</div>" +
        '<div class="rq-specs">' + r[3].map(function (s) { return "<span>" + esc(s) + "</span>"; }).join("") + "</div>" +
        '<div class="rq-foot"><a class="rq-cta" style="--d:' + (i * .35).toFixed(2) + 's" href="giris.html?kayit=veren" aria-label="' + esc(r[1]) + ' talebine hemen teklif ver"><i aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M13.5 2 4 14h6.5L9.5 22 20 9.5h-6.8L13.5 2Z"/></svg></i>Hemen teklif ver<span aria-hidden="true">→</span></a>' +
        '<span class="rq-offers' + (r[5] >= 8 ? " hot" : "") + '">' + r[5] + " teklif</span></div></article>";
    }).join("");
  }
  filterEl.addEventListener("click", function (e) {
    var b = e.target.closest("[data-f]"); if (!b) return;
    feedV = b.dataset.f;
    $$("[data-f]", filterEl).forEach(function (x) { x.setAttribute("aria-pressed", x === b); });
    renderFeed();
  });
  renderFeed();
  window.addEventListener("resize", function () { if (feedCols() !== lastCols) renderFeed(); });

  /* ================= KATEGORİLER ================= */
  var catTabs = $("#catTabs"), catPanel = $("#catPanel"), catV = "hizmet";
  catTabs.innerHTML = A.VERTICALS.map(function (v) {
    return '<button type="button" role="tab" aria-selected="' + (v.id === catV) + '" data-v="' + v.id + '">' + v.emo + " " + v.name + " <small>" + (v.id === "hizmet" ? v.count : A.CATS[v.id].length) + "</small></button>";
  }).join("");
  function renderCats(id) {
    catV = id;
    var v = A.findVertical(id);
    $$("button", catTabs).forEach(function (b) { b.setAttribute("aria-selected", b.dataset.v === id); });
    var html;
    if (id === "hizmet") {
      // Her alanda aynı sayıda (6) alt başlık: kutular eşit boyda kalsın
      html = '<div class="areas">' + A.HIZMET_AREAS.map(function (a) {
        return '<div class="area">' +
          '<div class="area-head"><i>' + a.emo + "</i><h3>" + esc(a.name) + "</h3></div>" +
          "<ul>" + a.subs.slice(0, 6).map(function (s) {
            return '<li><a href="' + A.talepUrl({ tip: "hizmet", hizmet: s[1] }) + '" title="' + esc(s[1]) + '"><i>' + s[0] + "</i><span>" + esc(s[1]) + "</span><b>›</b></a></li>";
          }).join("") + "</ul>" +
          '<a class="area-all" href="' + A.talepUrl({ tip: "hizmet", alan: a.name }) + '">Tüm ' + a.n + ' başlığı gör <span>→</span></a></div>';
      }).join("") +
      // 11: serbest talep kartı
      '<form class="area area-free" action="talep-olustur.html">' +
        '<div class="area-head"><i>✍️</i><h3>Aradığın başlık yok mu?</h3></div>' +
        "<p>Listede olmasa da olur. Ne lazım olduğunu kendi cümlelerinle yaz, uygun ustalar sana teklif versin.</p>" +
        '<input type="hidden" name="tip" value="hizmet"><label class="af-input"><span class="sr">Ne lazım?</span><input name="hizmet" placeholder="Örn. akıllı ev kurulumu" required></label>' +
        '<button class="btn btn-cta" type="submit">Talep oluştur →</button></form>' +
      // 12: bu hafta en çok istenenler (eski sitedeki talep sayıları)
      '<div class="area area-top"><div class="area-head"><i>🔥</i><h3>Bu hafta en çok istenenler</h3></div><ol>' +
        [["Kombi, Doğalgaz ve Isıtma Sistemleri", 273], ["Boya, Badana ve Sıva", 170], ["Cilt Bakımı, Makyaj ve Epilasyon", 157], ["İç Mimari, Proje ve Mühendislik", 114], ["Su Tesisatı, Sıhhi Tesisat ve Su Arıtma", 87]].map(function (t, k) {
          return '<li><a href="' + A.talepUrl({ tip: "hizmet", hizmet: t[0] }) + '"><b>' + (k + 1) + "</b><span>" + esc(t[0]) + "</span><small>" + t[1] + " talep</small></a></li>";
        }).join("") + "</ol></div>" +
      "</div>";
    } else {
      // Sütun sayısını öğe sayısını bölecek şekilde seç: yarım satır kalmasın
      var n = A.CATS[id].length;
      html = '<div class="tiles" style="--tc:' + tileCols(n) + '">' + A.CATS[id].map(function (c) {
        return '<a class="tile" style="--c:' + v.c + '" href="' + A.talepUrl({ tip: id, kategori: c[1] }) + '" title="' + esc(c[1]) + '"><i>' + c[0] + "</i><span>" + esc(c[1]) + "</span><b>→</b></a>";
      }).join("") + "</div>";
    }
    html += '<div class="panel-cta"><p>' + v.emo + " " + v.name + " için talebini yaz, " + v.who + " sana teklif versin.<small>Ücretsiz, 2 dakika sürer. İletişim bilgilerin gizli kalır.</small></p>" +
      '<a class="btn btn-cta" href="' + A.talepUrl({ tip: id }) + '">＋ ' + v.name + " talebi oluştur</a></div>";
    catPanel.innerHTML = html;
    catPanel.style.animation = "none"; void catPanel.offsetWidth; catPanel.style.animation = "";
  }
  function tileMax() { var w = catPanel.clientWidth || window.innerWidth; return w >= 1180 ? 5 : w >= 760 ? 4 : w >= 480 ? 2 : 1; }
  function tileCols(n) {
    var max = tileMax();
    if (max <= 2) return max;
    for (var c = max; c >= 2; c--) if (n % c === 0) return c;
    return max; // bölünemiyorsa son satır esneyerek satırı doldurur (flex-grow)
  }
  catTabs.addEventListener("click", function (e) { var b = e.target.closest("button"); if (b) renderCats(b.dataset.v); });
  // Telefonda alan kutuları akordeon gibi açılıp kapanır
  var phone = window.matchMedia("(max-width: 600px)");
  catPanel.addEventListener("click", function (e) {
    var head = e.target.closest(".area-head");
    if (!head || !phone.matches) return;
    var area = head.parentElement;
    if (area.classList.contains("area-free") || area.classList.contains("area-top")) return;
    var open = !area.classList.contains("open");
    $$(".area.open", catPanel).forEach(function (x) { x.classList.remove("open"); x.querySelector(".area-head").setAttribute("aria-expanded", "false"); });
    area.classList.toggle("open", open);
    head.setAttribute("aria-expanded", String(open));
    if (open) area.scrollIntoView({ behavior: A.reduceMotion ? "auto" : "smooth", block: "nearest" });
  });
  function areaA11y() {
    $$(".area:not(.area-free):not(.area-top) .area-head", catPanel).forEach(function (h) {
      if (phone.matches) { h.setAttribute("role", "button"); h.tabIndex = 0; h.setAttribute("aria-expanded", String(h.parentElement.classList.contains("open"))); }
      else { h.removeAttribute("role"); h.removeAttribute("tabindex"); h.removeAttribute("aria-expanded"); }
    });
  }
  if (phone.addEventListener) phone.addEventListener("change", areaA11y);
  new MutationObserver(areaA11y).observe(catPanel, { childList: true });
  areaA11y();
  catPanel.addEventListener("keydown", function (e) {
    if ((e.key === "Enter" || e.key === " ") && e.target.classList.contains("area-head")) { e.preventDefault(); e.target.click(); }
  });
  renderCats("hizmet");
  var lastTileMax = tileMax();
  window.addEventListener("resize", function () { var m = tileMax(); if (m !== lastTileMax) { lastTileMax = m; if (catV !== "hizmet") renderCats(catV); } });

  window.ALICAM_SELECT_VERTICAL = function (id) {
    renderCats(id);
    if (FINDER[id]) renderFinder(id);
  };
  try {
    var pre = sessionStorage.getItem("alicam-v");
    if (pre) { sessionStorage.removeItem("alicam-v"); window.ALICAM_SELECT_VERTICAL(pre); }
  } catch (_) {}

  /* ================= TEKLİF VERENLER ================= */
  var WHO = {
    usta: "Örnek: Kadıköy'de <b>kombi bakımı</b> isteyen biri bütçesini ve zamanını yazdı. Sen sadece teklifini gönder.",
    emlak: "Örnek: Ataşehir'de <b>3+1 kiralık daire</b> arayan bir aile, 42.000 ₺ bütçeyle portföyündeki uygun daireyi bekliyor.",
    galeri: "Örnek: Ankara'da <b>otomatik dizel otomobil</b> arayan bir alıcı 1,15 milyon ₺'ye kadar teklif bekliyor.",
    magaza: "Örnek: İzmir'de <b>çamaşır makinesi</b> almak isteyen biri, montaj dahil en iyi fiyatı arıyor."
  };
  var whoEl = $("#proWho"), exEl = $("#proExample");
  function setWho(k) {
    $$("button", whoEl).forEach(function (b) { b.setAttribute("aria-selected", b.dataset.who === k); });
    exEl.innerHTML = WHO[k];
  }
  whoEl.addEventListener("click", function (e) { var b = e.target.closest("button"); if (b) setWho(b.dataset.who); });
  setWho("usta");

  /* ================= SSS: aynı anda tek soru açık ================= */
  // <details name="sss"> yeni tarayıcılarda bunu kendisi yapar; eski tarayıcılar için yedek
  var faqItems = $$(".faq details");
  faqItems.forEach(function (d) {
    d.addEventListener("toggle", function () {
      if (d.open) faqItems.forEach(function (o) { if (o !== d && o.open) o.open = false; });
    });
  });

  /* SSS arama: yazdıkça soruları süz, eşleşeni vurgula */
  var faqQ = $("#faqQ"), faqCount = $("#faqCount"), faqEmpty = $("#faqEmpty"), topicBtns = $$(".faq-topics button");
  faqItems.forEach(function (d) {
    var s = $("summary", d); s.dataset.text = s.textContent;
    d.dataset.key = fold(s.textContent + " " + $("p", d).textContent);
  });
  function setCount(n) { faqCount.textContent = n + " soru"; }
  function filterFaq(raw) {
    var words = fold(raw.trim()).split(/\s+/).filter(Boolean), shown = 0, first = null;
    var re = words.length ? new RegExp("(" + raw.trim().split(/\s+/).map(function (w) { return w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }).join("|") + ")", "gi") : null;
    faqItems.forEach(function (d) {
      var hit = words.every(function (w) { return d.dataset.key.indexOf(w) > -1; });
      d.classList.toggle("dim", !hit);
      var s = $("summary", d);
      s.innerHTML = re && hit ? esc(s.dataset.text).replace(re, "<mark>$1</mark>") : esc(s.dataset.text);
      if (hit) { shown++; if (!first) first = d; }
    });
    faqEmpty.hidden = shown > 0;
    setCount(shown);
    if (words.length && first && !first.open) first.open = true;
  }
  faqQ.addEventListener("input", function () {
    topicBtns.forEach(function (b) { b.setAttribute("aria-pressed", "false"); });
    filterFaq(faqQ.value);
  });
  setCount(faqItems.length);

  /* Destek kartındaki sohbet, ekrana gelince oynasın */
  var help = $(".faq-help");
  if ("IntersectionObserver" in window && !A.reduceMotion) {
    var hio = new IntersectionObserver(function (en) { if (en[0].isIntersecting) { help.classList.add("go"); hio.disconnect(); } }, { threshold: .4 });
    hio.observe(help);
  } else help.classList.add("go");

  /* Konu kartları: ilgili soruları öne çıkar, ilkini aç */
  topicBtns.forEach(function (b) {
    b.setAttribute("aria-pressed", "false");
    b.addEventListener("click", function () {
      var on = b.getAttribute("aria-pressed") !== "true";
      topicBtns.forEach(function (x) { x.setAttribute("aria-pressed", String(x === b && on)); });
      faqQ.value = "";
      var shown = 0, first = null;
      faqItems.forEach(function (d) {
        var hit = !on || d.dataset.topic.split(" ").indexOf(b.dataset.topic) > -1;
        d.classList.toggle("dim", !hit);
        $("summary", d).textContent = $("summary", d).dataset.text;
        if (hit) { shown++; if (!first) first = d; }
      });
      faqEmpty.hidden = true;
      setCount(shown);
      if (on && first) {
        first.open = true;
        if (window.innerWidth < 1180) first.scrollIntoView({ behavior: A.reduceMotion ? "auto" : "smooth", block: "center" });
      }
    });
  });

  /* ================= MOBİL CTA + GÖRÜNÜRLÜK ================= */
  var mcta = $("#mobileCta"), finder = $("#finder");
  function onScroll() { mcta.classList.toggle("show", finder.getBoundingClientRect().bottom < 0); }
  window.addEventListener("scroll", onScroll, { passive: true }); onScroll();

  /* Neden alıcam.net: bento görünür olunca animasyonları başlat */
  var bento = $("#bento");
  if ("IntersectionObserver" in window && !A.reduceMotion) {
    bento.classList.add("anim");
    var bio = new IntersectionObserver(function (en) { if (en[0].isIntersecting) { bento.classList.add("play"); bio.disconnect(); } }, { threshold: .12 });
    bio.observe(bento);
  } else bento.classList.add("play");

  A.reveal(".vcard, .rq, .how-col, .bx, .kontor, .faq details, .final-in, .trust-row li");
});
