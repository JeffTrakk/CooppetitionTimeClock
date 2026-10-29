// Demo data so every screen works before Supabase is connected. Dates are
// generated relative to "now" so the schedule and timesheets always look
// current. Two companies show the white-label + multi-tenant behaviour.

import { currentPeriod, shiftPeriod } from "../../domain/pay-period";
import { addDays, dayOfWeek, localDate, zonedTimeToUtc } from "../../domain/time";
import type {
  AuditEntry, Company, CostCode, IntegrationConnection, Job, LocationPing, Message, MessageDelivery, PayrollExport, Punch, Shift,
  Timesheet, User,
} from "../../domain/types";

export interface Store {
  companies: Company[];
  users: User[];
  jobs: Job[];
  costCodes: CostCode[];
  shifts: Shift[];
  punches: Punch[];
  locationPings: LocationPing[];
  timesheets: Timesheet[];
  audit: AuditEntry[];
  messages: Message[];
  deliveries: MessageDelivery[];
  integrationConnections: IntegrationConnection[];
  payrollExports: PayrollExport[];
}

// Small deterministic PRNG so the demo looks the same on every restart.
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

export function buildSeed(now = new Date()): Store {
  const rand = rng(42);
  const companies: Company[] = [
    {
      id: "co-northline",
      name: "Northline Builders",
      slug: "northline",
      branding: { appName: "Northline TimeClock", logoUrl: null, primaryColor: "#1f5f8b", accentColor: "#f2a541" },
      timezone: "America/Toronto",
      labourRuleSet: "CA-ON",
      weekStartsOn: 0,
      payPeriod: { type: "biweekly", anchorDate: "2026-01-04" },
      gpsModeDefault: "punch_only",
    },
    {
      id: "co-ridgeview",
      name: "Ridgeview Contracting",
      slug: "ridgeview",
      branding: { appName: "Ridgeview Crew Clock", logoUrl: null, primaryColor: "#7a2e2e", accentColor: "#e0c068" },
      timezone: "America/Vancouver",
      labourRuleSet: "CA-BC",
      weekStartsOn: 0,
      payPeriod: { type: "weekly", anchorDate: "2026-01-04" },
      gpsModeDefault: "punch_only",
    },
  ];

  const u = (id: string, companyId: string, name: string, role: User["role"], pin: string, rate: number | null, phone: string | null = "+1 416 555 0100"): User => ({
    id, companyId, name, role, kioskPin: pin, hourlyRate: rate, phone,
    email: `${name.split(" ")[0].toLowerCase()}@${companyId.replace("co-", "")}.example`,
    payrollExternalId: `EMP-${id.slice(-3).toUpperCase()}`, active: true, locationConsentAt: null,
  });

  const users: User[] = [
    u("u-dana", "co-northline", "Dana Reyes", "owner_admin", "1001", null),
    u("u-priya", "co-northline", "Priya Shah", "office_payroll", "1002", 32),
    u("u-marco", "co-northline", "Marco Bianchi", "foreman", "2001", 48),
    u("u-sam", "co-northline", "Sam Okafor", "foreman", "2002", 46),
    u("u-tyler", "co-northline", "Tyler Chen", "employee", "3001", 31),
    u("u-aisha", "co-northline", "Aisha Mohamed", "employee", "3002", 34),
    u("u-ben", "co-northline", "Ben Kowalski", "employee", "3003", 29),
    u("u-jordan", "co-northline", "Jordan Lee", "employee", "3004", 27, null),
    u("u-ravi", "co-northline", "Ravi Patel", "employee", "3005", 33),
    u("u-claire", "co-ridgeview", "Claire Dubois", "owner_admin", "1001", null, "+1 604 555 0100"),
    u("u-hank", "co-ridgeview", "Hank Morrison", "foreman", "2001", 47, "+1 604 555 0101"),
    u("u-mei", "co-ridgeview", "Mei Tanaka", "employee", "3001", 33, "+1 604 555 0102"),
    u("u-oscar", "co-ridgeview", "Oscar Silva", "employee", "3002", 30, "+1 604 555 0103"),
  ];

  const job = (j: Partial<Job> & Pick<Job, "id" | "companyId" | "name" | "code" | "address" | "lat" | "lng" | "foremanIds">): Job => ({
    geofenceRadiusM: 150, geofenceEnforcement: "flag", requireQr: false, qrToken: `qr-${j.id}`, offlineMode: "queue",
    gpsMode: null, labourRuleOverride: null, status: "active", ...j,
  });

  const jobs: Job[] = [
    job({ id: "job-king", companyId: "co-northline", name: "King St Condo — Phase 2", code: "NB-2041", address: "455 King St W, Toronto, ON", lat: 43.6455, lng: -79.395, foremanIds: ["u-marco"], offlineMode: "require_online" }),
    job({ id: "job-leslie", companyId: "co-northline", name: "Leslieville Townhomes", code: "NB-2044", address: "1100 Queen St E, Toronto, ON", lat: 43.6625, lng: -79.329, foremanIds: ["u-marco"], gpsMode: "continuous" }),
    job({ id: "job-etob", companyId: "co-northline", name: "Etobicoke Warehouse Reno", code: "NB-2050", address: "30 Belfield Rd, Etobicoke, ON", lat: 43.6905, lng: -79.5832, foremanIds: ["u-sam"], requireQr: true, geofenceRadiusM: 250 }),
    job({ id: "job-kits", companyId: "co-ridgeview", name: "Kitsilano Duplex", code: "RV-118", address: "2200 W 4th Ave, Vancouver, BC", lat: 49.2681, lng: -123.1587, foremanIds: ["u-hank"] }),
  ];

  const cc = (companyId: string, code: string, name: string): CostCode => ({ id: `cc-${companyId.slice(3, 6)}-${code}`, companyId, code, name });
  const costCodes: CostCode[] = [
    ...[["01-100", "Site prep"], ["03-300", "Concrete"], ["06-100", "Framing"], ["09-200", "Drywall"], ["15-000", "Plumbing"], ["16-000", "Electrical"], ["99-000", "General labour"]].map(([c, nme]) => cc("co-northline", c, nme)),
    ...[["06-100", "Framing"], ["07-200", "Roofing"], ["99-000", "General labour"]].map(([c, nme]) => cc("co-ridgeview", c, nme)),
  ];

  // Crew → job assignment for the demo.
  const crews: Record<string, { jobId: string; costCode: string }> = {
    "u-marco": { jobId: "job-king", costCode: "99-000" },
    "u-tyler": { jobId: "job-king", costCode: "06-100" },
    "u-aisha": { jobId: "job-king", costCode: "16-000" },
    "u-ben": { jobId: "job-leslie", costCode: "09-200" },
    "u-sam": { jobId: "job-etob", costCode: "99-000" },
    "u-jordan": { jobId: "job-etob", costCode: "01-100" },
    "u-ravi": { jobId: "job-etob", costCode: "15-000" },
    "u-hank": { jobId: "job-kits", costCode: "99-000" },
    "u-mei": { jobId: "job-kits", costCode: "06-100" },
    "u-oscar": { jobId: "job-kits", costCode: "07-200" },
  };

  const shifts: Shift[] = [];
  const punches: Punch[] = [];
  let pid = 0;

  for (const [userId, a] of Object.entries(crews)) {
    const user = users.find((x) => x.id === userId)!;
    const company = companies.find((c) => c.id === user.companyId)!;
    const jobRec = jobs.find((j) => j.id === a.jobId)!;
    const costCodeId = costCodes.find((c) => c.companyId === company.id && c.code === a.costCode)?.id ?? null;
    const today = localDate(now, company.timezone);

    for (let offset = -21; offset <= 13; offset++) {
      const date = addDays(today, offset);
      const dow = dayOfWeek(date);
      if (dow === 0 || dow === 6) continue;
      // Ben is moved to King St on Fridays to show multi-job schedules.
      const jobId = userId === "u-ben" && dow === 5 ? "job-king" : a.jobId;
      shifts.push({
        id: `sh-${userId}-${date}`, companyId: company.id, jobId, userId,
        start: zonedTimeToUtc(date, "07:00", company.timezone), end: zonedTimeToUtc(date, "15:30", company.timezone),
        costCodeId, notes: dow === 1 ? "Toolbox talk at 7:00 sharp." : null,
      });
      if (offset > 0) continue;

      const site = jobs.find((j) => j.id === jobId)!;
      const jitter = () => Math.floor(rand() * 12) - 4;
      const at = (hhmm: string, deltaMin: number) => new Date(Date.parse(zonedTimeToUtc(date, hhmm, company.timezone)) + deltaMin * 60_000).toISOString();
      const mk = (type: Punch["type"], iso: string, extra: Partial<Punch> = {}): Punch | null => {
        if (Date.parse(iso) > now.getTime()) return null;
        const gps = { lat: site.lat + (rand() - 0.5) * 0.0008, lng: site.lng + (rand() - 0.5) * 0.0008, accuracyM: 8 + Math.round(rand() * 20) };
        return {
          id: `pu-${++pid}`, companyId: company.id, userId, jobId, type, occurredAt: iso, receivedAt: iso,
          source: userId === "u-jordan" ? "kiosk" : "phone", gps, distanceM: Math.round(rand() * 60), withinGeofence: true,
          qrVerified: site.requireQr && userId !== "u-jordan", costCodeId, offline: false, createdBy: userId, voided: false,
          replacesPunchId: null, note: null, clientId: null, ...extra,
        };
      };

      const isLongDay = userId === "u-tyler" && (dow === 2 || dow === 4);
      const outAt = isLongDay ? at("18:30", jitter()) : at("15:30", jitter());
      const skipLunch = userId === "u-ravi" && offset === -2;
      const offline = userId === "u-ben" && offset === -1;
      const outside = userId === "u-aisha" && offset === -3;
      const forgotOut = userId === "u-ravi" && offset === -6;

      const day = [
        mk("in", at("07:00", jitter()), outside ? { withinGeofence: false, distanceM: 640 } : {}),
        skipLunch ? null : mk("break_start", at("12:00", jitter())),
        skipLunch ? null : mk("break_end", at("12:30", jitter())),
        forgotOut ? null : mk("out", outAt, offline ? { offline: true, receivedAt: at("17:45", 0) } : {}),
      ];
      for (const p of day) if (p) punches.push(p);
    }
  }

  // Previous pay period is approved so payroll export has something to send.
  const timesheets: Timesheet[] = [];
  for (const company of companies) {
    const prev = shiftPeriod(company, currentPeriod(company, now), -1);
    for (const user of users.filter((x) => x.companyId === company.id && crews[x.id])) {
      timesheets.push({
        id: `ts-${user.id}-${prev.start}`, companyId: company.id, userId: user.id, periodStart: prev.start, periodEnd: prev.end,
        status: "approved",
        approvals: [{ byUserId: company.id === "co-northline" ? "u-priya" : "u-claire", role: company.id === "co-northline" ? "office_payroll" : "owner_admin", at: now.toISOString(), status: "approved" }],
      });
    }
  }

  const messages: Message[] = [
    { id: "msg-1", companyId: "co-northline", senderId: "u-dana", audience: { type: "company" }, subject: "Winter PPE", body: "Insulated gloves and hi-vis toques are in the trailer at each site. Grab yours before the cold snap next week.", channels: ["in_app", "email"], createdAt: new Date(now.getTime() - 2 * 86_400_000).toISOString() },
    { id: "msg-2", companyId: "co-northline", senderId: "u-marco", audience: { type: "job", jobId: "job-king" }, subject: null, body: "Concrete pour moved to Thursday. Same start time.", channels: ["in_app", "sms"], createdAt: new Date(now.getTime() - 5 * 3_600_000).toISOString() },
  ];
  const deliveries: MessageDelivery[] = [];
  for (const user of users.filter((x) => x.companyId === "co-northline")) {
    deliveries.push({ messageId: "msg-1", userId: user.id, channel: "in_app", status: "delivered", readAt: null });
    deliveries.push({ messageId: "msg-1", userId: user.id, channel: "email", status: "not_connected", readAt: null });
  }
  for (const id of ["u-marco", "u-tyler", "u-aisha"]) {
    deliveries.push({ messageId: "msg-2", userId: id, channel: "in_app", status: "delivered", readAt: null });
    deliveries.push({ messageId: "msg-2", userId: id, channel: "sms", status: "not_connected", readAt: null });
  }

  return {
    companies, users, jobs, costCodes, shifts, punches, locationPings: [], timesheets, audit: [], messages, deliveries,
    integrationConnections: [], payrollExports: [],
  };
}
