import { describe, expect, it } from "vitest";
import { hasUngroundedNumbers, metricTable } from "@/lib/agents/metrics";
import type { BusinessSnapshot } from "@/lib/types";

const snapshot: BusinessSnapshot = {
  sales: { pipeline: 486_000_000, conversion: 18, overdueFollowups: 14, hotLeads: 9, weeklyRevenue: 124_000_000 },
  finance: { revenue: 412_000_000, expenses: 286_000_000, cashBalance: 178_000_000, planRevenue: 480_000_000, overdueInvoices: 3 },
};

describe("metricTable", () => {
  it("pul qiymatlarini millionda ko‘rsatadi", () => {
    expect(metricTable(snapshot).pipeline.text).toBe("486 mln so‘m");
  });

  it("1 mln dan kichik qiymat 0 mln bo‘lib qolmaydi", () => {
    const small: BusinessSnapshot = { ...snapshot, finance: { ...snapshot.finance, cashBalance: 400_000 } };
    expect(metricTable(small).kassaQoldigi.text).toBe("400 ming so‘m");
  });

  it("reja bajarilishini foizda hisoblaydi", () => {
    expect(metricTable(snapshot).rejaBajarilishi.text).toBe("86%");
  });
});

describe("hasUngroundedNumbers", () => {
  it("snapshot'dan olingan raqamlarni o‘tkazadi", () => {
    expect(hasUngroundedNumbers("Pipeline 486 mln, konversiya 18%", snapshot)).toBe(false);
  });

  it("to‘qib chiqarilgan raqamni ushlaydi", () => {
    expect(hasUngroundedNumbers("Konversiya 55% ga oshdi", snapshot)).toBe(true);
  });

  it("raqamsiz matnni o‘tkazadi", () => {
    expect(hasUngroundedNumbers("Sotuvlar barqaror o‘smoqda", snapshot)).toBe(false);
  });

  it("metrika shakllaridan yasalmagan kichik son ham ushlanadi", () => {
    // 7 hech bir metrika matnida yo‘q — ilgari keng oq ro‘yxat uni o‘tkazib yuborishi mumkin edi.
    expect(hasUngroundedNumbers("7 ta yangi shartnoma imzolandi", snapshot)).toBe(true);
  });
});
