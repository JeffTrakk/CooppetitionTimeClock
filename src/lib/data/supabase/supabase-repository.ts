// SupabaseRepository — NOT CONNECTED.
//
// This is where the production data layer goes. It implements the same
// Repository interface as MemoryRepository, so switching DATA_BACKEND to
// "supabase" changes nothing else in the app.
//
// To connect (see docs/ARCHITECTURE.md → "Connecting Supabase"):
//   1. Create a Supabase project in region ca-central-1 (Canada).
//   2. Apply supabase/migrations/ (`supabase db push`).
//   3. `npm i @supabase/supabase-js @supabase/ssr`.
//   4. Add a server client factory here that reads NEXT_PUBLIC_SUPABASE_URL +
//      NEXT_PUBLIC_SUPABASE_ANON_KEY and the signed-in user's cookies, so
//      every query runs under that user's RLS policies. Use
//      SUPABASE_SERVICE_ROLE_KEY only in background jobs (payroll sync,
//      notification dispatch), never in request handlers.
//   5. Replace each method below with the query noted beside it.
//
// Table map (snake_case in Postgres ↔ camelCase in TypeScript):
//   companies, memberships + profiles (User), jobs, job_foremen, cost_codes,
//   shifts, punches, location_pings, timesheets, timesheet_approvals,
//   audit_log, messages, message_deliveries, integration_connections,
//   payroll_exports. Column-level mapping lives next to each table in the
//   migration file.

import type { Repository } from "../repository";

export class NotConnectedError extends Error {
  constructor(what: string) {
    super(`Supabase is not connected yet (${what}). Set DATA_BACKEND=memory or finish src/lib/data/supabase/supabase-repository.ts.`);
    this.name = "NotConnectedError";
  }
}

const todo = (method: string, query: string) => () => Promise.reject(new NotConnectedError(`${method}: ${query}`));

export class SupabaseRepository implements Repository {
  listCompanies = todo("listCompanies", "select * from companies (RLS returns the caller's companies)");
  getCompany = todo("getCompany", "select * from companies where id = $1");
  updateCompany = todo("updateCompany", "update companies set ... where id = $1 (owner_admin only via RLS)");

  listUsers = todo("listUsers", "select profiles.*, memberships.role from memberships join profiles ... where company_id = $1");
  getUser = todo("getUser", "select ... from memberships join profiles where profiles.id = $1");
  findUserByPin = todo("findUserByPin", "rpc('kiosk_identify', { company_id, pin }) — compares against memberships.kiosk_pin_hash");
  createUser = todo("createUser", "auth.admin.inviteUserByEmail + insert memberships (service role, from an admin action)");
  updateUser = todo("updateUser", "update memberships / profiles");

  listJobs = todo("listJobs", "select jobs.*, array_agg(job_foremen.user_id) from jobs ...");
  getJob = todo("getJob", "select * from jobs where id = $1");
  findJobByQrToken = todo("findJobByQrToken", "select * from jobs where qr_token = $1");
  createJob = todo("createJob", "insert into jobs");
  updateJob = todo("updateJob", "update jobs");
  listCostCodes = todo("listCostCodes", "select * from cost_codes where company_id = $1");
  createCostCode = todo("createCostCode", "insert into cost_codes");

  listShifts = todo("listShifts", "select * from shifts where company_id = $1 and tstzrange(starts_at, ends_at) && tstzrange($from, $to)");
  getShift = todo("getShift", "select * from shifts where id = $1");
  createShift = todo("createShift", "insert into shifts");
  deleteShift = todo("deleteShift", "delete from shifts where id = $1");

  listPunches = todo("listPunches", "select * from punches where company_id = $1 and occurred_at between ...");
  getPunch = todo("getPunch", "select * from punches where id = $1");
  findPunchByClientId = todo("findPunchByClientId", "select * from punches where company_id = $1 and client_id = $2");
  createPunch = todo("createPunch", "insert into punches (client_id unique for offline de-dupe)");
  updatePunch = todo("updatePunch", "update punches set voided, note");
  createLocationPing = todo("createLocationPing", "insert into location_pings");
  listLocationPings = todo("listLocationPings", "select * from location_pings where ...");

  getTimesheet = todo("getTimesheet", "select * from timesheets where company_id, user_id, period_start");
  listTimesheets = todo("listTimesheets", "select * from timesheets where company_id, period_start");
  upsertTimesheet = todo("upsertTimesheet", "insert ... on conflict (company_id, user_id, period_start) do update");

  appendAudit = todo("appendAudit", "insert into audit_log (append-only; no update/delete policy)");
  listAudit = todo("listAudit", "select * from audit_log order by at desc");

  createMessage = todo("createMessage", "insert into messages + message_deliveries; outbox row per external channel");
  listMessagesForUser = todo("listMessagesForUser", "select from message_deliveries join messages where user_id = auth.uid()");
  listSentMessages = todo("listSentMessages", "select messages with deliveries");
  markMessageRead = todo("markMessageRead", "update message_deliveries set read_at = now()");

  listIntegrationConnections = todo("listIntegrationConnections", "select * from integration_connections");
  recordPayrollExport = todo("recordPayrollExport", "insert into payroll_exports");
  listPayrollExports = todo("listPayrollExports", "select * from payroll_exports");
}
