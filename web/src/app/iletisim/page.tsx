import type { Metadata } from "next";
import Link from "next/link";
import styles from "../legal.module.css";
import { LegalShell, type LegalTocItem } from "../legal-shell";
import { KurumsalKart } from "./kurumsal-kart";
import { kurumsalOku } from "@/lib/company-server";

/**
 * Istek aninda uretilir.
 *
 * Varsayilan davranis bu sayfayi DERLEME sirasinda onceden uretiyordu;
 * derleme sirasinda API konteynerine erisim yok, dolayisiyla kurumsal
 * kimlik bos donuyor ve o bos hal statik cikti olarak yayina giriyordu.
 * Unvan, adres ve vergi bilgisi veritabanindan geliyor ve yoneticinin
 * degisikligi aninda gorunmeli.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "İletişim — alıcam.net",
  description: "alıcam.net'e nasıl ulaşacağın, işletme bilgileri ve hangi konuda nereye yazman gerektiği.",
};

const TOC: LegalTocItem[] = [
  { id: "ulas", label: "Bize ulaş" },
  { id: "kurumsal", label: "İşletme bilgileri" },
  { id: "konular", label: "Hangi konu nereye?" },
  { id: "sure", label: "Yanıt süresi" },
];

export default async function ContactPage() {
  const kurumsal = await kurumsalOku();

  return <LegalShell
    aside={<>
      <div className={styles.asideCard}>
        <h4>✉️ Doğrudan yaz</h4>
        <p>Her konu için tek adres; ekibimiz ilgili birime yönlendirir.</p>
        <a className={`${styles.btn} ${styles.btnCta}`} href="mailto:destek@alicam.net">destek@alicam.net</a>
      </div>
      <Link className={styles.asideCard} href="/kvkk">
        <h4>KVKK aydınlatma metni →</h4>
        <p className={styles.flush}>Kişisel verilerin nasıl işleniyor</p>
      </Link>
      <Link className={styles.asideCard} href="/kullanim-kosullari">
        <h4>Kullanım koşulları →</h4>
        <p className={styles.flush}>Platform kuralları ve kredi sistemi</p>
      </Link>
    </>}
    eyebrow="İletişim"
    lead="Sorun, öneri ya da kurumsal bir konu; hepsi için aynı kapıdan geçiyoruz ve ilgili ekibe biz ulaştırıyoruz."
    meta={["Hafta içi 09.00 – 18.00", "⏱️ Ortalama yanıt: 1 iş günü"]}
    title="Bize ulaş"
    toc={TOC}
  >
    <div className={styles.summary}>
      <strong>Kısaca</strong>
      <ul>
        <li>Tüm başvurular <a href="mailto:destek@alicam.net">destek@alicam.net</a> adresine gider.</li>
        <li>Hesabınla ilgili bir konuysa kayıtlı e-posta adresinden yazman işi hızlandırır.</li>
        <li>Kişisel veri talepleri için <Link href="/kvkk">aydınlatma metnindeki</Link> başvuru yolunu kullan.</li>
      </ul>
    </div>

    <section id="ulas">
      <h2><small>01</small>Bize ulaş</h2>
      <p>E-posta: <a href="mailto:destek@alicam.net">destek@alicam.net</a></p>
      <p>Mesajında talebinin ya da teklifinin referans numarasını (örneğin <b>ALC-DEMO-001</b>) paylaşırsan kaydı doğrudan açıp bakabiliriz.</p>
    </section>

    <section id="kurumsal">
      <h2><small>02</small>İşletme bilgileri</h2>
      <p>alıcam.net, aşağıdaki şirket tarafından işletilmektedir.</p>
      <KurumsalKart kurumsal={kurumsal} />
    </section>

    <section id="konular">
      <h2><small>03</small>Hangi konu nereye?</h2>
      <ul>
        <li><b>Hesap ve giriş:</b> şifre, doğrulama, hesap kapatma</li>
        <li><b>Talep ve teklif:</b> yayından kaldırma, yanlış kategori, uygunsuz içerik bildirimi</li>
        <li><b>Kredi ve ödeme:</b> paket, fatura, iade talepleri</li>
        <li><b>Hizmet veren başvurusu:</b> onay süreci ve eksik belge</li>
        <li><b>Kişisel veri:</b> bilgi talebi, düzeltme, silme — <Link href="/kvkk">aydınlatma metni</Link></li>
      </ul>
    </section>

    <section id="sure">
      <h2><small>04</small>Yanıt süresi</h2>
      <p>Başvuruları hafta içi mesai saatlerinde yanıtlıyoruz; ortalama yanıt süremiz bir iş günüdür. Kişisel veri başvuruları için yasal süre en geç otuz gündür, ancak uygulamada çok daha kısa sürede dönüş yapıyoruz.</p>
    </section>
  </LegalShell>;
}
