import { notFound } from "next/navigation";
import { editJob, rotateQr } from "@/app/actions/admin";
import { launchKiosk } from "@/app/actions/auth";
import { ActionForm } from "@/components/action-form";
import { SiteModesForm } from "@/components/site-modes-form";
import { SiteQr } from "@/components/site-qr";
import { PageHeader, Section } from "@/components/ui";
import { requireCap } from "@/lib/auth/session";
import { repo } from "@/lib/data";
import { LABOUR_RULE_PRESETS } from "@/lib/domain/labour-rules";

export default async function JobDetail({ params }: { params: Promise<{ id: string }> }) {
  const { company } = await requireCap("jobs.manage");
  const job = await repo().getJob((await params).id);
  if (!job || job.companyId !== company.id) notFound();
  const users = await repo().listUsers(company.id);
  const foremen = users.filter((u) => u.role === "foreman" || u.role === "owner_admin");

  return (
    <div>
      <PageHeader title={job.name} subtitle={`${job.code} · ${job.address}`} />
      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        <div>
          <Section title="Job details">
            <ActionForm action={editJob} className="card grid gap-3 sm:grid-cols-2">
              <input type="hidden" name="jobId" value={job.id} />
              <div className="sm:col-span-2"><label className="label">Name</label><input name="name" className="input" defaultValue={job.name} /></div>
              <div><label className="label">Job code</label><input name="code" className="input" defaultValue={job.code} /></div>
              <div><label className="label">Status</label>
                <select name="status" className="input" defaultValue={job.status}><option value="active">Active</option><option value="on_hold">On hold</option><option value="complete">Complete</option></select>
              </div>
              <div className="sm:col-span-2"><label className="label">Site address</label><input name="address" className="input" defaultValue={job.address} /></div>
              <div><label className="label">Latitude</label><input name="lat" className="input" defaultValue={job.lat} /></div>
              <div><label className="label">Longitude</label><input name="lng" className="input" defaultValue={job.lng} /></div>
              <div><label className="label">Geofence radius (m)</label><input name="geofenceRadiusM" type="number" className="input" defaultValue={job.geofenceRadiusM} /></div>
              <div><label className="label">Phone punch outside geofence</label>
                <select name="geofenceEnforcement" className="input" defaultValue={job.geofenceEnforcement}>
                  <option value="flag">Allow, but flag for review</option>
                  <option value="block">Block the punch</option>
                </select>
              </div>
              <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" name="requireQr" defaultChecked={job.requireQr} /> Require a QR scan at the site to clock in by phone (kiosk punches always count as on site)</label>
              <div className="sm:col-span-2"><label className="label">Labour rules for this job</label>
                <select name="labourRuleOverride" className="input" defaultValue={job.labourRuleOverride ?? ""}>
                  <option value="">Company default ({LABOUR_RULE_PRESETS[company.labourRuleSet]?.name})</option>
                  {Object.values(LABOUR_RULE_PRESETS).map((r) => <option key={r.code} value={r.code}>{r.name}</option>)}
                </select>
                <p className="mt-1 text-xs text-stone-500">Use when a crew works in another province. Applies to a worker&apos;s pay period when all their hours in it are on jobs with this override.</p>
              </div>
              <div className="sm:col-span-2"><label className="label">Foremen</label>
                <div className="flex flex-wrap gap-3">{foremen.map((f) => <label key={f.id} className="flex items-center gap-1 text-sm"><input type="checkbox" name="foremanIds" value={f.id} defaultChecked={job.foremanIds.includes(f.id)} /> {f.name}</label>)}</div>
              </div>
              <button className="btn-primary sm:col-span-2">Save job</button>
            </ActionForm>
          </Section>
          <Section title="Offline & location">
            <div className="card"><SiteModesForm job={job} company={company} /></div>
          </Section>
        </div>

        <div className="space-y-4">
          <div className="card text-center">
            <h3 className="mb-2 font-bold">Site QR code</h3>
            <SiteQr job={job} size={200} />
            <p className="mt-2 text-xs text-stone-500">Print and post it at the gate or trailer.</p>
            <form action={rotateQr} className="mt-2">
              <input type="hidden" name="jobId" value={job.id} />
              <button className="text-xs font-semibold text-red-700">Replace code (old prints stop working)</button>
            </form>
          </div>
          <div className="card text-center">
            <h3 className="mb-2 font-bold">Site kiosk</h3>
            <form action={launchKiosk}>
              <input type="hidden" name="jobId" value={job.id} />
              <button className="btn-accent w-full">Use this device as kiosk</button>
            </form>
            <p className="mt-2 text-xs text-stone-500">Signs you out on this device and shows the PIN pad for this site.</p>
          </div>
          <a className="btn-ghost w-full" href={`https://maps.google.com/?q=${job.lat},${job.lng}`} target="_blank" rel="noreferrer">Check location on map</a>
        </div>
      </div>
    </div>
  );
}
