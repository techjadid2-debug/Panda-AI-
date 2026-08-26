import { Output, ToolLoopAgent, stepCountIs } from "ai";
import { INSTRUCTIONS } from "@/lib/agents/prompts";
import { agentReportSchema, ceoPlanSchema, type AgentReport, type CeoPlan } from "@/lib/agents/schemas";
import { agentTools } from "@/lib/agents/tools";
import { saveAgentRun } from "@/lib/db";
import type { BusinessSnapshot } from "@/lib/types";

export type SubAgentKey = "moliya" | "savdo" | "marketing";
export const SUB_AGENT_KEYS: SubAgentKey[] = ["moliya", "savdo", "marketing"];

const SUB_MODEL = "anthropic/claude-sonnet-5";
const CEO_MODEL = "anthropic/claude-opus-5";

/** Gateway kaliti (lokal) yoki Vercel OIDC tokeni bo‘lmasa agentlar ishga tushmaydi. */
export function aiAvailable() { return Boolean(process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN); }

const providerOptions = (agent: string) => ({ gateway: { user: "ceo", tags: [`agent:${agent}`, "feature:daily-brief"] } });

type RunMeta = { agent: string; model: string; briefDate: string };

async function log(meta: RunMeta, started: number, result: { usage?: { inputTokens?: number; outputTokens?: number }; steps?: unknown[] } | null, output: unknown, error?: unknown) {
  await saveAgentRun({
    briefDate: meta.briefDate, agent: meta.agent, model: meta.model,
    status: error ? "xato" : "ok", durationMs: Date.now() - started,
    inputTokens: result?.usage?.inputTokens, outputTokens: result?.usage?.outputTokens, steps: result?.steps?.length,
    error: error ? (error instanceof Error ? error.message : String(error)) : undefined,
    output: error ? undefined : output,
  }).catch((issue) => console.error("agent_runs yozilmadi", issue));
}

export async function runSubAgent(key: SubAgentKey, snapshot: BusinessSnapshot, briefDate: string): Promise<AgentReport | null> {
  const meta: RunMeta = { agent: key, model: SUB_MODEL, briefDate };
  const started = Date.now();
  try {
    const agent = new ToolLoopAgent({
      model: SUB_MODEL,
      instructions: INSTRUCTIONS[key],
      tools: agentTools(snapshot),
      output: Output.object({ schema: agentReportSchema }),
      stopWhen: stepCountIs(6),
      providerOptions: providerOptions(key),
    });
    const result = await agent.generate({ prompt: `Bugungi sana: ${briefDate}. Tool'lardan foydalanib bo‘limingiz bo‘yicha hisobot va takliflarni tayyorlang.` });
    await log(meta, started, result, result.output);
    return result.output;
  } catch (error) {
    await log(meta, started, null, null, error);
    console.error(`${key} agenti ishlamadi`, error);
    return null;
  }
}

export async function runCeoAgent(reports: Array<{ key: SubAgentKey; report: AgentReport }>, snapshot: BusinessSnapshot, briefDate: string): Promise<CeoPlan | null> {
  const meta: RunMeta = { agent: "ceo", model: CEO_MODEL, briefDate };
  const started = Date.now();
  const digest = reports.map(({ key, report }) => [
    `## ${key}`,
    `Xulosa: ${report.insight.headline} — ${report.insight.detail}`,
    "Takliflar:",
    ...report.proposals.map((proposal) => `- ref: ${key}:${proposal.key}\n  sarlavha: ${proposal.title}\n  dalil: ${proposal.evidence}\n  natija: ${proposal.expectedResult}\n  ta'sir: ${proposal.impact}\n  agent CEO qarori deb belgiladi: ${proposal.ceoDecision ? "ha" : "yo‘q"}`),
  ].join("\n")).join("\n\n");
  try {
    const agent = new ToolLoopAgent({
      model: CEO_MODEL,
      instructions: INSTRUCTIONS.ceo,
      tools: agentTools(snapshot),
      output: Output.object({ schema: ceoPlanSchema }),
      stopWhen: stepCountIs(5),
      providerOptions: providerOptions("ceo"),
    });
    const result = await agent.generate({ prompt: `Bugungi sana: ${briefDate}. Bo‘lim agentlarining hisobotlari:\n\n${digest}\n\nHar bir taklifga qaror yozing va CEO uchun xulosa tayyorlang.` });
    await log(meta, started, result, result.output);
    return result.output;
  } catch (error) {
    await log(meta, started, null, null, error);
    console.error("CEO agenti ishlamadi", error);
    return null;
  }
}
