import { Dashboard } from "@/components/dashboard";
import { currentSession } from "@/lib/auth";
import { getLatestBrief, hasDatabase, latestAgentIssue } from "@/lib/db";
import { listTeams } from "@/lib/teams";
import { tashkentDate } from "@/lib/time";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [session, brief, teams, agentIssue] = await Promise.all([
    currentSession(),
    getLatestBrief(),
    listTeams(),
    latestAgentIssue(tashkentDate()).catch(() => null),
  ]);
  return <Dashboard
    initialBrief={brief}
    teams={teams.map(({ key, label }) => ({ key, label }))}
    user={session ? { name: session.name, role: session.role } : null}
    dbReady={hasDatabase()}
    agentIssue={agentIssue}
  />;
}
