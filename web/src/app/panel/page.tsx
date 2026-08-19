import type { Metadata } from "next";
import { BuyerDashboard } from "./buyer-dashboard";

export const metadata: Metadata = {
  title: "Taleplerim — alıcam.net",
  description: "Taleplerini ve hizmet verenlerden gelen teklifleri yönet.",
};

export default function BuyerPanelPage() {
  return <BuyerDashboard />;
}
