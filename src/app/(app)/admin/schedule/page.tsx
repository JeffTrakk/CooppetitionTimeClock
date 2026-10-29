import Link from "next/link";
import { addShift, removeShift } from "@/app/actions/admin";
import { ActionForm } from "@/components/action-form";
import { PageHeader, Section } from "@/components/ui";
import { requireCap } from "@/lib/auth/session";
import { repo } from "@/lib/data";
import { addDays, formatDate, formatTime, localDate, startOfWeek } from "@/lib/domain/time";
import { today, utcBounds } from "@/lib/services/scope";

// Simple palette so each job reads at a glance in the grid.
const JOB_COLOURS = ["bg-sky-100 border-sky-300", "bg-amber-100 border-amber-300", "bg-emerald-100 border-emerald-300", "bg-rose-100 border-rose-300", "bg-violet-100 border-violet-300"];

export default async function Schedule({ searchParams }: { searchParams: Promise<{ week?: string }> }) {
  const { company } = await requireCap("schedule.manage");
  const w = (await searchParams).week;
  const t = today(company);
  const weekStart = startOfWeek(w && /^\d{4}-\d{2}-\d{2}$/.test(w) ? w : t, company.weekStartsOn);
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const [users, jobs, costCodes, shifts] = await Promise.all([
    repo().listUsers(company.id),
    repo().listJobs(company.id),
    repo().listCostCodes(company.id),
    repo().listShifts(company.id, utcBounds(company, days[0], days[6])),
  ]);
  const field = users.filter((u) => u.active && (u.role === "employee" || u.role === "foreman"));
  const activeJobs = jobs.filter((j) => j.status === "active");
  const colour = (jobId: string) => JOB_COLOURS[jobs.findIndex((j) => j.id === jobId) % JOB_COLOURS.length];

  return (
    <div>
      <PageHeader
        title="Schedule"
        subtitle={`Week of ${formatDate(weekStart, { month: "long", day: "numeric", year: "numeric" })}`}
        actions={
          <>
            <Link className="btn-ghost" href={`/admin/schedule?week=${addDays(weekStart, -7)}`}>← Prev</Link>
            <Link className="btn-ghost" href="/admin/schedule">This week</Link>
            <Link className="btn-ghost" href={`/admin/schedule?week=${addDays(weekStart, 7)}`}>Next →</Link>
          </>
        }
      />

      <div className="card mb-6 overflow-x-auto p-0">
        <table className="data-table min-w-[900px]">
          <thead>
            <tr>
              <th className="w-40">Worker</th>
              {days.map((d) => <th key={d} className={d === t ? "bg-brand/5 text-brand" : ""}>{formatDate(d)}</th>)}
            </tr>
          </thead>
          <tbody>
            {field.map((u) => (
              <tr key={u.id}>
                <td className="font-semibold">{u.name}</td>
                {days.map((d) => (
                  <td key={d} className={`space-y-1 ${d === t ? "bg-brand/5" : ""}`}>
                    {shifts.filter((s) => s.userId === u.id && localDate(s.start, company.timezone) === d).map((s) => (
                      <div key={s.id} className={`rounded-md border px-1.5 py-1 text-[11px] leading-tight ${colour(s.jobId)}`}>
                        <div className="font-semibold">{jobs.find((j) => j.id === s.jobId)?.code}</div>
                        <div className="tabular-nums">{formatTime(s.start, company.timezone)}–{formatTime(s.end, company.timezone)}</div>
                        <form action={removeShift}>
                          <input type="hidden" name="shiftId" value={s.id} />
                          <button className="text-[10px] font-semibold text-red-700">Remove</button>
                        </form>
                      </div>
                    ))}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Section title="Add a shift">
        <ActionForm action={addShift} className="card grid gap-2 md:grid-cols-4">
          <div><label className="label">Worker</label><select name="userId" className="input">{field.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></div>
          <div><label className="label">Job</label><select name="jobId" className="input">{activeJobs.map((j) => <option key={j.id} value={j.id}>{j.name}</option>)}</select></div>
          <div><label className="label">Date</label><input type="date" name="date" className="input" defaultValue={t} required /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="label">Start</label><input type="time" name="start" className="input" defaultValue="07:00" /></div>
            <div><label className="label">End</label><input type="time" name="end" className="input" defaultValue="15:30" /></div>
          </div>
          <div><label className="label">Cost code</label><select name="costCodeId" className="input"><option value="">None</option>{costCodes.map((c) => <option key={c.id} value={c.id}>{c.code} · {c.name}</option>)}</select></div>
          <div className="md:col-span-2"><label className="label">Notes for the worker</label><input name="notes" className="input" placeholder="e.g. Bring harness, meet at north gate" /></div>
          <label className="flex items-end gap-2 pb-2 text-sm"><input type="checkbox" name="notify" defaultChecked /> Notify the worker</label>
          <button className="btn-primary md:col-span-4">Add shift</button>
        </ActionForm>
      </Section>
    </div>
  );
}
