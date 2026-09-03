"use client";

import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";

export type SessionUser = {
  id: number;
  name: string;
  email?: string;
  roles: string[];
};

/**
 * Oturumu bir kez okur. Ust cubuk her sayfada ayni gorunmek zorunda oldugu
 * icin, oturumu kendi cekmeyen sayfalar da bu kancayi kullanir.
 */
export function useSession(enabled = true) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    apiRequest<{ data: SessionUser }>("/me")
      .then((response) => { if (active) setUser(response.data); })
      .catch(() => undefined)
      .finally(() => { if (active) setReady(true); });
    return () => { active = false; };
  }, [enabled]);

  return { user, ready };
}
