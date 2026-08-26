import { ShieldCheck } from "lucide-react";
import { loginAction } from "@/app/actions";
import { accounts, authConfigured } from "@/lib/session";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { error } = await searchParams;
  const list = accounts(), configured = authConfigured();
  return <main className="flex min-h-screen items-center justify-center p-6">
    <div className="w-full max-w-sm rounded-3xl border border-[var(--line)] bg-white p-7 shadow-sm">
      <div className="mb-6 flex items-center gap-2 text-sm font-semibold text-emerald-700"><ShieldCheck size={18} /> Hazrat Panda AI</div>
      <h1 className="text-2xl font-bold tracking-tight">CEO boshqaruv markazi</h1>
      <p className="mt-2 text-sm text-slate-600">Panelga faqat ruxsat etilgan foydalanuvchilar kiradi.</p>
      {configured ? <form action={loginAction} className="mt-6 space-y-3">
        {list.length > 1 && <select name="key" className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium">{list.map((item) => <option key={item.key} value={item.key}>{item.name}</option>)}</select>}
        <input name="password" type="password" required autoFocus placeholder="Parol" className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm" />
        <button type="submit" className="w-full rounded-xl bg-emerald-700 px-5 py-3 font-semibold text-white">Kirish</button>
      </form> : <p className="mt-6 rounded-2xl bg-amber-50 p-4 text-sm text-amber-900">Autentifikatsiya sozlanmagan. <code className="font-mono">AUTH_SECRET</code> va <code className="font-mono">APP_PASSWORD</code> muhit o‘zgaruvchilarini qo‘shing.</p>}
      {error === "1" && <p className="mt-4 text-sm font-medium text-rose-600">Parol noto‘g‘ri.</p>}
      {error === "config" && <p className="mt-4 text-sm font-medium text-rose-600">Server tomonda autentifikatsiya sozlanmagan.</p>}
    </div>
  </main>;
}
