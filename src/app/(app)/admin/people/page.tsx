import { addPerson, editPerson } from "@/app/actions/admin";
import { ActionForm } from "@/components/action-form";
import { Badge, PageHeader, Section, TableWrap } from "@/components/ui";
import { requireCap } from "@/lib/auth/session";
import { repo } from "@/lib/data";
import { can } from "@/lib/domain/permissions";
import { ROLE_LABELS, type Role } from "@/lib/domain/types";

const ROLES = Object.entries(ROLE_LABELS) as [Role, string][];

export default async function People() {
  const { user, company } = await requireCap("people.view");
  const users = await repo().listUsers(company.id);
  const manage = can(user.role, "people.manage");

  return (
    <div>
      <PageHeader title="People" subtitle="Four roles: Employee, Foreman, Office/Payroll and Owner/Admin. Kiosk PINs are for crews who punch in on the site tablet." />
      <Section title="Team">
        <TableWrap>
          <table className="data-table">
            <thead><tr><th>Name</th><th>Role</th><th>Contact</th><th>Rate</th><th>Payroll ID</th><th>Location consent</th><th /></tr></thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className={u.active ? "" : "opacity-50"}>
                  <td className="font-semibold">{u.name}{!u.active && <div><Badge>inactive</Badge></div>}</td>
                  <td><Badge tone={u.role === "owner_admin" ? "brand" : u.role === "foreman" ? "amber" : u.role === "office_payroll" ? "blue" : "neutral"}>{ROLE_LABELS[u.role]}</Badge></td>
                  <td className="text-xs">{u.email}<br />{u.phone ?? <span className="text-stone-400">no phone (kiosk)</span>}</td>
                  <td className="tabular-nums">{u.hourlyRate ? `$${u.hourlyRate.toFixed(2)}` : "–"}</td>
                  <td className="font-mono text-xs">{u.payrollExternalId ?? "–"}</td>
                  <td className="text-xs">{u.locationConsentAt ? new Date(u.locationConsentAt).toLocaleDateString() : "Not yet"}</td>
                  <td>
                    {manage && (
                      <details>
                        <summary className="cursor-pointer text-xs font-semibold text-brand">Edit</summary>
                        <ActionForm action={editPerson} className="mt-2 grid w-64 gap-2">
                          <input type="hidden" name="userId" value={u.id} />
                          <select name="role" className="input" defaultValue={u.role}>{ROLES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
                          <input name="phone" className="input" defaultValue={u.phone ?? ""} placeholder="Mobile" />
                          <input name="hourlyRate" className="input" defaultValue={u.hourlyRate ?? ""} placeholder="Hourly rate" />
                          <input name="payrollExternalId" className="input" defaultValue={u.payrollExternalId ?? ""} placeholder="Payroll employee ID" />
                          <input name="kioskPin" className="input" inputMode="numeric" placeholder="New kiosk PIN (optional)" />
                          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="active" defaultChecked={u.active} /> Active</label>
                          <button className="btn-primary">Save</button>
                        </ActionForm>
                      </details>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      </Section>

      {manage && (
        <Section title="Add a person">
          <ActionForm action={addPerson} className="card grid gap-2 md:grid-cols-4">
            <input name="name" className="input" placeholder="Full name" required />
            <input name="email" type="email" className="input" placeholder="Email" required />
            <input name="phone" className="input" placeholder="Mobile (for text sign-in and SMS)" />
            <select name="role" className="input" defaultValue="employee">{ROLES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
            <input name="kioskPin" className="input" inputMode="numeric" placeholder="Kiosk PIN (4–6 digits)" required />
            <input name="hourlyRate" className="input" placeholder="Hourly rate" />
            <input name="payrollExternalId" className="input" placeholder="Payroll employee ID" />
            <button className="btn-primary">Add person</button>
          </ActionForm>
        </Section>
      )}
    </div>
  );
}
