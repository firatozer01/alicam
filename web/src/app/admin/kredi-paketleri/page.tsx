import type { Metadata } from "next";
import { CreditPackages } from "./credit-packages";

export const metadata: Metadata = {
  title: "Kredi Paketleri — alıcam.net Yönetim",
  description: "Hizmet verenin satın aldığı kredi paketlerinin kredisi, bonusu ve fiyatı.",
};

export default function AdminCreditPackagesPage() {
  return <CreditPackages />;
}
