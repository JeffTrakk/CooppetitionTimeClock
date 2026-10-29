// Turns raw punches into worked time, then classifies it as regular,
// overtime and double time using a labour rule set. Pure functions — no I/O —
// so the same logic can run in the app, in a payroll export job, or in a
// Supabase Edge Function.

import type { LabourRuleSet } from "./labour-rules";
import type { Punch } from "./types";
import { localDate, startOfWeek } from "./time";

export type SegmentFlag = "missing_out" | "missing_in" | "open" | "outside_geofence" | "offline_punch" | "break_short";

export interface WorkSegment {
  userId: string;
  jobId: string;
  costCodeId: string | null;
  start: string;
  end: string;
  /** Local date (company tz) the segment is credited to — the day it started. */
  date: string;
  breakMinutes: number;
  workedMinutes: number;
  open: boolean;
  flags: SegmentFlag[];
}

export interface PunchIssue {
  punchId: string;
  userId: string;
  issue: "missing_in" | "missing_out" | "break_without_in" | "duplicate_in";
}

const minutesBetween = (a: string, b: string) => Math.max(0, (Date.parse(b) - Date.parse(a)) / 60_000);

/**
 * Pairs a single user's punches into segments. Voided punches are ignored.
 * An unclosed "in" ends at `now` and is marked open.
 */
export function buildSegments(punches: Punch[], timezone: string, now: Date = new Date()): { segments: WorkSegment[]; issues: PunchIssue[] } {
  const sorted = punches.filter((p) => !p.voided).sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
  const segments: WorkSegment[] = [];
  const issues: PunchIssue[] = [];

  let current: { in: Punch; breakStart: string | null; breakMinutes: number; flags: Set<SegmentFlag> } | null = null;

  const close = (endIso: string, open: boolean, extra: SegmentFlag[] = []) => {
    if (!current) return;
    let breakMinutes = current.breakMinutes;
    if (current.breakStart) breakMinutes += minutesBetween(current.breakStart, endIso);
    const total = minutesBetween(current.in.occurredAt, endIso);
    const flags = new Set([...current.flags, ...extra]);
    if (open) flags.add("open");
    segments.push({
      userId: current.in.userId,
      jobId: current.in.jobId,
      costCodeId: current.in.costCodeId,
      start: current.in.occurredAt,
      end: endIso,
      date: localDate(current.in.occurredAt, timezone),
      breakMinutes: Math.round(breakMinutes),
      workedMinutes: Math.round(Math.max(0, total - breakMinutes)),
      open,
      flags: [...flags],
    });
    current = null;
  };

  const noteFlags = (p: Punch, flags: Set<SegmentFlag>) => {
    if (p.withinGeofence === false) flags.add("outside_geofence");
    if (p.offline) flags.add("offline_punch");
  };

  for (const p of sorted) {
    switch (p.type) {
      case "in":
        if (current) {
          issues.push({ punchId: current.in.id, userId: p.userId, issue: "missing_out" });
          close(p.occurredAt, false, ["missing_out"]);
        }
        current = { in: p, breakStart: null, breakMinutes: 0, flags: new Set() };
        noteFlags(p, current.flags);
        break;
      case "break_start":
        if (!current) issues.push({ punchId: p.id, userId: p.userId, issue: "break_without_in" });
        else if (!current.breakStart) current.breakStart = p.occurredAt;
        break;
      case "break_end":
        if (!current) issues.push({ punchId: p.id, userId: p.userId, issue: "break_without_in" });
        else if (current.breakStart) {
          current.breakMinutes += minutesBetween(current.breakStart, p.occurredAt);
          current.breakStart = null;
        }
        break;
      case "out":
        if (!current) {
          issues.push({ punchId: p.id, userId: p.userId, issue: "missing_in" });
          break;
        }
        noteFlags(p, current.flags);
        close(p.occurredAt, false);
        break;
    }
  }
  if (current) close(now.toISOString(), true);

  return { segments, issues };
}

export interface ClassifiedSegment extends WorkSegment {
  regularMinutes: number;
  overtimeMinutes: number;
  doubleMinutes: number;
}

export interface DaySummary {
  date: string;
  workedMinutes: number;
  breakMinutes: number;
  regularMinutes: number;
  overtimeMinutes: number;
  doubleMinutes: number;
  breakCompliant: boolean;
}

/**
 * Classifies segments for ONE user. Walks segments in time order and spends
 * each one's minutes against running daily and weekly counters, so overtime
 * lands on the hours actually worked past the threshold (and on the right
 * job/cost code). Weekly overtime counts only regular minutes, so daily
 * overtime is never double-counted.
 */
export function classifySegments(segments: WorkSegment[], rules: LabourRuleSet, weekStartsOn: number): ClassifiedSegment[] {
  const sorted = [...segments].sort((a, b) => a.start.localeCompare(b.start));
  const dayTotals = new Map<string, number>();
  const weekRegular = new Map<string, number>();
  const INF = Number.POSITIVE_INFINITY;
  const dOt = rules.dailyOtAfterMin ?? INF;
  const dDt = rules.dailyDoubleAfterMin ?? INF;
  const wOt = rules.weeklyOtAfterMin ?? INF;

  return sorted.map((seg) => {
    const weekKey = startOfWeek(seg.date, weekStartsOn);
    let day = dayTotals.get(seg.date) ?? 0;
    let week = weekRegular.get(weekKey) ?? 0;
    let remaining = seg.workedMinutes;
    let reg = 0, ot = 0, dt = 0;

    while (remaining > 0) {
      let chunk: number;
      if (day >= dDt) {
        chunk = remaining;
        dt += chunk;
      } else if (day >= dOt) {
        chunk = Math.min(remaining, dDt - day);
        ot += chunk;
      } else if (week >= wOt) {
        chunk = Math.min(remaining, dOt - day);
        ot += chunk;
      } else {
        chunk = Math.min(remaining, dOt - day, wOt - week);
        reg += chunk;
        week += chunk;
      }
      day += chunk;
      remaining -= chunk;
    }

    dayTotals.set(seg.date, day);
    weekRegular.set(weekKey, week);
    return { ...seg, regularMinutes: reg, overtimeMinutes: ot, doubleMinutes: dt };
  });
}

/** Rolls classified segments up to one row per day, with break compliance. */
export function summariseDays(classified: ClassifiedSegment[], rules: LabourRuleSet): DaySummary[] {
  const byDay = new Map<string, DaySummary>();
  for (const s of classified) {
    const d = byDay.get(s.date) ?? { date: s.date, workedMinutes: 0, breakMinutes: 0, regularMinutes: 0, overtimeMinutes: 0, doubleMinutes: 0, breakCompliant: true };
    d.workedMinutes += s.workedMinutes;
    d.breakMinutes += s.breakMinutes;
    d.regularMinutes += s.regularMinutes;
    d.overtimeMinutes += s.overtimeMinutes;
    d.doubleMinutes += s.doubleMinutes;
    byDay.set(s.date, d);
  }
  for (const d of byDay.values()) {
    d.breakCompliant = d.workedMinutes + d.breakMinutes <= rules.breakAfterMin || d.breakMinutes >= rules.breakMinutes;
  }
  return [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export interface HoursReport {
  segments: ClassifiedSegment[];
  days: DaySummary[];
  issues: PunchIssue[];
  totals: { workedMinutes: number; regularMinutes: number; overtimeMinutes: number; doubleMinutes: number };
}

/** One-call helper: punches for one user → classified hours for [from, to] (local dates, inclusive). */
export function computeHours(
  punches: Punch[],
  opts: { rules: LabourRuleSet; timezone: string; weekStartsOn: number; from?: string; to?: string; now?: Date },
): HoursReport {
  const { segments, issues } = buildSegments(punches, opts.timezone, opts.now);
  // Classify the whole set so weekly overtime sees days before `from`, then filter.
  const classified = classifySegments(segments, opts.rules, opts.weekStartsOn).filter(
    (s) => (!opts.from || s.date >= opts.from) && (!opts.to || s.date <= opts.to),
  );
  const days = summariseDays(classified, opts.rules);
  const totals = classified.reduce(
    (t, s) => ({
      workedMinutes: t.workedMinutes + s.workedMinutes,
      regularMinutes: t.regularMinutes + s.regularMinutes,
      overtimeMinutes: t.overtimeMinutes + s.overtimeMinutes,
      doubleMinutes: t.doubleMinutes + s.doubleMinutes,
    }),
    { workedMinutes: 0, regularMinutes: 0, overtimeMinutes: 0, doubleMinutes: 0 },
  );
  return { segments: classified, days, issues, totals };
}

export type ClockState = { status: "out" } | { status: "in" | "on_break"; jobId: string; since: string; punch: Punch };

/** Current state of a user from their punches (latest non-voided punch wins). */
export function clockState(punches: Punch[]): ClockState {
  const sorted = punches.filter((p) => !p.voided).sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
  let lastIn: Punch | null = null;
  let onBreak = false;
  let breakSince = "";
  for (const p of sorted) {
    if (p.type === "in") { lastIn = p; onBreak = false; }
    else if (p.type === "out") { lastIn = null; onBreak = false; }
    else if (p.type === "break_start" && lastIn) { onBreak = true; breakSince = p.occurredAt; }
    else if (p.type === "break_end") onBreak = false;
  }
  if (!lastIn) return { status: "out" };
  return onBreak
    ? { status: "on_break", jobId: lastIn.jobId, since: breakSince, punch: lastIn }
    : { status: "in", jobId: lastIn.jobId, since: lastIn.occurredAt, punch: lastIn };
}

/** Which punch types are valid next, given current state. */
export function allowedNext(state: ClockState): ("in" | "out" | "break_start" | "break_end")[] {
  if (state.status === "out") return ["in"];
  if (state.status === "on_break") return ["break_end"];
  return ["break_start", "out"];
}
