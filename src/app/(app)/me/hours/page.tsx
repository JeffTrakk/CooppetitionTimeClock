import { submitMine } from "@/app/actions/timesheets";
import { ActionForm } from "@/components/action-form";
import { HoursTable, StatusBadge } from "@/components/hours-table";
import { PeriodNav } from "@/components/period-nav";
import { Notice, PageHeader } from "@/components/ui";
import { requireCap } from "@/lib/auth/session";
import { repo } from "@/lib/data";
import { hoursForUser } from "@/lib/services/hours-service";
import { periodFromParam } from "@/lib/services/period-param";
import { getOrInitTimesheet } from "@/lib/services/timesheet-service";

export default async function MyHours({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  const { user, company } = await requireCap("clock.self");
  const { period, prev, next } = periodFromParam(company, (await searchParams).p);
  const jobs = await repo().listJobs(company.id);
  const [report, ts] = await Promise.all([hoursForUser(company, user.id, period, jobs), getOrInitTimesheet(company, user.id, period)]);
  const reopenNote = [...ts.approvals].reverse().find((a) => a.status === "open");
  const reopenAudit = reopenNote ? (await repo().listAudit(company.id, { entity: "timesheet", entityId: ts.id, limit: 1 }))[0] : null;

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="My hours" subtitle={<>Pay period · <StatusBadge status={ts.status} /></>} />
      <PeriodNav period={period} prev={prev} next={next} basePath="/me/hours" />
      {ts.status === "open" && reopenAudit?.reason && <Notice>Sent back: {reopenAudit.reason}</Notice>}
      <HoursTable report={report} jobs={jobs} timezone={company.timezone} />
      <p className="mt-2 text-xs text-stone-500">Overtime rules: {report.rules.name}. {report.rules.notes}</p>
      {ts.status === "open" && report.segments.length > 0 && (
        <ActionForm action={submitMine} className="mt-4">
          <input type="hidden" name="periodStart" value={period.start} />
          <button className="btn-primary w-full sm:w-auto">Submit timesheet</button>
          <p className="mt-1 text-xs text-stone-500">Something wrong? Tell your foreman before you submit. They can add or fix punches.</p>
        </ActionForm>
      )}
    </div>
  );
}
