import type { Metadata } from "next";
import Link from "next/link";
import styles from "../legal.module.css";
import { LegalShell, type LegalTocItem } from "../legal-shell";

export const metadata: Metadata = {
  title: "Gizlilik politikası — alıcam.net",
  description: "alıcam.net'te hangi bilgilerin neden işlendiğini ve iletişim bilgilerinin nasıl korunduğunu öğren.",
};

// Icindekiler sirasi makaledeki bolum sirasiyla ayni.
const TOC: LegalTocItem[] = [
  { id: "toplanan", label: "Toplanan bilgiler" },
  { id: "amac", label: "Kullanım amacı" },
  { id: "gorunurluk", label: "İletişim bilgilerinin görünürlüğü" },
  { id: "saklama", label: "Saklama ve güvenlik" },
  { id: "haklar", label: "Hakların" },
  { id: "basvuru", label: "Başvuru" },
];

export default function PrivacyPage() {
  return <LegalShell
    aside={<>
      <div className={styles.asideCard}>
        <h4>🔒 Numaran gizli</h4>
        <p>Talep oluştururken iletişim bilgilerin hiçbir özette görünmez.</p>
        <Link className={`${styles.btn} ${styles.btnCta}`} href="/talep-olustur">＋ Talep oluştur</Link>
      </div>
      <div className={styles.asideCard}>
        <h4>Sorun mu var?</h4>
        <p>Destek ekibimiz sorularını yanıtlar.</p>
        <a className={`${styles.btn} ${styles.btnSoft}`} href="mailto:destek@alicam.net">destek@alicam.net</a>
      </div>
      <Link className={styles.asideCard} href="/kullanim-kosullari">
        <h4>Kullanım koşulları →</h4>
        <p className={styles.flush}>Platform kuralları ve kontör sistemi</p>
      </Link>
    </>}
    eyebrow="Veri ve gizlilik"
    lead="Hangi bilgileri neden işlediğimizi, iletişim bilgilerini nasıl koruduğumuzu ve haklarını sade bir dille anlatıyoruz."
    meta={["Son güncelleme: 19 Ağustos 2026", "⏱️ 3 dakikalık okuma"]}
    title="Gizlilik politikası"
    toc={TOC}
  >
    <div className={styles.summary}>
      <strong>Kısaca</strong>
      <ul>
        <li>Adın, telefonun ve açık adresin talep özetlerinde <b>asla</b> görünmez.</li>
        <li>İletişim bilgilerin yalnızca talebini açan onaylı teklif verenle paylaşılır.</li>
        <li>Verilerini satmayız; yalnızca platformun çalışması için gereken kadarını işleriz.</li>
      </ul>
    </div>

    <section id="toplanan">
      <h2><small>01</small>Toplanan bilgiler</h2>
      <p>Hesap bilgileri, doğrulama kayıtları, talep ve teklif içerikleri, seçilen hizmet bölgeleri ile güvenlik ve işlem kayıtları platformun çalışması için işlenebilir.</p>
      <p>Emlak, vasıta ve ürün taleplerinde; talebi netleştirmek için verdiğin tercihler (örneğin oda sayısı, model yılı, ürün durumu) talep içeriğinin parçası olarak saklanır.</p>
    </section>

    <section id="amac">
      <h2><small>02</small>Kullanım amacı</h2>
      <p>Bilgiler şu amaçlarla kullanılır:</p>
      <ul>
        <li>Hesap güvenliği ve kimlik doğrulama</li>
        <li>Talebin doğru kategori ve bölgedeki teklif verenlerle eşleştirilmesi</li>
        <li>İşlem geçmişi, kontör hareketleri ve ödeme kayıtları</li>
        <li>Kullanıcı desteği, suistimal önleme ve yasal yükümlülükler</li>
      </ul>
    </section>

    <section id="gorunurluk">
      <h2><small>03</small>İletişim bilgilerinin görünürlüğü</h2>
      <p>Talep eden kişinin iletişim bilgileri genel talep özetinde gösterilmez. Özet yalnızca kategori, ilçe, bütçe ve kısa açıklamayı içerir.</p>
      <p>Onaylı bir teklif veren, ilgili talebin detayını platform kurallarına uygun biçimde açtıktan sonra iletişim bilgilerine erişebilir. Talep eden, hangi iletişim kanalını tercih ettiğini (mesaj, telefon, WhatsApp) kendisi seçer.</p>
    </section>

    <section id="saklama">
      <h2><small>04</small>Saklama ve güvenlik</h2>
      <p>Veriler yalnızca gerekli süre boyunca saklanır ve yetkisiz erişimi önlemek için makul teknik ve idari önlemler uygulanır. Doğrulama kodları özetlenmiş (hash) biçimde tutulur.</p>
    </section>

    <section id="haklar">
      <h2><small>05</small>Hakların</h2>
      <p>Kişisel verilerinle ilgili bilgi talep etme, düzeltilmesini veya silinmesini isteme ve işlenmesine itiraz etme hakların vardır. Hesabını dilediğin zaman kapatabilirsin.</p>
    </section>

    <section id="basvuru">
      <h2><small>06</small>Başvuru</h2>
      <p>Gizlilik taleplerin için <a href="mailto:destek@alicam.net">destek@alicam.net</a> adresine yazabilirsin.</p>
    </section>
  </LegalShell>;
}
