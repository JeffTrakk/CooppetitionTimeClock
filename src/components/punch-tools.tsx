// Foreman/admin tools: punch a worker in or out, add a missed punch, and
// void a wrong one. Every action needs a reason and goes to the audit log.

import { addMissed, punchFor, voidIt } from "@/app/actions/crew";
import { formatDateTime } from "@/lib/domain/time";
import type { CostCode, Job, Punch, User } from "@/lib/domain/types";
import { ActionForm } from "./action-form";
import { Badge } from "./ui";

const TYPE_LABEL = { in: "Clock in", out: "Clock out", break_start: "Start break", break_end: "End break" } as const;

export function PunchTools({ users, jobs, costCodes, recent, timezone, today }: { users: User[]; jobs: Job[]; costCodes: CostCode[]; recent: Punch[]; timezone: string; today: string }) {
  const userOpts = users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>);
  const jobOpts = jobs.map((j) => <option key={j.id} value={j.id}>{j.name}</option>);
  const typeOpts = Object.entries(TYPE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="card">
        <h3 className="font-bold">Punch for a crew member</h3>
        <p className="mb-3 text-xs text-stone-500">For workers without a phone, or a dead battery. Recorded now, marked as entered by you.</p>
        <ActionForm action={punchFor} className="grid gap-2 sm:grid-cols-2">
          <select name="userId" className="input" required>{userOpts}</select>
          <select name="jobId" className="input" required>{jobOpts}</select>
          <select name="type" className="input">{typeOpts}</select>
          <select name="costCodeId" className="input"><option value="">Cost code (optional)</option>{costCodes.map((c) => <option key={c.id} value={c.id}>{c.code} · {c.name}</option>)}</select>
          <input name="note" className="input sm:col-span-2" placeholder="Note (optional), e.g. phone died" />
          <button className="btn-primary sm:col-span-2">Record punch</button>
        </ActionForm>
      </div>

      <div className="card">
        <h3 className="font-bold">Add a missed punch</h3>
        <p className="mb-3 text-xs text-stone-500">Forgot to clock out? Add it with the real time. If the timesheet was already approved, it goes back for review.</p>
        <ActionForm action={addMissed} className="grid gap-2 sm:grid-cols-2">
          <select name="userId" className="input" required>{userOpts}</select>
          <select name="jobId" className="input" required>{jobOpts}</select>
          <select name="type" className="input" defaultValue="out">{typeOpts}</select>
          <div className="grid grid-cols-2 gap-2">
            <input type="date" name="date" className="input" defaultValue={today} max={today} required />
            <input type="time" name="time" className="input" required />
          </div>
          <input name="reason" className="input sm:col-span-2" placeholder="Reason (required)" required />
          <button className="btn-primary sm:col-span-2">Add correction</button>
        </ActionForm>
      </div>

      <div className="card lg:col-span-2">
        <h3 className="mb-2 font-bold">Recent punches</h3>
        <div className="max-h-96 overflow-y-auto">
          <table className="data-table">
            <tbody>
              {recent.slice(0, 60).map((p) => (
                <tr key={p.id} className={p.voided ? "opacity-50" : ""}>
                  <td className="whitespace-nowrap text-xs tabular-nums">{formatDateTime(p.occurredAt, timezone)}</td>
                  <td className="text-sm">{users.find((u) => u.id === p.userId)?.name}</td>
                  <td className="text-sm">{TYPE_LABEL[p.type]} · {jobs.find((j) => j.id === p.jobId)?.name}</td>
                  <td className="space-x-1">
                    {p.voided && <Badge tone="red">voided</Badge>}
                    {p.withinGeofence === false && <Badge tone="amber">{p.distanceM} m off site</Badge>}
                    {p.offline && <Badge tone="blue">offline</Badge>}
                    {p.source !== "phone" && <Badge>{p.source.replace("_", " ")}</Badge>}
                    {p.note && <span className="text-xs text-stone-500">{p.note}</span>}
                  </td>
                  <td>
                    {!p.voided && (
                      <ActionForm action={voidIt} className="flex gap-1">
                        <input type="hidden" name="punchId" value={p.id} />
                        <input name="reason" className="input w-32 py-1 text-xs" placeholder="Reason" required />
                        <button className="btn-ghost px-2 py-1 text-xs">Void</button>
                      </ActionForm>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
