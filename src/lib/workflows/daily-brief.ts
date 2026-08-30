import { assembleBrief } from "@/lib/agents/assemble";
import { fallbackInsight, fallbackRecommendations, fallbackSummary } from "@/lib/agents/fallback";
import { SUB_AGENT_KEYS, aiAvailable, runCeoAgent, runSubAgent, type SubAgentKey } from "@/lib/agents/run";
import type { AgentReport } from "@/lib/agents/schemas";
import { getBusinessSnapshot } from "@/lib/business";
import { claimAlert, releaseAlert, saveBrief, saveSnapshot } from "@/lib/db";
import { resolveTeam } from "@/lib/teams";
import { sendCriticalAlerts, sendDailyBrief, sendTeamDigest, type Delivery } from "@/lib/telegram";
import { tashkentDate } from "@/lib/time";
import type { Brief, BusinessSnapshot, Recommendation, Team } from "@/lib/types";

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
  const critical: Array<{ item: Recommendation; alertKey: string }> = [];
  for (const item of brief.recommendations.filter((entry) => entry.notification === "critical" && entry.status === "draft")) {
    const alertKey = `${brief.briefDate}:${item.dedupeKey}`;
    if (await claimAlert(alertKey)) critical.push({ item, alertKey });
  }
  if (!critical.length) return;
  const result = await sendCriticalAlerts(critical.map(({ item }) => item));
  if (!result.delivered) for (const { alertKey } of critical) await releaseAlert(alertKey);
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

/** Digest amallari CEO stoliga chiqmaydi — shuning uchun ularni bajaradigan jamoaga kuniga bir marta ro‘yxat bo‘lib boradi. */
export async function notifyTeamDigests(brief: Brief) {
  const pending = brief.recommendations.filter((item) => item.notification === "digest" && item.status === "draft");
  const groups = new Map<string, { team: Team; items: Recommendation[] }>();
  for (const item of pending) {
    const team = await resolveTeam(item.owner);
    if (!team) continue;
    const group = groups.get(team.key) ?? { team, items: [] };
    group.items.push(item);
    groups.set(team.key, group);
  }

  const sent: Array<{ team: string; delivered: boolean; reason?: string }> = [];
  for (const { team, items } of groups.values()) {
    // Kun davomida cron qayta ishga tushsa jamoa ikkinchi marta bezovta qilinmaydi.
    const alertKey = `digest:${brief.briefDate}:${team.key}`;
    if (!(await claimAlert(alertKey))) continue;
    const result = await sendTeamDigest(items, team);
    if (!result.delivered) await releaseAlert(alertKey);
    sent.push({ team: team.key, ...result });
  }
  return sent;
}

/** Brifni yetkazish — cron ham, paneldagi «Brifni yangilash» ham shu yagona yo‘ldan o‘tadi.
 *  CEO chatiga kuniga bir marta (qulf bilan), jamoalarga digest; muvaffaqiyatsiz yuborish qulfni bo‘shatadi. */
export async function deliverBrief(brief: Brief) {
  let delivery: Delivery;
  const alertKey = `brif:${brief.briefDate}`;
  if (!(await claimAlert(alertKey))) {
    delivery = { delivered: false, skipped: true, reason: "Bugungi brif CEO chatiga allaqachon yuborilgan" };
  } else {
    delivery = await sendDailyBrief(brief);
    if (!delivery.delivered) await releaseAlert(alertKey);
  }
  return { delivery, digests: await notifyTeamDigests(brief) };
}
