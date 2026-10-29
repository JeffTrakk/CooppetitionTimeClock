import "server-only";
// Timesheet workflow: open → submitted (employee) → foreman_approved
// (foreman) → approved (office/admin) → exported (payroll). Any change to
// punches inside a locked period drops it back to "submitted" with an
// audit entry, so payroll never pays on stale numbers.

import { repo } from "../data";
import { can } from "../domain/permissions";
import { periodFor, type Period } from "../domain/pay-period";
import { localDate } from "../domain/time";
import type { Company, Timesheet, TimesheetStatus, User } from "../domain/types";
import { crewFor, fail, type Result } from "./scope";

export async function getOrInitTimesheet(company: Company, userId: string, period: Period): Promise<Timesheet> {
  return (
    (await repo().getTimesheet(company.id, userId, period.start)) ?? {
      id: "",
      companyId: company.id,
      userId,
      periodStart: period.start,
      periodEnd: period.end,
      status: "open",
      approvals: [],
    }
  );
}

async function setStatus(company: Company, actor: User, ts: Timesheet, status: TimesheetStatus, reason: string | null) {
  const { id: _id, ...rest } = ts;
  const next = await repo().upsertTimesheet({
    ...rest,
    status,
    approvals: [...ts.approvals, { byUserId: actor.id, role: actor.role, at: new Date().toISOString(), status }],
  });
  await repo().appendAudit({ companyId: company.id, actorId: actor.id, action: `timesheet.${status}`, entity: "timesheet", entityId: next.id, reason, before: { status: ts.status }, after: { status }, at: new Date().toISOString() });
  return next;
}

export async function submitTimesheet(company: Company, actor: User, period: Period): Promise<Result> {
  const ts = await getOrInitTimesheet(company, actor.id, period);
  if (ts.status !== "open") return fail("This timesheet has already been submitted.");
  await setStatus(company, actor, ts, "submitted", null);
  return { ok: true };
}

export async function approveTimesheet(company: Company, actor: User, userId: string, period: Period): Promise<Result> {
  const ts = await getOrInitTimesheet(company, userId, period);
  if (ts.status === "exported") return fail("Already exported to payroll.");
  if (can(actor.role, "timesheet.approve.all")) {
    if (ts.status === "approved") return fail("Already approved.");
    await setStatus(company, actor, ts, "approved", null);
    return { ok: true };
  }
  if (can(actor.role, "timesheet.approve.crew")) {
    const { users } = await crewFor(actor, company);
    if (!users.some((u) => u.id === userId)) return fail("You can only approve your own crew.");
    if (ts.status === "foreman_approved" || ts.status === "approved") return fail("Already approved.");
    await setStatus(company, actor, ts, "foreman_approved", null);
    return { ok: true };
  }
  return fail("You don't have permission to approve timesheets.");
}

export async function reopenTimesheet(company: Company, actor: User, userId: string, period: Period, reason: string): Promise<Result> {
  if (!can(actor.role, "timesheet.approve.crew") && !can(actor.role, "timesheet.approve.all")) return fail("Not allowed.");
  if (!reason.trim()) return fail("Give a reason so the employee knows what to fix.");
  const ts = await getOrInitTimesheet(company, userId, period);
  if (ts.status === "exported") return fail("Already exported. Fix it in the payroll system or with a correction next period.");
  await setStatus(company, actor, ts, "open", reason);
  return { ok: true };
}

/** Called after any punch change: if that day's period was approved, send it back for review. */
export async function reopenIfLocked(company: Company, userId: string, occurredAt: string, actor: User, reason: string) {
  const period = periodFor(company, localDate(occurredAt, company.timezone));
  const ts = await repo().getTimesheet(company.id, userId, period.start);
  if (ts && (ts.status === "foreman_approved" || ts.status === "approved")) await setStatus(company, actor, ts, "submitted", `Punches changed: ${reason}`);
}

export async function markExported(company: Company, actor: User, userIds: string[], period: Period) {
  for (const userId of userIds) {
    const ts = await repo().getTimesheet(company.id, userId, period.start);
    if (ts && ts.status === "approved") await setStatus(company, actor, ts, "exported", null);
  }
}
