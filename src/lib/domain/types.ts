// Core domain types. These mirror the Supabase schema in
// supabase/migrations/ — keep the two in step when either changes.

export type Role = "owner_admin" | "office_payroll" | "foreman" | "employee";

export const ROLE_LABELS: Record<Role, string> = {
  owner_admin: "Owner / Admin",
  office_payroll: "Office / Payroll",
  foreman: "Foreman",
  employee: "Employee",
};

/** How a job site behaves when the device has no signal. Chosen per site by a foreman or admin. */
export type OfflineMode = "queue" | "require_online";

/** When location is captured. Company default, overridable per job. */
export type GpsMode = "punch_only" | "continuous";

/** What happens to a phone punch made outside the geofence. */
export type GeofenceEnforcement = "flag" | "block";

export interface Branding {
  appName: string;
  logoUrl: string | null;
  primaryColor: string;
  accentColor: string;
}

export type PayPeriodType = "weekly" | "biweekly";

export interface Company {
  id: string;
  name: string;
  slug: string;
  branding: Branding;
  timezone: string;
  /** Key into LABOUR_RULE_PRESETS, e.g. "CA-ON". */
  labourRuleSet: string;
  /** 0 = Sunday. Used for weekly overtime and pay periods. */
  weekStartsOn: number;
  payPeriod: { type: PayPeriodType; anchorDate: string };
  gpsModeDefault: GpsMode;
}

export interface User {
  id: string;
  companyId: string;
  name: string;
  email: string;
  phone: string | null;
  role: Role;
  /** Kiosk PIN. Stored hashed in Supabase; plain only in the in-memory demo. */
  kioskPin: string;
  hourlyRate: number | null;
  /** ID used by the payroll provider for this employee. */
  payrollExternalId: string | null;
  active: boolean;
  locationConsentAt: string | null;
}

export interface Job {
  id: string;
  companyId: string;
  name: string;
  code: string;
  address: string;
  lat: number;
  lng: number;
  geofenceRadiusM: number;
  geofenceEnforcement: GeofenceEnforcement;
  requireQr: boolean;
  qrToken: string;
  offlineMode: OfflineMode;
  /** null = inherit company default. */
  gpsMode: GpsMode | null;
  /** null = inherit company rule set. */
  labourRuleOverride: string | null;
  foremanIds: string[];
  status: "active" | "on_hold" | "complete";
}

export interface CostCode {
  id: string;
  companyId: string;
  code: string;
  name: string;
}

export interface Shift {
  id: string;
  companyId: string;
  jobId: string;
  userId: string;
  start: string;
  end: string;
  costCodeId: string | null;
  notes: string | null;
}

export type PunchType = "in" | "out" | "break_start" | "break_end";
export type PunchSource = "phone" | "kiosk" | "foreman" | "admin_edit";

export interface GpsFix {
  lat: number;
  lng: number;
  accuracyM: number;
}

export interface Punch {
  id: string;
  companyId: string;
  userId: string;
  jobId: string;
  type: PunchType;
  /** When it happened on site (device clock for offline punches). */
  occurredAt: string;
  /** When the server received it. Differs from occurredAt for offline punches. */
  receivedAt: string;
  source: PunchSource;
  gps: GpsFix | null;
  distanceM: number | null;
  withinGeofence: boolean | null;
  qrVerified: boolean;
  costCodeId: string | null;
  offline: boolean;
  createdBy: string;
  voided: boolean;
  /** For admin/foreman edits: the punch this one replaces. */
  replacesPunchId: string | null;
  note: string | null;
  /** Generated on the device; makes offline re-sync idempotent. */
  clientId: string | null;
}

/** Breadcrumb recorded only when a job runs in "continuous" GPS mode. */
export interface LocationPing {
  id: string;
  companyId: string;
  userId: string;
  jobId: string;
  at: string;
  gps: GpsFix;
  withinGeofence: boolean;
}

export type TimesheetStatus = "open" | "submitted" | "foreman_approved" | "approved" | "exported";

export interface Timesheet {
  id: string;
  companyId: string;
  userId: string;
  periodStart: string;
  periodEnd: string;
  status: TimesheetStatus;
  approvals: { byUserId: string; role: Role; at: string; status: TimesheetStatus }[];
}

export interface AuditEntry {
  id: string;
  companyId: string;
  actorId: string;
  action: string;
  entity: string;
  entityId: string;
  reason: string | null;
  before: unknown;
  after: unknown;
  at: string;
}

export type ChannelKey = "in_app" | "sms" | "email" | "push";

export type Audience =
  | { type: "company" }
  | { type: "job"; jobId: string }
  | { type: "user"; userId: string };

export interface Message {
  id: string;
  companyId: string;
  senderId: string;
  audience: Audience;
  subject: string | null;
  body: string;
  channels: ChannelKey[];
  createdAt: string;
}

export type DeliveryStatus = "delivered" | "queued" | "not_connected" | "failed";

export interface MessageDelivery {
  messageId: string;
  userId: string;
  channel: ChannelKey;
  status: DeliveryStatus;
  readAt: string | null;
}

export type IntegrationKind = "payroll" | "messaging";

export interface IntegrationConnection {
  id: string;
  companyId: string;
  provider: string;
  kind: IntegrationKind;
  status: "not_connected" | "configured" | "error";
  /** Non-secret settings only. Secrets live in Supabase Vault / Vercel env. */
  settings: Record<string, string>;
}

export interface PayrollExport {
  id: string;
  companyId: string;
  provider: string;
  periodStart: string;
  periodEnd: string;
  createdBy: string;
  createdAt: string;
  status: "succeeded" | "not_connected" | "failed";
  rowCount: number;
}
