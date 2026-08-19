import type { Metadata } from "next";
import { CreditPurchase } from "./credit-purchase";

export const metadata: Metadata = {
  title: "Kontör Yükle — alıcam.net",
  description: "Hizmet veren hesabın için güvenli PayTR ödemesiyle kontör paketi satın al.",
};

export default function CreditPurchasePage() {
  return <CreditPurchase />;
}
