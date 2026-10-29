import { describe, expect, it } from "vitest";
import { checkGeofence, distanceMetres } from "./geofence";
import { allowedNext, buildSegments, clockState, computeHours } from "./hours";
import { getRuleSet, LABOUR_RULE_PRESETS } from "./labour-rules";
import { periodFor } from "./pay-period";
import { can } from "./permissions";
import { localDate, startOfWeek, zonedTimeToUtc } from "./time";
import type { Punch, PunchType } from "./types";

const TZ = "America/Toronto";
let n = 0;
function punch(type: PunchType, local: string, extra: Partial<Punch> = {}): Punch {
  const [date, time] = local.split(" ");
  const at = zonedTimeToUtc(date, time, TZ);
  return {
    id: `p${++n}`, companyId: "c", userId: "u", jobId: "j", type, occurredAt: at, receivedAt: at, source: "phone",
    gps: null, distanceM: null, withinGeofence: null, qrVerified: false, costCodeId: null, offline: false,
    createdBy: "u", voided: false, replacesPunchId: null, note: null, clientId: null, ...extra,
  };
}

/** A full day: in at 07:00, 30-min lunch at 12:00, out after `hours` worked. */
function day(date: string, workedHours: number): Punch[] {
  const outMin = 7 * 60 + workedHours * 60 + 30;
  const hh = String(Math.floor(outMin / 60)).padStart(2, "0");
  const mm = String(outMin % 60).padStart(2, "0");
  return [punch("in", `${date} 07:00`), punch("break_start", `${date} 12:00`), punch("break_end", `${date} 12:30`), punch("out", `${date} ${hh}:${mm}`)];
}

describe("time", () => {
  it("converts Toronto wall time to UTC across DST", () => {
    expect(zonedTimeToUtc("2026-07-01", "07:00", TZ)).toBe("2026-07-01T11:00:00.000Z");
    expect(zonedTimeToUtc("2026-12-01", "07:00", TZ)).toBe("2026-12-01T12:00:00.000Z");
  });
  it("finds local date and week start", () => {
    expect(localDate("2026-07-02T03:00:00Z", TZ)).toBe("2026-07-01");
    expect(startOfWeek("2026-10-29", 0)).toBe("2026-10-25");
  });
});

describe("geofence", () => {
  const site = { lat: 43.6532, lng: -79.3832, geofenceRadiusM: 150 };
  it("measures distance", () => {
    expect(Math.round(distanceMetres(site, { lat: 43.6542, lng: -79.3832 }))).toBe(111);
  });
  it("is inside when accuracy circle overlaps the fence", () => {
    expect(checkGeofence(site, { lat: 43.6552, lng: -79.3832, accuracyM: 80 }).within).toBe(true);
    expect(checkGeofence(site, { lat: 43.6600, lng: -79.3832, accuracyM: 20 }).within).toBe(false);
  });
});

describe("hours", () => {
  it("deducts unpaid breaks", () => {
    const r = computeHours(day("2026-10-26", 8), { rules: getRuleSet("CA-ON"), timezone: TZ, weekStartsOn: 0 });
    expect(r.totals.workedMinutes).toBe(480);
    expect(r.days[0].breakMinutes).toBe(30);
    expect(r.days[0].breakCompliant).toBe(true);
  });

  it("Ontario: overtime only after 44 h in the week", () => {
    const punches = ["2026-10-26", "2026-10-27", "2026-10-28", "2026-10-29", "2026-10-30"].flatMap((d) => day(d, 10));
    const r = computeHours(punches, { rules: getRuleSet("CA-ON"), timezone: TZ, weekStartsOn: 0 });
    expect(r.totals.workedMinutes).toBe(3000);
    expect(r.totals.regularMinutes).toBe(44 * 60);
    expect(r.totals.overtimeMinutes).toBe(6 * 60);
    expect(r.days[4].overtimeMinutes).toBe(6 * 60);
  });

  it("BC: daily overtime after 8 h and double time after 12 h", () => {
    const r = computeHours(day("2026-10-26", 13), { rules: getRuleSet("CA-BC"), timezone: TZ, weekStartsOn: 0 });
    expect(r.totals).toMatchObject({ regularMinutes: 480, overtimeMinutes: 240, doubleMinutes: 60 });
  });

  it("does not double-count daily OT toward the weekly threshold", () => {
    // 5 x 10h in BC: 8 reg + 2 OT daily → 40 reg total, weekly cap not exceeded.
    const punches = ["2026-10-26", "2026-10-27", "2026-10-28", "2026-10-29", "2026-10-30"].flatMap((d) => day(d, 10));
    const r = computeHours(punches, { rules: getRuleSet("CA-BC"), timezone: TZ, weekStartsOn: 0 });
    expect(r.totals.regularMinutes).toBe(2400);
    expect(r.totals.overtimeMinutes).toBe(600);
  });

  it("flags a missing break on a long day", () => {
    const punches = [punch("in", "2026-10-26 07:00"), punch("out", "2026-10-26 15:00")];
    const r = computeHours(punches, { rules: getRuleSet("CA-ON"), timezone: TZ, weekStartsOn: 0 });
    expect(r.days[0].breakCompliant).toBe(false);
  });

  it("reports a missing clock-out and keeps open shifts open", () => {
    const punches = [punch("in", "2026-10-26 07:00"), punch("in", "2026-10-27 07:00")];
    const { segments, issues } = buildSegments(punches, TZ, new Date("2026-10-27T15:00:00Z"));
    expect(issues.map((i) => i.issue)).toEqual(["missing_out"]);
    expect(segments[1].open).toBe(true);
  });

  it("ignores voided punches and carries flags", () => {
    const punches = [
      punch("in", "2026-10-26 07:00", { withinGeofence: false, offline: true }),
      punch("out", "2026-10-26 09:00", { voided: true }),
      punch("out", "2026-10-26 11:00"),
    ];
    const { segments } = buildSegments(punches, TZ);
    expect(segments[0].workedMinutes).toBe(240);
    expect(segments[0].flags).toEqual(expect.arrayContaining(["outside_geofence", "offline_punch"]));
  });

  it("tracks clock state transitions", () => {
    const p = [punch("in", "2026-10-26 07:00"), punch("break_start", "2026-10-26 12:00")];
    const s = clockState(p);
    expect(s.status).toBe("on_break");
    expect(allowedNext(s)).toEqual(["break_end"]);
    expect(allowedNext(clockState([]))).toEqual(["in"]);
  });
});

describe("pay periods", () => {
  it("finds the bi-weekly period containing a date", () => {
    const company = { payPeriod: { type: "biweekly" as const, anchorDate: "2026-10-18" } };
    expect(periodFor(company, "2026-10-29")).toEqual({ start: "2026-10-18", end: "2026-10-31" });
    expect(periodFor(company, "2026-11-01")).toEqual({ start: "2026-11-01", end: "2026-11-14" });
  });
});

describe("rules and permissions", () => {
  it("has presets for all provinces, territories and US", () => {
    for (const code of ["CA-ON", "CA-QC", "CA-BC", "CA-AB", "CA-SK", "CA-MB", "CA-NB", "CA-NS", "CA-PE", "CA-NL", "CA-YT", "CA-NT", "CA-NU", "CA-FED", "US-FLSA", "US-CA"]) {
      expect(LABOUR_RULE_PRESETS[code]).toBeDefined();
    }
  });
  it("gates capabilities by role", () => {
    expect(can("employee", "payroll.export")).toBe(false);
    expect(can("office_payroll", "payroll.export")).toBe(true);
    expect(can("foreman", "timesheet.approve.crew")).toBe(true);
    expect(can("foreman", "settings.manage")).toBe(false);
  });
});
