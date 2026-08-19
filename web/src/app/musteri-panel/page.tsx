import type { Metadata } from "next";
import { CustomerDashboard } from "./customer-dashboard";

export const metadata: Metadata = {
  title: "Müşteri Paneli — alıcam.net",
  description: "Taleplerini, tekliflerini ve hizmet değerlendirmelerini tek merkezden yönet.",
};

export default function CustomerPanelPage() {
  return <CustomerDashboard />;
}
