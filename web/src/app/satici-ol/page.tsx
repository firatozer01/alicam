import type { Metadata } from "next";
import { SellerWizard } from "./seller-wizard";

export const metadata: Metadata = {
  title: "Hizmet Veren Başvurusu — alıcam.net",
  description: "Uzmanlığını, hizmet kategorilerini ve çalışma bölgelerini ekle; yeni taleplerle buluş.",
};

export default function SellerPage() {
  return <SellerWizard />;
}
