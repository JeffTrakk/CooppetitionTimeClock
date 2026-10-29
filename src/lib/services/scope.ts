import "server-only";
import { repo } from "../data";
import { can, type Capability } from "../domain/permissions";
import { addDays, localDate, zonedTimeToUtc } from "../domain/time";
import type { Company, Job, User } from "../domain/types";

export type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

export const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });

/** Admins act on every job; foremen only on jobs they lead. */
export function canActOnJob(actor: User, job: Job, cap: Capability): boolean {
  if (actor.companyId !== job.companyId || !can(actor.role, cap)) return false;
  if (actor.role === "owner_admin" || actor.role === "office_payroll") return true;
  return job.foremanIds.includes(actor.id);
}

/** UTC bounds of a local date range, inclusive of both days. */
export function utcBounds(company: Company, from: string, to: string) {
  return { from: zonedTimeToUtc(from, "00:00", company.timezone), to: zonedTimeToUtc(addDays(to, 1), "00:00", company.timezone) };
}

export function today(company: Company, now = new Date()) {
  return localDate(now, company.timezone);
}

/**
 * Users a foreman is responsible for: anyone scheduled on one of their jobs
 * within a week either side of today, plus the foreman themself. Admins and
 * office see every field worker.
 */
export async function crewFor(actor: User, company: Company): Promise<{ users: User[]; jobs: Job[] }> {
  const [users, jobs] = await Promise.all([repo().listUsers(company.id), repo().listJobs(company.id)]);
  const field = users.filter((u) => u.active && (u.role === "employee" || u.role === "foreman"));
  if (actor.role !== "foreman") return { users: field, jobs: jobs.filter((j) => j.status === "active") };

  const myJobs = jobs.filter((j) => j.foremanIds.includes(actor.id));
  const t = today(company);
  const range = utcBounds(company, addDays(t, -7), addDays(t, 7));
  const shifts = (await Promise.all(myJobs.map((j) => repo().listShifts(company.id, { ...range, jobId: j.id })))).flat();
  const ids = new Set([actor.id, ...shifts.map((s) => s.userId)]);
  return { users: field.filter((u) => ids.has(u.id)), jobs: myJobs };
}
