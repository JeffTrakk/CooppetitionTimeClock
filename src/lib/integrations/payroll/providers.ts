// Placeholder providers. Each one documents what it will need and shows the
// payload it WOULD send, but makes no network calls. To connect one, replace
// its exportBatch with real API calls inside a background job (see
// supabase/functions/payroll-sync and docs/ARCHITECTURE.md).

import type { PayrollBatch, PayrollProvider } from "./types";

function placeholder(p: Omit<PayrollProvider, "ready" | "exportBatch">, toPayload: (b: PayrollBatch) => unknown): PayrollProvider {
  return {
    ...p,
    ready: false,
    async exportBatch(batch) {
      return {
        status: "not_connected",
        message: `${p.name} is not connected yet. Nothing was sent. The preview shows what would be sent.`,
        preview: toPayload(batch),
      };
    },
  };
}

export const quickbooksProvider = placeholder(
  {
    key: "quickbooks",
    name: "QuickBooks Online",
    region: "CA/US",
    description: "Sends approved hours to QuickBooks Online as time entries for each employee, linked to a customer or project. Matches employees and jobs by ID.",
    auth: "oauth2",
    envVars: ["QUICKBOOKS_CLIENT_ID", "QUICKBOOKS_CLIENT_SECRET", "QUICKBOOKS_REDIRECT_URI", "QUICKBOOKS_ENVIRONMENT"],
    capabilities: ["push_hours", "sync_employees", "sync_jobs"],
    docsUrl: "https://developer.intuit.com/app/developer/qbo/docs/api/accounting/all-entities/timeactivity",
  },
  (b) =>
    b.rows.slice(0, 3).map((r) => ({
      TxnDate: r.date,
      NameOf: "Employee",
      EmployeeRef: { value: r.payrollExternalId },
      CustomerRef: { value: `<customer id for ${r.jobCode}>` },
      Hours: Math.floor(r.regularHours + r.overtimeHours + r.doubleHours),
      Minutes: Math.round(((r.regularHours + r.overtimeHours + r.doubleHours) % 1) * 60),
      Description: [r.jobName, r.costCode].filter(Boolean).join(" · "),
    })),
);

export const wagepointProvider = placeholder(
  {
    key: "wagepoint",
    name: "Wagepoint",
    region: "CA",
    description: "Canadian payroll. Sends regular, overtime and double-time hours per employee per pay period. Confirm the API or import method with Wagepoint when connecting.",
    auth: "api_key",
    envVars: ["WAGEPOINT_API_KEY", "WAGEPOINT_COMPANY_ID"],
    capabilities: ["push_hours", "sync_employees"],
    docsUrl: "https://wagepoint.com",
  },
  (b) => summarisePerEmployee(b),
);

export const ceridianProvider = placeholder(
  {
    key: "ceridian",
    name: "Dayforce (Ceridian)",
    region: "CA/US",
    description: "Sends approved punches or hours to Dayforce through its API, matched by employee number.",
    auth: "oauth2",
    envVars: ["DAYFORCE_CLIENT_ID", "DAYFORCE_CLIENT_SECRET", "DAYFORCE_COMPANY_NAMESPACE"],
    capabilities: ["push_hours", "sync_employees"],
    docsUrl: "https://developers.dayforce.com",
  },
  (b) => summarisePerEmployee(b),
);

export const adpProvider = placeholder(
  {
    key: "adp",
    name: "ADP",
    region: "CA/US",
    description: "ADP Workforce Now or RUN. Sends hours as pay data input batches. ADP requires a partner app registration and a client certificate.",
    auth: "oauth2",
    envVars: ["ADP_CLIENT_ID", "ADP_CLIENT_SECRET", "ADP_CERT_PEM", "ADP_KEY_PEM"],
    capabilities: ["push_hours", "sync_employees"],
    docsUrl: "https://developers.adp.com",
  },
  (b) => ({
    payDataInput: {
      payrollGroupCode: "<company payroll group>",
      payPeriod: { startDate: b.periodStart, endDate: b.periodEnd },
      earnings: summarisePerEmployee(b).slice(0, 3),
    },
  }),
);

function summarisePerEmployee(b: PayrollBatch) {
  const by = new Map<string, { employeeId: string | null; name: string; regular: number; overtime: number; double: number }>();
  for (const r of b.rows) {
    const e = by.get(r.userId) ?? { employeeId: r.payrollExternalId, name: r.employeeName, regular: 0, overtime: 0, double: 0 };
    e.regular += r.regularHours;
    e.overtime += r.overtimeHours;
    e.double += r.doubleHours;
    by.set(r.userId, e);
  }
  return [...by.values()].map((e) => ({ ...e, regular: +e.regular.toFixed(2), overtime: +e.overtime.toFixed(2), double: +e.double.toFixed(2) }));
}
