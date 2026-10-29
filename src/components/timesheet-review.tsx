// Approval list used by foremen (their crew) and office/admin (everyone).

import { approve, reopen } from "@/app/actions/timesheets";
import type { HoursReport } from "@/lib/domain/hours";
import type { Period } from "@/lib/domain/pay-period";
import { formatMinutes } from "@/lib/domain/time";
import type { Job, Timesheet, User } from "@/lib/domain/types";
import { ActionForm } from "./action-form";
import { HoursTable, StatusBadge } from "./hours-table";
import { Badge, Empty } from "./ui";

export interface ReviewRow {
  user: User;
  report: HoursReport;
  timesheet: Timesheet;
}

export function TimesheetReview({ rows, period, jobs, timezone, finalApprover }: { rows: ReviewRow[]; period: Period; jobs: Job[]; timezone: string; finalApprover: boolean }) {
  if (rows.length === 0) return <Empty>No one to review.</Empty>;
  return (
    <div className="space-y-2">
      {rows.map(({ user, report, timesheet }) => {
        const flagged = report.days.some((d) => !d.breakCompliant) || report.segments.some((s) => s.flags.some((f) => f !== "open")) || report.issues.length > 0;
        const canApprove = finalApprover ? !["approved", "exported"].includes(timesheet.status) : ["open", "submitted"].includes(timesheet.status);
        return (
          <details key={user.id} className="card">
            <summary className="flex cursor-pointer list-none flex-wrap items-center gap-3">
              <span className="min-w-40 font-semibold">{user.name}</span>
              <StatusBadge status={timesheet.status} />
              {flagged && <Badge tone="red">needs a look</Badge>}
              <span className="ml-auto flex gap-4 text-sm tabular-nums">
                <span>{formatMinutes(report.totals.workedMinutes)}</span>
                <span className="text-stone-500">OT {formatMinutes(report.totals.overtimeMinutes + report.totals.doubleMinutes)}</span>
              </span>
            </summary>
            <div className="mt-3 space-y-3">
              <HoursTable report={report} jobs={jobs} timezone={timezone} />
              <div className="flex flex-wrap items-start gap-2">
                {canApprove && (
                  <ActionForm action={approve}>
                    <input type="hidden" name="userId" value={user.id} />
                    <input type="hidden" name="periodStart" value={period.start} />
                    <button className="btn-primary">{finalApprover ? "Approve for payroll" : "Approve (foreman)"}</button>
                  </ActionForm>
                )}
                {timesheet.status !== "exported" && timesheet.status !== "open" && (
                  <ActionForm action={reopen} className="flex gap-2">
                    <input type="hidden" name="userId" value={user.id} />
                    <input type="hidden" name="periodStart" value={period.start} />
                    <input name="reason" className="input" placeholder="What needs fixing?" required />
                    <button className="btn-ghost">Send back</button>
                  </ActionForm>
                )}
              </div>
            </div>
          </details>
        );
      })}
    </div>
  );
}
