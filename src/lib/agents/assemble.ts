import { fallbackInsight, fallbackSummary } from "@/lib/agents/fallback";
import { hasUngroundedNumbers, metricTable, metricText } from "@/lib/agents/metrics";
import type { SubAgentKey } from "@/lib/agents/run";
import type { AgentReport, CeoPlan, Proposal } from "@/lib/agents/schemas";
import { dueInHours } from "@/lib/time";
import type { AgentInsight, AgentName, Brief, BusinessSnapshot, NotificationLevel, Recommendation } from "@/lib/types";

const OWNERS: Record<SubAgentKey, AgentName> = { moliya: "Moliya", savdo: "Savdo", marketing: "Marketing" };
const ORDER: SubAgentKey[] = ["moliya", "savdo", "marketing"];
const MAX_CEO_ACTIONS = 3;
const RANK: Record<NotificationLevel, number> = { critical: 0, approval_required: 1, digest: 2 };

/** Model matnidagi raqamlar tekshiriladi; ishonchsiz bo‘lsa faqat ma’lumotdan olingan qiymatlar qoladi. */
function groundEvidence(proposal: Proposal, snapshot: BusinessSnapshot) {
  const metrics = metricText(snapshot, proposal.evidenceMetrics);
  const text = hasUngroundedNumbers(proposal.evidence, snapshot) ? "" : proposal.evidence.trim().replace(/[.\s]+$/, "");
  return text ? `${text} (${metrics})` : metrics;
}

function buildInsight(key: SubAgentKey, report: AgentReport | undefined, snapshot: BusinessSnapshot): AgentInsight {
  const owner = OWNERS[key];
  if (!report || hasUngroundedNumbers(`${report.insight.headline} ${report.insight.detail}`, snapshot)) return fallbackInsight(owner, snapshot);
  return { agent: owner, headline: report.insight.headline, detail: report.insight.detail, signal: report.insight.signal, metric: metricTable(snapshot)[report.insight.metricKey].text };
}

export function assembleBrief(input: {
  snapshot: BusinessSnapshot;
  source: Brief["source"];
  briefDate: string;
  reports: Array<{ key: SubAgentKey; report: AgentReport }>;
  plan: CeoPlan | null;
}): Brief {
  const { snapshot, source, briefDate, reports, plan } = input;
  const byKey = new Map(reports.map(({ key, report }) => [key, report]));
  const decisions = new Map((plan?.decisions ?? []).map((decision) => [decision.ref.trim().toLowerCase(), decision]));

  type Candidate = { recommendation: Recommendation; priority: number };
  const candidates: Candidate[] = [];
  for (const key of ORDER) {
    const report = byKey.get(key);
    if (!report) continue;
    for (const proposal of report.proposals) {
      const ref = `${key}:${proposal.key}`;
      const decision = decisions.get(ref);
      candidates.push({
        priority: decision?.priority ?? (proposal.ceoDecision ? 2 : 4),
        recommendation: {
          id: crypto.randomUUID(), dedupeKey: ref, title: proposal.title, owner: OWNERS[key], impact: proposal.impact,
          notification: decision?.notification ?? (proposal.ceoDecision ? "approval_required" : "digest"),
          evidence: groundEvidence(proposal, snapshot), expectedResult: proposal.expectedResult,
          dueAt: dueInHours(proposal.dueHours), status: "draft",
        },
      });
    }
  }

  // CEO stoliga eng ko‘pi 3 ta amal chiqadi, qolgani bo‘lim digestiga tushadi.
  const ceoLevel = candidates
    .filter(({ recommendation }) => recommendation.notification !== "digest")
    .sort((left, right) => RANK[left.recommendation.notification] - RANK[right.recommendation.notification] || left.priority - right.priority);
  for (const extra of ceoLevel.slice(MAX_CEO_ACTIONS)) extra.recommendation.notification = "digest";

  const recommendations = candidates
    .sort((left, right) => RANK[left.recommendation.notification] - RANK[right.recommendation.notification] || left.priority - right.priority || left.recommendation.dueAt.localeCompare(right.recommendation.dueAt))
    .map(({ recommendation }) => recommendation);

  const summary = plan && !hasUngroundedNumbers(plan.executiveSummary, snapshot) ? plan.executiveSummary : fallbackSummary(snapshot);
  // Bir yoki ikki agent (yoki CEO agenti) yiqilgan bo‘lsa brif to‘liq agent mahsuloti emas — panelda halol belgilanadi.
  const engine: Brief["engine"] = plan && reports.length === ORDER.length ? "agentlar" : "qisman";
  return {
    id: crypto.randomUUID(), briefDate, generatedAt: new Date().toISOString(), source, engine,
    executiveSummary: summary, insights: ORDER.map((key) => buildInsight(key, byKey.get(key), snapshot)), recommendations,
  };
}
