import type { Metadata } from "next";
import { MailSettings } from "./mail-settings";

export const metadata: Metadata = {
  title: "Bildirim Ayarları — alıcam.net Yönetim",
  description: "E-posta (SMTP) bağlantısını yönetin ve deneme gönderimi yapın.",
};

export default function AdminSettingsPage() {
  return <MailSettings />;
}
