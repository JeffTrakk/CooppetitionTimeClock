import { markRead } from "@/app/actions/messages";
import { Badge, Empty, PageHeader } from "@/components/ui";
import { requireSession } from "@/lib/auth/session";
import { repo } from "@/lib/data";
import { formatDateTime } from "@/lib/domain/time";

export default async function MyMessages() {
  const { user, company } = await requireSession();
  const [inbox, users, jobs] = await Promise.all([repo().listMessagesForUser(company.id, user.id), repo().listUsers(company.id), repo().listJobs(company.id)]);

  return (
    <div className="mx-auto max-w-md">
      <PageHeader title="Messages" />
      {inbox.length === 0 && <Empty>No messages yet.</Empty>}
      <ul className="space-y-2">
        {inbox.map((m) => {
          const from = users.find((u) => u.id === m.senderId);
          const to = m.audience.type === "company" ? "Everyone" : m.audience.type === "job" ? jobs.find((j) => j.id === (m.audience as { jobId: string }).jobId)?.name : "You";
          return (
            <li key={m.id} className={`card ${m.delivery.readAt ? "" : "border-brand/40"}`}>
              <div className="flex items-center justify-between gap-2 text-xs text-stone-500">
                <span>{from?.name ?? "System"} → {to}</span>
                <span>{formatDateTime(m.createdAt, company.timezone)}</span>
              </div>
              {m.subject && <div className="mt-1 font-semibold">{m.subject}</div>}
              <p className="mt-1 whitespace-pre-line text-sm">{m.body}</p>
              {!m.delivery.readAt ? (
                <form action={markRead} className="mt-2">
                  <input type="hidden" name="messageId" value={m.id} />
                  <button className="text-xs font-semibold text-brand">Mark as read</button>
                </form>
              ) : (
                <div className="mt-2"><Badge>Read</Badge></div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
