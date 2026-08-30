import { describe, expect, it } from "vitest";
import { assembleBrief } from "@/lib/agents/assemble";
import type { AgentReport, CeoPlan, Proposal } from "@/lib/agents/schemas";
import type { SubAgentKey } from "@/lib/agents/run";
import type { BusinessSnapshot } from "@/lib/types";

const snapshot: BusinessSnapshot = {
  sales: { pipeline: 486_000_000, conversion: 18, overdueFollowups: 14, hotLeads: 9, weeklyRevenue: 124_000_000 },
  finance: { revenue: 412_000_000, expenses: 286_000_000, cashBalance: 178_000_000, planRevenue: 480_000_000, overdueInvoices: 3 },
};

function proposal(key: string, ceoDecision = true): Proposal {
  return { key, title: `«${key}» bo‘yicha aniq harakat qilish`, impact: "Yuqori", evidence: "Ko‘rsatkichlar harakat talab qilmoqda", evidenceMetrics: ["pipeline"], expectedResult: "Holat yaxshilanadi", dueHours: 8, ceoDecision };
}

function report(proposals: Proposal[]): AgentReport {
  return { insight: { headline: "Bo‘lim holati barqaror", detail: "Ko‘rsatkichlar kutilgan oraliqda, alohida xavf ko‘rinmayapti.", signal: "neytral", metricKey: "pipeline" }, proposals };
}

const fullReports: Array<{ key: SubAgentKey; report: AgentReport }> = [
  { key: "moliya", report: report([proposal("undirish")]) },
  { key: "savdo", report: report([proposal("follow-up"), proposal("reja-fakt")]) },
  { key: "marketing", report: report([proposal("kontent"), proposal("case-study")]) },
];

const plan: CeoPlan = {
  executiveSummary: "Bugungi fokus: undirish va follow-uplarni yakunlash, marketing o‘z ritmida davom etadi.",
  decisions: [{ ref: "moliya:undirish", notification: "approval_required", priority: 1, rationale: "Kassa uchun muhim" }],
};

describe("assembleBrief", () => {
  it("CEO stoliga eng ko‘pi 3 ta amal chiqaradi, qolgani digestga tushadi", () => {
    const brief = assembleBrief({ snapshot, source: "demo", briefDate: "2026-08-30", reports: fullReports, plan });
    const ceoLevel = brief.recommendations.filter((item) => item.notification !== "digest");
    expect(brief.recommendations).toHaveLength(5);
    expect(ceoLevel.length).toBeLessThanOrEqual(3);
  });

  it("hamma agent ishlaganda engine «agentlar» bo‘ladi", () => {
    const brief = assembleBrief({ snapshot, source: "demo", briefDate: "2026-08-30", reports: fullReports, plan });
    expect(brief.engine).toBe("agentlar");
  });

  it("agent yetishmasa yoki CEO plani bo‘lmasa engine «qisman» bo‘ladi", () => {
    const partial = assembleBrief({ snapshot, source: "demo", briefDate: "2026-08-30", reports: fullReports.slice(0, 2), plan });
    const noPlan = assembleBrief({ snapshot, source: "demo", briefDate: "2026-08-30", reports: fullReports, plan: null });
    expect(partial.engine).toBe("qisman");
    expect(noPlan.engine).toBe("qisman");
  });

  it("to‘qilgan raqamli dalil metrika matni bilan almashtiriladi", () => {
    const bad = { ...proposal("soxta"), evidence: "Sotuv 73% ga oshdi" };
    const brief = assembleBrief({ snapshot, source: "demo", briefDate: "2026-08-30", reports: [{ key: "savdo", report: report([bad]) }], plan: null });
    expect(brief.recommendations[0].evidence).not.toContain("73");
    expect(brief.recommendations[0].evidence).toContain("pipeline");
  });
});
