export type Role = "ceo" | "manager";
export type Session = { key: string; name: string; role: Role; exp: number };
export type Account = { key: string; name: string; role: Role; password: string };

export const SESSION_COOKIE = "hp_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

const encoder = new TextEncoder();
const toBase64Url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fromBase64Url = (value: string) => Uint8Array.from(atob(value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=")), (char) => char.charCodeAt(0));
const hmacKey = (secret: string) => crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);

export function authSecret() { return process.env.AUTH_SECRET ?? ""; }

/** Hisoblar `AUTH_ACCOUNTS` (JSON) yoki bitta `APP_PASSWORD` orqali beriladi. */
export function accounts(): Account[] {
  const raw = process.env.AUTH_ACCOUNTS;
  if (raw) {
    try { return (JSON.parse(raw) as Account[]).filter((item) => item?.key && item?.password).map((item) => ({ ...item, name: item.name || item.key, role: item.role === "ceo" ? "ceo" : "manager" })); }
    catch { return []; }
  }
  const password = process.env.APP_PASSWORD;
  return password ? [{ key: "ceo", name: "CEO", role: "ceo", password }] : [];
}

export function authConfigured() { return Boolean(authSecret()) && accounts().length > 0; }
/** Lokal `next dev` uchun: sozlanmagan bo‘lsa panel ochiq qoladi, deployda hech qachon emas. */
export function authBypassed() { return !authConfigured() && process.env.NODE_ENV === "development" && process.env.VERCEL !== "1"; }

export async function signSession(session: Session, secret: string) {
  const payload = toBase64Url(encoder.encode(JSON.stringify(session)));
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", await hmacKey(secret), encoder.encode(payload)));
  return `${payload}.${toBase64Url(signature)}`;
}

export async function verifySession(token: string | undefined, secret: string): Promise<Session | null> {
  if (!token || !secret) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  try {
    if (!(await crypto.subtle.verify("HMAC", await hmacKey(secret), fromBase64Url(signature), encoder.encode(payload)))) return null;
    const session = JSON.parse(new TextDecoder().decode(fromBase64Url(payload))) as Session;
    return session.exp > Date.now() ? session : null;
  } catch { return null; }
}
