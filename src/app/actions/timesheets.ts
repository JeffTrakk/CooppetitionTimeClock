"use server";

import { revalidatePath } from "next/cache";
import type { ActionState } from "@/components/action-form";
import { requireSession } from "@/lib/auth/session";
import { periodFor } from "@/lib/domain/pay-period";
import { approveTimesheet, reopenTimesheet, submitTimesheet } from "@/lib/services/timesheet-service";

function done(r: { ok: boolean; error?: string }, message: string): ActionState {
  revalidatePath("/", "layout");
  return r.ok ? { message } : { error: (r as { error: string }).error };
}

export async function submitMine(_: ActionState, fd: FormData): Promise<ActionState> {
  const { user, company } = await requireSession();
  return done(await submitTimesheet(company, user, periodFor(company, String(fd.get("periodStart")))), "Submitted for approval.");
}

export async function approve(_: ActionState, fd: FormData): Promise<ActionState> {
  const { user, company } = await requireSession();
  return done(await approveTimesheet(company, user, String(fd.get("userId")), periodFor(company, String(fd.get("periodStart")))), "Approved.");
}

export async function reopen(_: ActionState, fd: FormData): Promise<ActionState> {
  const { user, company } = await requireSession();
  return done(
    await reopenTimesheet(company, user, String(fd.get("userId")), periodFor(company, String(fd.get("periodStart"))), String(fd.get("reason") ?? "")),
    "Sent back to the employee.",
  );
}
