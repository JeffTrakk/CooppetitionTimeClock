import "server-only";
import { repo } from "../data";
import { can } from "../domain/permissions";
import { formatDate, formatTime, localDate, zonedTimeToUtc } from "../domain/time";
import type { Company, User } from "../domain/types";
import { sendMessage } from "./messaging-service";
import { fail, type Result } from "./scope";

export async function createShift(input: {
  company: Company;
  actor: User;
  userId: string;
  jobId: string;
  date: string;
  startTime: string;
  endTime: string;
  costCodeId: string | null;
  notes: string | null;
  notify: boolean;
}): Promise<Result> {
  const { company, actor } = input;
  if (!can(actor.role, "schedule.manage")) return fail("Not allowed.");
  const [user, job] = await Promise.all([repo().getUser(input.userId), repo().getJob(input.jobId)]);
  if (!user || user.companyId !== company.id) return fail("Pick an employee.");
  if (!job || job.companyId !== company.id) return fail("Pick a job.");
  const start = zonedTimeToUtc(input.date, input.startTime, company.timezone);
  let end = zonedTimeToUtc(input.date, input.endTime, company.timezone);
  if (end <= start) end = new Date(Date.parse(end) + 86_400_000).toISOString(); // overnight shift

  const overlapping = await repo().listShifts(company.id, { from: start, to: end, userId: user.id });
  if (overlapping.length) return fail(`${user.name} already has a shift that overlaps this time.`);

  await repo().createShift({ companyId: company.id, jobId: job.id, userId: user.id, start, end, costCodeId: input.costCodeId, notes: input.notes });
  if (input.notify) {
    await sendMessage({
      company, sender: actor, system: true, audience: { type: "user", userId: user.id }, channels: ["in_app", "push", "sms"],
      subject: "New shift",
      body: `You're scheduled at ${job.name} on ${formatDate(input.date)}, ${formatTime(start, company.timezone)}–${formatTime(end, company.timezone)}.${input.notes ? ` Note: ${input.notes}` : ""}`,
    });
  }
  return { ok: true };
}

export async function deleteShift(input: { company: Company; actor: User; shiftId: string; notify: boolean }): Promise<Result> {
  if (!can(input.actor.role, "schedule.manage")) return fail("Not allowed.");
  const shift = await repo().getShift(input.shiftId);
  if (!shift || shift.companyId !== input.company.id) return fail("Shift not found.");
  await repo().deleteShift(shift.id);
  if (input.notify) {
    const job = await repo().getJob(shift.jobId);
    await sendMessage({
      company: input.company, sender: input.actor, system: true, audience: { type: "user", userId: shift.userId }, channels: ["in_app", "push", "sms"],
      subject: "Shift cancelled",
      body: `Your shift at ${job?.name ?? "a job"} on ${formatDate(localDate(shift.start, input.company.timezone))} has been cancelled.`,
    });
  }
  return { ok: true };
}
