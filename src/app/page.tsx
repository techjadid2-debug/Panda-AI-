import { Dashboard } from "@/components/dashboard";
import { currentSession } from "@/lib/auth";
import { getBriefByDate, getLatestBrief, hasDatabase, latestAgentIssue, listBriefDates } from "@/lib/db";
import { listTeams } from "@/lib/teams";
import { tashkentDate } from "@/lib/time";

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: PageProps<"/">) {
  const { sana } = await searchParams;
  const selectedDate = typeof sana === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sana) ? sana : null;
  const brief = selectedDate ? await getBriefByDate(selectedDate) : await getLatestBrief();

  const [session, teams, briefDates, agentIssue] = await Promise.all([
    currentSession(),
    listTeams(),
    listBriefDates(),
    latestAgentIssue(brief?.briefDate ?? tashkentDate()).catch(() => null),
  ]);

  return <Dashboard
    // Sana almashganda brif holati eskisida qolib ketmasligi uchun komponent qayta yig‘iladi.
    key={brief?.briefDate ?? "bosh"}
    initialBrief={brief}
    teams={teams.map(({ key, label }) => ({ key, label }))}
    user={session ? { name: session.name, role: session.role } : null}
    dbReady={hasDatabase()}
    agentIssue={agentIssue}
    briefDates={briefDates}
    selectedDate={selectedDate}
  />;
}
