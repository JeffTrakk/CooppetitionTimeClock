import { saveCompany } from "@/app/actions/admin";
import { ActionForm } from "@/components/action-form";
import { PageHeader, Section } from "@/components/ui";
import { requireCap } from "@/lib/auth/session";
import { LABOUR_RULE_PRESETS } from "@/lib/domain/labour-rules";
import { formatMinutes } from "@/lib/domain/time";

const TIMEZONES = ["America/St_Johns", "America/Halifax", "America/Moncton", "America/Toronto", "America/Winnipeg", "America/Regina", "America/Edmonton", "America/Vancouver", "America/Whitehorse", "America/Yellowknife", "America/Iqaluit", "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles"];
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default async function Settings() {
  const { company } = await requireCap("settings.manage");
  const b = company.branding;
  const presets = Object.values(LABOUR_RULE_PRESETS);

  return (
    <div>
      <PageHeader title="Company & branding" subtitle="White-label settings. Your crews see your name, logo and colours everywhere, including the kiosk." />
      <ActionForm action={saveCompany} className="space-y-6">
        <Section title="Branding">
          <div className="card grid gap-3 md:grid-cols-2">
            <div><label className="label">Company name</label><input name="name" className="input" defaultValue={company.name} /></div>
            <div><label className="label">App name shown to crews</label><input name="appName" className="input" defaultValue={b.appName} /></div>
            <div className="md:col-span-2">
              <label className="label">Logo URL (https)</label>
              <input name="logoUrl" className="input" defaultValue={b.logoUrl ?? ""} placeholder="https://…/logo.png" />
              <p className="mt-1 text-xs text-stone-500">Once storage is connected, this becomes an upload to the private <code>branding</code> bucket in Supabase Storage.</p>
            </div>
            <div className="flex items-end gap-2"><div className="flex-1"><label className="label">Primary colour</label><input name="primaryColor" className="input font-mono" defaultValue={b.primaryColor} /></div><input type="color" defaultValue={b.primaryColor} className="h-10 w-12 rounded" aria-label="Primary preview" disabled /></div>
            <div className="flex items-end gap-2"><div className="flex-1"><label className="label">Accent colour</label><input name="accentColor" className="input font-mono" defaultValue={b.accentColor} /></div><input type="color" defaultValue={b.accentColor} className="h-10 w-12 rounded" aria-label="Accent preview" disabled /></div>
          </div>
        </Section>

        <Section title="Time rules">
          <div className="card grid gap-3 md:grid-cols-2">
            <div><label className="label">Timezone</label><select name="timezone" className="input" defaultValue={company.timezone}>{TIMEZONES.map((t) => <option key={t}>{t}</option>)}</select></div>
            <div>
              <label className="label">Labour rules (overtime & breaks)</label>
              <select name="labourRuleSet" className="input" defaultValue={company.labourRuleSet}>
                <optgroup label="Canada">{presets.filter((p) => p.country === "CA").map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}</optgroup>
                <optgroup label="United States">{presets.filter((p) => p.country === "US").map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}</optgroup>
              </select>
            </div>
            <div><label className="label">Week starts on</label><select name="weekStartsOn" className="input" defaultValue={company.weekStartsOn}>{DAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}</select></div>
            <div className="grid grid-cols-2 gap-2">
              <div><label className="label">Pay period</label><select name="payPeriodType" className="input" defaultValue={company.payPeriod.type}><option value="weekly">Weekly</option><option value="biweekly">Every two weeks</option></select></div>
              <div><label className="label">A period start date</label><input type="date" name="anchorDate" className="input" defaultValue={company.payPeriod.anchorDate} /></div>
            </div>
            <div className="md:col-span-2">
              <label className="label">Default location tracking</label>
              <select name="gpsModeDefault" className="input" defaultValue={company.gpsModeDefault}>
                <option value="punch_only">Only when clocking in, out or on break (recommended)</option>
                <option value="continuous">Continuous while clocked in (app open)</option>
              </select>
              <p className="mt-1 text-xs text-stone-500">Each job can override this. Continuous tracking needs clear notice to employees. Check your province&apos;s privacy and electronic-monitoring rules (in Ontario, employers with 25+ staff need a written electronic monitoring policy).</p>
            </div>
          </div>
        </Section>
        <button className="btn-primary">Save settings</button>
      </ActionForm>

      <Section title="Rule set reference">
        <div className="card overflow-x-auto p-0">
          <table className="data-table">
            <thead><tr><th>Jurisdiction</th><th>Daily OT</th><th>Daily 2x</th><th>Weekly OT</th><th>Break</th><th>Notes</th></tr></thead>
            <tbody>
              {presets.map((p) => (
                <tr key={p.code} className={p.code === company.labourRuleSet ? "bg-brand/5" : ""}>
                  <td className="font-semibold">{p.name}</td>
                  <td>{p.dailyOtAfterMin ? `> ${formatMinutes(p.dailyOtAfterMin)}` : "–"}</td>
                  <td>{p.dailyDoubleAfterMin ? `> ${formatMinutes(p.dailyDoubleAfterMin)}` : "–"}</td>
                  <td>{p.weeklyOtAfterMin ? `> ${formatMinutes(p.weeklyOtAfterMin)}` : "–"}</td>
                  <td>{p.breakMinutes}m after {formatMinutes(p.breakAfterMin)}</td>
                  <td className="text-xs text-stone-500">{p.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-stone-500">These are starting defaults, not legal advice. Confirm with your payroll provider, especially for unionized or sector-specific construction work.</p>
      </Section>
    </div>
  );
}
