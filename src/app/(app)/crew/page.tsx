import { AutoRefresh } from "@/components/auto-refresh";
import { CrewBoard } from "@/components/crew-board";
import { PunchTools } from "@/components/punch-tools";
import { PageHeader, Section } from "@/components/ui";
import { requireCap } from "@/lib/auth/session";
import { repo } from "@/lib/data";
import { addDays } from "@/lib/domain/time";
import { crewStatus } from "@/lib/services/crew-status";
import { crewFor, today, utcBounds } from "@/lib/services/scope";

export default async function CrewToday() {
  const { user, company } = await requireCap("crew.view");
  const { users, jobs } = await crewFor(user, company);
  const t = today(company);
  const [rows, costCodes, punches] = await Promise.all([
    crewStatus(company, users, jobs),
    repo().listCostCodes(company.id),
    repo().listPunches(company.id, { from: utcBounds(company, addDays(t, -6), t).from }),
  ]);
  const jobIds = new Set(jobs.map((j) => j.id));
  const recent = punches.filter((p) => jobIds.has(p.jobId)).reverse();
  const onSite = rows.filter((r) => r.state.status !== "out").length;

  return (
    <div>
      <AutoRefresh seconds={30} />
      <PageHeader title="Crew today" subtitle={`${onSite} of ${rows.length} on the clock · ${jobs.map((j) => j.name).join(", ") || "no jobs"}`} />
      <Section title="Status"><CrewBoard rows={rows} timezone={company.timezone} /></Section>
      <Section title="Fix and enter time">
        <PunchTools users={users} jobs={jobs} costCodes={costCodes} recent={recent} timezone={company.timezone} today={t} />
      </Section>
    </div>
  );
}
