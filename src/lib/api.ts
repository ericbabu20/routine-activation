// Thin client for our own backend (/api/*). Every request carries the member's
// Supabase access token as a Bearer header; the backend re-verifies it and
// resolves the member identity server-side (never trusting client-sent ids).
import { supabase } from "./supabase";

async function authHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.error) msg = body.error;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

export async function apiGet<T>(path: string): Promise<T> {
  const headers = await authHeader();
  return handle<T>(await fetch(path, { headers }));
}

export async function apiSend<T>(
  path: string,
  method: "POST" | "PATCH" | "PUT" | "DELETE",
  body?: unknown
): Promise<T> {
  const headers = { "Content-Type": "application/json", ...(await authHeader()) };
  return handle<T>(
    await fetch(path, { method, headers, body: body ? JSON.stringify(body) : undefined })
  );
}

/** Fire-and-forget analytics event (never throws). */
export function trackEvent(name: string, detail?: unknown): void {
  apiSend("/api/events", "POST", { name, detail }).catch(() => {});
}
