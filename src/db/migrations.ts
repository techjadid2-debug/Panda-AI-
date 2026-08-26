export type Migration = { id: string; statements: string[] };

export const migrations: Migration[] = [
  {
    id: "001_core",
    statements: [
      `CREATE TABLE IF NOT EXISTS briefs (
        id text PRIMARY KEY,
        brief_date date NOT NULL UNIQUE,
        generated_at timestamptz NOT NULL DEFAULT now(),
        source text NOT NULL,
        executive_summary text NOT NULL,
        insights jsonb NOT NULL DEFAULT '[]'::jsonb,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`,
      `CREATE TABLE IF NOT EXISTS recommendations (
        id text PRIMARY KEY,
        brief_id text NOT NULL REFERENCES briefs(id) ON DELETE CASCADE,
        dedupe_key text NOT NULL,
        title text NOT NULL,
        owner text NOT NULL,
        impact text NOT NULL,
        notification text NOT NULL,
        evidence text NOT NULL,
        expected_result text NOT NULL,
        due_at timestamptz NOT NULL,
        status text NOT NULL DEFAULT 'draft',
        team_key text,
        recipient_chat_id text,
        sent_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE (brief_id, dedupe_key)
      )`,
      `CREATE INDEX IF NOT EXISTS recommendations_brief_idx ON recommendations (brief_id)`,
      `CREATE INDEX IF NOT EXISTS recommendations_open_idx ON recommendations (status, due_at)`,
      `CREATE TABLE IF NOT EXISTS decision_log (
        id bigserial PRIMARY KEY,
        recommendation_id text NOT NULL,
        status text NOT NULL,
        channel text NOT NULL,
        actor text,
        note text,
        created_at timestamptz NOT NULL DEFAULT now()
      )`,
      `CREATE INDEX IF NOT EXISTS decision_log_recommendation_idx ON decision_log (recommendation_id, created_at DESC)`,
      `CREATE TABLE IF NOT EXISTS teams (
        key text PRIMARY KEY,
        label text NOT NULL,
        chat_id text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`,
      `CREATE TABLE IF NOT EXISTS agent_alerts (
        alert_key text PRIMARY KEY,
        last_sent_at timestamptz NOT NULL DEFAULT now()
      )`,
    ],
  },
  {
    id: "002_metric_snapshots",
    statements: [
      `CREATE TABLE IF NOT EXISTS metric_snapshots (
        captured_on date PRIMARY KEY,
        source text NOT NULL,
        payload jsonb NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`,
    ],
  },
  {
    id: "003_agent_runs",
    statements: [
      `ALTER TABLE briefs ADD COLUMN IF NOT EXISTS engine text NOT NULL DEFAULT 'qoidalar'`,
      `CREATE TABLE IF NOT EXISTS agent_runs (
        id bigserial PRIMARY KEY,
        brief_date date NOT NULL,
        agent text NOT NULL,
        model text NOT NULL,
        status text NOT NULL,
        duration_ms integer NOT NULL,
        input_tokens integer,
        output_tokens integer,
        steps integer,
        error text,
        output jsonb,
        created_at timestamptz NOT NULL DEFAULT now()
      )`,
      `CREATE INDEX IF NOT EXISTS agent_runs_date_idx ON agent_runs (brief_date, created_at DESC)`,
    ],
  },
  {
    id: "004_done_status",
    statements: [
      `ALTER TABLE recommendations ADD COLUMN IF NOT EXISTS done_at timestamptz`,
    ],
  },
];
