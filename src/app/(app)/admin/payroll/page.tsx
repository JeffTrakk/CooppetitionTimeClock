import Link from "next/link";
import { PeriodNav } from "@/components/period-nav";
import { Badge, Notice, PageHeader, Section, TableWrap } from "@/components/ui";
import { requireCap } from "@/lib/auth/session";
import { repo } from "@/lib/data";
import { formatDateTime } from "@/lib/domain/time";
import { PAYROLL_PROVIDERS } from "@/lib/integrations/payroll/registry";
import { buildPayrollBatch } from "@/lib/services/payroll-service";
import { periodFromParam } from "@/lib/services/period-param";

export default async function Payroll({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  const { company } = await requireCap("payroll.export");
  const { period, prev, next } = periodFromParam(company, (await searchParams).p);
  const [{ batch }, timesheets, history] = await Promise.all([
    buildPayrollBatch(company, period),
    repo().listTimesheets(company.id, period.start),
    repo().listPayrollExports(company.id),
  ]);
  const sum = (k: "regularHours" | "overtimeHours" | "doubleHours") => batch.rows.reduce((a, r) => a + r[k], 0).toFixed(2);
  const approved = timesheets.filter((t) => t.status === "approved").length;
  const exported = timesheets.filter((t) => t.status === "exported").length;

  return (
    <div>
      <PageHeader title="Payroll export" subtitle="Only approved timesheets are exported. After a successful export they're marked as sent to payroll and locked." />
      <PeriodNav period={period} prev={prev} next={next} basePath="/admin/payroll" />
      {approved === 0 && <Notice tone="blue">No approved timesheets waiting in this period{exported ? ` (${exported} already exported)` : ""}. Approve them under <Link className="underline" href={`/admin/timesheets?p=${period.start}`}>Timesheets</Link>.</Notice>}

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="card"><div className="label">Approved, ready</div><div className="text-2xl font-bold">{approved}</div></div>
        <div className="card"><div className="label">Regular hrs</div><div className="text-2xl font-bold tabular-nums">{sum("regularHours")}</div></div>
        <div className="card"><div className="label">Overtime hrs</div><div className="text-2xl font-bold tabular-nums">{sum("overtimeHours")}</div></div>
        <div className="card"><div className="label">Double-time hrs</div><div className="text-2xl font-bold tabular-nums">{sum("doubleHours")}</div></div>
      </div>

      <Section title="Send to">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {PAYROLL_PROVIDERS.map((p) => (
            <div key={p.key} className="card flex flex-col">
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold">{p.name}</span>
                {p.ready ? <Badge tone="green">Ready</Badge> : <Badge tone="amber">Not connected</Badge>}
              </div>
              <p className="mt-1 flex-1 text-sm text-stone-600">{p.description}</p>
              {approved > 0 && (
                <form method="post" action="/api/payroll/export" target={p.ready ? undefined : "_blank"} className="mt-3">
                  <input type="hidden" name="provider" value={p.key} />
                  <input type="hidden" name="start" value={period.start} />
                  <button className={`${p.ready ? "btn-primary" : "btn-ghost"} w-full`}>{p.ready ? "Download CSV" : "Preview payload"}</button>
                </form>
              )}
            </div>
          ))}
        </div>
      </Section>

      <Section title="Rows in this export">
        <TableWrap>
          <table className="data-table">
            <thead><tr><th>Employee</th><th>Date</th><th>Job</th><th>Cost code</th><th className="text-right">Reg</th><th className="text-right">OT</th><th className="text-right">2x</th></tr></thead>
            <tbody>
              {batch.rows.length === 0 && <tr><td colSpan={7} className="text-center text-stone-500">Nothing approved yet.</td></tr>}
              {batch.rows.map((r, i) => (
                <tr key={i}>
                  <td>{r.employeeName} <span className="font-mono text-xs text-stone-400">{r.payrollExternalId}</span></td>
                  <td className="tabular-nums">{r.date}</td>
                  <td>{r.jobCode}</td>
                  <td>{r.costCode ?? "–"}</td>
                  <td className="text-right tabular-nums">{r.regularHours.toFixed(2)}</td>
                  <td className="text-right tabular-nums">{r.overtimeHours ? r.overtimeHours.toFixed(2) : "–"}</td>
                  <td className="text-right tabular-nums">{r.doubleHours ? r.doubleHours.toFixed(2) : "–"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      </Section>

      <Section title="Export history">
        {history.length === 0 ? <p className="text-sm text-stone-500">No exports yet.</p> : (
          <ul className="space-y-1 text-sm">
            {history.map((h) => (
              <li key={h.id}>{formatDateTime(h.createdAt, company.timezone)} · {h.provider} · {h.periodStart} → {h.periodEnd} · {h.rowCount} rows · <Badge tone={h.status === "succeeded" ? "green" : "amber"}>{h.status.replace("_", " ")}</Badge></li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
