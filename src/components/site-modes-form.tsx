import { updateSiteModes } from "@/app/actions/crew";
import type { Company, Job } from "@/lib/domain/types";
import { ActionForm } from "./action-form";

export function SiteModesForm({ job, company }: { job: Job; company: Company }) {
  return (
    <ActionForm action={updateSiteModes} className="space-y-3">
      <input type="hidden" name="jobId" value={job.id} />
      <fieldset>
        <legend className="label">When there&apos;s no signal</legend>
        <label className="flex items-start gap-2 text-sm">
          <input type="radio" name="offlineMode" value="queue" defaultChecked={job.offlineMode === "queue"} className="mt-1" />
          <span><strong>Save and sync later.</strong> Punches are stored on the phone or kiosk with the real time and location, then sent when signal returns. Best for basements, rural sites and dead zones.</span>
        </label>
        <label className="mt-1 flex items-start gap-2 text-sm">
          <input type="radio" name="offlineMode" value="require_online" defaultChecked={job.offlineMode === "require_online"} className="mt-1" />
          <span><strong>Require a connection.</strong> No punch without signal. Stricter, for sites with reliable coverage.</span>
        </label>
      </fieldset>
      <div>
        <label className="label" htmlFor={`gps-${job.id}`}>Location tracking</label>
        <select id={`gps-${job.id}`} name="gpsMode" className="input" defaultValue={job.gpsMode ?? "inherit"}>
          <option value="inherit">Company default ({company.gpsModeDefault === "continuous" ? "continuous" : "at punches only"})</option>
          <option value="punch_only">Only when clocking in, out or on break</option>
          <option value="continuous">Continuous while clocked in (app open)</option>
        </select>
      </div>
      <button className="btn-primary">Save site settings</button>
    </ActionForm>
  );
}
