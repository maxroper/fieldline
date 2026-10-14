import { apiBase, transport } from "./transport";

/**
 * The one HTTP client. Same-origin `/api` in development (Vite proxies to the API) and in production
 * when the web app is served next to the API; set VITE_API_URL to call a separate host. The static
 * demo swaps the transport for an in-page call (see `demo.ts`); nothing here changes.
 */
export class ApiError extends Error {
  status: number;
  issues: unknown;
  constructor(status: number, message: string, issues?: unknown) {
    super(message);
    this.status = status;
    this.issues = issues;
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {};
  let payload: BodyInit | undefined;
  if (body instanceof FormData) payload = body;
  else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }
  const res = await transport(path, { method, headers, body: payload });
  const text = await res.text();
  const data = text ? (safeJson(text) as { error?: string; issues?: unknown }) : {};
  if (!res.ok) throw new ApiError(res.status, (data && typeof data === "object" && data.error) || res.statusText, data?.issues);
  return data as T;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, body),
  patch: <T>(path: string, body?: unknown) => request<T>("PATCH", path, body),
  put: <T>(path: string, body?: unknown) => request<T>("PUT", path, body),
  delete: <T>(path: string) => request<T>("DELETE", path),
  upload: <T>(path: string, form: FormData) => request<T>("POST", path, form),
  /** Fetch a file or export through the transport and hand it to the browser as a download. */
  download: async (path: string, filename: string) => {
    const res = await transport(path);
    if (!res.ok) throw new ApiError(res.status, res.statusText);
    const url = URL.createObjectURL(await res.blob());
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  },
  eventsUrl: () => `${apiBase}/api/events`,
};

export function qs(params: Record<string, string | number | boolean | null | undefined>): string {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== "");
  if (!entries.length) return "";
  return "?" + entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join("&");
}
