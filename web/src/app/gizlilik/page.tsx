import type { Metadata } from "next";
import Link from "next/link";
import styles from "../legal.module.css";

export const metadata: Metadata = { title: "Gizlilik Politikası — alıcam.net" };

export default function PrivacyPage() {
  return <main className={styles.page}>
    <nav className={styles.nav}><Link className={styles.brand} href="/">alıcam<span>.net</span></Link><Link href="/">Ana sayfaya dön →</Link></nav>
    <article className={styles.card}><span>VERİ VE GİZLİLİK</span><h1>Gizlilik politikası</h1><p>Son güncelleme: 19 Ağustos 2026. Bu metin, platformda işlenen temel veri gruplarını ve kullanım amaçlarını özetler.</p>
      <section><h2>Toplanan bilgiler</h2><p>Hesap bilgileri, doğrulama kayıtları, talep ve teklif içerikleri, seçilen hizmet bölgeleri ile güvenlik ve işlem kayıtları platformun çalışması için işlenebilir.</p></section>
      <section><h2>Kullanım amacı</h2><p>Bilgiler; hesap güvenliği, doğru talep–hizmet veren eşleşmesi, işlem geçmişi, kullanıcı desteği, suistimal önleme ve yasal yükümlülüklerin yerine getirilmesi için kullanılır.</p></section>
      <section><h2>İletişim bilgilerinin görünürlüğü</h2><p>Müşteri iletişim bilgileri genel talep özetinde gösterilmez. Yetkili hizmet veren, ilgili talebin detayını platform kurallarına uygun biçimde açtıktan sonra erişebilir.</p></section>
      <section><h2>Saklama ve güvenlik</h2><p>Veriler yalnızca gerekli süre boyunca saklanır ve yetkisiz erişimi önlemek için makul teknik ve idari önlemler uygulanır.</p></section>
      <section><h2>Başvuru</h2><p>Gizlilik taleplerin için <a href="mailto:destek@alicam.net">destek@alicam.net</a> adresine yazabilirsin.</p></section>
    </article>
  </main>;
}
