import { neon } from "@neondatabase/serverless";
import { migrations } from "../src/db/migrations.ts";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL topilmadi. `.env.local` ga qo‘shing yoki `vercel env pull .env.local` ni bajaring.");
  process.exit(1);
}

const sql = neon(url);
await sql.query(`CREATE TABLE IF NOT EXISTS _migrations (id text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`);
const applied = new Set((await sql.query(`SELECT id FROM _migrations`)).map((row) => String(row.id)));

for (const migration of migrations) {
  if (applied.has(migration.id)) { console.log(`· ${migration.id} — allaqachon qo‘llangan`); continue; }
  for (const statement of migration.statements) await sql.query(statement);
  await sql.query(`INSERT INTO _migrations (id) VALUES ($1) ON CONFLICT DO NOTHING`, [migration.id]);
  console.log(`✓ ${migration.id}`);
}
console.log("Migratsiyalar tayyor.");
