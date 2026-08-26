import { metricTable } from "@/lib/agents/metrics";
import { dueInHours } from "@/lib/time";
import type { AgentInsight, AgentName, BusinessSnapshot, Recommendation } from "@/lib/types";

/** Agentlar ishlamaganda (gateway yo‘q yoki xato) ishlatiladigan qoidaga asoslangan zaxira. */
export function fallbackInsight(agent: AgentName, snapshot: BusinessSnapshot): AgentInsight {
  const table = metricTable(snapshot);
  if (agent === "Moliya") {
    const gap = Math.max(0, snapshot.finance.planRevenue - snapshot.finance.revenue);
    return { agent, headline: `Sof pul oqimi ${table.sofPulOqimi.text}`, detail: `Tushum ${table.tushum.text}, xarajat ${table.xarajat.text}. Reja bajarilishi ${table.rejaBajarilishi.text}.`, signal: gap ? "ogohlantirish" : "ijobiy", metric: table.rejaBajarilishi.text };
  }
  if (agent === "Savdo") {
    return { agent, headline: `${table.issiqLead.text} issiq lead`, detail: `Pipeline ${table.pipeline.text}; ${table.kechikkanFollowup.text} follow-up muddati o‘tgan.`, signal: snapshot.sales.overdueFollowups > 8 ? "ogohlantirish" : "ijobiy", metric: table.konversiya.text };
  }
  return { agent: "Marketing", headline: "Kontent paketi tayyor", detail: "Savdo va moliya signallariga tayangan ijtimoiy isbotli kontent taklifi tayyor.", signal: "neytral", metric: table.haftalikTushum.text };
}

export function fallbackSummary(snapshot: BusinessSnapshot) {
  const table = metricTable(snapshot);
  return `Bugungi fokus: savdo follow-uplarini tiklash va reja–fakt farqini yopish. ${table.pipeline.text} pipeline ichida tezkor harakat talab qiladigan leadlar bor.`;
}

export function fallbackRecommendations(snapshot: BusinessSnapshot): Recommendation[] {
  const table = metricTable(snapshot);
  const id = () => crypto.randomUUID();
  return [
    { id: id(), dedupeKey: "savdo:overdue-followup", title: "Muddati o‘tgan leadlarga follow-up qilish", owner: "Savdo", impact: "Yuqori", notification: snapshot.sales.overdueFollowups >= 20 ? "critical" : "digest", evidence: `Javobsiz leadlar to‘planib qolgan (${table.kechikkanFollowup.text})`, expectedResult: "Konversiyani oshirish", dueAt: dueInHours(8), status: "draft" },
    { id: id(), dedupeKey: "marketing:case-study", title: "Telegramda case-study postini chiqarish", owner: "Marketing", impact: "O‘rta", notification: "digest", evidence: `Reja bajarilishi ${table.rejaBajarilishi.text}`, expectedResult: "Issiq leadlar oqimini kuchaytirish", dueAt: dueInHours(6), status: "draft" },
    { id: id(), dedupeKey: "moliya:overdue-invoices", title: "Kechikkan to‘lovlar bo‘yicha undirish rejasini tasdiqlash", owner: "Moliya", impact: "Yuqori", notification: snapshot.finance.overdueInvoices >= 5 ? "critical" : "approval_required", evidence: `Kechikkan to‘lovlar: ${table.kechikkanTolovlar.text}`, expectedResult: "Cash-flow barqarorligini saqlash", dueAt: dueInHours(26), status: "draft" },
  ];
}
