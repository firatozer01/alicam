import type { Metadata } from "next";
import { FavoritesPage } from "./favorites-page";

export const metadata: Metadata = {
  title: "Favori Talepler — alıcam.net",
  description: "Takip etmek için işaretlediğin talepler tek ekranda.",
};

export default function Favorites() {
  return <FavoritesPage />;
}
