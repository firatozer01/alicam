import type { Metadata } from "next";
import Link from "next/link";
import styles from "../legal.module.css";
import { LegalShell, type LegalTocItem } from "../legal-shell";

export const metadata: Metadata = {
  title: "Kullanım koşulları — alıcam.net",
  description: "alıcam.net talep pazaryerinin temel kullanım kuralları: platformun rolü, hesap güvenliği, talep, teklif ve kontör.",
};

// Icindekiler sirasi makaledeki bolum sirasiyla ayni.
const TOC: LegalTocItem[] = [
  { id: "rol", label: "Platformun rolü" },
  { id: "hesap", label: "Hesap ve güvenlik" },
  { id: "talep", label: "Talep oluşturma" },
  { id: "kontor", label: "Teklif ve kontör" },
  { id: "uygun", label: "Uygun kullanım" },
  { id: "iletisim", label: "İletişim" },
];

export default function TermsPage() {
  return <LegalShell
    aside={<>
      <div className={styles.asideCard}>
        <h4>Talep oluşturmak ücretsiz</h4>
        <p>Ne istediğini yaz, teklifler sana gelsin.</p>
        <Link className={`${styles.btn} ${styles.btnCta}`} href="/talep-olustur">＋ Talep oluştur</Link>
      </div>
      <div className={styles.asideCard}>
        <h4>Teklif veren misin?</h4>
        <p>Bölgendeki taleplere ulaş, sadece ilgilendiğin için öde.</p>
        <Link className={`${styles.btn} ${styles.btnSoft}`} href="/giris?kayit=veren">Teklif veren ol</Link>
      </div>
      <Link className={styles.asideCard} href="/gizlilik">
        <h4>Gizlilik politikası →</h4>
        <p className={styles.flush}>Bilgilerin nasıl korunuyor?</p>
      </Link>
    </>}
    eyebrow="Yasal bilgilendirme"
    lead="alıcam.net talep pazaryerini kullanırken geçerli olan temel kuralları özetliyoruz."
    meta={["Son güncelleme: 19 Ağustos 2026", "⏱️ 4 dakikalık okuma"]}
    title="Kullanım koşulları"
    toc={TOC}
  >
    <div className={styles.summary}>
      <strong>Kısaca</strong>
      <ul>
        <li>Talep oluşturmak ücretsizdir; teklifler seni hiçbir şekilde bağlamaz.</li>
        <li>Teklif verenler yalnızca talep detayını açarken kontör öder; maliyet önceden gösterilir.</li>
        <li>Anlaşmanın kapsamı, fiyatı ve teslimi taraflar arasındadır.</li>
      </ul>
    </div>

    <section id="rol">
      <h2><small>01</small>Platformun rolü</h2>
      <p>alıcam.net; hizmet, emlak, vasıta, ürün ve diğer kategorilerde talep oluşturan kullanıcıları, bu taleplere teklif veren ustalar, firmalar, emlakçılar, galeriler ve satıcılarla buluşturan bir pazaryeridir.</p>
      <p>Hizmetin veya ürünün kapsamı, fiyatı, teslimi ve taraflar arasındaki anlaşma kullanıcıların sorumluluğundadır.</p>
    </section>

    <section id="hesap">
      <h2><small>02</small>Hesap ve güvenlik</h2>
      <p>Kullanıcılar doğru bilgi vermek, hesap erişimini korumak ve hesapları üzerinden gerçekleşen işlemleri takip etmekle yükümlüdür. Teklif veren hesapları başvuru sonrası incelenerek onaylanır.</p>
    </section>

    <section id="talep">
      <h2><small>03</small>Talep oluşturma</h2>
      <p>Talep oluşturmak ve teklif almak ücretsizdir. Talepler gerçek bir ihtiyacı yansıtmalı; yanıltıcı fiyat, konum veya içerik barındırmamalıdır. Talebin, seçtiğin kategori ve bölgedeki onaylı teklif verenlere gösterilir.</p>
    </section>

    <section id="kontor">
      <h2><small>04</small>Teklif ve kontör</h2>
      <p>Teklif verenler talep özetlerini ücretsiz görür. Talep detayını açmak ve platformun belirlediği görünürlük işlemleri (ör. vitrinde öne çıkma) kontörle ücretlendirilebilir; işlem öncesinde maliyet gösterilir.</p>
      <p>Teklif göndermek, güncellemek ve daha önce açılmış bir talebi tekrar görüntülemek ek kontör gerektirmez.</p>
    </section>

    <section id="uygun">
      <h2><small>05</small>Uygun kullanım</h2>
      <p>Aşağıdakiler yasaktır; ihlal halinde içerik veya hesap kısıtlanabilir:</p>
      <ul>
        <li>Yanıltıcı içerik ve sahte talep ya da teklifler</li>
        <li>Hukuka aykırı hizmet veya ürünler</li>
        <li>İzinsiz kişisel veri paylaşımı ve taciz</li>
        <li>Platform güvenliğini bozan davranışlar</li>
      </ul>
    </section>

    <section id="iletisim">
      <h2><small>06</small>İletişim</h2>
      <p>Sorular için <a href="mailto:destek@alicam.net">destek@alicam.net</a> adresine ulaşabilirsin.</p>
    </section>
  </LegalShell>;
}
