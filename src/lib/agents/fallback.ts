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
  // Marketing ham ma’lumotga qaraydi: reja ortda bo‘lsa lead oqimi, issiq lead ko‘p bo‘lsa kontent fursati.
  if (table.rejaBajarilishi.value < 80) {
    return { agent: "Marketing", headline: "Lead oqimini kuchaytirish kerak", detail: `Reja bajarilishi ${table.rejaBajarilishi.text} — kontent va reklama orqali yangi lead oqimi talab qilinadi. Haftalik tushum ${table.haftalikTushum.text}.`, signal: "ogohlantirish", metric: table.rejaBajarilishi.text };
  }
  if (snapshot.sales.hotLeads >= 8) {
    return { agent: "Marketing", headline: "Issiq leadlar uchun kontent fursati", detail: `${table.issiqLead.text} issiq lead bor — case-study va ijtimoiy isbot kontenti ularni bitimga tezroq olib keladi.`, signal: "ijobiy", metric: table.issiqLead.text };
  }
  return { agent: "Marketing", headline: "Marketing barqaror rejimda", detail: `Reja bajarilishi ${table.rejaBajarilishi.text}, haftalik tushum ${table.haftalikTushum.text} — joriy kontent ritmini saqlash yetarli.`, signal: "neytral", metric: table.haftalikTushum.text };
}

export function fallbackSummary(snapshot: BusinessSnapshot) {
  const table = metricTable(snapshot);
  return `Bugungi fokus: savdo follow-uplarini tiklash va reja–fakt farqini yopish. ${table.pipeline.text} pipeline ichida tezkor harakat talab qiladigan leadlar bor.`;
}

/** Qoidalar ma’lumotga qarab yonadi; `openKeys` — oldingi kunlardan hali yopilmagan amallar, ular takrorlanmaydi
 *  (agent yo‘lida bu vazifani `ochiqAmallar` tool’i bajaradi). */
export function fallbackRecommendations(snapshot: BusinessSnapshot, openKeys: ReadonlySet<string> = new Set()): Recommendation[] {
  const table = metricTable(snapshot);
  const { sales, finance } = snapshot;
  const netCash = finance.revenue - finance.expenses;
  const planShare = finance.planRevenue ? (finance.revenue / finance.planRevenue) * 100 : 100;
  const id = () => crypto.randomUUID();
  const items: Recommendation[] = [];

  if (sales.overdueFollowups > 0) {
    items.push({ id: id(), dedupeKey: "savdo:overdue-followup", title: "Muddati o‘tgan leadlarga follow-up qilish", owner: "Savdo", impact: sales.overdueFollowups >= 8 ? "Yuqori" : "O‘rta", notification: sales.overdueFollowups >= 20 ? "critical" : "digest", evidence: `Javobsiz leadlar to‘planib qolgan (${table.kechikkanFollowup.text})`, expectedResult: "Konversiyani oshirish", dueAt: dueInHours(8), status: "draft" });
  }
  if (finance.overdueInvoices > 0) {
    items.push({ id: id(), dedupeKey: "moliya:overdue-invoices", title: "Kechikkan to‘lovlar bo‘yicha undirish rejasini tasdiqlash", owner: "Moliya", impact: "Yuqori", notification: finance.overdueInvoices >= 5 ? "critical" : "approval_required", evidence: `Kechikkan to‘lovlar: ${table.kechikkanTolovlar.text}`, expectedResult: "Cash-flow barqarorligini saqlash", dueAt: dueInHours(26), status: "draft" });
  }
  if (netCash < 0 || finance.cashBalance < finance.expenses / 2) {
    items.push({ id: id(), dedupeKey: "moliya:kassa-riski", title: "Xarajatlarni qisqartirish rejasini ko‘rib chiqish", owner: "Moliya", impact: "Yuqori", notification: netCash < 0 ? "critical" : "approval_required", evidence: `Sof pul oqimi ${table.sofPulOqimi.text}, kassa qoldig‘i ${table.kassaQoldigi.text}`, expectedResult: "Kassa barqarorligini tiklash", dueAt: dueInHours(24), status: "draft" });
  }
  if (planShare < 70) {
    items.push({ id: id(), dedupeKey: "savdo:reja-fakt", title: "Reja–fakt farqini yopish bo‘yicha tezkor reja tuzish", owner: "Savdo", impact: "Yuqori", notification: "approval_required", evidence: `Reja bajarilishi ${table.rejaBajarilishi.text}, pipeline ${table.pipeline.text}`, expectedResult: "Oy rejasiga qaytish", dueAt: dueInHours(24), status: "draft" });
  }
  if (planShare < 90 || sales.hotLeads >= 5) {
    items.push({ id: id(), dedupeKey: "marketing:case-study", title: "Telegramda case-study postini chiqarish", owner: "Marketing", impact: "O‘rta", notification: "digest", evidence: `Reja bajarilishi ${table.rejaBajarilishi.text}, ${table.issiqLead.text} issiq lead`, expectedResult: "Issiq leadlar oqimini kuchaytirish", dueAt: dueInHours(6), status: "draft" });
  }

  return items.filter((item) => !openKeys.has(item.dedupeKey));
}
