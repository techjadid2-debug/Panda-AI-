import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import { migrations } from "@/db/migrations";
import { tashkentDate } from "@/lib/time";
import type { AgentInsight, AgentRunSummary, Brief, BusinessSnapshot, DecisionChannel, DecisionLogEntry, DecisionStatus, Recommendation, Team } from "@/lib/types";

type Row = Record<string, unknown>;
type Sql = NeonQueryFunction<false, false>;

const COLUMNS = `r.id, r.dedupe_key, r.title, r.owner, r.impact, r.notification, r.evidence, r.expected_result, r.due_at, r.status, r.team_key, r.recipient_chat_id, r.sent_at, r.done_at, t.label AS team_label`;
const FROM = `FROM recommendations r LEFT JOIN teams t ON t.key = r.team_key`;
const iso = (value: unknown) => (value instanceof Date ? value : new Date(String(value))).toISOString();

let connection: Sql | null | undefined;
let migrated: Promise<void> | null = null;

export function hasDatabase() { return Boolean(process.env.DATABASE_URL); }

function connect(): Sql | null {
  if (connection === undefined) connection = process.env.DATABASE_URL ? neon(process.env.DATABASE_URL) : null;
  return connection;
}

export async function runMigrations() {
  const sql = connect();
  if (!sql) return false;
  await sql.query(`CREATE TABLE IF NOT EXISTS _migrations (id text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`);
  const applied = new Set(((await sql.query(`SELECT id FROM _migrations`)) as Row[]).map((row) => String(row.id)));
  for (const migration of migrations) {
    if (applied.has(migration.id)) continue;
    for (const statement of migration.statements) await sql.query(statement);
    await sql.query(`INSERT INTO _migrations (id) VALUES ($1) ON CONFLICT DO NOTHING`, [migration.id]);
  }
  return true;
}

/** Ulanish + migratsiyalar bir marta (instansiya umri davomida) qo‘llanadi. */
async function db(): Promise<Sql | null> {
  const sql = connect();
  if (!sql) return null;
  if (!migrated) migrated = runMigrations().then(() => undefined, (error) => { migrated = null; throw error; });
  await migrated;
  return sql;
}

function mapRecommendation(row: Row): Recommendation {
  return {
    id: String(row.id), dedupeKey: String(row.dedupe_key), title: String(row.title),
    owner: row.owner as Recommendation["owner"], impact: row.impact as Recommendation["impact"], notification: row.notification as Recommendation["notification"],
    evidence: String(row.evidence), expectedResult: String(row.expected_result), dueAt: iso(row.due_at), status: row.status as DecisionStatus,
    teamKey: (row.team_key as string | null) ?? null, teamLabel: (row.team_label as string | null) ?? null, recipientChatId: (row.recipient_chat_id as string | null) ?? null,
    sentAt: row.sent_at ? iso(row.sent_at) : null, doneAt: row.done_at ? iso(row.done_at) : null,
  };
}

async function loadBrief(sql: Sql, row: Row): Promise<Brief> {
  const items = (await sql.query(`SELECT ${COLUMNS} ${FROM} WHERE r.brief_id = $1 ORDER BY r.due_at`, [row.id])) as Row[];
  return {
    id: String(row.id), briefDate: String(row.brief_date), generatedAt: iso(row.generated_at), source: row.source as Brief["source"],
    engine: row.engine as Brief["engine"], executiveSummary: String(row.executive_summary), insights: (row.insights ?? []) as AgentInsight[], recommendations: items.map(mapRecommendation),
  };
}

const BRIEF_COLUMNS = `id, to_char(brief_date, 'YYYY-MM-DD') AS brief_date, generated_at, source, engine, executive_summary, insights`;

export async function saveBrief(brief: Brief): Promise<Brief> {
  const sql = await db();
  if (!sql) return brief;
  const rows = (await sql.query(
    `INSERT INTO briefs (id, brief_date, generated_at, source, engine, executive_summary, insights) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
     ON CONFLICT (brief_date) DO UPDATE SET generated_at = EXCLUDED.generated_at, source = EXCLUDED.source, engine = EXCLUDED.engine, executive_summary = EXCLUDED.executive_summary, insights = EXCLUDED.insights, updated_at = now()
     RETURNING id`,
    [brief.id, brief.briefDate, brief.generatedAt, brief.source, brief.engine, brief.executiveSummary, JSON.stringify(brief.insights)],
  )) as Row[];
  const briefId = String(rows[0].id);
  // Bir kunlik brif qayta ishlansa: dalil/muddat yangilanadi, qabul qilingan qarorlar saqlanib qoladi.
  for (const item of brief.recommendations) {
    await sql.query(
      `INSERT INTO recommendations (id, brief_id, dedupe_key, title, owner, impact, notification, evidence, expected_result, due_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (brief_id, dedupe_key) DO UPDATE SET title = EXCLUDED.title, impact = EXCLUDED.impact, notification = EXCLUDED.notification,
         evidence = EXCLUDED.evidence, expected_result = EXCLUDED.expected_result, due_at = EXCLUDED.due_at, updated_at = now()`,
      [item.id, briefId, item.dedupeKey, item.title, item.owner, item.impact, item.notification, item.evidence, item.expectedResult, item.dueAt],
    );
  }
  return (await getBriefById(briefId)) ?? brief;
}

export async function getBriefById(id: string): Promise<Brief | null> {
  const sql = await db();
  if (!sql) return null;
  const row = ((await sql.query(`SELECT ${BRIEF_COLUMNS} FROM briefs WHERE id = $1`, [id])) as Row[])[0];
  return row ? loadBrief(sql, row) : null;
}

export async function getLatestBrief(): Promise<Brief | null> {
  try {
    const sql = await db();
    if (!sql) return null;
    const row = ((await sql.query(`SELECT ${BRIEF_COLUMNS} FROM briefs ORDER BY brief_date DESC LIMIT 1`)) as Row[])[0];
    return row ? await loadBrief(sql, row) : null;
  } catch { return null; }
}

/** Tarix: tanlangan kunning brifi. */
export async function getBriefByDate(briefDate: string): Promise<Brief | null> {
  try {
    const sql = await db();
    if (!sql) return null;
    const row = ((await sql.query(`SELECT ${BRIEF_COLUMNS} FROM briefs WHERE brief_date = $1`, [briefDate])) as Row[])[0];
    return row ? await loadBrief(sql, row) : null;
  } catch { return null; }
}

/** Panel sana tanlovchisi uchun: brif yozilgan kunlar, yangisidan eskisiga. */
export async function listBriefDates(limit = 14): Promise<string[]> {
  try {
    const sql = await db();
    if (!sql) return [];
    const rows = (await sql.query(
      `SELECT to_char(brief_date, 'YYYY-MM-DD') AS brief_date FROM briefs ORDER BY brief_date DESC LIMIT $1`,
      [Math.max(1, Math.min(limit, 60))],
    )) as Row[];
    return rows.map((row) => String(row.brief_date));
  } catch { return []; }
}

export async function getRecommendation(id: string): Promise<Recommendation | null> {
  const sql = await db();
  if (!sql) return null;
  const row = ((await sql.query(`SELECT ${COLUMNS} ${FROM} WHERE r.id = $1`, [id])) as Row[])[0];
  return row ? mapRecommendation(row) : null;
}

/** Atomik qaror: faqat `draft` holatdagi qatorni egallaydi, shuning uchun ikki kanal bir-birini bosmaydi. */
export async function claimRecommendation(id: string, status: "approved" | "rejected", team: Team | null) {
  const sql = await db();
  if (!sql) return { recommendation: null, claimed: false };
  const rows = (await sql.query(
    `UPDATE recommendations SET status = $2, team_key = COALESCE($3, team_key), recipient_chat_id = COALESCE($4, recipient_chat_id), updated_at = now()
     WHERE id = $1 AND status = 'draft' RETURNING id`,
    [id, status, team?.key ?? null, team?.chatId ?? null],
  )) as Row[];
  return { recommendation: await getRecommendation(id), claimed: rows.length > 0 };
}

export async function markSent(id: string) {
  const sql = await db();
  if (!sql) return null;
  await sql.query(`UPDATE recommendations SET status = 'sent', sent_at = now(), updated_at = now() WHERE id = $1 AND status = 'approved'`, [id]);
  return getRecommendation(id);
}

/** Atomik yakunlash: `approved`/`sent` holatdagi qator, yoki CEO tasdig‘ini talab qilmaydigan digest bandi (`draft`).
 *  Ikkinchi bosish hech narsani o‘zgartirmaydi. */
export async function markDone(id: string) {
  const sql = await db();
  if (!sql) return { recommendation: null, claimed: false };
  const rows = (await sql.query(
    `UPDATE recommendations SET status = 'done', done_at = now(), updated_at = now()
     WHERE id = $1 AND (status IN ('approved', 'sent') OR (status = 'draft' AND notification = 'digest')) RETURNING id`,
    [id],
  )) as Row[];
  return { recommendation: await getRecommendation(id), claimed: rows.length > 0 };
}

export async function logDecision(recommendationId: string, status: string, channel: DecisionChannel, actor: string, note?: string) {
  const sql = await db();
  if (!sql) return;
  await sql.query(`INSERT INTO decision_log (recommendation_id, status, channel, actor, note) VALUES ($1, $2, $3, $4, $5)`, [recommendationId, status, channel, actor, note ?? null]);
}

export async function saveSnapshot(snapshot: BusinessSnapshot, source: string) {
  const sql = await db();
  if (!sql) return;
  await sql.query(
    `INSERT INTO metric_snapshots (captured_on, source, payload) VALUES ($1, $2, $3::jsonb)
     ON CONFLICT (captured_on) DO UPDATE SET source = EXCLUDED.source, payload = EXCLUDED.payload, updated_at = now()`,
    [tashkentDate(), source, JSON.stringify(snapshot)],
  );
}

/** Bir kalit boyicha 12 soatda bir marta yuborishga ruxsat beradi (kritik ogohlantirish, bolim digesti). Bitta so‘rov — parallel ikki cron'dan faqat bittasi qulfni oladi. */
export async function claimAlert(alertKey: string) {
  const sql = await db();
  if (!sql) return false;
  const rows = (await sql.query(
    `INSERT INTO agent_alerts (alert_key, last_sent_at) VALUES ($1, now())
     ON CONFLICT (alert_key) DO UPDATE SET last_sent_at = now()
     WHERE agent_alerts.last_sent_at < now() - interval '12 hours'
     RETURNING alert_key`,
    [alertKey],
  )) as Row[];
  return rows.length > 0;
}

/** Yuborish muvaffaqiyatsiz tugasa qulf qaytariladi — aks holda xabar 12 soat davomida umuman ketmay qoladi. */
export async function releaseAlert(alertKey: string) {
  const sql = await db();
  if (!sql) return;
  await sql.query(`DELETE FROM agent_alerts WHERE alert_key = $1`, [alertKey]);
}

export async function syncTeams(teams: Team[]) {
  const sql = await db();
  if (!sql || !teams.length) return;
  for (const team of teams) {
    await sql.query(
      `INSERT INTO teams (key, label, chat_id) VALUES ($1, $2, $3)
       ON CONFLICT (key) DO UPDATE SET label = EXCLUDED.label, chat_id = EXCLUDED.chat_id, updated_at = now()`,
      [team.key, team.label, team.chatId],
    );
  }
}

export async function listStoredTeams(): Promise<Team[]> {
  const sql = await db();
  if (!sql) return [];
  const rows = (await sql.query(`SELECT key, label, chat_id FROM teams ORDER BY label`)) as Row[];
  return rows.map((row) => ({ key: String(row.key), label: String(row.label), chatId: String(row.chat_id) }));
}

export async function recentSnapshots(days: number): Promise<Array<{ capturedOn: string; snapshot: BusinessSnapshot }>> {
  const sql = await db();
  if (!sql) return [];
  const rows = (await sql.query(
    `SELECT to_char(captured_on, 'YYYY-MM-DD') AS captured_on, payload FROM metric_snapshots ORDER BY captured_on DESC LIMIT $1`,
    [Math.max(1, Math.min(days, 60))],
  )) as Row[];
  return rows.map((row) => ({ capturedOn: String(row.captured_on), snapshot: row.payload as BusinessSnapshot }));
}

/** Oldingi kunlardan qolgan, hali yopilmagan amallar — agentlar takrorlamasligi uchun. */
export async function listOpenRecommendations(days: number): Promise<Recommendation[]> {
  const sql = await db();
  if (!sql) return [];
  const rows = (await sql.query(
    `SELECT ${COLUMNS} ${FROM} JOIN briefs b ON b.id = r.brief_id
     WHERE r.status IN ('draft', 'approved', 'sent') AND b.brief_date >= (CURRENT_DATE - $1::integer)
     ORDER BY r.due_at LIMIT 20`,
    [Math.max(1, Math.min(days, 60))],
  )) as Row[];
  return rows.map(mapRecommendation);
}

export async function saveAgentRun(run: { briefDate: string; agent: string; model: string; status: "ok" | "xato"; durationMs: number; inputTokens?: number; outputTokens?: number; steps?: number; error?: string; output?: unknown }) {
  const sql = await db();
  if (!sql) return;
  await sql.query(
    `INSERT INTO agent_runs (brief_date, agent, model, status, duration_ms, input_tokens, output_tokens, steps, error, output)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)`,
    [run.briefDate, run.agent, run.model, run.status, Math.round(run.durationMs), run.inputTokens ?? null, run.outputTokens ?? null, run.steps ?? null, run.error ?? null, run.output ? JSON.stringify(run.output) : null],
  );
}

/** Panel uchun audit: tanlangan brif amallari bo‘yicha kim, qachon, qaysi kanaldan qaror qilgani. */
export async function listDecisionLog(briefId: string, limit = 30): Promise<DecisionLogEntry[]> {
  try {
    const sql = await db();
    if (!sql) return [];
    const rows = (await sql.query(
      `SELECT d.id, d.recommendation_id, d.status, d.channel, d.actor, d.note, d.created_at, r.title
       FROM decision_log d JOIN recommendations r ON r.id = d.recommendation_id
       WHERE r.brief_id = $1 ORDER BY d.created_at DESC LIMIT $2`,
      [briefId, Math.max(1, Math.min(limit, 100))],
    )) as Row[];
    return rows.map((row) => ({
      id: String(row.id), recommendationId: String(row.recommendation_id), title: String(row.title),
      status: String(row.status), channel: String(row.channel),
      actor: row.actor ? String(row.actor) : null, note: row.note ? String(row.note) : null, at: iso(row.created_at),
    }));
  } catch { return []; }
}

/** Panel uchun telemetriya: tanlangan kunda agentlar qanday ishlagani (davomiylik, tokenlar, xatolar). */
export async function listAgentRuns(briefDate: string): Promise<AgentRunSummary[]> {
  try {
    const sql = await db();
    if (!sql) return [];
    const rows = (await sql.query(
      `SELECT agent, model, status, duration_ms, input_tokens, output_tokens, steps, error, created_at
       FROM agent_runs WHERE brief_date = $1 ORDER BY created_at DESC LIMIT 20`,
      [briefDate],
    )) as Row[];
    return rows.map((row) => ({
      agent: String(row.agent), model: String(row.model), status: row.status as AgentRunSummary["status"],
      durationMs: Number(row.duration_ms), inputTokens: row.input_tokens == null ? null : Number(row.input_tokens),
      outputTokens: row.output_tokens == null ? null : Number(row.output_tokens), steps: row.steps == null ? null : Number(row.steps),
      error: row.error ? String(row.error) : null, at: iso(row.created_at),
    }));
  } catch { return []; }
}

/** Jurnal/telemetriya jadvallari cheksiz o‘smasin — cron har kuni eski qatorlarni tozalaydi. */
export async function cleanupOldRows() {
  const sql = await db();
  if (!sql) return;
  await sql.query(`DELETE FROM agent_runs WHERE created_at < now() - interval '90 days'`);
  await sql.query(`DELETE FROM metric_snapshots WHERE captured_on < CURRENT_DATE - 180`);
  await sql.query(`DELETE FROM agent_alerts WHERE last_sent_at < now() - interval '30 days'`);
  await sql.query(`DELETE FROM decision_log WHERE created_at < now() - interval '365 days'`);
}

export async function latestAgentIssue(briefDate: string): Promise<string | null> {
  const sql = await db();
  if (!sql) return null;
  const row = ((await sql.query(
    `SELECT agent, error FROM agent_runs WHERE brief_date = $1 AND status = 'xato' ORDER BY id DESC LIMIT 1`,
    [briefDate],
  )) as Row[])[0];
  return row ? `${row.agent}: ${String(row.error).slice(0, 180)}` : null;
}
