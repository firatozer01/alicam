"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { apiRequest } from "@/lib/api";

export type SessionUser = {
  id: number;
  name: string;
  email?: string;
  roles: string[];
};

/**
 * Onceki ziyarette oturum acik miydi.
 *
 * Yetki DEGIL, yalnizca bir tahmin: ust cubuk /me cevabini beklerken dogru
 * olcude yer tutucu basabilsin diye. Yanlis olmasi bir sey bozmaz, en fazla
 * eski davranisa (bir kerelik kayma) donulur.
 */
const OTURUM_IZI = "alicam:oturum-vardi";

/**
 * Iz localStorage'da; yani React'in disinda bir kaynak. useSyncExternalStore
 * tam bunun icin: sunucu anlik goruntusu her zaman false donuyor, boylece
 * ilk cizim iki tarafta ayni oluyor ve hydration uyusmazligi cikmiyor.
 * Degeri biz yaziyoruz, disaridan degismiyor -- abonelik bos.
 */
const izeAbone = () => () => {};
const izOku = () => {
  try { return window.localStorage.getItem(OTURUM_IZI) === "1"; } catch { return false; }
};
const izSunucu = () => false;

/**
 * Oturumu bir kez okur. Ust cubuk her sayfada ayni gorunmek zorunda oldugu
 * icin, oturumu kendi cekmeyen sayfalar da bu kancayi kullanir.
 */
export function useSession(enabled = true) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [ready, setReady] = useState(false);
  const wasSignedIn = useSyncExternalStore(izeAbone, izOku, izSunucu);

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    apiRequest<{ data: SessionUser }>("/me")
      .then((response) => { if (active) setUser(response.data); })
      .catch(() => undefined)
      .finally(() => { if (active) setReady(true); });
    return () => { active = false; };
  }, [enabled]);

  // Sonuc bir sonraki acilis icin saklanir.
  useEffect(() => {
    if (!ready) return;
    try { window.localStorage.setItem(OTURUM_IZI, user ? "1" : "0"); } catch { /* yoksay */ }
  }, [ready, user]);

  return { user, ready, wasSignedIn };
}
