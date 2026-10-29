// Contract every payroll integration implements. The app builds one
// PayrollBatch from approved timesheets; each provider maps it to its own
// format (file, API calls, etc.). Adding a provider = one new file + one line
// in registry.ts.

export interface PayrollRow {
  userId: string;
  employeeName: string;
  payrollExternalId: string | null;
  date: string;
  jobCode: string;
  jobName: string;
  costCode: string | null;
  regularHours: number;
  overtimeHours: number;
  doubleHours: number;
  hourlyRate: number | null;
}

export interface PayrollBatch {
  companyId: string;
  companyName: string;
  periodStart: string;
  periodEnd: string;
  generatedAt: string;
  rows: PayrollRow[];
}

export type PayrollExportResult =
  | { status: "succeeded"; file?: { filename: string; contentType: string; body: string }; message: string }
  | { status: "not_connected"; message: string; preview: unknown }
  | { status: "failed"; message: string };

export interface PayrollProvider {
  key: string;
  name: string;
  region: "CA" | "US" | "CA/US" | "any";
  description: string;
  auth: "none" | "oauth2" | "api_key" | "sftp";
  /** Environment variable NAMES this provider will need once connected. Never values. */
  envVars: string[];
  /** What the connection will do once live. */
  capabilities: ("file_export" | "push_hours" | "sync_employees" | "sync_jobs")[];
  docsUrl: string;
  /** True only when the provider works without credentials (e.g. a file download). */
  ready: boolean;
  exportBatch(batch: PayrollBatch): Promise<PayrollExportResult>;
}
