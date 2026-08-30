import { hasDatabase, listStoredTeams, syncTeams } from "@/lib/db";
import type { AgentName, Team } from "@/lib/types";

const OWNER_KEYS: Record<AgentName, string> = { Moliya: "moliya", Savdo: "savdo", Marketing: "marketing" };

/** `TELEGRAM_TEAM_CHAT_IDS` — JSON massiv: [{"key":"savdo","label":"Savdo jamoasi","chatId":"-100..."}] */
export function envTeams(): Team[] {
  const teams: Team[] = [];
  const raw = process.env.TELEGRAM_TEAM_CHAT_IDS;
  if (raw) {
    try {
      for (const item of JSON.parse(raw) as Team[]) {
        if (item?.key && item?.chatId) teams.push({ key: String(item.key).toLowerCase(), label: item.label || String(item.key), chatId: String(item.chatId) });
      }
    } catch { /* noto‘g‘ri JSON — fallback ishlatiladi */ }
  }
  const fallback = process.env.TELEGRAM_DEFAULT_EXECUTOR_CHAT_ID;
  if (fallback && !teams.some((team) => team.key === "asosiy")) teams.push({ key: "asosiy", label: "Asosiy ijrochi", chatId: fallback });
  return teams;
}

let synced: Promise<void> | null = null;
function syncOnce(seeds: Team[]) {
  if (!synced) synced = syncTeams(seeds).then(() => undefined, () => { synced = null; });
  return synced;
}

export async function listTeams(): Promise<Team[]> {
  const seeds = envTeams();
  if (!hasDatabase()) return seeds;
  try {
    await syncOnce(seeds);
    const stored = await listStoredTeams();
    return stored.length ? stored : seeds;
  } catch { return seeds; }
}

/** Aniq tanlangan kalit topilmasa `null` — vazifa indamay boshqa jamoaning chatiga ketib qolmasligi uchun.
 *  Kalit berilmaganda: owner bo‘yicha jamoa → asosiy ijrochi → birinchi jamoa. */
export async function resolveTeam(owner: AgentName, key?: string | null): Promise<Team | null> {
  const teams = await listTeams();
  const wanted = key?.trim().toLowerCase();
  if (wanted) return teams.find((team) => team.key === wanted) ?? null;
  return teams.find((team) => team.key === OWNER_KEYS[owner])
    ?? teams.find((team) => team.key === "asosiy")
    ?? teams[0]
    ?? null;
}
