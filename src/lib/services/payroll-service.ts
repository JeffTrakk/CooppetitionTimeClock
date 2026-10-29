import "server-only";
import { repo } from "../data";
import { can } from "../domain/permissions";
import type { Period } from "../domain/pay-period";
import type { Company, User } from "../domain/types";
import { getPayrollProvider } from "../integrations/payroll/registry";
import type { PayrollBatch, PayrollExportResult, PayrollRow } from "../integrations/payroll/types";
import { hoursForUser } from "./hours-service";
import { fail, type Result } from "./scope";
import { markExported } from "./timesheet-service";

const hrs = (min: number) => Math.round((min / 60) * 100) / 100;

/** Builds the provider-neutral batch from APPROVED timesheets only. */
export async function buildPayrollBatch(company: Company, period: Period): Promise<{ batch: PayrollBatch; userIds: string[] }> {
  const r = repo();
  const [timesheets, users, jobs, costCodes] = await Promise.all([
    r.listTimesheets(company.id, period.start),
    r.listUsers(company.id),
    r.listJobs(company.id),
    r.listCostCodes(company.id),
  ]);
  const approved = timesheets.filter((t) => t.status === "approved");
  const rows: PayrollRow[] = [];

  for (const ts of approved) {
    const user = users.find((u) => u.id === ts.userId);
    if (!user) continue;
    const report = await hoursForUser(company, user.id, period, jobs);
    const grouped = new Map<string, PayrollRow>();
    for (const s of report.segments) {
      const job = jobs.find((j) => j.id === s.jobId);
      const cc = costCodes.find((c) => c.id === s.costCodeId);
      const key = `${s.date}|${s.jobId}|${s.costCodeId ?? ""}`;
      const row = grouped.get(key) ?? {
        userId: user.id, employeeName: user.name, payrollExternalId: user.payrollExternalId, date: s.date,
        jobCode: job?.code ?? "", jobName: job?.name ?? "", costCode: cc?.code ?? null,
        regularHours: 0, overtimeHours: 0, doubleHours: 0, hourlyRate: user.hourlyRate,
      };
      row.regularHours += s.regularMinutes / 60;
      row.overtimeHours += s.overtimeMinutes / 60;
      row.doubleHours += s.doubleMinutes / 60;
      grouped.set(key, row);
    }
    for (const row of grouped.values()) {
      rows.push({ ...row, regularHours: hrs(row.regularHours * 60), overtimeHours: hrs(row.overtimeHours * 60), doubleHours: hrs(row.doubleHours * 60) });
    }
  }

  rows.sort((a, b) => a.employeeName.localeCompare(b.employeeName) || a.date.localeCompare(b.date));
  return {
    batch: { companyId: company.id, companyName: company.name, periodStart: period.start, periodEnd: period.end, generatedAt: new Date().toISOString(), rows },
    userIds: approved.map((t) => t.userId),
  };
}

export async function runPayrollExport(company: Company, actor: User, providerKey: string, period: Period): Promise<Result<{ result: PayrollExportResult }>> {
  if (!can(actor.role, "payroll.export")) return fail("Not allowed.");
  const provider = getPayrollProvider(providerKey);
  if (!provider) return fail("Unknown payroll provider.");
  const { batch, userIds } = await buildPayrollBatch(company, period);
  if (batch.rows.length === 0) return fail("No approved timesheets in this period.");

  const result = await provider.exportBatch(batch);
  await repo().recordPayrollExport({
    companyId: company.id, provider: provider.key, periodStart: period.start, periodEnd: period.end, createdBy: actor.id,
    createdAt: new Date().toISOString(), status: result.status, rowCount: batch.rows.length,
  });
  if (result.status === "succeeded") await markExported(company, actor, userIds, period);
  return { ok: true, result };
}
