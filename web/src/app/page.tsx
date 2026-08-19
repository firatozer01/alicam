const categories = [
  { icon: "✦", name: "Hizmet", text: "Ustadan danışmana", tone: "cyan" },
  { icon: "↗", name: "Nakliye", text: "Şehir içi ve şehirler arası", tone: "green" },
  { icon: "⌂", name: "Tadilat", text: "Ev ve iş yeri projeleri", tone: "violet" },
];

const recentRequests = [
  { category: "Tadilat", title: "2+1 daire için komple boya", location: "Kadıköy, İstanbul", budget: "25–35 bin ₺", offers: 6 },
  { category: "Nakliye", title: "Ofis eşyaları şehir içi taşıma", location: "Çankaya, Ankara", budget: "12–18 bin ₺", offers: 4 },
  { category: "Hizmet", title: "Aylık sosyal medya yönetimi", location: "Uzaktan", budget: "8–12 bin ₺", offers: 9 },
];

export default function Home() {
  return (
    <main>
      <div className="announcement">
        <span className="announcement-dot" />
        İlk talebini ücretsiz oluştur, teklifleri karşılaştır.
        <a href="#nasil-calisir">Nasıl çalışır?</a>
      </div>

      <nav className="nav shell" aria-label="Ana menü">
        <a className="brand" href="#" aria-label="alıcam.net ana sayfa">
          alıcam<span>.net</span>
        </a>
        <div className="nav-links">
          <a href="#kategoriler">Kategoriler</a>
          <a href="#nasil-calisir">Nasıl çalışır?</a>
          <a href="/satici-ol">Hizmet verenler</a>
        </div>
        <div className="nav-actions">
          <a className="button button-ghost" href="/giris">Giriş yap</a>
          <a className="button button-primary" href="/talep-olustur">Talep oluştur <span>→</span></a>
        </div>
      </nav>

      <section className="hero shell">
        <div className="aurora aurora-one" />
        <div className="aurora aurora-two" />
        <div className="hero-copy">
          <div className="eyebrow"><span>YENİ NESİL PAZARYERİ</span> Arayan değil, aranan ol.</div>
          <h1>
            Arama. Talebini yaz,<br />
            <span>teklifler sana gelsin.</span>
          </h1>
          <p className="hero-text">
            İhtiyacını birkaç adımda anlat. Doğrulanmış hizmet verenler sana özel
            tekliflerini hazırlasın. Karar daima sende.
          </p>
          <div className="hero-actions">
            <a className="button button-primary button-large" href="/talep-olustur">Ücretsiz talep oluştur <span>→</span></a>
            <a className="text-link" href="#son-talepler"><span className="play">▶</span> Güncel talepleri gör</a>
          </div>
          <div className="trust-row">
            <div className="avatars" aria-hidden="true"><i>AY</i><i>EK</i><i>MS</i><i>+</i></div>
            <div><strong>1.200+ hizmet veren</strong><span>yeni talepleri bekliyor</span></div>
          </div>
        </div>

        <div className="hero-stage" aria-label="Talep ve teklif akışı örneği">
          <div className="flow-label">TERS İLAN AKIŞI</div>
          <article className="request-card">
            <div className="request-topline">
              <span className="category-chip">⌂ TADİLAT</span>
              <span className="live-chip"><i /> YENİ TALEP</span>
            </div>
            <h2>Salon ve mutfak için yenileme</h2>
            <p>85 m² ev, boya ve parke dahil. Önümüzdeki ay içinde başlanması tercih edilir.</p>
            <div className="request-details">
              <div><span>Konum</span><strong>Üsküdar, İstanbul</strong></div>
              <div><span>Bütçe</span><strong>₺60.000 – ₺85.000</strong></div>
            </div>
            <div className="request-footer">
              <div className="verified"><b>✓</b><span><strong>Telefon doğrulandı</strong><small>3 dakika önce</small></span></div>
              <span className="offer-count">4 teklif</span>
            </div>
          </article>

          <div className="offer-stack">
            <article className="offer-card offer-one">
              <div className="company-mark">MK</div>
              <div><span>MERKEZ YAPI</span><strong>₺72.500</strong><small>12 gün · Malzeme dahil</small></div>
              <b className="rating">★ 4.9</b>
            </article>
            <article className="offer-card offer-two">
              <div className="company-mark petrol">AY</div>
              <div><span>ADA YAPI</span><strong>₺68.000</strong><small>14 gün · Keşif ücretsiz</small></div>
              <b className="rating">★ 4.8</b>
            </article>
          </div>
          <div className="flow-arrow">Tek talep <span>→</span> birden çok teklif</div>
        </div>
      </section>

      <section className="difference" id="nasil-calisir">
        <div className="shell difference-grid">
          <div>
            <span className="section-kicker">ALIŞKANLIĞI TERSİNE ÇEVİR</span>
            <h2>İlan aramakla uğraşma.<br />İhtiyacını ilan et.</h2>
          </div>
          <div className="versus-card">
            <div className="old-way"><span>ESKİ YÖNTEM</span><p>Yüzlerce ilanı tek tek ara, ara, ara…</p><b>ARAMAK</b></div>
            <div className="new-way"><span>ALICAM YÖNTEMİ</span><p>Bir kez anlat, doğru teklifler seni bulsun.</p><b>TEKLİF ALMAK</b></div>
          </div>
        </div>
      </section>

      <section className="categories shell" id="kategoriler">
        <div className="section-heading">
          <div><span className="section-kicker">İLK KATEGORİLER</span><h2>Bugün neye ihtiyacın var?</h2></div>
          <p>İlk sürümde en sık ihtiyaç duyulan üç alanda başlıyoruz. Her kategoride alanında doğrulanmış hizmet verenler bulunur.</p>
        </div>
        <div className="category-grid">
          {categories.map((category) => (
            <a className="category-card" href={`/talep-olustur?kategori=${category.name.toLocaleLowerCase("tr-TR")}`} key={category.name}>
              <span className={`category-icon ${category.tone}`}>{category.icon}</span>
              <span><strong>{category.name}</strong><small>{category.text}</small></span>
              <b>↗</b>
            </a>
          ))}
        </div>
      </section>

      <section className="steps" id="saticilar">
        <div className="shell">
          <div className="section-heading steps-heading">
            <div><span className="section-kicker light">ÜÇ BASİT ADIM</span><h2>Sen anlat, gerisini<br />biz eşleştirelim.</h2></div>
            <a className="button button-light" href="/talep-olustur">Hemen başla →</a>
          </div>
          <div className="steps-grid">
            <article><span>01</span><i>✎</i><h3>Talebini anlat</h3><p>Kategoriye özel kısa soruları yanıtla. Talebin yalnızca ilgili hizmet verenlere ulaşsın.</p></article>
            <article><span>02</span><i>◎</i><h3>Teklifleri karşılaştır</h3><p>Fiyat, süre, değerlendirme ve firma profillerini tek ekranda karşılaştır.</p></article>
            <article><span>03</span><i>✓</i><h3>Sen karar ver</h3><p>İçine sinen teklifi seç. Talep açmak ve teklifleri değerlendirmek daima ücretsiz.</p></article>
          </div>
        </div>
      </section>

      <section className="recent shell" id="son-talepler">
        <div className="section-heading">
          <div><span className="section-kicker">PAZARYERİNDE ŞİMDİ</span><h2>Yeni talepler</h2></div>
          <a className="text-link" href="/talepler">Tümünü gör <span>→</span></a>
        </div>
        <div className="recent-grid">
          {recentRequests.map((request) => (
            <article className="recent-card" key={request.title}>
              <div><span className="mini-chip">{request.category}</span><span className="recent-time">az önce</span></div>
              <h3>{request.title}</h3>
              <p>⌖ {request.location}</p>
              <div><strong>{request.budget}</strong><span>{request.offers} teklif</span></div>
            </article>
          ))}
        </div>
      </section>

      <section className="final-cta shell">
        <div><span className="section-kicker light">ARAMAYA SON VER</span><h2>Doğru teklif bir talep uzağında.</h2><p>Ücretsiz oluştur. Doğrulanmış hizmet verenlerden teklif al.</p></div>
        <a className="button button-white button-large" href="/talep-olustur">Talebini oluştur <span>→</span></a>
      </section>

      <footer className="footer shell">
        <a className="brand" href="#">alıcam<span>.net</span></a>
        <p>Arayan değil, aranan ol.</p>
        <div><a href="#">Gizlilik</a><a href="#">Kullanım koşulları</a><span>© 2026 alıcam.net</span></div>
      </footer>
    </main>
  );
}
