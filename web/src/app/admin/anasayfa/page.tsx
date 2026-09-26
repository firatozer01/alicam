import type { Metadata } from "next";
import { HomeEditor } from "./home-editor";

export const metadata: Metadata = {
  title: "Anasayfa — alıcam.net Yönetim",
  description: "Anasayfa bölüm metinlerini, öne çıkan hizmetleri ve kart fotoğraflarını düzenleyin.",
};

export default function AdminHomePage() {
  return <HomeEditor />;
}
