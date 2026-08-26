import { guard } from "@/lib/auth";
import { listTeams } from "@/lib/teams";

export const runtime = "nodejs";

export async function GET() {
  const auth = await guard();
  if ("response" in auth) return auth.response;
  const teams = await listTeams();
  return Response.json(teams.map(({ key, label }) => ({ key, label })));
}
