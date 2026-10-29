import { formatMinutes, formatTime } from "@/lib/domain/time";
import type { CrewRow } from "@/lib/services/crew-status";
import { FLAG_TEXT } from "@/lib/services/crew-status";
import { ROLE_LABELS } from "@/lib/domain/types";
import { Badge, Empty } from "./ui";

export function CrewBoard({ rows, timezone }: { rows: CrewRow[]; timezone: string }) {
  if (rows.length === 0) return <Empty>No crew assigned.</Empty>;
  const order = { in: 0, on_break: 1, out: 2 } as const;
  const sorted = [...rows].sort((a, b) => order[a.state.status] - order[b.state.status] || a.user.name.localeCompare(b.user.name));
  return (
    <div className="card overflow-x-auto p-0">
      <table className="data-table">
        <thead>
          <tr><th>Worker</th><th>Status</th><th>Job</th><th className="text-right">Today</th><th>Flags</th></tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr key={r.user.id}>
              <td>
                <div className="font-semibold">{r.user.name}</div>
                <div className="text-xs text-stone-500">{ROLE_LABELS[r.user.role]}{!r.user.phone ? " · kiosk only" : ""}</div>
              </td>
              <td className="whitespace-nowrap">
                {r.state.status === "in" && <Badge tone="green">On site since {formatTime(r.state.since, timezone)}</Badge>}
                {r.state.status === "on_break" && <Badge tone="amber">Break since {formatTime(r.state.since, timezone)}</Badge>}
                {r.state.status === "out" && <Badge>Off the clock</Badge>}
              </td>
              <td className="text-sm">{r.job?.name ?? "–"}</td>
              <td className="text-right tabular-nums">{r.todayMinutes ? formatMinutes(r.todayMinutes) : "–"}</td>
              <td className="space-x-1">
                {r.flags.map((f) => <Badge key={f} tone={f === "offline_punch" ? "blue" : "red"}>{FLAG_TEXT[f] ?? f}</Badge>)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
