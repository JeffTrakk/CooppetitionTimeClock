// The single data-access contract for the app. Every page, server action
// and integration goes through this interface — nothing imports a database
// client directly. Two implementations:
//   - MemoryRepository  (src/lib/data/memory/)   in-process demo data, used today
//   - SupabaseRepository (src/lib/data/supabase/) stub, mapped to supabase/migrations
// Switch with DATA_BACKEND in .env (see src/lib/data/index.ts).
//
// Every method is scoped by companyId. In Supabase, Row Level Security
// enforces the same scoping, so a bug here cannot leak another company's data.

import type {
  AuditEntry, Company, CostCode, IntegrationConnection, Job, LocationPing, Message, MessageDelivery,
  PayrollExport, Punch, Shift, Timesheet, User,
} from "../domain/types";

export type NewRecord<T extends { id: string }> = Omit<T, "id">;

export interface Repository {
  // Companies (tenants)
  listCompanies(): Promise<Company[]>;
  getCompany(id: string): Promise<Company | null>;
  updateCompany(id: string, patch: Partial<Omit<Company, "id">>): Promise<Company>;

  // People
  listUsers(companyId: string): Promise<User[]>;
  getUser(id: string): Promise<User | null>;
  findUserByPin(companyId: string, pin: string): Promise<User | null>;
  createUser(input: NewRecord<User>): Promise<User>;
  updateUser(id: string, patch: Partial<Omit<User, "id" | "companyId">>): Promise<User>;

  // Jobs and cost codes
  listJobs(companyId: string): Promise<Job[]>;
  getJob(id: string): Promise<Job | null>;
  findJobByQrToken(token: string): Promise<Job | null>;
  createJob(input: NewRecord<Job>): Promise<Job>;
  updateJob(id: string, patch: Partial<Omit<Job, "id" | "companyId">>): Promise<Job>;
  listCostCodes(companyId: string): Promise<CostCode[]>;
  createCostCode(input: NewRecord<CostCode>): Promise<CostCode>;

  // Schedule
  listShifts(companyId: string, range: { from: string; to: string; userId?: string; jobId?: string }): Promise<Shift[]>;
  getShift(id: string): Promise<Shift | null>;
  createShift(input: NewRecord<Shift>): Promise<Shift>;
  deleteShift(id: string): Promise<void>;

  // Time
  listPunches(companyId: string, filter: { userId?: string; jobId?: string; from?: string; to?: string }): Promise<Punch[]>;
  getPunch(id: string): Promise<Punch | null>;
  findPunchByClientId(companyId: string, clientId: string): Promise<Punch | null>;
  createPunch(input: NewRecord<Punch>): Promise<Punch>;
  updatePunch(id: string, patch: Partial<Pick<Punch, "voided" | "note">>): Promise<Punch>;
  createLocationPing(input: NewRecord<LocationPing>): Promise<LocationPing>;
  listLocationPings(companyId: string, filter: { userId: string; from: string }): Promise<LocationPing[]>;

  // Timesheets
  getTimesheet(companyId: string, userId: string, periodStart: string): Promise<Timesheet | null>;
  listTimesheets(companyId: string, periodStart: string): Promise<Timesheet[]>;
  upsertTimesheet(input: NewRecord<Timesheet>): Promise<Timesheet>;

  // Audit trail — append only
  appendAudit(input: NewRecord<AuditEntry>): Promise<void>;
  listAudit(companyId: string, filter?: { entity?: string; entityId?: string; limit?: number }): Promise<AuditEntry[]>;

  // Messaging
  createMessage(input: NewRecord<Message>, deliveries: Omit<MessageDelivery, "messageId">[]): Promise<Message>;
  listMessagesForUser(companyId: string, userId: string): Promise<(Message & { delivery: MessageDelivery })[]>;
  listSentMessages(companyId: string): Promise<(Message & { deliveries: MessageDelivery[] })[]>;
  markMessageRead(messageId: string, userId: string): Promise<void>;

  // Integrations
  listIntegrationConnections(companyId: string): Promise<IntegrationConnection[]>;
  recordPayrollExport(input: NewRecord<PayrollExport>): Promise<PayrollExport>;
  listPayrollExports(companyId: string): Promise<PayrollExport[]>;
}
