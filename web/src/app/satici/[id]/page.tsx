import type { Metadata } from "next";
import { SellerShowcase } from "./seller-showcase";

export const metadata: Metadata = {
  title: "Hizmet Veren Vitrini — alıcam.net",
  description: "Hizmet verenin tamamladığı işler, galeri ve müşteri değerlendirmeleri.",
};

type ShowcasePageProps = {
  params: Promise<{ id: string }>;
};

export default async function SellerShowcasePage({ params }: ShowcasePageProps) {
  const { id } = await params;

  return <SellerShowcase sellerId={id} />;
}
