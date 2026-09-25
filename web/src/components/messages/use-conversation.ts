"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiRequest } from "@/lib/api";

export type ChatMessage = {
  id: number;
  body: string;
  mine: boolean;
  sender: string;
  read: boolean;
  created_at: string;
};

export type ConversationSummary = {
  id: number;
  counterpart: { id: number | null; name: string };
  role: "buyer" | "seller";
  unread: number;
  last_message_at: string | null;
  request: { id: number; reference: string; title: string } | null;
};

export type ComposeState = { credit_cost: number; notice: string | null };

/**
 * Bir konusmanin mesajlarini tutar ve yeni gelenleri yoklar.
 *
 * Canli tasiyici (WebSocket) baglanana kadar kisa araliklarla /poll ucu
 * kullanilir. Tasiyici geldiginde yalnizca bu kancanin icindeki yoklama
 * dongusu degisecek; disaridaki bilesenler ayni kalir.
 */
export function useConversation(conversationId: number | null, pollMs = 5000) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [compose, setCompose] = useState<ComposeState>({ credit_cost: 0, notice: null });
  const [summary, setSummary] = useState<ConversationSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const lastId = useRef(0);


  // Konusma degisince durum render sirasinda sifirlanir; efekt icinde
  // dogrudan setState cagirmak fazladan bir tur olustururdu.
  const [loadedFor, setLoadedFor] = useState<number | null>(null);
  if (loadedFor !== conversationId) {
    setLoadedFor(conversationId);
    setMessages([]);
    setSummary(null);
    setError("");
    setLoading(conversationId !== null);
  }

  // Kurallara uymak icin istek dogrudan zincirlenir: adlandirilmis async
  // fonksiyon cagirmak lint tarafindan "efekt icinde setState" sayiliyor.
  useEffect(() => {
    if (!conversationId) return;
    let active = true;
    lastId.current = 0;

    apiRequest<{ data: ConversationSummary; messages: ChatMessage[]; compose: ComposeState }>(
      `/conversations/${conversationId}`,
    )
      .then((response) => {
        if (!active) return;
        setSummary(response.data);
        setMessages(response.messages);
        setCompose(response.compose);
        lastId.current = response.messages.at(-1)?.id ?? 0;
      })
      .catch(() => { if (active) setError("Konuşma yüklenemedi."); })
      .finally(() => { if (active) setLoading(false); });

    return () => { active = false; };
  }, [conversationId]);

  // Yoklama: sekme arka plandayken durur, boylece bos istek atilmaz.
  useEffect(() => {
    if (!conversationId) return;
    let stopped = false;

    const tick = async () => {
      if (stopped || document.hidden) return;
      try {
        const response = await apiRequest<{ messages: ChatMessage[] }>(
          `/conversations/${conversationId}/poll?after=${lastId.current}`,
        );
        if (response.messages.length > 0) {
          setMessages((current) => [...current, ...response.messages]);
          lastId.current = response.messages.at(-1)!.id;
        }
      } catch {
        // Gecici ag hatasi: bir sonraki turda tekrar denenir.
      }
    };

    const timer = window.setInterval(tick, pollMs);
    return () => { stopped = true; window.clearInterval(timer); };
  }, [conversationId, pollMs]);

  const send = useCallback(async (body: string) => {
    if (!conversationId) return null;
    const response = await apiRequest<{ data: ChatMessage; compose: ComposeState }>(
      `/conversations/${conversationId}/messages`,
      { method: "POST", body: JSON.stringify({ body }) },
    );
    setMessages((current) => [...current, response.data]);
    setCompose(response.compose);
    lastId.current = response.data.id;
    return response.data;
  }, [conversationId]);

  return { messages, compose, summary, loading, error, send };
}
