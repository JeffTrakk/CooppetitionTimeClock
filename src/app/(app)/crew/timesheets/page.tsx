import { PeriodNav } from "@/components/period-nav";
import { TimesheetReview } from "@/components/timesheet-review";
import { PageHeader } from "@/components/ui";
import { requireCap } from "@/lib/auth/session";
import { repo } from "@/lib/data";
import { hoursForUser } from "@/lib/services/hours-service";
import { periodFromParam } from "@/lib/services/period-param";
import { crewFor } from "@/lib/services/scope";
import { getOrInitTimesheet } from "@/lib/services/timesheet-service";

export default async function CrewTimesheets({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  const { user, company } = await requireCap("timesheet.approve.crew");
  const { period, prev, next } = periodFromParam(company, (await searchParams).p);
  const { users } = await crewFor(user, company);
  const jobs = await repo().listJobs(company.id);
  const rows = await Promise.all(
    users.filter((u) => u.id !== user.id).map(async (u) => ({ user: u, report: await hoursForUser(company, u.id, period, jobs), timesheet: await getOrInitTimesheet(company, u.id, period) })),
  );

  return (
    <div>
      <PageHeader title="Crew timesheets" subtitle="Check hours, fix punches on the Crew today page, then approve. The office gives final approval." />
      <PeriodNav period={period} prev={prev} next={next} basePath="/crew/timesheets" />
      <TimesheetReview rows={rows} period={period} jobs={jobs} timezone={company.timezone} finalApprover={false} />
    </div>
  );
}
