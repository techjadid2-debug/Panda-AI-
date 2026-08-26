import type { BusinessSnapshot } from "@/lib/types";
const demo: BusinessSnapshot = { sales: { pipeline: 486_000_000, conversion: 18, overdueFollowups: 14, hotLeads: 9, weeklyRevenue: 124_000_000 }, finance: { revenue: 412_000_000, expenses: 286_000_000, cashBalance: 178_000_000, planRevenue: 480_000_000, overdueInvoices: 3 } };
export async function getBusinessSnapshot(): Promise<{ snapshot: BusinessSnapshot; source: "internal-api" | "demo" }> {
  const url = process.env.INTERNAL_API_URL, token = process.env.INTERNAL_API_TOKEN;
  if (!url || !token) return { snapshot: demo, source: "demo" };
  const headers = { Authorization: `Bearer ${token}`, Accept: "application/json" };
  const [sales, finance] = await Promise.all([fetch(new URL(process.env.INTERNAL_API_SALES_PATH || "/analytics/sales", url), { headers, cache: "no-store" }), fetch(new URL(process.env.INTERNAL_API_FINANCE_PATH || "/analytics/finance", url), { headers, cache: "no-store" })]);
  if (!sales.ok || !finance.ok) throw new Error("Ichki API savdo yoki moliya ma’lumotini qaytarmadi.");
  return { snapshot: { sales: await sales.json(), finance: await finance.json() }, source: "internal-api" };
}
