import type { HoursReport } from "@/lib/domain/hours";
import { formatDate, formatMinutes, formatTime } from "@/lib/domain/time";
import type { Job, TimesheetStatus } from "@/lib/domain/types";
import { Badge, type Tone } from "./ui";

export const STATUS_TONE: Record<TimesheetStatus, Tone> = { open: "neutral", submitted: "blue", foreman_approved: "amber", approved: "green", exported: "brand" };
export const STATUS_LABEL: Record<TimesheetStatus, string> = { open: "Open", submitted: "Submitted", foreman_approved: "Foreman approved", approved: "Approved", exported: "Sent to payroll" };

export function StatusBadge({ status }: { status: TimesheetStatus }) {
  return <Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge>;
}

const FLAG_LABEL: Record<string, string> = { outside_geofence: "off site", offline_punch: "offline", missing_out: "missing clock-out", open: "still on", missing_in: "missing in", break_short: "short break" };

export function HoursTable({ report, jobs, timezone, detailed = true }: { report: HoursReport; jobs: Job[]; timezone: string; detailed?: boolean }) {
  if (report.segments.length === 0) return <p className="text-sm text-stone-500">No time recorded in this period.</p>;
  return (
    <div className="card overflow-x-auto p-0">
      <table className="data-table">
        <thead>
          <tr>
            <th>Day</th>
            {detailed && <th>Job · time</th>}
            <th className="text-right">Worked</th>
            <th className="text-right">Reg</th>
            <th className="text-right">OT</th>
            <th className="text-right">2x</th>
          </tr>
        </thead>
        <tbody>
          {report.days.map((d) => {
            const segs = report.segments.filter((s) => s.date === d.date);
            return (
              <tr key={d.date}>
                <td className="whitespace-nowrap font-medium">
                  {formatDate(d.date)}
                  {!d.breakCompliant && <div><Badge tone="red">{d.breakMinutes > 0 ? "short break" : "break missed"}</Badge></div>}
                </td>
                {detailed && (
                  <td className="space-y-1">
                    {segs.map((s, i) => (
                      <div key={i} className="text-xs">
                        <span className="font-semibold">{jobs.find((j) => j.id === s.jobId)?.name ?? "Job"}</span>{" "}
                        <span className="tabular-nums text-stone-600">{formatTime(s.start, timezone)}–{s.open ? "now" : formatTime(s.end, timezone)}</span>
                        {s.breakMinutes > 0 && <span className="text-stone-500"> · {formatMinutes(s.breakMinutes)} break</span>}
                        {s.flags.map((f) => <span key={f} className="ml-1"><Badge tone={f === "open" ? "green" : f === "offline_punch" ? "blue" : "amber"}>{FLAG_LABEL[f] ?? f}</Badge></span>)}
                      </div>
                    ))}
                  </td>
                )}
                <td className="text-right tabular-nums">{formatMinutes(d.workedMinutes)}</td>
                <td className="text-right tabular-nums">{formatMinutes(d.regularMinutes)}</td>
                <td className="text-right tabular-nums">{d.overtimeMinutes ? formatMinutes(d.overtimeMinutes) : "–"}</td>
                <td className="text-right tabular-nums">{d.doubleMinutes ? formatMinutes(d.doubleMinutes) : "–"}</td>
              </tr>
            );
          })}
          <tr className="bg-stone-50 font-bold">
            <td>Total</td>
            {detailed && <td />}
            <td className="text-right tabular-nums">{formatMinutes(report.totals.workedMinutes)}</td>
            <td className="text-right tabular-nums">{formatMinutes(report.totals.regularMinutes)}</td>
            <td className="text-right tabular-nums">{formatMinutes(report.totals.overtimeMinutes)}</td>
            <td className="text-right tabular-nums">{formatMinutes(report.totals.doubleMinutes)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
