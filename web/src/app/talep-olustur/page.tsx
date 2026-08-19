import type { Metadata } from "next";
import { RequestWizard } from "./request-wizard";

export const metadata: Metadata = {
  title: "Yeni Talep Oluştur — alıcam.net",
  description: "İhtiyacını birkaç adımda anlat, doğrulanmış hizmet verenlerden teklif al.",
};

type RequestPageProps = {
  searchParams: Promise<{ kategori?: string }>;
};

export default async function RequestPage({ searchParams }: RequestPageProps) {
  const { kategori } = await searchParams;

  return <RequestWizard initialCategory={kategori} />;
}
