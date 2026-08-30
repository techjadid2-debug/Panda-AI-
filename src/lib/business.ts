import { z } from "zod";
import type { BusinessSnapshot } from "@/lib/types";

const demo: BusinessSnapshot = { sales: { pipeline: 486_000_000, conversion: 18, overdueFollowups: 14, hotLeads: 9, weeklyRevenue: 124_000_000 }, finance: { revenue: 412_000_000, expenses: 286_000_000, cashBalance: 178_000_000, planRevenue: 480_000_000, overdueInvoices: 3 } };

const snapshotSchema = z.object({
  sales: z.object({ pipeline: z.number(), conversion: z.number(), overdueFollowups: z.number(), hotLeads: z.number(), weeklyRevenue: z.number() }),
  finance: z.object({ revenue: z.number(), expenses: z.number(), cashBalance: z.number(), planRevenue: z.number(), overdueInvoices: z.number() }),
});

/** `INTERNAL_API_URL` yo‘l prefiksi bilan berilishi mumkin (`https://api.example.com/v1`) — bosh `/` uni yeb yuborardi. */
function endpoint(base: string, path: string) {
  return new URL(path.replace(/^\/+/, ""), base.endsWith("/") ? base : `${base}/`);
}

export async function getBusinessSnapshot(): Promise<{ snapshot: BusinessSnapshot; source: "internal-api" | "demo" }> {
  const url = process.env.INTERNAL_API_URL, token = process.env.INTERNAL_API_TOKEN;
  if (!url || !token) return { snapshot: demo, source: "demo" };
  const headers = { Authorization: `Bearer ${token}`, Accept: "application/json" };
  try {
    // Timeout'siz osilib qolgan ichki API butun cron'ni osiltirib qo‘yardi.
    const [sales, finance] = await Promise.all([
      fetch(endpoint(url, process.env.INTERNAL_API_SALES_PATH || "/analytics/sales"), { headers, cache: "no-store", signal: AbortSignal.timeout(10_000) }),
      fetch(endpoint(url, process.env.INTERNAL_API_FINANCE_PATH || "/analytics/finance"), { headers, cache: "no-store", signal: AbortSignal.timeout(10_000) }),
    ]);
    if (!sales.ok || !finance.ok) throw new Error(`Ichki API ${sales.ok ? finance.status : sales.status} qaytardi`);

    // Tekshiruvsiz maydon nomi mos kelmasa raqamlar `NaN` bo‘lib butun brif bo‘ylab tarqalardi.
    const parsed = snapshotSchema.safeParse({ sales: await sales.json(), finance: await finance.json() });
    if (!parsed.success) {
      const issues = parsed.error.issues.map((issue) => `${issue.path.join(".") || "(ildiz)"}: ${issue.message}`).join("; ");
      console.error(`Ichki API javobi kutilgan shaklda emas, demo ma’lumotga qaytildi — ${issues}`);
      return { snapshot: demo, source: "demo" };
    }
    return { snapshot: parsed.data, source: "internal-api" };
  } catch (error) {
    // Ichki API yiqilgani brifni to‘xtatmasligi kerak — panel baribir DEMO belgisi bilan ogohlantiradi.
    console.error(`Ichki API bilan bog‘lanib bo‘lmadi, demo ma’lumotga qaytildi — ${error instanceof Error ? error.message : String(error)}`);
    return { snapshot: demo, source: "demo" };
  }
}
