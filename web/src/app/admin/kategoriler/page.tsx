import type { Metadata } from "next";
import { CategoryManager } from "./category-manager";

export const metadata: Metadata = {
  title: "Kategori Yönetimi — alıcam.net Yönetim",
  description: "Kategori, kontör maliyeti ve dinamik talep formu alanlarını yönetin.",
};

export default function AdminCategoriesPage() {
  return <CategoryManager />;
}
