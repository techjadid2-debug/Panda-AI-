import { assembleBrief } from "@/lib/agents/assemble";
import { fallbackInsight, fallbackRecommendations, fallbackSummary } from "@/lib/agents/fallback";
import { SUB_AGENT_KEYS, aiAvailable, runCeoAgent, runSubAgent, type SubAgentKey } from "@/lib/agents/run";
import type { AgentReport } from "@/lib/agents/schemas";
import { getBusinessSnapshot } from "@/lib/business";
import { claimCriticalAlert, saveBrief, saveSnapshot } from "@/lib/db";
import { sendCriticalAlerts } from "@/lib/telegram";
import { tashkentDate } from "@/lib/time";
import type { Brief, BusinessSnapshot, Recommendation } from "@/lib/types";

function fallbackBrief(snapshot: BusinessSnapshot, source: Brief["source"], briefDate: string): Brief {
  return {
    id: crypto.randomUUID(), briefDate, generatedAt: new Date().toISOString(), source, engine: "qoidalar",
    executiveSummary: fallbackSummary(snapshot),
    insights: [fallbackInsight("Moliya", snapshot), fallbackInsight("Savdo", snapshot), fallbackInsight("Marketing", snapshot)],
    recommendations: fallbackRecommendations(snapshot),
  };
}

/** Bo‘lim agentlari parallel ishlaydi; biri yiqilsa qolganlari davom etadi, hammasi yiqilsa qoidaga qaytamiz. */
async function compose(snapshot: BusinessSnapshot, source: Brief["source"], briefDate: string): Promise<Brief> {
  if (!aiAvailable()) return fallbackBrief(snapshot, source, briefDate);
  const settled = await Promise.all(SUB_AGENT_KEYS.map(async (key: SubAgentKey) => ({ key, report: await runSubAgent(key, snapshot, briefDate) })));
  const reports = settled.filter((entry): entry is { key: SubAgentKey; report: AgentReport } => entry.report !== null);
  if (!reports.length) return fallbackBrief(snapshot, source, briefDate);
  const plan = await runCeoAgent(reports, snapshot, briefDate);
  return assembleBrief({ snapshot, source, briefDate, reports, plan });
}

async function notifyCritical(brief: Brief) {
  const critical: Recommendation[] = [];
  for (const item of brief.recommendations.filter((entry) => entry.notification === "critical" && entry.status === "draft")) {
    if (await claimCriticalAlert(`${brief.briefDate}:${item.dedupeKey}`)) critical.push(item);
  }
  if (critical.length) await sendCriticalAlerts(critical);
}

/** Kunlik workflow: ma’lumot → snapshot → bo‘lim agentlari → CEO agenti → brif → kritik ogohlantirish. */
export async function runDailyBrief(): Promise<Brief> {
  const { snapshot, source } = await getBusinessSnapshot();
  const briefDate = tashkentDate();
  await saveSnapshot(snapshot, source).catch((error) => console.error("Snapshot saqlanmadi", error));
  const brief = await saveBrief(await compose(snapshot, source, briefDate));
  await notifyCritical(brief);
  return brief;
}
