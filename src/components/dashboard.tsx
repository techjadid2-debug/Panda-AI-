"use client";
import { useState } from "react";
import { Activity, Bot, Check, Clock3, LogOut, Play, Send, ShieldCheck, X } from "lucide-react";
import { logoutAction } from "@/app/actions";
import { formatDateTime, formatDue, isOverdue } from "@/lib/time";
import type { Brief, Recommendation } from "@/lib/types";
import type { Role } from "@/lib/session";

type TeamOption = { key: string; label: string };
type Notice = { tone: "error" | "info"; text: string } | null;

const colors = { Moliya: "bg-amber-50 text-amber-800", Savdo: "bg-sky-50 text-sky-800", Marketing: "bg-fuchsia-50 text-fuchsia-800", CEO: "bg-emerald-50 text-emerald-800" };
const statusLabels = { sent: "Yuborildi", approved: "Tasdiqlandi", rejected: "Rad etildi", draft: "Kutilmoqda" };

export function Dashboard({ initialBrief, teams, user, dbReady, agentIssue }: { initialBrief: Brief | null; teams: TeamOption[]; user: { name: string; role: Role } | null; dbReady: boolean; agentIssue: string | null }) {
  const [brief, setBrief] = useState(initialBrief);
  const [loading, setLoading] = useState(false);
  const [teamKey, setTeamKey] = useState(teams[0]?.key ?? "");
  const [notice, setNotice] = useState<Notice>(null);
  const ceoActions = brief?.recommendations.filter((item) => item.notification !== "digest") ?? [];
  const teamActions = brief?.recommendations.filter((item) => item.notification === "digest") ?? [];
  const canDecide = user?.role === "ceo" && teams.length > 0;

  async function run() {
    setLoading(true); setNotice(null);
    try {
      const response = await fetch("/api/brief", { method: "POST" });
      const payload = await response.json().catch(() => null);
      if (!response.ok) { setNotice({ tone: "error", text: payload?.error ?? "Agentlarni ishga tushirib bo‘lmadi." }); return; }
      setBrief(payload as Brief);
    } catch { setNotice({ tone: "error", text: "Tarmoq xatosi: brif yangilanmadi." }); }
    finally { setLoading(false); }
  }

  async function decide(item: Recommendation, decision: "approved" | "rejected") {
    setNotice(null);
    try {
      const response = await fetch(`/api/recommendations/${item.id}/decision`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, teamKey: decision === "approved" ? teamKey : undefined }),
      });
      const payload = await response.json().catch(() => null);
      if (payload?.recommendation) setBrief((current) => current ? { ...current, recommendations: current.recommendations.map((entry) => entry.id === item.id ? payload.recommendation as Recommendation : entry) } : current);
      if (!response.ok) setNotice({ tone: "error", text: payload?.error ?? "Qarorni saqlab bo‘lmadi." });
      else if (payload?.alreadyDecided) setNotice({ tone: "info", text: "Bu amal bo‘yicha qaror allaqachon qabul qilingan." });
      else if (payload?.delivery && !payload.delivery.delivered) setNotice({ tone: "error", text: `Tasdiqlandi, lekin Telegramga yetkazilmadi: ${payload.delivery.reason ?? "noma’lum xato"}` });
    } catch { setNotice({ tone: "error", text: "Tarmoq xatosi: qaror yuborilmadi." }); }
  }

  return <main className="min-h-screen p-5 md:p-10"><div className="mx-auto max-w-6xl">
    <header className="mb-8 flex flex-col justify-between gap-5 md:flex-row md:items-center">
      <div>
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-emerald-700"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Tizim ishlamoqda</div>
        <h1 className="text-3xl font-bold tracking-tight">CEO boshqaruv markazi</h1>
        <p className="mt-2 text-slate-600">Moliya, marketing va savdo agentlaridan bitta aniq kunlik qaror.</p>
      </div>
      <div className="flex items-center gap-2">
        <button onClick={run} disabled={loading} className="flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 py-3 font-semibold text-white shadow-sm disabled:opacity-60"><Play size={18} fill="currentColor" />{loading ? "Agentlar ishlamoqda…" : "Brifni yangilash"}</button>
        {user && <form action={logoutAction}><button type="submit" title={`${user.name} — chiqish`} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-medium text-slate-600"><LogOut size={18} /></button></form>}
      </div>
    </header>

    {(!dbReady || !teams.length || agentIssue || notice) && <div className="mb-6 space-y-2">
      {!dbReady && <p className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-900"><code className="font-mono">DATABASE_URL</code> sozlanmagan — brif va qarorlar saqlanmaydi.</p>}
      {!teams.length && <p className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-900"><code className="font-mono">TELEGRAM_TEAM_CHAT_IDS</code> sozlanmagan — tasdiqlangan vazifani yuborish uchun ijrochi jamoa yo‘q.</p>}
      {agentIssue && <p className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-900">Agentlar ishlamadi, brif zaxira qoidalar bilan tayyorlandi — {agentIssue}</p>}
      {notice && <p className={`rounded-2xl p-4 text-sm ${notice.tone === "error" ? "bg-rose-50 text-rose-900" : "bg-sky-50 text-sky-900"}`}>{notice.text}</p>}
    </div>}

    {!brief ? <section className="rounded-3xl border border-dashed border-emerald-300 bg-emerald-50 p-10 text-center">
      <Bot className="mx-auto mb-4 text-emerald-700" size={42} />
      <h2 className="text-xl font-bold">Birinchi CEO brifini yarating</h2>
      <p className="mx-auto mt-2 max-w-md text-slate-600">Agentlar savdo va moliya ma’lumotlarini tahlil qilib, tasdiqlashga tayyor ishlar ro‘yxatini beradi.</p>
      <button onClick={run} disabled={loading} className="mt-6 rounded-xl bg-emerald-700 px-5 py-3 font-semibold text-white disabled:opacity-60">Agentlarni ishga tushirish</button>
    </section> : <>
      <section className="mb-6 rounded-3xl bg-[#10271e] p-7 text-white shadow-xl shadow-emerald-950/10"><div className="flex flex-col gap-5 md:flex-row md:justify-between">
        <div>
          <div className="mb-3 flex items-center gap-2 text-sm text-emerald-200"><ShieldCheck size={17} /> CEO AGENT · {brief.source === "demo" ? "DEMO MA’LUMOT" : "ICHKI API"} · {brief.engine === "agentlar" ? "AGENTLAR" : "ZAXIRA QOIDALAR"}</div>
          <h2 className="max-w-3xl text-2xl font-semibold leading-snug">{brief.executiveSummary}</h2>
        </div>
        <div className="shrink-0 text-sm text-emerald-100"><Clock3 className="mb-1" size={17} />{formatDateTime(brief.generatedAt)}</div>
      </div></section>

      <section className="mb-6 grid gap-4 md:grid-cols-3">{brief.insights.map((insight) => <article key={insight.agent} className="rounded-2xl border border-[var(--line)] bg-white p-5">
        <div className="mb-4 flex justify-between"><span className={`rounded-full px-3 py-1 text-xs font-bold ${colors[insight.agent]}`}>{insight.agent}</span><Activity size={18} className={insight.signal === "ogohlantirish" ? "text-amber-500" : "text-emerald-500"} /></div>
        <h3 className="font-bold">{insight.headline}</h3>
        <p className="mt-2 text-sm leading-6 text-slate-600">{insight.detail}</p>
        <p className="mt-4 text-sm font-semibold text-emerald-700">{insight.metric}</p>
      </article>)}</section>

      <section className="rounded-3xl border border-[var(--line)] bg-white p-6">
        <div className="mb-5 flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <h2 className="text-xl font-bold">CEO tasdiqlashi kerak bo‘lgan amallar</h2>
            <p className="mt-1 text-sm text-slate-500">Kundalik ishlar CEO’ga yuborilmaydi: {teamActions.length} ta amal bo‘limlar digestida.</p>
          </div>
          {teams.length > 0 && <select value={teamKey} onChange={(event) => setTeamKey(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium">{teams.map((team) => <option key={team.key} value={team.key}>{team.label}</option>)}</select>}
        </div>
        <div className="space-y-3">{ceoActions.length ? ceoActions.map((item) => <article key={item.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${colors[item.owner]}`}>{item.owner}</span>
                <span className={`text-xs font-semibold ${item.notification === "critical" ? "text-rose-600" : "text-amber-700"}`}>{item.notification === "critical" ? "KRITIK" : "CEO qarori"}</span>
                <span className={`text-xs ${isOverdue(item.dueAt) && item.status === "draft" ? "font-semibold text-rose-600" : "text-slate-500"}`}>{formatDue(item.dueAt)}</span>
              </div>
              <h3 className="font-bold">{item.title}</h3>
              <p className="mt-1 text-sm text-slate-600">Dalil: {item.evidence}</p>
              <p className="mt-1 text-sm text-slate-600">Natija: {item.expectedResult}</p>
              {item.teamLabel && item.status !== "draft" && <p className="mt-1 text-sm text-slate-500">Ijrochi: {item.teamLabel}</p>}
            </div>
            {item.status === "draft" ? (canDecide ? <div className="flex shrink-0 gap-2">
              <button onClick={() => decide(item, "rejected")} aria-label="Rad etish" className="rounded-xl border border-slate-200 bg-white p-2.5 text-slate-600"><X size={18} /></button>
              <button onClick={() => decide(item, "approved")} className="flex items-center gap-2 rounded-xl bg-emerald-700 px-3 py-2 text-sm font-semibold text-white"><Send size={16} /> Tasdiqlash</button>
            </div> : <span className="shrink-0 rounded-xl bg-slate-100 px-3 py-2 text-sm font-medium text-slate-500">CEO tasdig‘i kutilmoqda</span>)
            : <div className={`flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold ${item.status === "rejected" ? "bg-slate-200 text-slate-600" : "bg-emerald-100 text-emerald-800"}`}>{item.status === "rejected" ? <X size={16} /> : <Check size={16} />} {statusLabels[item.status]}</div>}
          </div>
        </article>) : <p className="rounded-2xl bg-emerald-50 p-5 text-sm font-medium text-emerald-800">Bugun CEO aralashuvini talab qiladigan qaror yo‘q.</p>}</div>
      </section>
    </>}
  </div></main>;
}
