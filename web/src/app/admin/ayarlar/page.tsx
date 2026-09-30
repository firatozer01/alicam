import type { Metadata } from "next";
import { MailSettings } from "./mail-settings";

export const metadata: Metadata = {
  title: "Ayarlar — alıcam.net Yönetim",
  description: "E-posta gönderimi, asistan, görsel kaynağı ve sosyal medya hesapları buradan yönetilir.",
};

export default function AdminSettingsPage() {
  return <MailSettings />;
}
