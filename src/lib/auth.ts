import { cookies } from "next/headers";
import { SESSION_COOKIE, SESSION_TTL_SECONDS, accounts, authBypassed, authSecret, signSession, verifySession, type Account, type Role, type Session } from "@/lib/session";

const devSession: Session = { key: "dev", name: "Lokal CEO", role: "ceo", exp: Number.MAX_SAFE_INTEGER };

function safeEqual(left: string, right: string) {
  const a = new TextEncoder().encode(left), b = new TextEncoder().encode(right);
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return diff === 0;
}

export function findAccount(key: string | undefined, password: string): Account | null {
  const candidates = key ? accounts().filter((item) => item.key === key.trim().toLowerCase()) : accounts();
  return candidates.find((item) => safeEqual(item.password, password)) ?? null;
}

export async function currentSession(): Promise<Session | null> {
  if (authBypassed()) return devSession;
  return verifySession((await cookies()).get(SESSION_COOKIE)?.value, authSecret());
}

export async function createSession(account: Account) {
  const session: Session = { key: account.key, name: account.name, role: account.role, exp: Date.now() + SESSION_TTL_SECONDS * 1000 };
  (await cookies()).set(SESSION_COOKIE, await signSession(session, authSecret()), { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: SESSION_TTL_SECONDS });
}

export async function destroySession() { (await cookies()).delete(SESSION_COOKIE); }

/** API route’lar uchun: sessiya yo‘q bo‘lsa 401, rol yetmasa 403 javobini qaytaradi. */
export async function guard(role?: Role): Promise<{ session: Session } | { response: Response }> {
  const session = await currentSession();
  if (!session) return { response: Response.json({ error: "Avval tizimga kiring." }, { status: 401 }) };
  if (role === "ceo" && session.role !== "ceo") return { response: Response.json({ error: "Bu amal uchun CEO huquqi kerak." }, { status: 403 }) };
  return { session };
}
