import { describe, expect, it } from "vitest";
import { fallbackInsight, fallbackRecommendations } from "@/lib/agents/fallback";
import type { BusinessSnapshot } from "@/lib/types";

const base: BusinessSnapshot = {
  sales: { pipeline: 486_000_000, conversion: 18, overdueFollowups: 14, hotLeads: 9, weeklyRevenue: 124_000_000 },
  finance: { revenue: 412_000_000, expenses: 286_000_000, cashBalance: 178_000_000, planRevenue: 480_000_000, overdueInvoices: 3 },
};

describe("fallbackRecommendations", () => {
  it("qoidalar ma’lumotga qarab yonadi", () => {
    const keys = fallbackRecommendations(base).map((item) => item.dedupeKey);
    expect(keys).toContain("savdo:overdue-followup");
    expect(keys).toContain("moliya:overdue-invoices");
    expect(keys).not.toContain("moliya:kassa-riski");
  });

  it("muammo bo‘lmasa tegishli qoida yonmaydi", () => {
    const calm: BusinessSnapshot = { ...base, sales: { ...base.sales, overdueFollowups: 0 }, finance: { ...base.finance, overdueInvoices: 0 } };
    const keys = fallbackRecommendations(calm).map((item) => item.dedupeKey);
    expect(keys).not.toContain("savdo:overdue-followup");
    expect(keys).not.toContain("moliya:overdue-invoices");
  });

  it("kassa taqchilligida kritik tavsiya beradi", () => {
    const risky: BusinessSnapshot = { ...base, finance: { ...base.finance, revenue: 200_000_000, expenses: 260_000_000 } };
    const item = fallbackRecommendations(risky).find((entry) => entry.dedupeKey === "moliya:kassa-riski");
    expect(item?.notification).toBe("critical");
  });

  it("ochiq qolgan ishlarni takrorlamaydi", () => {
    const open = new Set(["savdo:overdue-followup"]);
    const keys = fallbackRecommendations(base, open).map((item) => item.dedupeKey);
    expect(keys).not.toContain("savdo:overdue-followup");
    expect(keys).toContain("moliya:overdue-invoices");
  });
});

describe("fallbackInsight (Marketing)", () => {
  it("reja ortda qolganda ogohlantiradi", () => {
    const behind: BusinessSnapshot = { ...base, finance: { ...base.finance, revenue: 300_000_000 } };
    expect(fallbackInsight("Marketing", behind).signal).toBe("ogohlantirish");
  });

  it("issiq lead ko‘p bo‘lsa ijobiy signal beradi", () => {
    expect(fallbackInsight("Marketing", base).signal).toBe("ijobiy");
  });
});
