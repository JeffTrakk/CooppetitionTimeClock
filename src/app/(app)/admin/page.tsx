import Link from "next/link";
import { AutoRefresh } from "@/components/auto-refresh";
import { CrewBoard } from "@/components/crew-board";
import { PageHeader, Section, Stat } from "@/components/ui";
import { requireCap } from "@/lib/auth/session";
import { can } from "@/lib/domain/permissions";
import { repo } from "@/lib/data";
import { formatMinutes } from "@/lib/domain/time";
import { crewStatus } from "@/lib/services/crew-status";
import { crewFor, today, utcBounds } from "@/lib/services/scope";

export default async function Dashboard() {
  const { user, company } = await requireCap("dashboard.view");
  const { users, jobs } = await crewFor(user, company);
  const t = today(company);
  const [rows, shiftsToday] = await Promise.all([crewStatus(company, users, jobs), repo().listShifts(company.id, utcBounds(company, t, t))]);

  const onClock = rows.filter((r) => r.state.status === "in").length;
  const onBreak = rows.filter((r) => r.state.status === "on_break").length;
  const flagged = rows.filter((r) => r.flags.length);
  const totalToday = rows.reduce((a, r) => a + r.todayMinutes, 0);

  return (
    <div>
      <AutoRefresh seconds={30} />
      <PageHeader title="On site now" subtitle={`${company.name} · updates every 30 seconds`} />
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="On the clock" value={onClock} hint={`${onBreak} on break`} />
        <Stat label="Scheduled today" value={new Set(shiftsToday.map((s) => s.userId)).size} hint={`${new Set(shiftsToday.map((s) => s.jobId)).size} jobs`} />
        <Stat label="Hours today" value={formatMinutes(totalToday)} />
        <Stat label="Need attention" value={flagged.length} hint={flagged.length ? "see flags below" : "all clear"} />
      </div>

      <Section title="By job">
        <div className="grid gap-3 md:grid-cols-3">
          {jobs.map((j) => {
            const here = rows.filter((r) => r.job?.id === j.id);
            const expected = new Set(shiftsToday.filter((s) => s.jobId === j.id).map((s) => s.userId)).size;
            return (
              <Link key={j.id} href={can(user.role, "jobs.manage") ? `/admin/jobs/${j.id}` : "/admin"} className="card hover:border-stone-400">
                <div className="font-semibold">{j.name}</div>
                <div className="text-xs text-stone-500">{j.code} · {j.address}</div>
                <div className="mt-2 text-2xl font-bold">{here.length}<span className="text-sm font-normal text-stone-500"> / {expected} scheduled</span></div>
                <div className="mt-1 truncate text-xs text-stone-600">{here.map((r) => r.user.name.split(" ")[0]).join(", ") || "Nobody on site"}</div>
              </Link>
            );
          })}
        </div>
      </Section>

      <Section title="Everyone"><CrewBoard rows={rows} timezone={company.timezone} /></Section>
    </div>
  );
}
