import { STATUS_LABEL } from "@/components/hours-table";
import { PeriodNav } from "@/components/period-nav";
import { TimesheetReview } from "@/components/timesheet-review";
import { Badge, PageHeader } from "@/components/ui";
import { requireCap } from "@/lib/auth/session";
import { repo } from "@/lib/data";
import type { TimesheetStatus } from "@/lib/domain/types";
import { hoursForUser } from "@/lib/services/hours-service";
import { periodFromParam } from "@/lib/services/period-param";
import { getOrInitTimesheet } from "@/lib/services/timesheet-service";

export default async function Timesheets({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  const { company } = await requireCap("timesheet.approve.all");
  const { period, prev, next } = periodFromParam(company, (await searchParams).p);
  const [users, jobs] = await Promise.all([repo().listUsers(company.id), repo().listJobs(company.id)]);
  const field = users.filter((u) => u.active && (u.role === "employee" || u.role === "foreman"));
  const rows = await Promise.all(field.map(async (u) => ({ user: u, report: await hoursForUser(company, u.id, period, jobs), timesheet: await getOrInitTimesheet(company, u.id, period) })));
  const counts = rows.reduce<Record<string, number>>((acc, r) => ({ ...acc, [r.timesheet.status]: (acc[r.timesheet.status] ?? 0) + 1 }), {});

  return (
    <div>
      <PageHeader title="Timesheets" subtitle="Final approval before payroll. Foremen approve their crews first; you can approve directly at any stage." />
      <PeriodNav period={period} prev={prev} next={next} basePath="/admin/timesheets" />
      <div className="mb-4 flex flex-wrap gap-2">
        {Object.entries(counts).map(([s, n]) => <Badge key={s}>{STATUS_LABEL[s as TimesheetStatus]}: {n}</Badge>)}
      </div>
      <TimesheetReview rows={rows} period={period} jobs={jobs} timezone={company.timezone} finalApprover />
    </div>
  );
}
