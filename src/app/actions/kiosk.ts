"use server";

import { kioskJobId } from "@/lib/auth/session";
import { repo } from "@/lib/data";
import { allowedNext, clockState } from "@/lib/domain/hours";
import { addDays } from "@/lib/domain/time";
import type { PunchType } from "@/lib/domain/types";
import { utcBounds, today } from "@/lib/services/scope";

export type KioskIdentity = { ok: true; name: string; status: "out" | "in" | "on_break"; allowed: PunchType[]; elsewhere: string | null } | { ok: false; error: string };

/** Looks up a PIN on this kiosk's company and returns what that worker can do next. */
export async function kioskIdentify(pin: string): Promise<KioskIdentity> {
  const jobId = await kioskJobId();
  const job = jobId ? await repo().getJob(jobId) : null;
  if (!job) return { ok: false, error: "Kiosk is not set up." };
  if (!/^\d{4,6}$/.test(pin)) return { ok: false, error: "Enter your 4-digit PIN." };
  const company = await repo().getCompany(job.companyId);
  const user = company && (await repo().findUserByPin(company.id, pin));
  if (!company || !user) return { ok: false, error: "PIN not recognised." };
  const t = today(company);
  const state = clockState(await repo().listPunches(company.id, { userId: user.id, from: utcBounds(company, addDays(t, -2), t).from }));
  const elsewhere = state.status !== "out" && state.jobId !== job.id ? (await repo().getJob(state.jobId))?.name ?? "another job" : null;
  return { ok: true, name: user.name, status: state.status, allowed: elsewhere ? [] : allowedNext(state), elsewhere };
}
