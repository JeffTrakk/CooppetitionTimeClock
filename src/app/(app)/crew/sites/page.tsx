import { launchKiosk } from "@/app/actions/auth";
import { SiteModesForm } from "@/components/site-modes-form";
import { SiteQr } from "@/components/site-qr";
import { Badge, Empty, PageHeader } from "@/components/ui";
import { requireCap } from "@/lib/auth/session";
import { crewFor } from "@/lib/services/scope";

export default async function CrewSites() {
  const { user, company } = await requireCap("site.modes");
  const { jobs } = await crewFor(user, company);

  return (
    <div>
      <PageHeader title="Site settings" subtitle="Choose how each of your sites handles poor signal and location, print the site QR code, or turn this device into the site kiosk." />
      {jobs.length === 0 && <Empty>You don&apos;t lead any active jobs.</Empty>}
      <div className="space-y-4">
        {jobs.map((job) => (
          <div key={job.id} className="card grid gap-4 md:grid-cols-[1fr_auto]">
            <div>
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-bold">{job.name}</h2>
                <Badge>{job.code}</Badge>
                {job.requireQr && <Badge tone="blue">QR required</Badge>}
                <Badge tone={job.geofenceEnforcement === "block" ? "red" : "amber"}>Geofence {job.geofenceRadiusM} m · {job.geofenceEnforcement}</Badge>
              </div>
              <p className="mb-3 text-sm text-stone-500">{job.address}</p>
              <SiteModesForm job={job} company={company} />
            </div>
            <div className="space-y-3 text-center">
              <SiteQr job={job} />
              <form action={launchKiosk}>
                <input type="hidden" name="jobId" value={job.id} />
                <button className="btn-accent w-full">Use this device as kiosk</button>
              </form>
              <p className="max-w-[220px] text-[11px] text-stone-500">Signs you out and locks this browser to the {job.name} kiosk. Exit needs a foreman PIN.</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
