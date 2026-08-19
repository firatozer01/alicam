import type { Metadata } from "next";
import { SellerDashboard } from "./seller-dashboard";

export const metadata: Metadata = {
  title: "Gelen Talepler — alıcam.net Hizmet Veren",
  description: "Uzmanlık ve hizmet bölgelerinle eşleşen yeni talepleri görüntüle.",
};

export default function SellerDashboardPage() {
  return <SellerDashboard />;
}
