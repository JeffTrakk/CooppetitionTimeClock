import "server-only";
import type { ClockJob } from "@/components/clock-widget";
import { repo } from "../data";
import { clockState } from "../domain/hours";
import { addDays, formatTime } from "../domain/time";
import type { Company, User } from "../domain/types";
import { today, utcBounds } from "./scope";

/** Everything the clock widget needs for one user, today. */
export async function clockViewFor(company: Company, user: User) {
  const t = today(company);
  const [shifts, jobs, costCodes, punches] = await Promise.all([
    repo().listShifts(company.id, { ...utcBounds(company, t, t), userId: user.id }),
    repo().listJobs(company.id),
    repo().listCostCodes(company.id),
    repo().listPunches(company.id, { userId: user.id, from: utcBounds(company, addDays(t, -2), t).from }),
  ]);

  const ids = new Set([...shifts.map((s) => s.jobId), ...jobs.filter((j) => j.foremanIds.includes(user.id) && j.status === "active").map((j) => j.id)]);
  const clockJobs: ClockJob[] = jobs
    .filter((j) => ids.has(j.id))
    .map((j) => {
      const shift = shifts.find((s) => s.jobId === j.id);
      return {
        id: j.id, name: j.name, address: j.address, offlineMode: j.offlineMode, gpsMode: j.gpsMode ?? company.gpsModeDefault,
        requireQr: j.requireQr, defaultCostCodeId: shift?.costCodeId ?? null,
        shiftLabel: shift ? `${formatTime(shift.start, company.timezone)}–${formatTime(shift.end, company.timezone)}` : null,
      };
    });

  const state = clockState(punches);
  // Make sure the job you're clocked into is always listed, even if the shift was removed.
  if (state.status !== "out" && !clockJobs.some((j) => j.id === state.jobId)) {
    const j = jobs.find((x) => x.id === state.jobId);
    if (j) clockJobs.push({ id: j.id, name: j.name, address: j.address, offlineMode: j.offlineMode, gpsMode: j.gpsMode ?? company.gpsModeDefault, requireQr: j.requireQr, defaultCostCodeId: null, shiftLabel: null });
  }

  return {
    jobs: clockJobs,
    costCodes: costCodes.map((c) => ({ id: c.id, code: c.code, name: c.name })),
    state: state.status === "out" ? ({ status: "out" } as const) : { status: state.status, jobId: state.jobId, since: state.since },
    todayPunches: punches.filter((p) => p.occurredAt >= utcBounds(company, t, t).from && !p.voided),
    shifts,
    allJobs: jobs,
  };
}
