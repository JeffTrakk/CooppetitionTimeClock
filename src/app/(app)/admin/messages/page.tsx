import { send } from "@/app/actions/messages";
import { ActionForm } from "@/components/action-form";
import { Badge, PageHeader, Section } from "@/components/ui";
import { requireCap } from "@/lib/auth/session";
import { repo } from "@/lib/data";
import { formatDateTime } from "@/lib/domain/time";
import { MESSAGING_CHANNELS } from "@/lib/integrations/messaging/channels";
import { crewFor } from "@/lib/services/scope";

export default async function Messages() {
  const { user, company } = await requireCap("messages.send");
  const [{ users: crew, jobs }, allUsers, sent] = await Promise.all([crewFor(user, company), repo().listUsers(company.id), repo().listSentMessages(company.id)]);
  const people = user.role === "foreman" ? crew : allUsers.filter((u) => u.active);

  return (
    <div>
      <PageHeader title="Messages" subtitle="Announcements and direct messages. In-app always works; text, email and push go out once those services are connected." />
      <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        <Section title="New message">
          <ActionForm action={send} className="card space-y-3">
            <div>
              <label className="label">To</label>
              <select name="audience" className="input">
                {user.role !== "foreman" && <option value="company">Everyone at {company.name}</option>}
                <optgroup label="Job crew">{jobs.map((j) => <option key={j.id} value={`job:${j.id}`}>{j.name}</option>)}</optgroup>
                <optgroup label="One person">{people.map((u) => <option key={u.id} value={`user:${u.id}`}>{u.name}</option>)}</optgroup>
              </select>
            </div>
            <div><label className="label">Subject (optional)</label><input name="subject" className="input" /></div>
            <div><label className="label">Message</label><textarea name="body" rows={4} className="input" required placeholder="e.g. Rain day tomorrow. Site closed, no work." /></div>
            <fieldset>
              <legend className="label">Send by</legend>
              <div className="flex flex-wrap gap-4">
                {MESSAGING_CHANNELS.map((c) => (
                  <label key={c.key} className="flex items-center gap-1.5 text-sm">
                    <input type="checkbox" name="channels" value={c.key} defaultChecked={c.key === "in_app"} disabled={c.key === "in_app"} />
                    {c.name}
                    {!c.ready && <Badge tone="amber">not connected</Badge>}
                  </label>
                ))}
              </div>
            </fieldset>
            <button className="btn-primary">Send</button>
          </ActionForm>
        </Section>

        <Section title="Sent">
          <ul className="space-y-2">
            {sent.slice(0, 30).map((m) => {
              const sender = allUsers.find((u) => u.id === m.senderId);
              const inApp = m.deliveries.filter((d) => d.channel === "in_app");
              const read = inApp.filter((d) => d.readAt).length;
              const to = m.audience.type === "company" ? "Everyone" : m.audience.type === "job" ? jobs.find((j) => j.id === (m.audience as { jobId: string }).jobId)?.name ?? "Job crew" : allUsers.find((u) => u.id === (m.audience as { userId: string }).userId)?.name;
              return (
                <li key={m.id} className="card">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-stone-500">
                    <span>{sender?.name} → {to}</span>
                    <span>{formatDateTime(m.createdAt, company.timezone)}</span>
                  </div>
                  {m.subject && <div className="mt-1 font-semibold">{m.subject}</div>}
                  <p className="mt-1 line-clamp-3 text-sm">{m.body}</p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    <Badge tone="green">read {read}/{inApp.length}</Badge>
                    {m.channels.filter((c) => c !== "in_app").map((c) => <Badge key={c} tone="amber">{c}: not connected</Badge>)}
                  </div>
                </li>
              );
            })}
          </ul>
        </Section>
      </div>
    </div>
  );
}
