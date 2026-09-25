import type { Metadata } from "next";
import { MessagesPage } from "./messages-page";

export const metadata: Metadata = {
  title: "Mesajlar — alıcam.net",
  description: "Alıcı ve hizmet verenlerle yazışmaların tek ekranda.",
};

type Props = { searchParams: Promise<{ konusma?: string }> };

export default async function Messages({ searchParams }: Props) {
  const { konusma } = await searchParams;

  return <MessagesPage initialConversationId={konusma} />;
}
