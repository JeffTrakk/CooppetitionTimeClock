import type { PayrollBatch, PayrollProvider } from "./types";

const HEADERS = [
  "employee_id", "employee_name", "date", "job_code", "job_name", "cost_code",
  "regular_hours", "overtime_hours", "double_time_hours", "hourly_rate",
];

function cell(v: string | number | null): string {
  const s = v === null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function batchToCsv(batch: PayrollBatch): string {
  const lines = [HEADERS.join(",")];
  for (const r of batch.rows) {
    lines.push(
      [r.payrollExternalId, r.employeeName, r.date, r.jobCode, r.jobName, r.costCode, r.regularHours.toFixed(2), r.overtimeHours.toFixed(2), r.doubleHours.toFixed(2), r.hourlyRate]
        .map(cell)
        .join(","),
    );
  }
  return lines.join("\n") + "\n";
}

/** Works today: a generic CSV any payroll service can import. */
export const csvProvider: PayrollProvider = {
  key: "csv",
  name: "CSV export",
  region: "any",
  description: "Download approved hours as a spreadsheet: one row per employee, day, job and cost code. Import it into any payroll service.",
  auth: "none",
  envVars: [],
  capabilities: ["file_export"],
  docsUrl: "",
  ready: true,
  async exportBatch(batch) {
    return {
      status: "succeeded",
      message: `${batch.rows.length} rows exported.`,
      file: { filename: `payroll-${batch.periodStart}-to-${batch.periodEnd}.csv`, contentType: "text/csv", body: batchToCsv(batch) },
    };
  },
};
