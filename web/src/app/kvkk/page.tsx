import type { Metadata } from "next";
import Link from "next/link";
import styles from "../legal.module.css";
import { LegalShell, type LegalTocItem } from "../legal-shell";
import { KurumsalKart } from "../iletisim/kurumsal-kart";
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
  title: "KVKK aydınlatma metni — alıcam.net",
  description: "Kişisel verilerinin hangi amaçla, hangi hukuki sebebe dayanarak işlendiğini ve haklarını nasıl kullanacağını anlatır.",
};

const TOC: LegalTocItem[] = [
  { id: "sorumlu", label: "Veri sorumlusu" },
  { id: "veriler", label: "İşlenen veriler" },
  { id: "amac", label: "Amaçlar ve hukuki sebep" },
  { id: "aktarim", label: "Kimlere aktarılıyor" },
  { id: "ticari", label: "Ticari elektronik ileti" },
  { id: "saklama", label: "Saklama süresi" },
  { id: "haklar", label: "Haklarım" },
  { id: "basvuru", label: "Başvuru yolu" },
];

export default async function KvkkPage() {
  const kurumsal = await kurumsalOku();

  return <LegalShell
    aside={<>
      <div className={styles.asideCard}>
        <h4>📩 Veri başvurusu</h4>
        <p>Haklarını kullanmak için kayıtlı e-posta adresinden yaz.</p>
        <a className={`${styles.btn} ${styles.btnCta}`} href="mailto:destek@alicam.net?subject=KVKK%20ba%C5%9Fvurusu">destek@alicam.net</a>
      </div>
      <Link className={styles.asideCard} href="/gizlilik">
        <h4>Gizlilik politikası →</h4>
        <p className={styles.flush}>Bilgilerin ne zaman görünür olur</p>
      </Link>
      <Link className={styles.asideCard} href="/iletisim">
        <h4>İletişim →</h4>
        <p className={styles.flush}>İşletme bilgileri ve başvuru kanalları</p>
      </Link>
    </>}
    eyebrow="Kişisel verilerin korunması"
    lead="6698 sayılı Kişisel Verilerin Korunması Kanunu kapsamında, verilerini hangi amaçla ve hangi hukuki sebebe dayanarak işlediğimizi anlatır."
    meta={["6698 sayılı KVKK m. 10", "⏱️ 4 dakikalık okuma"]}
    title="Aydınlatma metni"
    toc={TOC}
  >
    <div className={styles.summary}>
      <strong>Kısaca</strong>
      <ul>
        <li>Verilerini <b>satmıyoruz</b>; platformun çalışması için gerekeni işliyoruz.</li>
        <li>İletişim bilgilerin talep özetinde görünmez; yalnızca talebini açan onaylı teklif verene açılır.</li>
        <li>Ticari elektronik ileti izni <b>ayrıdır</b>, üyelikten bağımsızdır ve dilediğin an geri alınır.</li>
      </ul>
    </div>

    <section id="sorumlu">
      <h2><small>01</small>Veri sorumlusu</h2>
      <p>Kişisel verilerin, veri sorumlusu sıfatıyla aşağıdaki şirket tarafından işlenmektedir.</p>
      <KurumsalKart kurumsal={kurumsal} />
    </section>

    <section id="veriler">
      <h2><small>02</small>İşlenen veriler</h2>
      <ul>
        <li><b>Kimlik ve iletişim:</b> ad soyad, e-posta adresi, telefon numarası</li>
        <li><b>Müşteri işlem:</b> oluşturduğun talepler, aldığın ve gönderdiğin teklifler, mesajlar, favoriler</li>
        <li><b>Konum:</b> talebin ve hizmet bölgen için seçtiğin il ve ilçe; açık adres yalnızca sen yazarsan</li>
        <li><b>İşlem güvenliği:</b> giriş kayıtları, doğrulama kayıtları, IP ve oturum bilgileri</li>
        <li><b>Finans:</b> kredi hareketleri ve ödeme siparişi kayıtları</li>
      </ul>
      <p>Kart bilgilerin alıcam.net sunucularında <b>tutulmaz</b>; ödeme, lisanslı ödeme kuruluşunun kendi ekranında alınır.</p>
    </section>

    <section id="amac">
      <h2><small>03</small>Amaçlar ve hukuki sebep</h2>
      <ul>
        <li><b>Üyelik ve hizmetin sunulması</b> — sözleşmenin kurulması ve ifası (KVKK m. 5/2-c)</li>
        <li><b>Talebin doğru teklif verenlerle eşleştirilmesi</b> — sözleşmenin ifası (m. 5/2-c)</li>
        <li><b>Doğrulama, güvenlik ve suistimal önleme</b> — meşru menfaat (m. 5/2-f)</li>
        <li><b>Fatura, muhasebe ve yasal saklama</b> — hukuki yükümlülük (m. 5/2-ç)</li>
        <li><b>Kampanya ve duyuru gönderimi</b> — <b>açık rıza</b> (m. 5/1)</li>
      </ul>
    </section>

    <section id="aktarim">
      <h2><small>04</small>Kimlere aktarılıyor</h2>
      <ul>
        <li><b>Onaylı teklif verenler:</b> yalnızca senin talebini açan hizmet verene, yalnızca iletişim bilgilerin</li>
        <li><b>Ödeme kuruluşu:</b> kredi satın alımında ödeme işleminin tamamlanması için</li>
        <li><b>Barındırma ve altyapı sağlayıcıları:</b> hizmetin çalışması için</li>
        <li><b>Yetkili kurumlar:</b> yasal talep olduğunda ve talep kapsamında</li>
      </ul>
      <p>Bunların dışında kişisel verilerin üçüncü kişilere satılmaz ve pazarlama amacıyla devredilmez.</p>
    </section>

    <section id="ticari">
      <h2><small>05</small>Ticari elektronik ileti</h2>
      <p>Kampanya, duyuru ve tanıtım içeren e-posta veya SMS gönderimi yalnızca <b>ayrıca onay verdiysen</b> yapılır. Bu onay üyelikten bağımsızdır: vermeden de hesabını açabilir ve platformu kullanabilirsin.</p>
      <p>Onayını dilediğin an geri alabilirsin: hesap ayarlarından kapatabilir, gönderilen iletideki bağlantıyı kullanabilir ya da <a href="mailto:destek@alicam.net">destek@alicam.net</a> adresine yazabilirsin. Üyelik, işlem ve güvenlik bildirimleri bu kapsamda değildir; onay vermesen de gönderilir.</p>
    </section>

    <section id="saklama">
      <h2><small>06</small>Saklama süresi</h2>
      <p>Veriler, işlendikleri amaç için gerekli olan süre boyunca ve ilgili mevzuatın öngördüğü zamanaşımı ile saklama süreleri kadar tutulur. Süre dolduğunda silinir, yok edilir veya anonim hâle getirilir.</p>
    </section>

    <section id="haklar">
      <h2><small>07</small>Haklarım</h2>
      <p>KVKK m. 11 uyarınca; kişisel verinin işlenip işlenmediğini öğrenme, buna ilişkin bilgi talep etme, işlenme amacını ve amacına uygun kullanılıp kullanılmadığını öğrenme, yurt içinde veya yurt dışında aktarıldığı üçüncü kişileri bilme, eksik veya yanlış işlenmişse düzeltilmesini isteme, silinmesini veya yok edilmesini isteme, bu işlemlerin aktarıldığı üçüncü kişilere bildirilmesini isteme, münhasıran otomatik sistemlerle analiz edilmesi suretiyle aleyhine bir sonuç ortaya çıkmasına itiraz etme ve kanuna aykırı işleme nedeniyle zarara uğraman hâlinde zararın giderilmesini talep etme haklarına sahipsin.</p>
    </section>

    <section id="basvuru">
      <h2><small>08</small>Başvuru yolu</h2>
      <p>Başvurunu <a href="mailto:destek@alicam.net?subject=KVKK%20ba%C5%9Fvurusu">destek@alicam.net</a> adresine, hesabında kayıtlı e-posta adresinden gönderebilir ya da yukarıdaki şirket adresine yazılı olarak iletebilirsin. Kimliğini doğrulayabilmemiz için başvurunda ad soyad ve kayıtlı iletişim bilgini belirtmen gerekir.</p>
      <p>Başvurular en geç otuz gün içinde sonuçlandırılır.</p>
    </section>
  </LegalShell>;
}
