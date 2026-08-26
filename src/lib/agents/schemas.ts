import { z } from "zod";
import { METRIC_KEYS } from "@/lib/agents/metrics";

const metricKey = z.enum(METRIC_KEYS);

export const proposalSchema = z.object({
  key: z.string().regex(/^[a-z][a-z0-9-]{2,39}$/).describe("Qisqa lotincha slug, masalan `kechikkan-tolovlar`. Bir xil muammo uchun har kuni bir xil bo‘lsin."),
  title: z.string().min(10).max(90).describe("Bitta aniq harakat, buyruq shaklida."),
  impact: z.enum(["Yuqori", "O‘rta", "Past"]),
  evidence: z.string().min(10).max(200).describe("Nega shu ish kerak. Raqam yozmang — raqamlar evidenceMetrics orqali qo‘shiladi."),
  evidenceMetrics: z.array(metricKey).min(1).max(3).describe("Taklifni asoslaydigan ko‘rsatkich kalitlari."),
  expectedResult: z.string().min(5).max(120).describe("Bajarilsa nima o‘zgaradi."),
  dueHours: z.number().int().min(2).max(72).describe("Necha soat ichida bajarilishi kerak."),
  ceoDecision: z.boolean().describe("CEO tasdig‘i kerakmi. Kundalik operatsion ish uchun false."),
});

export const agentReportSchema = z.object({
  insight: z.object({
    headline: z.string().min(5).max(80).describe("Bo‘lim holatining bir jumlalik xulosasi. Raqam yozmang."),
    detail: z.string().min(20).max(240).describe("Nima bo‘layotgani va nega muhimligi. Raqam yozmang."),
    signal: z.enum(["ijobiy", "ogohlantirish", "neytral"]),
    metricKey: z.enum(METRIC_KEYS).describe("Bo‘limni eng yaxshi tavsiflovchi ko‘rsatkich."),
  }),
  proposals: z.array(proposalSchema).min(1).max(3),
});

export const ceoPlanSchema = z.object({
  executiveSummary: z.string().min(40).max(320).describe("CEO uchun 2 gaplik fokus. Raqam yozmang."),
  decisions: z.array(z.object({
    ref: z.string().describe("Taklif havolasi: `bolim:key` ko‘rinishida, hisobotlardagi kabi."),
    notification: z.enum(["digest", "approval_required", "critical"]).describe("digest — bo‘lim o‘zi bajaradi; approval_required — CEO tasdiqlaydi; critical — darhol ogohlantirish."),
    priority: z.number().int().min(1).max(5),
    rationale: z.string().max(160).describe("Nega shu daraja. Raqam yozmang."),
  })).min(1).max(6),
});

export type Proposal = z.infer<typeof proposalSchema>;
export type AgentReport = z.infer<typeof agentReportSchema>;
export type CeoPlan = z.infer<typeof ceoPlanSchema>;
