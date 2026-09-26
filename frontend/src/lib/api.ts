declare global {
  interface Window {
    __FLAVORDEX_CONFIG__?: {
      apiUrl?: string;
    };
  }
}

export function apiUrl(path: string): string {
  const baseUrl =
    (typeof window !== "undefined" && window.__FLAVORDEX_CONFIG__?.apiUrl) ||
    process.env.NEXT_PUBLIC_API_URL ||
    (process.env.NODE_ENV === "production" ? "" : "http://localhost:8000");

  if (!baseUrl) {
    throw new Error("API_URL is not configured for this deployment");
  }

  const API_BASE_URL = baseUrl;
  const normalizedBase = API_BASE_URL.replace(/\/$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${normalizedBase}${normalizedPath}`;
}

export function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(apiUrl(path), init);
}
