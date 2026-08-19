import type { Metadata } from "next";
import { AdminDashboard } from "./admin-dashboard";

export const metadata: Metadata = {
  title: "Genel Bakış — alıcam.net Yönetim",
  description: "Pazaryeri operasyon ve performans özeti.",
};

export default function AdminPage() {
  return <AdminDashboard />;
}
