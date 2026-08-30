"use server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createSession, destroySession, findAccount } from "@/lib/auth";
import { authConfigured } from "@/lib/session";

// Instansiya darajasidagi oddiy cheklov: bitta umumiy parolga cheksiz urinishning oldini oladi.
const attempts = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 10;

function tooManyAttempts(ip: string) {
  const now = Date.now();
  const entry = attempts.get(ip);
  if (!entry || now > entry.resetAt) { attempts.set(ip, { count: 1, resetAt: now + WINDOW_MS }); return false; }
  entry.count += 1;
  return entry.count > MAX_ATTEMPTS;
}

export async function loginAction(formData: FormData) {
  if (!authConfigured()) redirect("/login?error=config");
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || "nomalum";
  if (tooManyAttempts(ip)) redirect("/login?error=limit");
  const key = String(formData.get("key") ?? "").trim();
  const account = findAccount(key || undefined, String(formData.get("password") ?? ""));
  if (!account) redirect("/login?error=1");
  attempts.delete(ip);
  await createSession(account);
  redirect("/");
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}
