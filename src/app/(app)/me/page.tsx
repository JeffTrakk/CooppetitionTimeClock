import { ClockWidget } from "@/components/clock-widget";
import { Badge, PageHeader, Section } from "@/components/ui";
import { requireCap } from "@/lib/auth/session";
import { formatDate, formatTime, localDate } from "@/lib/domain/time";
import { clockViewFor } from "@/lib/services/clock-view";
import { describePunch } from "@/lib/services/punch-service";

export default async function MyClock() {
  const { user, company } = await requireCap("clock.self");
  const view = await clockViewFor(company, user);
  const tz = company.timezone;

  return (
    <div className="mx-auto max-w-md">
      <PageHeader title={`Hi ${user.name.split(" ")[0]}`} subtitle={formatDate(localDate(new Date(), tz), { weekday: "long", month: "long", day: "numeric" })} />
      <ClockWidget jobs={view.jobs} costCodes={view.costCodes} initial={view.state} consentNeeded={!user.locationConsentAt} />

      <Section title="Today's shifts">
        {view.shifts.length === 0 ? (
          <p className="text-sm text-stone-500">No shifts scheduled today.</p>
        ) : (
          <ul className="space-y-2">
            {view.shifts.map((s) => {
              const job = view.allJobs.find((j) => j.id === s.jobId);
              return (
                <li key={s.id} className="card py-3">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">{job?.name}</span>
                    <span className="text-sm tabular-nums">{formatTime(s.start, tz)}–{formatTime(s.end, tz)}</span>
                  </div>
                  <div className="text-xs text-stone-500">{job?.address}</div>
                  {s.notes && <div className="mt-1 text-sm">{s.notes}</div>}
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      <Section title="Today's punches">
        {view.todayPunches.length === 0 ? (
          <p className="text-sm text-stone-500">Nothing yet.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {view.todayPunches.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2">
                <span>{describePunch(p, view.allJobs.find((j) => j.id === p.jobId), tz)}</span>
                <span className="flex gap-1">
                  {p.withinGeofence === false && <Badge tone="amber">off site</Badge>}
                  {p.offline && <Badge tone="blue">offline</Badge>}
                  {p.qrVerified && <Badge tone="green">QR</Badge>}
                  {p.source !== "phone" && <Badge>{p.source.replace("_", " ")}</Badge>}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
