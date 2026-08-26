"use server";
import { redirect } from "next/navigation";
import { createSession, destroySession, findAccount } from "@/lib/auth";
import { authConfigured } from "@/lib/session";

export async function loginAction(formData: FormData) {
  if (!authConfigured()) redirect("/login?error=config");
  const key = String(formData.get("key") ?? "").trim();
  const account = findAccount(key || undefined, String(formData.get("password") ?? ""));
  if (!account) redirect("/login?error=1");
  await createSession(account);
  redirect("/");
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}
