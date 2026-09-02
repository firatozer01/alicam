import type { Metadata } from "next";
import { SellerDirectory } from "./seller-directory";

export const metadata: Metadata = {
  title: "Öne Çıkan Hizmet Verenler — alıcam.net",
  description: "Doğrulanmış hizmet verenleri puan, uzmanlık alanı ve tamamladıkları işlerle karşılaştır.",
};

export default function SellerDirectoryPage() {
  return <SellerDirectory />;
}
