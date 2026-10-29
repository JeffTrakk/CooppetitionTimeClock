"use server";

import { revalidatePath } from "next/cache";
import type { ActionState } from "@/components/action-form";
import { requireSession } from "@/lib/auth/session";
import { repo } from "@/lib/data";
import type { Audience, ChannelKey } from "@/lib/domain/types";
import { sendMessage } from "@/lib/services/messaging-service";

export async function markRead(fd: FormData) {
  const { user } = await requireSession();
  await repo().markMessageRead(String(fd.get("messageId")), user.id);
  revalidatePath("/", "layout");
}

export async function send(_: ActionState, fd: FormData): Promise<ActionState> {
  const { user, company } = await requireSession();
  const raw = String(fd.get("audience") ?? "company");
  const [kind, id] = raw.split(":");
  const audience: Audience = kind === "job" ? { type: "job", jobId: id } : kind === "user" ? { type: "user", userId: id } : { type: "company" };
  const channels = fd.getAll("channels").map(String) as ChannelKey[];
  const r = await sendMessage({ company, sender: user, audience, subject: String(fd.get("subject") ?? "") || null, body: String(fd.get("body") ?? ""), channels });
  revalidatePath("/", "layout");
  if (!r.ok) return { error: r.error };
  const external = channels.filter((c) => c !== "in_app");
  return { message: `Sent to ${r.recipients} ${r.recipients === 1 ? "person" : "people"} in-app.${external.length ? ` ${external.join(", ")}: logged as not connected yet.` : ""}` };
}
