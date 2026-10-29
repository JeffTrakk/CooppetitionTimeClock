import "server-only";
// All clock-in/out rules live here, so phone, kiosk, foreman and offline
// sync behave identically. In production this same logic runs server-side
// (Next.js route / Supabase RPC); the database also has a CHECK + trigger
// backstop (see supabase/migrations).

import { repo } from "../data";
import { checkGeofence } from "../domain/geofence";
import { allowedNext, clockState } from "../domain/hours";
import { can } from "../domain/permissions";
import { addDays, formatTime } from "../domain/time";
import type { Company, GpsFix, Job, Punch, PunchSource, PunchType, User } from "../domain/types";
import { canActOnJob, fail, type Result, today, utcBounds } from "./scope";
import { reopenIfLocked } from "./timesheet-service";

const MAX_OFFLINE_AGE_MS = 72 * 3_600_000;
const MAX_CLOCK_SKEW_MS = 2 * 60_000;

export interface PunchInput {
  actor: User;
  company: Company;
  userId: string;
  jobId: string;
  type: PunchType;
  source: Exclude<PunchSource, "admin_edit">;
  gps?: GpsFix | null;
  qrVerified?: boolean;
  costCodeId?: string | null;
  /** Device timestamp, only honoured for offline punches. */
  occurredAt?: string;
  offline?: boolean;
  clientId?: string | null;
  locationConsent?: boolean;
  /** For kiosk punches: the job the kiosk is locked to. */
  kioskJobId?: string | null;
  note?: string | null;
}

export async function recordPunch(input: PunchInput): Promise<Result<{ punch: Punch; warning?: string; duplicate?: boolean }>> {
  const { actor, company } = input;
  const r = repo();

  if (input.clientId) {
    const dup = await r.findPunchByClientId(company.id, input.clientId);
    if (dup) return { ok: true, punch: dup, duplicate: true };
  }

  const [user, job] = await Promise.all([r.getUser(input.userId), r.getJob(input.jobId)]);
  if (!user || user.companyId !== company.id || !user.active) return fail("Employee not found.");
  if (!job || job.companyId !== company.id) return fail("Job not found.");
  if (job.status !== "active" && input.type === "in") return fail(`${job.name} is not active.`);

  // Who may punch for whom.
  if (input.source === "phone" && (actor.id !== user.id || !can(actor.role, "clock.self"))) return fail("You can only clock yourself in.");
  if (input.source === "kiosk" && input.kioskJobId !== job.id) return fail("This kiosk is set up for a different site.");
  if (input.source === "foreman" && !canActOnJob(actor, job, "crew.punch")) return fail("You can only punch in crew on your own jobs.");

  // Must be scheduled on this job today (foremen can override for their crew).
  if (input.type === "in" && input.source !== "foreman") {
    const t = today(company);
    const shifts = await r.listShifts(company.id, { ...utcBounds(company, t, t), userId: user.id, jobId: job.id });
    if (shifts.length === 0 && !job.foremanIds.includes(user.id)) return fail(`${user.name.split(" ")[0]} isn't scheduled on ${job.name} today. Ask your foreman to add you.`);
  }

  // Offline rules.
  const now = Date.now();
  let occurredAt = new Date(now).toISOString();
  if (input.offline) {
    if (job.offlineMode === "require_online") return fail(`${job.name} requires a live connection to clock in. This punch was not saved.`);
    const t = input.occurredAt ? Date.parse(input.occurredAt) : NaN;
    if (Number.isNaN(t) || t > now + MAX_CLOCK_SKEW_MS || t < now - MAX_OFFLINE_AGE_MS) return fail("Offline punch time is invalid or more than 72 hours old. Ask your foreman to enter it.");
    occurredAt = new Date(t).toISOString();
  }

  // State machine: in → break/out, break_start → break_end, etc.
  const recent = await r.listPunches(company.id, { userId: user.id, from: addDays(occurredAt.slice(0, 10), -3) });
  const state = clockState(recent.filter((p) => p.occurredAt <= occurredAt));
  if (!allowedNext(state).includes(input.type)) {
    const msg = state.status === "out" ? "You're not clocked in." : state.status === "on_break" ? "End your break first." : "You're already clocked in.";
    return fail(msg);
  }
  if (state.status !== "out" && state.jobId !== job.id) return fail("You're clocked in on a different job. Clock out there first.");

  // Location checks.
  let distanceM: number | null = null;
  let withinGeofence: boolean | null = null;
  let warning: string | undefined;
  const gps = input.gps ?? null;
  if (gps) {
    const g = checkGeofence(job, gps);
    distanceM = g.distanceM;
    withinGeofence = g.within;
  }
  if (input.source === "phone") {
    if (job.geofenceEnforcement === "block") {
      if (!gps) return fail("Location is required to clock in on this site. Turn on location and try again.");
      if (!withinGeofence) return fail(`You're ${distanceM} m from ${job.name}. Move onto the site to clock in.`);
    } else if (withinGeofence === false) {
      warning = `Recorded ${distanceM} m from the site. Your foreman will see a flag.`;
    } else if (!gps) {
      warning = "Location unavailable. The punch is saved without GPS and flagged for review.";
    }
    if (job.requireQr && input.type === "in" && !input.qrVerified) return fail("This site needs a QR scan to clock in. Scan the code posted at the site entrance.");
    if (gps && !user.locationConsentAt) {
      if (!input.locationConsent) return fail("Please accept the location notice before clocking in.");
      await r.updateUser(user.id, { locationConsentAt: new Date(now).toISOString() });
    }
  }

  const punch = await r.createPunch({
    companyId: company.id,
    userId: user.id,
    jobId: job.id,
    type: input.type,
    occurredAt,
    receivedAt: new Date(now).toISOString(),
    source: input.source,
    gps,
    distanceM,
    withinGeofence,
    qrVerified: Boolean(input.qrVerified),
    costCodeId: input.type === "in" ? input.costCodeId ?? null : state.status !== "out" ? state.punch.costCodeId : null,
    offline: Boolean(input.offline),
    createdBy: actor.id,
    voided: false,
    replacesPunchId: null,
    note: input.note ?? null,
    clientId: input.clientId ?? null,
  });

  if (input.source === "foreman") {
    await r.appendAudit({ companyId: company.id, actorId: actor.id, action: `punch.${input.type}.on_behalf`, entity: "punch", entityId: punch.id, reason: input.note ?? null, before: null, after: punch, at: punch.receivedAt });
  }
  if (input.offline) await reopenIfLocked(company, user.id, occurredAt, actor, "Offline punch synced after approval");

  return { ok: true, punch, warning };
}

/** Foreman/admin adds a missed punch. Always audited with a reason. */
export async function addCorrection(input: { actor: User; company: Company; userId: string; jobId: string; type: PunchType; occurredAt: string; reason: string }): Promise<Result<{ punch: Punch }>> {
  const r = repo();
  const job = await r.getJob(input.jobId);
  if (!job || !canActOnJob(input.actor, job, "punch.edit")) return fail("You can't edit punches on this job.");
  if (!input.reason.trim()) return fail("A reason is required for every correction.");
  if (Date.parse(input.occurredAt) > Date.now()) return fail("Corrections can't be in the future.");
  const punch = await r.createPunch({
    companyId: input.company.id, userId: input.userId, jobId: job.id, type: input.type, occurredAt: input.occurredAt,
    receivedAt: new Date().toISOString(), source: "admin_edit", gps: null, distanceM: null, withinGeofence: null, qrVerified: false,
    costCodeId: null, offline: false, createdBy: input.actor.id, voided: false, replacesPunchId: null, note: input.reason, clientId: null,
  });
  await r.appendAudit({ companyId: input.company.id, actorId: input.actor.id, action: "punch.correction.add", entity: "punch", entityId: punch.id, reason: input.reason, before: null, after: punch, at: punch.receivedAt });
  await reopenIfLocked(input.company, input.userId, input.occurredAt, input.actor, input.reason);
  return { ok: true, punch };
}

export async function voidPunch(input: { actor: User; company: Company; punchId: string; reason: string }): Promise<Result> {
  const r = repo();
  const punch = await r.getPunch(input.punchId);
  if (!punch || punch.companyId !== input.company.id) return fail("Punch not found.");
  const job = await r.getJob(punch.jobId);
  if (!job || !canActOnJob(input.actor, job, "punch.edit")) return fail("You can't edit punches on this job.");
  if (!input.reason.trim()) return fail("A reason is required.");
  const after = await r.updatePunch(punch.id, { voided: true, note: input.reason });
  await r.appendAudit({ companyId: input.company.id, actorId: input.actor.id, action: "punch.void", entity: "punch", entityId: punch.id, reason: input.reason, before: punch, after, at: new Date().toISOString() });
  await reopenIfLocked(input.company, punch.userId, punch.occurredAt, input.actor, input.reason);
  return { ok: true };
}

/** Continuous-GPS breadcrumb. Only accepted while clocked in on a continuous-mode job. */
export async function recordLocationPing(input: { actor: User; company: Company; jobId: string; gps: GpsFix }): Promise<Result> {
  const r = repo();
  const job = await r.getJob(input.jobId);
  if (!job || job.companyId !== input.company.id) return fail("Job not found.");
  if ((job.gpsMode ?? input.company.gpsModeDefault) !== "continuous") return fail("Continuous tracking is off for this job.");
  const state = clockState(await r.listPunches(input.company.id, { userId: input.actor.id, from: addDays(new Date().toISOString().slice(0, 10), -2) }));
  if (state.status === "out" || state.jobId !== job.id) return fail("Not clocked in on this job.");
  await r.createLocationPing({ companyId: input.company.id, userId: input.actor.id, jobId: job.id, at: new Date().toISOString(), gps: input.gps, withinGeofence: checkGeofence(job, input.gps).within });
  return { ok: true };
}

export function describePunch(p: Punch, job: Job | undefined, tz: string): string {
  const label = { in: "Clocked in", out: "Clocked out", break_start: "Break started", break_end: "Break ended" }[p.type];
  return `${label} ${job ? `at ${job.name} ` : ""}${formatTime(p.occurredAt, tz)}`;
}
