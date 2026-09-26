export type ApiErrorPayload = {
  message?: string;
  code?: string;
  errors?: Record<string, string[]>;
  verification?: { email: boolean; phone: boolean };
};

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly payload: ApiErrorPayload,
  ) {
    super(payload.message ?? "İşlem tamamlanamadı.");
  }
}

function readCookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;

  const prefix = `${name}=`;
  return document.cookie
    .split(";")
    .map((value) => value.trim())
    .find((value) => value.startsWith(prefix))
    ?.slice(prefix.length);
}

async function initializeCsrf(): Promise<void> {
  const response = await fetch("/sanctum/csrf-cookie", {
    credentials: "include",
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new ApiError(response.status, { message: "Güvenli oturum başlatılamadı." });
  }
}

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const method = (init.method ?? "GET").toUpperCase();
  const mutates = !["GET", "HEAD", "OPTIONS"].includes(method);

  if (mutates) await initializeCsrf();

  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");

  if (init.body && !(init.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const xsrfToken = readCookie("XSRF-TOKEN");
  if (mutates && xsrfToken) {
    headers.set("X-XSRF-TOKEN", decodeURIComponent(xsrfToken));
  }

  const response = await fetch(`/api${path}`, {
    ...init,
    headers,
    credentials: "include",
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new ApiError(response.status, payload as ApiErrorPayload);
  }

  return payload as T;
}

/**
 * Dosya yukler.
 *
 * apiRequest gövdeyi JSON'a çevirmediği için FormData ile de çalışır,
 * ama asıl mesele CSRF: panel içindeki mevcut yüklemeler XSRF-TOKEN
 * çerezini doğrudan document.cookie'den okuyor ve çerezin daha önce
 * bir başka istekle oluşturulmuş olmasına güveniyor. Sayfayı açıp ilk
 * iş olarak fotoğraf yükleyen kullanıcı 419 alıyordu.
 *
 * Content-Type BİLEREK ayarlanmaz: multipart sınırını tarayıcının
 * kendisi yazmalı.
 */
export async function apiUpload<T>(path: string, file: File, field = "image"): Promise<T> {
  const body = new FormData();
  body.append(field, file);

  return apiRequest<T>(path, { method: "POST", body });
}

export function firstApiError(error: unknown): string {
  if (!(error instanceof ApiError)) return "Beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.";

  const validationMessage = Object.values(error.payload.errors ?? {})[0]?.[0];
  return validationMessage ?? error.message;
}
