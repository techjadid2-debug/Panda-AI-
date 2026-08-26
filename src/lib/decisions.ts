import { claimRecommendation, getRecommendation, logDecision, markDone, markSent } from "@/lib/db";
import { resolveTeam } from "@/lib/teams";
import { sendTask } from "@/lib/telegram";
import type { DecisionChannel, Recommendation } from "@/lib/types";

export type DecisionInput = { id: string; decision: "approved" | "rejected"; teamKey?: string | null; channel: DecisionChannel; actor: string };
export type DecisionResult = { ok: boolean; recommendation: Recommendation | null; alreadyDecided?: boolean; delivery?: { delivered: boolean; reason?: string }; error?: string };

/** Panel ham, Telegram tugmasi ham shu yagona yo‘ldan o‘tadi: egallash → jurnal → yetkazish → `sent`. */
export async function applyDecision({ id, decision, teamKey, channel, actor }: DecisionInput): Promise<DecisionResult> {
  const existing = await getRecommendation(id);
  if (!existing) return { ok: false, recommendation: null, error: "Amal topilmadi." };

  const team = decision === "approved" ? await resolveTeam(existing.owner, teamKey) : null;
  if (decision === "approved" && !team) return { ok: false, recommendation: existing, error: "Ijrochi jamoa sozlanmagan (TELEGRAM_TEAM_CHAT_IDS)." };

  const { recommendation, claimed } = await claimRecommendation(id, decision, team);
  if (!recommendation) return { ok: false, recommendation: null, error: "Qarorni saqlab bo‘lmadi (DATABASE_URL?)." };
  if (!claimed) return { ok: true, recommendation, alreadyDecided: true };

  await logDecision(id, decision, channel, actor, team ? `Ijrochi: ${team.label}` : undefined);
  if (decision !== "approved" || !team) return { ok: true, recommendation };

  const delivery = await sendTask(recommendation, team);
  if (!delivery.delivered) {
    await logDecision(id, "approved", channel, actor, `Telegramga yuborilmadi: ${delivery.reason ?? "noma’lum xato"}`);
    return { ok: true, recommendation, delivery };
  }
  await logDecision(id, "sent", channel, actor, `Telegram: ${team.label}`);
  return { ok: true, recommendation: (await markSent(id)) ?? recommendation, delivery };
}

export type CompleteInput = { id: string; channel: DecisionChannel; actor: string };

/** Vazifani yakunlash: panel ham, ijrochining Telegram tugmasi ham shu yo‘ldan o‘tadi. */
export async function completeRecommendation({ id, channel, actor }: CompleteInput): Promise<DecisionResult> {
  const existing = await getRecommendation(id);
  if (!existing) return { ok: false, recommendation: null, error: "Amal topilmadi." };
  if (existing.status === "draft") return { ok: false, recommendation: existing, error: "Amal hali tasdiqlanmagan." };
  if (existing.status === "rejected") return { ok: false, recommendation: existing, error: "Rad etilgan amalni yakunlab bo‘lmaydi." };

  const { recommendation, claimed } = await markDone(id);
  if (!recommendation) return { ok: false, recommendation: null, error: "Holatni saqlab bo‘lmadi (DATABASE_URL?)." };
  if (!claimed) return { ok: true, recommendation, alreadyDecided: true };

  await logDecision(id, "done", channel, actor);
  return { ok: true, recommendation };
}
