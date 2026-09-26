"use client";

import Echo from "laravel-echo";
import Pusher from "pusher-js";
import { apiRequest } from "./api";

type RealtimeConfig = {
  key: string | null;
  host: string;
  port: number;
  scheme: "http" | "https";
};

let pending: Promise<Echo<"reverb"> | null> | null = null;

/**
 * Canli tasiyici (Laravel Reverb).
 *
 * Ayarlar derleme aninda gomulmez, calisma aninda /api/realtime ucundan
 * okunur: tek bir web imaji hem yerelde hem uretimde dogru adrese baglanir.
 *
 * Hicbir kosulda hata firlatmaz. Anahtar yoksa ya da baglanti kurulamazsa
 * null doner ve cagiran taraf yoklamayla devam eder; boylece Reverb kapali
 * oldugunda mesajlasma calismaya devam eder, sadece anliklik kaybolur.
 */
export function realtime(): Promise<Echo<"reverb"> | null> {
  if (pending) return pending;

  pending = apiRequest<RealtimeConfig>("/realtime")
    .then((config) => {
      if (!config.key) return null;

      // laravel-echo pusher-js'i global uzerinden bekliyor.
      (window as unknown as { Pusher: typeof Pusher }).Pusher = Pusher;

      return new Echo<"reverb">({
        broadcaster: "reverb",
        key: config.key,
        wsHost: config.host,
        wsPort: config.port,
        wssPort: config.port,
        forceTLS: config.scheme === "https",
        enabledTransports: ["ws", "wss"],
        // wsHost verildiginde yok sayilir; pusher-js yine de bir deger bekliyor.
        cluster: "mt1",
        authorizer: (channel: { name: string }) => ({
          authorize: (
            socketId: string,
            callback: (error: Error | null, data: { auth: string } | null) => void,
          ) => {
            apiRequest<{ auth: string }>("/broadcasting/auth", {
              method: "POST",
              body: JSON.stringify({ socket_id: socketId, channel_name: channel.name }),
            })
              .then((data) => callback(null, data))
              .catch((error: unknown) => callback(error as Error, null));
          },
        }),
      });
    })
    .catch(() => null);

  return pending;
}
