import { Empty, PageHeader } from "@/components/ui";
import { requireCap } from "@/lib/auth/session";
import { repo } from "@/lib/data";
import { addDays, formatDate, formatTime, localDate } from "@/lib/domain/time";
import { today, utcBounds } from "@/lib/services/scope";

export default async function MySchedule() {
  const { user, company } = await requireCap("clock.self");
  const t = today(company);
  const [shifts, jobs, costCodes] = await Promise.all([
    repo().listShifts(company.id, { ...utcBounds(company, t, addDays(t, 13)), userId: user.id }),
    repo().listJobs(company.id),
    repo().listCostCodes(company.id),
  ]);
  const byDay = new Map<string, typeof shifts>();
  for (const s of shifts) {
    const d = localDate(s.start, company.timezone);
    byDay.set(d, [...(byDay.get(d) ?? []), s]);
  }

  return (
    <div className="mx-auto max-w-md">
      <PageHeader title="My schedule" subtitle="Next two weeks" />
      {shifts.length === 0 && <Empty>No upcoming shifts.</Empty>}
      <div className="space-y-4">
        {[...byDay.entries()].map(([date, list]) => (
          <div key={date}>
            <div className="mb-1 text-sm font-bold">{date === t ? "Today" : formatDate(date, { weekday: "long", month: "short", day: "numeric" })}</div>
            {list.map((s) => {
              const job = jobs.find((j) => j.id === s.jobId);
              const cc = costCodes.find((c) => c.id === s.costCodeId);
              return (
                <div key={s.id} className="card mb-2 py-3">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">{job?.name}</span>
                    <span className="text-sm tabular-nums">{formatTime(s.start, company.timezone)}–{formatTime(s.end, company.timezone)}</span>
                  </div>
                  <div className="text-xs text-stone-500">{job?.address}{cc ? ` · ${cc.code} ${cc.name}` : ""}</div>
                  {s.notes && <div className="mt-1 text-sm">{s.notes}</div>}
                  {job && (
                    <a className="mt-2 inline-block text-xs font-semibold text-brand" href={`https://maps.google.com/?q=${encodeURIComponent(job.address)}`} target="_blank" rel="noreferrer">Directions →</a>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
