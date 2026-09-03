import type { Metadata } from "next";
import { AccountSettings } from "./account-settings";

export const metadata: Metadata = {
  title: "Hesap Ayarları — alıcam.net",
  description: "Hesap bilgilerin, güvenlik ayarların ve çalışma alanların.",
};

export default function SettingsPage() {
  return <AccountSettings />;
}
