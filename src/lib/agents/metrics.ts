import type { BusinessSnapshot } from "@/lib/types";

export const METRIC_KEYS = [
  "pipeline", "konversiya", "kechikkanFollowup", "issiqLead", "haftalikTushum",
  "tushum", "xarajat", "kassaQoldigi", "rejaTushum", "kechikkanTolovlar",
  "sofPulOqimi", "rejaBajarilishi",
] as const;

export type MetricKey = (typeof METRIC_KEYS)[number];
export type Metric = { key: MetricKey; label: string; value: number; text: string };

const money = (value: number) => `${Math.round(value / 1_000_000)} mln so‘m`;
const percent = (value: number) => `${Math.round(value)}%`;
const count = (value: number) => `${value} ta`;

export function metricTable(snapshot: BusinessSnapshot): Record<MetricKey, Metric> {
  const { sales, finance } = snapshot;
  const netCash = finance.revenue - finance.expenses;
  const planShare = finance.planRevenue ? (finance.revenue / finance.planRevenue) * 100 : 0;
  const entries: Array<[MetricKey, string, number, string]> = [
    ["pipeline", "Pipeline", sales.pipeline, money(sales.pipeline)],
    ["konversiya", "Konversiya", sales.conversion, percent(sales.conversion)],
    ["kechikkanFollowup", "Muddati o‘tgan follow-up", sales.overdueFollowups, count(sales.overdueFollowups)],
    ["issiqLead", "Issiq lead", sales.hotLeads, count(sales.hotLeads)],
    ["haftalikTushum", "Haftalik tushum", sales.weeklyRevenue, money(sales.weeklyRevenue)],
    ["tushum", "Tushum", finance.revenue, money(finance.revenue)],
    ["xarajat", "Xarajat", finance.expenses, money(finance.expenses)],
    ["kassaQoldigi", "Kassa qoldig‘i", finance.cashBalance, money(finance.cashBalance)],
    ["rejaTushum", "Reja (tushum)", finance.planRevenue, money(finance.planRevenue)],
    ["kechikkanTolovlar", "Kechikkan to‘lov", finance.overdueInvoices, count(finance.overdueInvoices)],
    ["sofPulOqimi", "Sof pul oqimi", netCash, money(netCash)],
    ["rejaBajarilishi", "Reja bajarilishi", planShare, percent(planShare)],
  ];
  return Object.fromEntries(entries.map(([key, label, value, text]) => [key, { key, label, value, text }])) as Record<MetricKey, Metric>;
}

export function metricText(snapshot: BusinessSnapshot, keys: MetricKey[]) {
  const table = metricTable(snapshot);
  return keys.map((key) => `${table[key].label.toLowerCase()} ${table[key].text}`).join(", ");
}

/** Model matnida uchrashi mumkin bo‘lgan yagona ruxsat etilgan raqamlar — snapshot’dan olinganlari. */
function allowedNumbers(snapshot: BusinessSnapshot) {
  const allowed = new Set<string>();
  for (const metric of Object.values(metricTable(snapshot))) {
    allowed.add(String(metric.value));
    allowed.add(String(Math.round(metric.value)));
    allowed.add(String(Math.round(metric.value / 1_000_000)));
  }
  return allowed;
}

/** Modelga raqam yozish taqiqlangan; bu tekshiruv qoidabuzarlikni ushlaydi. */
export function hasUngroundedNumbers(text: string, snapshot: BusinessSnapshot) {
  const numbers = text.match(/\d+(?:[.,]\d+)?/g);
  if (!numbers) return false;
  const allowed = allowedNumbers(snapshot);
  return numbers.some((value) => !allowed.has(value.replace(",", ".")) && !allowed.has(value));
}
