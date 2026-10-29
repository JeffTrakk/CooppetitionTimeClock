import type { Role } from "./types";

// Capabilities are what the UI and server actions check. The Supabase RLS
// policies enforce the same matrix at the database level.

export type Capability =
  | "clock.self"
  | "crew.view"
  | "crew.punch"
  | "punch.edit"
  | "site.modes"
  | "timesheet.approve.crew"
  | "timesheet.approve.all"
  | "dashboard.view"
  | "schedule.manage"
  | "jobs.manage"
  | "people.view"
  | "people.manage"
  | "payroll.export"
  | "messages.send"
  | "settings.manage"
  | "integrations.manage";

const MATRIX: Record<Role, Capability[]> = {
  employee: ["clock.self"],
  foreman: ["clock.self", "crew.view", "crew.punch", "punch.edit", "site.modes", "timesheet.approve.crew", "messages.send"],
  office_payroll: ["clock.self", "dashboard.view", "people.view", "punch.edit", "timesheet.approve.all", "payroll.export", "messages.send"],
  owner_admin: [
    "clock.self", "crew.view", "crew.punch", "punch.edit", "site.modes", "timesheet.approve.crew", "timesheet.approve.all",
    "dashboard.view", "schedule.manage", "jobs.manage", "people.view", "people.manage", "payroll.export", "messages.send",
    "settings.manage", "integrations.manage",
  ],
};

export function can(role: Role, cap: Capability): boolean {
  return MATRIX[role].includes(cap);
}

export function capabilitiesFor(role: Role): Capability[] {
  return MATRIX[role];
}
