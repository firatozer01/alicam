/* alıcam.net — Talep oluşturma sihirbazı */
document.addEventListener("DOMContentLoaded", function () {
  "use strict";
  var A = window.ALICAM, $ = A.$, $$ = A.$$, esc = A.esc, fold = A.fold;
  var DRAFT_KEY = "alicam-talep-taslak";

  /* ---------- Her türe özel sorular ---------- */
  var YEARS = []; for (var y = 2026; y >= 2000; y--) YEARS.push(String(y));
  var SCHEMA = {
    hizmet: [
      { id: "nerede", label: "Hizmet nerede verilecek?", type: "chips", opts: ["Evimde", "İşyerimde", "Online / uzaktan", "Hizmet verenin yerinde"], full: true },
      { id: "mekan", label: "Mekân tipi", type: "select", opts: ["Seçiniz", "Daire", "Müstakil ev / villa", "Ofis / işyeri", "Diğer"] },
      { id: "kisi", label: "Kaç kişi / oda / adet?", type: "text", ph: "Örn. 3+1 daire, 2 kişi" }
    ],
    emlak: [
      { id: "islem", label: "İşlem", type: "seg", opts: ["Kiralık", "Satılık"], full: true },
      { id: "oda", label: "Oda sayısı", type: "multi", opts: ["1+0", "1+1", "2+1", "3+1", "4+1", "5+1 ve üzeri"], full: true },
      { id: "m2", label: "En az metrekare", type: "text", ph: "Örn. 100", unit: "m²", num: true },
      { id: "yas", label: "Bina yaşı", type: "select", opts: ["Farketmez", "0 (yeni)", "5 yıla kadar", "10 yıla kadar", "20 yıla kadar"] },
      { id: "esya", label: "Eşya durumu", type: "chips", opts: ["Farketmez", "Eşyalı", "Eşyasız"] },
      { id: "tasinma", label: "Ne zaman taşınmak istiyorsun?", type: "select", opts: ["Esnek", "Hemen", "1 ay içinde", "2-3 ay içinde"] },
      { id: "ozellik", label: "Olmazsa olmazların", type: "multi", opts: ["Otopark", "Asansör", "Balkon", "Site içinde", "Doğalgaz", "Krediye uygun", "Toplu taşımaya yakın", "Evcil hayvan olur"], full: true }
    ],
    vasita: [
      { id: "marka", label: "Marka", type: "select", opts: ["Farketmez"].concat(A.MARKALAR) },
      { id: "model", label: "Model / seri", type: "text", ph: "Örn. Egea, Corolla, 3 Serisi" },
      { id: "yilmin", label: "En az model yılı", type: "select", opts: ["Farketmez"].concat(YEARS) },
      { id: "km", label: "En fazla kilometre", type: "select", opts: ["Farketmez", "50.000 km", "100.000 km", "150.000 km", "200.000 km"] },
      { id: "yakit", label: "Yakıt", type: "multi", opts: ["Benzin", "Dizel", "LPG", "Hibrit", "Elektrik"], full: true },
      { id: "vites", label: "Vites", type: "chips", opts: ["Farketmez", "Otomatik", "Manuel"] },
      { id: "hasar", label: "Hasar durumu", type: "chips", opts: ["Önemli değil", "Hasarsız", "Değişensiz"] },
      { id: "takas", label: "Takas", type: "chips", opts: ["Takas yok", "Takaslı olur"] }
    ],
    alisveris: [
      { id: "urun", label: "Ürün", type: "text", ph: "Örn. iPhone 15 128 GB", full: true },
      { id: "durum", label: "Durumu", type: "chips", opts: ["Farketmez", "Sıfır", "İkinci el", "Yenilenmiş"] },
      { id: "garanti", label: "Garanti / fatura", type: "chips", opts: ["Farketmez", "Garantili olsun", "Faturalı olsun"] },
      { id: "teslim", label: "Teslimat", type: "multi", opts: ["Kargo", "Elden teslim", "Mağazadan alırım", "Kurulum / montaj dahil"], full: true }
    ],
    makine: [
      { id: "urun", label: "Makine", type: "text", ph: "Örn. mini ekskavatör 3 ton", full: true },
      { id: "islem", label: "İşlem", type: "seg", opts: ["Kiralık", "Satılık"] },
      { id: "sure", label: "Kiralama süresi", type: "select", opts: ["Seçiniz", "1 gün", "1 hafta", "1 ay", "Uzun dönem"] },
      { id: "operator", label: "Operatör", type: "chips", opts: ["Operatörlü", "Operatörsüz", "Farketmez"] }
    ],
    eleman: [
      { id: "calisma", label: "Çalışma şekli", type: "chips", opts: ["Tam zamanlı", "Yarı zamanlı", "Yatılı", "Günlük"], full: true },
      { id: "baslangic", label: "Başlangıç", type: "select", opts: ["Hemen", "1 hafta içinde", "1 ay içinde", "Esnek"] },
      { id: "deneyim", label: "Deneyim", type: "chips", opts: ["Farketmez", "1 yıl +", "3 yıl +", "Referanslı"] }
    ],
    hayvan: [
      { id: "cins", label: "Cins", type: "text", ph: "Örn. British Shorthair, Golden Retriever" },
      { id: "yas2", label: "Yaş", type: "chips", opts: ["Yavru", "Genç", "Yetişkin", "Farketmez"] },
      { id: "sekil", label: "Nasıl?", type: "chips", opts: ["Satın alma", "Sahiplenme"], full: true }
    ]
  };
  var DESC_PH = {
    hizmet: "Örn. Kombim 4 yaşında, yıllık bakımı yapılacak. Hafta sonu da olur. Petek temizliği için de fiyat almak isterim.",
    emlak: "Örn. 2 kişilik aileyiz, evcil hayvanımız var. Okula ve metroya yakın, güneş alan bir daire arıyoruz.",
    vasita: "Örn. Aile aracı olarak kullanacağım. Ekspertiz raporu olsun, tramer kaydı düşük olsun.",
    alisveris: "Örn. Kutusu ve faturası olsun. İstanbul içi elden teslim tercihim, kargo da olur.",
    makine: "Örn. Bahçe kazısı için 3 günlük lazım. Nakliye dahil fiyat istiyorum.",
    eleman: "Örn. 2 yaşında kızım için hafta içi 14–19 arası bakıcı arıyorum.",
    hayvan: "Örn. Aşıları tam, sağlık karnesi olan bir yavru arıyorum."
  };
  var QUICK_BUDGET = {
    hizmet: [["1.000 ₺'ye kadar", 0, 1000], ["1.000 – 5.000 ₺", 1000, 5000], ["5.000 – 20.000 ₺", 5000, 20000], ["20.000 ₺ +", 20000, ""]],
    emlak_kiralik: [["20.000 ₺'ye kadar", 0, 20000], ["20 – 35 bin ₺", 20000, 35000], ["35 – 50 bin ₺", 35000, 50000], ["50.000 ₺ +", 50000, ""]],
    emlak_satilik: [["3 milyona kadar", 0, 3000000], ["3 – 5 milyon ₺", 3000000, 5000000], ["5 – 10 milyon ₺", 5000000, 10000000], ["10 milyon ₺ +", 10000000, ""]],
    vasita: [["750 bine kadar", 0, 750000], ["750 bin – 1,2 milyon", 750000, 1200000], ["1,2 – 2 milyon ₺", 1200000, 2000000], ["2 milyon ₺ +", 2000000, ""]],
    alisveris: [["5.000 ₺'ye kadar", 0, 5000], ["5 – 20 bin ₺", 5000, 20000], ["20 – 50 bin ₺", 20000, 50000], ["50.000 ₺ +", 50000, ""]]
  };

  /* ---------- Durum ---------- */
  var S = { step: 1, tip: "", kategori: "", alan: "", d: {}, title: "", titleAuto: true, desc: "", il: "", ilce: "", bmin: "", bmax: "", esnek: false, zaman: "Esnek", ad: "", tel: "", mail: "", pref: ["Uygulama içi mesaj"], ok: false };

  var form = $("#wizard"), steps = $$(".step", form), nextBtn = $("#next"), backBtn = $("#back");
  var vpick = $("#vpick"), catpick = $("#catpick"), catlist = $("#catlist"), catSearch = $("#catSearch");
  var dyn = $("#dynFields"), preview = $("#preview"), draftEl = $("#draft");

  /* ---------- Adım 1: tür ---------- */
  vpick.innerHTML = A.VERTICALS.map(function (v) {
    return '<label class="vopt" style="--c:' + v.c + '"><input type="radio" name="tip" value="' + v.id + '"><i>' + v.emo + "</i><strong>" + v.name + "</strong><small>" + v.desc + "</small></label>";
  }).join("");
  vpick.addEventListener("change", function (e) {
    if (e.target.name !== "tip") return;
    if (S.tip !== e.target.value) { S.kategori = ""; S.alan = ""; S.d = {}; }
    S.tip = e.target.value;
    catSearch.value = "";
    renderCats(); save(); renderPreview();
    catpick.hidden = false;
    $("#err1").hidden = true;
    if (window.innerWidth < 860) setTimeout(function () { catpick.scrollIntoView({ behavior: A.reduceMotion ? "auto" : "smooth", block: "start" }); }, 60);
  });

  function renderCats() {
    var v = A.findVertical(S.tip), q = fold(catSearch.value.trim());
    $("#catTitle").textContent = v.emo + " " + v.name + ": hangi başlık?";
    catSearch.placeholder = S.tip === "hizmet" ? "Ara… örn. kombi, boya, nakliyat" : "Başlıklarda ara…";
    var items = A.CATS[S.tip].filter(function (c) { return !q || fold(c[1] + " " + (c[2] || "")).indexOf(q) > -1; });
    var html = "", lastGroup = "";
    items.forEach(function (c) {
      if (S.tip === "hizmet" && !q && c[2] !== lastGroup) { lastGroup = c[2]; html += '<div class="cgroup">' + esc(c[2]) + "</div>"; }
      html += '<label class="copt"><input type="radio" name="kategori" value="' + esc(c[1]) + '"' + (S.kategori === c[1] ? " checked" : "") + (c[2] ? ' data-alan="' + esc(c[2]) + '"' : "") + "><i>" + c[0] + "</i>" + esc(c[1]) + "</label>";
    });
    if (!items.length) html = '<div class="cat-empty">“' + esc(catSearch.value) + '” için başlık bulamadık.</div>';
    // Listede olmayan serbest başlık
    var free = catSearch.value.trim();
    if (free && !items.some(function (c) { return fold(c[1]) === fold(free); }))
      html += '<label class="copt copt-free"><input type="radio" name="kategori" value="' + esc(free) + '"' + (S.kategori === free ? " checked" : "") + "><i>✍️</i>“" + esc(free) + "” olarak devam et</label>";
    catlist.innerHTML = html;
  }
  catSearch.addEventListener("input", renderCats);
  catSearch.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); var f = $("input", catlist); if (f) { f.checked = true; f.dispatchEvent(new Event("change", { bubbles: true })); } } });
  catlist.addEventListener("change", function (e) {
    if (e.target.name !== "kategori") return;
    S.kategori = e.target.value; S.alan = e.target.dataset.alan || "";
    $("#err1").hidden = true;
    applyCategoryDefaults();
    save(); renderPreview();
  });
  function applyCategoryDefaults() {
    if (S.tip === "emlak") {
      if (/Satılık/.test(S.kategori)) S.d.islem = "Satılık";
      else if (/Kiralık/.test(S.kategori)) S.d.islem = "Kiralık";
    }
    if (S.tip === "makine") S.d.islem = /Satılık/.test(S.kategori) ? "Satılık" : "Kiralık";
  }

  /* ---------- Adım 2: dinamik alanlar ---------- */
  function renderDyn() {
    var sch = SCHEMA[S.tip] || [];
    $("#s2title").textContent = A.findVertical(S.tip).emo + " " + S.kategori + " — biraz detay ver";
    dyn.innerHTML = sch.map(function (f) {
      var val = S.d[f.id], name = "d_" + f.id, inner;
      if (f.type === "select") {
        inner = '<select class="select" name="' + name + '">' + f.opts.map(function (o, i) {
          var v = (i === 0 && /Seçiniz|Farketmez|Esnek/.test(o)) ? "" : o;
          return '<option value="' + esc(v) + '"' + ((val || "") === v ? " selected" : "") + ">" + esc(o) + "</option>";
        }).join("") + "</select>";
      } else if (f.type === "seg") {
        var cur = val || f.opts[0]; S.d[f.id] = cur;
        inner = '<div class="segbar">' + f.opts.map(function (o) { return '<label><input type="radio" name="' + name + '" value="' + esc(o) + '"' + (cur === o ? " checked" : "") + "><span>" + esc(o) + "</span></label>"; }).join("") + "</div>";
      } else if (f.type === "chips" || f.type === "multi") {
        var multi = f.type === "multi", arr = multi ? (val || []) : null;
        inner = '<div class="chips">' + f.opts.map(function (o) {
          var on = multi ? arr.indexOf(o) > -1 : val === o;
          return '<label class="chip"><input type="' + (multi ? "checkbox" : "radio") + '" name="' + name + '" value="' + esc(o) + '"' + (on ? " checked" : "") + ">" + esc(o) + "</label>";
        }).join("") + "</div>";
      } else {
        inner = f.unit ? '<div class="input-group"><input class="input" name="' + name + '" value="' + esc(val || "") + '" placeholder="' + esc(f.ph || "") + '"' + (f.num ? ' inputmode="numeric"' : "") + '><span class="suffix">' + f.unit + "</span></div>"
          : '<input class="input" name="' + name + '" value="' + esc(val || "") + '" placeholder="' + esc(f.ph || "") + '">';
      }
      var isGroup = f.type !== "select" && f.type !== "text";
      return (isGroup ? '<div class="field' : '<label class="field') + (f.full ? " full" : "") + '"><span' + (isGroup ? ' class="label"' : "") + ">" + esc(f.label) + "</span>" + inner + (isGroup ? "</div>" : "</label>");
    }).join("");
    $("#desc").placeholder = DESC_PH[S.tip] || "";
    if (S.titleAuto) { S.title = autoTitle(); }
    $("#title").value = S.title;
    $("#desc").value = S.desc;
    updateCount();
  }
  dyn.addEventListener("input", onDyn);
  dyn.addEventListener("change", onDyn);
  function onDyn(e) {
    var el = e.target; if (!el.name || el.name.indexOf("d_") !== 0) return;
    var id = el.name.slice(2);
    if (el.type === "checkbox") S.d[id] = $$('input[name="' + el.name + '"]:checked', dyn).map(function (x) { return x.value; });
    else if (el.type === "radio") S.d[id] = el.value;
    else { if (el.inputMode === "numeric") el.value = el.value.replace(/\D/g, ""); S.d[id] = el.value; }
    if (S.titleAuto) { S.title = autoTitle(); $("#title").value = S.title; }
    save(); renderPreview();
  }
  function autoTitle() {
    var d = S.d, k = S.kategori;
    if (S.tip === "emlak") {
      var oda = (d.oda && d.oda.length) ? d.oda.join(" / ") + " " : "";
      var base = k.replace(/^(Kiralık|Satılık) /, "");
      return (oda + (d.islem || "") + " " + base.toLocaleLowerCase("tr-TR")).trim().replace(/^./, function (c) { return c.toLocaleUpperCase("tr-TR"); });
    }
    if (S.tip === "vasita") {
      var parts = [d.marka, d.model].filter(Boolean).join(" ");
      return parts ? parts + (d.yilmin ? ", " + d.yilmin + " ve sonrası" : "") : k + (d.vites ? ", " + d.vites.toLocaleLowerCase("tr-TR") + " vites" : "");
    }
    if ((S.tip === "alisveris" || S.tip === "makine") && d.urun) return d.urun + (d.durum && d.durum !== "Farketmez" ? " (" + d.durum.toLocaleLowerCase("tr-TR") + ")" : "");
    return k;
  }
  $("#title").addEventListener("input", function () { S.title = this.value; S.titleAuto = !this.value; save(); renderPreview(); clearInvalid("f-title"); });
  $("#desc").addEventListener("input", function () { S.desc = this.value; updateCount(); save(); renderPreview(); clearInvalid("f-desc"); });
  function updateCount() { $("#descCount").textContent = S.desc.length + " / 1000"; }

  /* ---------- Adım 3 ---------- */
  var ilSel = $("#il");
  ilSel.innerHTML += A.ILLER.map(function (i) { return "<option>" + i + "</option>"; }).join("");
  ilSel.addEventListener("change", function () { S.il = this.value; clearInvalid("f-il"); save(); renderPreview(); });
  $("#ilce").addEventListener("input", function () { S.ilce = this.value; save(); renderPreview(); });
  ["bmin", "bmax"].forEach(function (id) {
    $("#" + id).addEventListener("input", function () {
      var d = this.value.replace(/\D/g, "").slice(0, 11);
      this.value = d ? A.fmt(d) : ""; S[id] = d;
      syncQuick(); save(); renderPreview();
    });
  });
  $("#esnek").addEventListener("change", function () { S.esnek = this.checked; save(); renderPreview(); });
  $("#zaman").addEventListener("change", function (e) { S.zaman = e.target.value; save(); renderPreview(); });
  function budgetKey() { return S.tip === "emlak" ? (S.d.islem === "Satılık" ? "emlak_satilik" : "emlak_kiralik") : S.tip; }
  function renderBudget() {
    var monthly = S.tip === "emlak" && S.d.islem !== "Satılık";
    $("#budgetLabel").textContent = monthly ? "Aylık kira bütçesi" : (S.tip === "eleman" ? "Aylık ücret bütçesi" : "Bütçe aralığı");
    $$("[data-unit]").forEach(function (u) { u.textContent = monthly || S.tip === "eleman" ? "₺/ay" : "₺"; });
    var q = QUICK_BUDGET[budgetKey()] || [];
    $("#budgetQuick").innerHTML = q.map(function (b, i) { return '<button type="button" class="chip" data-q="' + i + '" aria-pressed="false">' + b[0] + "</button>"; }).join("");
    $("#bmin").value = S.bmin ? A.fmt(S.bmin) : ""; $("#bmax").value = S.bmax ? A.fmt(S.bmax) : "";
    ilSel.value = S.il; $("#ilce").value = S.ilce; $("#esnek").checked = S.esnek;
    var z = $('input[name="zaman"][value="' + S.zaman + '"]'); if (z) z.checked = true;
    syncQuick();
  }
  $("#budgetQuick").addEventListener("click", function (e) {
    var b = e.target.closest("[data-q]"); if (!b) return;
    var q = QUICK_BUDGET[budgetKey()][+b.dataset.q];
    S.bmin = q[1] ? String(q[1]) : ""; S.bmax = q[2] ? String(q[2]) : "";
    $("#bmin").value = S.bmin ? A.fmt(S.bmin) : ""; $("#bmax").value = S.bmax ? A.fmt(S.bmax) : "";
    syncQuick(); save(); renderPreview();
  });
  function syncQuick() {
    var q = QUICK_BUDGET[budgetKey()] || [];
    $$("[data-q]").forEach(function (b) { var x = q[+b.dataset.q]; b.setAttribute("aria-pressed", String(x[1] || "") === S.bmin && String(x[2] || "") === S.bmax); });
  }

  /* ---------- Adım 4 ---------- */
  $("#ad").addEventListener("input", function () { S.ad = this.value; clearInvalid("f-ad"); save(); });
  $("#tel").addEventListener("input", function () {
    var d = this.value.replace(/\D/g, "").slice(0, 11);
    if (d && d[0] !== "0") d = ("0" + d).slice(0, 11);
    var p = [d.slice(0, 4), d.slice(4, 7), d.slice(7, 9), d.slice(9, 11)].filter(Boolean);
    this.value = p.join(" "); S.tel = d; clearInvalid("f-tel"); save();
  });
  $("#mail").addEventListener("input", function () { S.mail = this.value.trim(); clearInvalid("f-mail"); save(); });
  $("#pref").addEventListener("change", function () { S.pref = $$("#pref input:checked").map(function (x) { return x.value; }); save(); });
  $("#ok").addEventListener("change", function () { S.ok = this.checked; $("#errOk").hidden = true; });
  function renderContact() {
    $("#ad").value = S.ad; $("#mail").value = S.mail;
    $("#tel").value = S.tel; $("#tel").dispatchEvent(new Event("input"));
    $$("#pref input").forEach(function (x) { x.checked = S.pref.indexOf(x.value) > -1; });
    $("#ok").checked = S.ok;
  }

  /* ---------- Önizleme ---------- */
  function specs() {
    var out = [], d = S.d;
    (SCHEMA[S.tip] || []).forEach(function (f) {
      var v = d[f.id];
      if (!v || (Array.isArray(v) && !v.length) || v === "Farketmez" || v === "Önemli değil" || v === "Takas yok") return;
      if (f.id === "urun") return;
      if (Array.isArray(v)) out.push(v.join(", "));
      else if (f.unit) out.push(v + " " + f.unit + "+");
      else if (f.id === "yilmin") out.push(v + " ve sonrası");
      else if (f.id === "km") out.push(v + " altı");
      else out.push(v);
    });
    if (S.zaman && S.zaman !== "Esnek") out.push(S.zaman === "Acil" ? "⚡ Acil" : S.zaman);
    return out.slice(0, 7);
  }
  function budgetText() {
    var unit = (S.tip === "emlak" && S.d.islem !== "Satılık") || S.tip === "eleman" ? " ₺/ay" : " ₺";
    var a = S.bmin ? A.fmt(S.bmin) : "", b = S.bmax ? A.fmt(S.bmax) : "";
    var t = a && b ? a + " – " + b + unit : b ? "En fazla " + b + unit : a ? "En az " + a + unit : "";
    if (!t) return S.esnek ? "Esnek" : "";
    return t + (S.esnek ? " · esnek" : "");
  }
  function renderPreview() {
    var v = S.tip ? A.findVertical(S.tip) : null;
    var loc = [S.ilce, S.il].filter(Boolean).join(", ");
    var sp = specs(), bt = budgetText();
    preview.innerHTML =
      '<div class="pv-top"><span class="pv-type" style="--c:' + (v ? v.c : "#7A849C") + '">' + (v ? v.emo + " " + v.name : "Tür seçilmedi") + (S.kategori ? " · " + esc(S.kategori) : "") + '</span><span class="pv-new">Yeni</span></div>' +
      "<h3" + (S.title ? "" : ' class="ph"') + ">" + esc(S.title || "Talep başlığın burada görünecek") + "</h3>" +
      '<div class="pv-loc' + (loc ? "" : " ph") + '">📍 ' + esc(loc || "Konum") + "</div>" +
      (sp.length ? '<div class="pv-specs">' + sp.map(function (s) { return "<span>" + esc(s) + "</span>"; }).join("") + "</div>" : "") +
      (S.desc ? '<p class="pv-desc">' + esc(S.desc) + "</p>" : "") +
      '<div class="pv-foot"><div><small>Bütçe</small><b' + (bt ? "" : ' class="ph"') + ">" + esc(bt || "Belirtilmedi") + '</b></div><span class="pv-lock">🔒 İletişim gizli</span></div>';
  }

  /* ---------- Doğrulama ---------- */
  function invalid(id) { var el = $("#" + id); if (el) el.classList.add("invalid"); return false; }
  function clearInvalid(id) { var el = $("#" + id); if (el) el.classList.remove("invalid"); }
  function validate(step) {
    var ok = true, first = null;
    function fail(id, focusSel) { ok = invalid(id); if (!first) first = focusSel; }
    if (step === 1) {
      if (!S.tip || !S.kategori) { $("#err1").hidden = !S.tip; if (!S.tip) A.toast("Önce ne için talep oluşturacağını seç."); return false; }
    }
    if (step === 2) {
      if (S.title.trim().length < 5) fail("f-title", "#title");
      if (S.desc.trim().length < 20) fail("f-desc", "#desc");
    }
    if (step === 3) { if (!S.il) fail("f-il", "#il"); }
    if (step === 4) {
      if (S.ad.trim().length < 2) fail("f-ad", "#ad");
      if (!/^05\d{9}$/.test(S.tel)) fail("f-tel", "#tel");
      if (S.mail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(S.mail)) fail("f-mail", "#mail");
      if (!S.ok) { ok = false; $("#errOk").hidden = false; if (!first) first = "#ok"; }
    }
    if (first) $(first).focus();
    return ok;
  }

  /* ---------- Adım geçişi ---------- */
  function go(n, dir) {
    S.step = n;
    steps.forEach(function (s) {
      var on = +s.dataset.step === n;
      s.hidden = !on;
      if (on) { s.classList.toggle("back", dir < 0); s.style.animation = "none"; void s.offsetWidth; s.style.animation = ""; }
    });
    if (n === 2) renderDyn();
    if (n === 3) renderBudget();
    if (n === 4) renderContact();
    $$("#stepList li").forEach(function (li) {
      var k = +li.dataset.s;
      li.classList.toggle("active", k === n); li.classList.toggle("done", k < n);
      if (k === n) li.setAttribute("aria-current", "step"); else li.removeAttribute("aria-current");
    });
    $("#progressBar").style.width = (n * 25) + "%";
    backBtn.style.visibility = n === 1 ? "hidden" : "visible";
    nextBtn.innerHTML = n === 4 ? "🚀 Talebimi yayınla" : "Devam et →";
    save(); renderPreview();
    var top = form.getBoundingClientRect().top + window.scrollY - 110;
    if (window.scrollY > top) window.scrollTo({ top: top, behavior: A.reduceMotion ? "auto" : "smooth" });
  }
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (!validate(S.step)) return;
    if (S.step < 4) go(S.step + 1, 1); else publish();
  });
  backBtn.addEventListener("click", function () { if (S.step > 1) go(S.step - 1, -1); });
  $("#stepList").addEventListener("click", function (e) { var li = e.target.closest("li.done"); if (li) go(+li.dataset.s, -1); });

  function publish() {
    nextBtn.disabled = true; nextBtn.textContent = "Yayınlanıyor…";
    setTimeout(function () {
      steps.forEach(function (s) { s.hidden = true; });
      $("#wzFoot").hidden = true;
      $("#doneId").textContent = "#AL-" + String(Math.floor(100000 + Math.random() * 899999));
      $("#done").hidden = false; $("#done").focus();
      $("#progressBar").style.width = "100%";
      $$("#stepList li").forEach(function (li) { li.classList.remove("active"); li.classList.add("done"); });
      try { localStorage.removeItem(DRAFT_KEY); } catch (_) {}
      window.scrollTo({ top: 0, behavior: A.reduceMotion ? "auto" : "smooth" });
    }, 700);
  }
  $("#newReq").addEventListener("click", function () { window.location.href = "talep-olustur.html"; });

  /* ---------- Taslak ---------- */
  var saveT;
  function save() {
    clearTimeout(saveT);
    saveT = setTimeout(function () {
      try {
        var copy = JSON.parse(JSON.stringify(S)); delete copy.ok;
        localStorage.setItem(DRAFT_KEY, JSON.stringify(copy));
        draftEl.textContent = "Taslak kaydedildi"; draftEl.classList.add("saved");
      } catch (_) {}
    }, 400);
  }

  /* ---------- Başlangıç: URL > taslak ---------- */
  var p = new URLSearchParams(location.search);
  var fromUrl = p.get("tip") || p.get("hizmet") || p.get("kategori");
  if (fromUrl) {
    S.tip = p.get("tip") || "hizmet";
    if (!A.findVertical(S.tip)) S.tip = "hizmet";
    var k = p.get("hizmet") || p.get("kategori") || "";
    if (k) {
      var hit = A.CATS[S.tip].filter(function (c) { return fold(c[1]) === fold(k); })[0];
      S.kategori = hit ? hit[1] : k;
      S.alan = hit && hit[2] ? hit[2] : "";
    }
    ["islem", "marka", "urun", "durum"].forEach(function (x) { if (p.get(x)) S.d[x] = p.get(x); });
    if (p.get("oda")) S.d.oda = [p.get("oda")];
    if (p.get("yil")) S.d.yilmin = p.get("yil");
    if (p.get("il") && A.ILLER.indexOf(p.get("il")) > -1) S.il = p.get("il");
    if (p.get("butce")) S.bmax = p.get("butce").replace(/\D/g, "");
    if (S.kategori) applyCategoryDefaults();
    if (p.get("islem")) S.d.islem = p.get("islem");
  } else {
    try {
      var saved = JSON.parse(localStorage.getItem(DRAFT_KEY) || "null");
      if (saved && saved.tip) { Object.keys(saved).forEach(function (key) { S[key] = saved[key]; }); S.ok = false; A.toast("Kaldığın yerden devam ediyorsun."); }
    } catch (_) {}
  }

  if (S.tip) {
    var r = $('input[name="tip"][value="' + S.tip + '"]', vpick); if (r) r.checked = true;
    catpick.hidden = false;
    renderCats();
  }
  renderPreview();
  // Ana sayfadan başlık seçilerek gelindiyse doğrudan detaylara geç
  var startStep = fromUrl && S.kategori ? 2 : (S.step > 1 && S.tip && S.kategori ? Math.min(S.step, 4) : 1);
  go(startStep, 1);
});
