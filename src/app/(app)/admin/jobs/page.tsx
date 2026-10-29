import Link from "next/link";
import { addCostCode, addJob } from "@/app/actions/admin";
import { ActionForm } from "@/components/action-form";
import { Badge, PageHeader, Section, TableWrap } from "@/components/ui";
import { requireCap } from "@/lib/auth/session";
import { repo } from "@/lib/data";

export default async function Jobs() {
  const { company } = await requireCap("jobs.manage");
  const [jobs, users, costCodes] = await Promise.all([repo().listJobs(company.id), repo().listUsers(company.id), repo().listCostCodes(company.id)]);
  const foremen = users.filter((u) => u.role === "foreman" || u.role === "owner_admin");

  return (
    <div>
      <PageHeader title="Jobs & sites" subtitle="Each job has a site location, a geofence, a QR code and its own offline and GPS settings." />
      <Section title="Jobs">
        <TableWrap>
          <table className="data-table">
            <thead><tr><th>Job</th><th>Foreman</th><th>Geofence</th><th>Offline</th><th>GPS</th><th>Status</th></tr></thead>
            <tbody>
              {jobs.map((j) => (
                <tr key={j.id}>
                  <td><Link className="font-semibold text-brand" href={`/admin/jobs/${j.id}`}>{j.name}</Link><div className="text-xs text-stone-500">{j.code} · {j.address}</div></td>
                  <td className="text-sm">{j.foremanIds.map((id) => users.find((u) => u.id === id)?.name).join(", ") || "–"}</td>
                  <td className="text-sm">{j.geofenceRadiusM} m · {j.geofenceEnforcement}{j.requireQr ? " · QR" : ""}</td>
                  <td className="text-sm">{j.offlineMode === "queue" ? "Save & sync" : "Require signal"}</td>
                  <td className="text-sm">{j.gpsMode ?? `default (${company.gpsModeDefault})`}</td>
                  <td><Badge tone={j.status === "active" ? "green" : "neutral"}>{j.status.replace("_", " ")}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      </Section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="New job">
          <ActionForm action={addJob} className="card grid gap-2 sm:grid-cols-2">
            <div className="sm:col-span-2"><label className="label">Name</label><input name="name" className="input" required /></div>
            <div><label className="label">Job code</label><input name="code" className="input" placeholder="NB-2060" required /></div>
            <div><label className="label">Geofence radius (m)</label><input name="geofenceRadiusM" type="number" className="input" defaultValue={150} /></div>
            <div className="sm:col-span-2"><label className="label">Site address</label><input name="address" className="input" required /></div>
            <div><label className="label">Latitude</label><input name="lat" className="input" placeholder="43.6455" required /></div>
            <div><label className="label">Longitude</label><input name="lng" className="input" placeholder="-79.3950" required /></div>
            <p className="text-xs text-stone-500 sm:col-span-2">Tip: right-click the site in Google Maps to copy its coordinates. (Address lookup plugs in here once a geocoding service is connected.)</p>
            <div className="sm:col-span-2"><label className="label">Foremen</label>
              <div className="flex flex-wrap gap-3">{foremen.map((f) => <label key={f.id} className="flex items-center gap-1 text-sm"><input type="checkbox" name="foremanIds" value={f.id} /> {f.name}</label>)}</div>
            </div>
            <button className="btn-primary sm:col-span-2">Create job</button>
          </ActionForm>
        </Section>

        <Section title="Cost codes">
          <div className="card">
            <ul className="mb-3 grid grid-cols-1 gap-1 text-sm sm:grid-cols-2">
              {costCodes.map((c) => <li key={c.id}><span className="font-mono text-xs text-stone-500">{c.code}</span> {c.name}</li>)}
            </ul>
            <ActionForm action={addCostCode} className="flex gap-2">
              <input name="code" className="input w-28" placeholder="03-300" />
              <input name="name" className="input" placeholder="Concrete" />
              <button className="btn-ghost">Add</button>
            </ActionForm>
          </div>
        </Section>
      </div>
    </div>
  );
}
