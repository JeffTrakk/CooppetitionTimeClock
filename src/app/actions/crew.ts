"use server";

import { revalidatePath } from "next/cache";
import type { ActionState } from "@/components/action-form";
import { requireSession } from "@/lib/auth/session";
import { repo } from "@/lib/data";
import { can } from "@/lib/domain/permissions";
import { zonedTimeToUtc } from "@/lib/domain/time";
import type { GpsMode, OfflineMode, PunchType } from "@/lib/domain/types";
import { addCorrection, recordPunch, voidPunch } from "@/lib/services/punch-service";
import { canActOnJob } from "@/lib/services/scope";

const TYPES: PunchType[] = ["in", "out", "break_start", "break_end"];
const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

function finish(r: { ok: boolean; error?: string; warning?: string }, message: string): ActionState {
  revalidatePath("/", "layout");
  if (!r.ok) return { error: r.error };
  return { message: r.warning ? `${message} ${r.warning}` : message };
}

export async function punchFor(_: ActionState, fd: FormData): Promise<ActionState> {
  const { user, company } = await requireSession();
  const type = str(fd, "type") as PunchType;
  if (!TYPES.includes(type)) return { error: "Pick an action." };
  const r = await recordPunch({
    actor: user, company, userId: str(fd, "userId"), jobId: str(fd, "jobId"), type, source: "foreman",
    note: str(fd, "note") || `Punched by ${user.name}`, costCodeId: str(fd, "costCodeId") || null,
  });
  return finish(r, "Punch recorded.");
}

export async function addMissed(_: ActionState, fd: FormData): Promise<ActionState> {
  const { user, company } = await requireSession();
  const type = str(fd, "type") as PunchType;
  if (!TYPES.includes(type)) return { error: "Pick an action." };
  if (!str(fd, "date") || !str(fd, "time")) return { error: "Enter the date and time." };
  const r = await addCorrection({
    actor: user, company, userId: str(fd, "userId"), jobId: str(fd, "jobId"), type,
    occurredAt: zonedTimeToUtc(str(fd, "date"), str(fd, "time"), company.timezone), reason: str(fd, "reason"),
  });
  return finish(r, "Correction added and logged.");
}

export async function voidIt(_: ActionState, fd: FormData): Promise<ActionState> {
  const { user, company } = await requireSession();
  return finish(await voidPunch({ actor: user, company, punchId: str(fd, "punchId"), reason: str(fd, "reason") }), "Punch voided and logged.");
}

export async function updateSiteModes(_: ActionState, fd: FormData): Promise<ActionState> {
  const { user, company } = await requireSession();
  const job = await repo().getJob(str(fd, "jobId"));
  if (!job || !can(user.role, "site.modes") || !canActOnJob(user, job, "site.modes")) return { error: "You can only change your own sites." };
  const offlineMode = str(fd, "offlineMode") as OfflineMode;
  const gps = str(fd, "gpsMode");
  if (!["queue", "require_online"].includes(offlineMode)) return { error: "Pick an offline mode." };
  const gpsMode = gps === "inherit" ? null : (gps as GpsMode);
  const after = await repo().updateJob(job.id, { offlineMode, gpsMode });
  await repo().appendAudit({ companyId: company.id, actorId: user.id, action: "job.site_modes", entity: "job", entityId: job.id, reason: null, before: { offlineMode: job.offlineMode, gpsMode: job.gpsMode }, after: { offlineMode, gpsMode }, at: new Date().toISOString() });
  revalidatePath("/", "layout");
  return { message: `Saved for ${after.name}.` };
}
