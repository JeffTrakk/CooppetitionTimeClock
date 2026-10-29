import "server-only";
import { repo } from "../data";
import { can } from "../domain/permissions";
import { addDays } from "../domain/time";
import type { Audience, ChannelKey, Company, MessageDelivery, User } from "../domain/types";
import { getChannel } from "../integrations/messaging/channels";
import { canActOnJob, fail, type Result, today, utcBounds } from "./scope";

async function resolveAudience(company: Company, audience: Audience): Promise<User[]> {
  const users = (await repo().listUsers(company.id)).filter((u) => u.active);
  if (audience.type === "company") return users;
  if (audience.type === "user") return users.filter((u) => u.id === audience.userId);
  const job = await repo().getJob(audience.jobId);
  const t = today(company);
  const shifts = await repo().listShifts(company.id, { ...utcBounds(company, addDays(t, -7), addDays(t, 14)), jobId: audience.jobId });
  const ids = new Set([...shifts.map((s) => s.userId), ...(job?.foremanIds ?? [])]);
  return users.filter((u) => ids.has(u.id));
}

/**
 * Sends through every selected channel. In-app is stored immediately;
 * external channels return "not_connected" today. When connected, they'll
 * enqueue to the outbox table instead of sending inline, so a slow SMS API
 * never blocks the admin's request.
 */
export async function sendMessage(input: {
  company: Company;
  sender: User;
  audience: Audience;
  subject: string | null;
  body: string;
  channels: ChannelKey[];
  system?: boolean;
}): Promise<Result<{ recipients: number }>> {
  const { company, sender } = input;
  if (!input.system) {
    if (!can(sender.role, "messages.send")) return fail("Not allowed.");
    if (sender.role === "foreman" && input.audience.type === "company") return fail("Foremen can message their job crews or individuals.");
    if (sender.role === "foreman" && input.audience.type === "job") {
      const job = await repo().getJob(input.audience.jobId);
      if (!job || !canActOnJob(sender, job, "messages.send")) return fail("You can only message crews on your jobs.");
    }
  }
  if (!input.body.trim()) return fail("Message is empty.");
  const channels: ChannelKey[] = Array.from(new Set<ChannelKey>(["in_app", ...input.channels]));
  const recipients = await resolveAudience(company, input.audience);
  if (recipients.length === 0) return fail("No one matches that audience.");

  const deliveries: Omit<MessageDelivery, "messageId">[] = [];
  for (const user of recipients) {
    for (const key of channels) {
      const ch = getChannel(key);
      const status = ch.canReach(user)
        ? await ch.send(user, { subject: input.subject, body: input.body, companyName: company.name, appName: company.branding.appName })
        : "failed";
      deliveries.push({ userId: user.id, channel: key, status, readAt: null });
    }
  }
  await repo().createMessage(
    { companyId: company.id, senderId: sender.id, audience: input.audience, subject: input.subject, body: input.body, channels, createdAt: new Date().toISOString() },
    deliveries,
  );
  return { ok: true, recipients: recipients.length };
}
