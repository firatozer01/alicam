import type { Metadata } from "next";
import Link from "next/link";
import styles from "../legal.module.css";

export const metadata: Metadata = { title: "Kullanım Koşulları — alıcam.net" };

export default function TermsPage() {
  return <main className={styles.page}>
    <nav className={styles.nav}><Link className={styles.brand} href="/">alıcam<span>.net</span></Link><Link href="/">Ana sayfaya dön →</Link></nav>
    <article className={styles.card}><span>YASAL BİLGİLENDİRME</span><h1>Kullanım koşulları</h1><p>Son güncelleme: 19 Ağustos 2026. Bu metin, alıcam.net talep pazaryerinin temel kullanım kurallarını açıklar.</p>
      <section><h2>Platformun rolü</h2><p>alıcam.net, müşterilerin taleplerini hizmet verenlerle buluşturan bir pazaryeridir. Hizmetin kapsamı, fiyatı, teslimi ve taraflar arasındaki anlaşma kullanıcıların sorumluluğundadır.</p></section>
      <section><h2>Hesap ve güvenlik</h2><p>Kullanıcılar doğru bilgi vermek, hesap erişimini korumak ve hesapları üzerinden gerçekleşen işlemleri takip etmekle yükümlüdür.</p></section>
      <section><h2>Talep, teklif ve kontör</h2><p>Talep oluşturmak müşteriler için ücretsizdir. Hizmet verenlerin talep detayını açması ve platformun belirlediği görünürlük işlemleri kontörle ücretlendirilebilir; işlem öncesinde maliyet gösterilir.</p></section>
      <section><h2>Uygun kullanım</h2><p>Yanıltıcı içerik, hukuka aykırı hizmet, izinsiz kişisel veri paylaşımı, taciz ve platform güvenliğini bozan davranışlar yasaktır. İhlal halinde içerik veya hesap kısıtlanabilir.</p></section>
      <section><h2>İletişim</h2><p>Sorular için <a href="mailto:destek@alicam.net">destek@alicam.net</a> adresine ulaşabilirsin.</p></section>
    </article>
  </main>;
}
