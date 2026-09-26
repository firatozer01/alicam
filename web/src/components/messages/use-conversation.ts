"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiRequest } from "@/lib/api";
import { realtime } from "@/lib/echo";

export type ChatMessage = {
  id: number;
  /** Konusma kilitliyken sunucu govdeyi hic gondermez. */
  body: string | null;
  locked: boolean;
  sender_id: number;
  mine: boolean;
  sender: string;
  read: boolean;
  created_at: string;
};

export type ConversationSummary = {
  id: number;
  viewer_id: number;
  /** Hizmet veren henuz acmadiysa true; alicida her zaman false. */
  locked: boolean;
  unlock_cost: number;
  counterpart: { id: number | null; name: string };
  role: "buyer" | "seller";
  unread: number;
  last_message_at: string | null;
  request: { id: number; reference: string; title: string } | null;
};

export type ComposeState = {
  credit_cost: number;
  locked: boolean;
  can_send: boolean;
  notice: string | null;
};

/** Soketten gelen yuk; "mine" tasimaz cunku tek yayin iki tarafa birden gider. */
type Broadcast = Omit<ChatMessage, "mine">;

/**
 * laravel-echo'nun altindaki pusher baglantisi. Genel tiplerde yer almadigi
 * icin ihtiyac duyulan kadari burada daraltilir; "any" serpmekten iyidir.
 */
type PusherLike = {
  connector?: { pusher?: { connection?: { bind: (event: string, handler: (payload: { current: string }) => void) => void } } };
};

/**
 * Ayni mesaj hem soketten hem yoklamadan gelebilir; kimlige gore tekillestirir.
 *
 * Elde metinsiz bir kopya varken metinli kopya gelirse YERINE GECER: kilitli
 * konusmada yayin govdeyi tasimadigi icin, kendi yazdigi mesajin maskeli
 * kopyasi HTTP yanitindan once dusen gonderici aksi halde kendi metnini
 * goremezdi.
 */
function mergeMessages(current: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  if (incoming.length === 0) return current;

  const byId = new Map(current.map((message) => [message.id, message]));
  let changed = false;

  for (const message of incoming) {
    const existing = byId.get(message.id);

    if (existing === undefined) {
      byId.set(message.id, message);
      changed = true;
      continue;
    }

    if (existing.body === null && message.body !== null) {
      byId.set(message.id, message);
      changed = true;
    }
  }

  return changed ? [...byId.values()].sort((a, b) => a.id - b.id) : current;
}

/**
 * Bir konusmanin mesajlarini tutar ve yenilerini getirir.
 *
 * Once Reverb uzerinden ozel kanala abone olunur; mesajlar aninda duser.
 * Soket kurulamazsa ya da sessizce olurse (vekil sunucu zaman asimi, uyku,
 * kopuk ag) bes saniyelik yoklama devreye girer. Soket calisirken de yarim
 * dakikada bir yoklanir: soketin oldugunu baska turlu anlayamayiz.
 *
 * Disariya verdigi sekil degismez; bileşenler tasiyiciyi hic bilmez.
 */
export function useConversation(conversationId: number | null, pollMs = 5000) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [compose, setCompose] = useState<ComposeState>({
    credit_cost: 0,
    locked: false,
    can_send: true,
    notice: null,
  });
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

  useEffect(() => {
    if (!conversationId) return;

    let stopped = false;
    let live = false;
    let ticks = 0;
    let socket: Awaited<ReturnType<typeof realtime>> = null;
    const channel = `conversation.${conversationId}`;

    const pull = () => {
      if (stopped || document.hidden) return;

      apiRequest<{ messages: ChatMessage[] }>(`/conversations/${conversationId}/poll?after=${lastId.current}`)
        .then((response) => {
          if (stopped || response.messages.length === 0) return;
          setMessages((current) => mergeMessages(current, response.messages));
          lastId.current = Math.max(lastId.current, ...response.messages.map((message) => message.id));
        })
        .catch(() => {
          // Gecici ag hatasi: bir sonraki turda tekrar denenir.
        });
    };

    realtime()
      .then((instance) => {
        if (stopped || !instance) return;
        socket = instance;

        instance.private(channel).listen(".message.sent", (payload: Broadcast) => {
          if (stopped) return;
          // "mine" burada gecicidir; gercegi render sirasinda viewer_id ile bulunur.
          setMessages((current) => mergeMessages(current, [{ ...payload, mine: false }]));
          lastId.current = Math.max(lastId.current, payload.id);
        });

        live = true;

        // Soket koparsa yoklama ANINDA devralir; yoksa kalp atisina kadar
        // (yarim dakika) mesajlar gelmemis gibi gorunurdu.
        const connection = (instance as unknown as PusherLike).connector?.pusher?.connection;
        connection?.bind("state_change", ({ current }: { current: string }) => {
          live = current === "connected";
          if (!live) pull();
        });
      })
      .catch(() => undefined);

    const timer = window.setInterval(() => {
      if (stopped) return;
      ticks += 1;
      // Soket calisirken yalnizca kalp atisi (30 sn); yoksa her turda.
      if (live && ticks % 6 !== 0) return;
      pull();
    }, pollMs);

    // Sekmeye donunce bekletilmeden bir kez yoklanir.
    const onVisibility = () => { if (!document.hidden) pull(); };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      stopped = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
      socket?.leave(channel);
    };
  }, [conversationId, pollMs]);

  const send = useCallback(async (body: string) => {
    if (!conversationId) return null;
    const response = await apiRequest<{ data: ChatMessage; compose: ComposeState }>(
      `/conversations/${conversationId}/messages`,
      { method: "POST", body: JSON.stringify({ body }) },
    );
    setMessages((current) => mergeMessages(current, [response.data]));
    setCompose(response.compose);
    lastId.current = Math.max(lastId.current, response.data.id);
    return response.data;
  }, [conversationId]);

  /**
   * Hizmet veren konusmayi acar. Basarili olursa konusma bastan yuklenir:
   * kilitliyken govdeler hic gelmedigi icin elde guncellenecek bir metin yok.
   */
  const unlock = useCallback(async () => {
    if (!conversationId) return null;

    const response = await apiRequest<{ credit_spent: number; balance: number | null }>(
      `/conversations/${conversationId}/unlock`,
      { method: "POST" },
    );

    const detay = await apiRequest<{ data: ConversationSummary; messages: ChatMessage[]; compose: ComposeState }>(
      `/conversations/${conversationId}`,
    );

    setSummary(detay.data);
    setMessages(detay.messages);
    setCompose(detay.compose);
    lastId.current = detay.messages.at(-1)?.id ?? 0;

    return response;
  }, [conversationId]);

  // Sahiplik gonderen kimligiyle belirlenir: soketten gelen mesajda sunucu
  // "mine" gonderemez, cunku ayni yayini iki taraf da aliyor.
  const owned = useMemo(() => {
    const viewerId = summary?.viewer_id;
    if (viewerId === undefined) return messages;

    return messages.map((message) => message.mine === (message.sender_id === viewerId)
      ? message
      : { ...message, mine: message.sender_id === viewerId });
  }, [messages, summary]);

  return { messages: owned, compose, summary, loading, error, send, unlock };
}
