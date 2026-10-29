import "server-only";
import { repo } from "../data";
import { buildSegments, clockState, type ClockState } from "../domain/hours";
import { addDays } from "../domain/time";
import type { Company, Job, Punch, User } from "../domain/types";
import { today, utcBounds } from "./scope";

export interface CrewRow {
  user: User;
  state: ClockState;
  job: Job | undefined;
  todayMinutes: number;
  flags: string[];
  scheduledJobIds: string[];
  todayPunches: Punch[];
}

/** Live status for a set of workers: who's on site, where, for how long, and anything odd. */
export async function crewStatus(company: Company, users: User[], jobs: Job[]): Promise<CrewRow[]> {
  const t = today(company);
  const todayBounds = utcBounds(company, t, t);
  const [punches, shifts] = await Promise.all([
    repo().listPunches(company.id, { from: utcBounds(company, addDays(t, -2), t).from }),
    repo().listShifts(company.id, todayBounds),
  ]);
  const now = Date.now();

  return users.map((user) => {
    const mine = punches.filter((p) => p.userId === user.id);
    const state = clockState(mine);
    const todays = mine.filter((p) => p.occurredAt >= todayBounds.from && !p.voided);
    const { segments, issues } = buildSegments(mine.filter((p) => p.occurredAt >= todayBounds.from), company.timezone);
    const flags = new Set<string>();
    for (const s of segments) for (const f of s.flags) if (f !== "open") flags.add(f);
    for (const i of issues) flags.add(i.issue);
    const myShifts = shifts.filter((s) => s.userId === user.id);
    if (state.status === "out" && myShifts.some((s) => Date.parse(s.start) + 15 * 60_000 < now && Date.parse(s.end) > now) && todays.length === 0) flags.add("not_clocked_in");
    if (state.status !== "out" && myShifts.length && myShifts.every((s) => Date.parse(s.end) + 30 * 60_000 < now)) flags.add("past_shift_end");
    return {
      user,
      state,
      job: state.status !== "out" ? jobs.find((j) => j.id === state.jobId) : undefined,
      todayMinutes: segments.filter((s) => s.date === t).reduce((a, s) => a + s.workedMinutes, 0),
      flags: [...flags],
      scheduledJobIds: myShifts.map((s) => s.jobId),
      todayPunches: todays,
    };
  });
}

export const FLAG_TEXT: Record<string, string> = {
  outside_geofence: "Punched off site",
  offline_punch: "Offline punch",
  missing_out: "Missing clock-out",
  missing_in: "Clock-out without clock-in",
  break_without_in: "Break without clock-in",
  not_clocked_in: "Shift started, not clocked in",
  past_shift_end: "Still clocked in 30+ min after shift",
};
