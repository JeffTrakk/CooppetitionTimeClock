"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSession, homeFor, KIOSK_COOKIE, SESSION_COOKIE } from "@/lib/auth/session";
import { repo } from "@/lib/data";
import { can } from "@/lib/domain/permissions";
import { canActOnJob } from "@/lib/services/scope";

const cookieOpts = { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/" };

/** DEMO sign-in: pick a seeded user. Replaced by Supabase Auth (phone OTP / magic link). */
export async function demoSignIn(data: FormData) {
  const uid = String(data.get("userId") ?? "");
  const user = await repo().getUser(uid);
  if (!user) redirect("/login");
  (await cookies()).set(SESSION_COOKIE, user.id, { ...cookieOpts, maxAge: 60 * 60 * 24 * 30 });
  const next = String(data.get("next") ?? "");
  // Only same-site relative paths, so ?next= can't bounce people elsewhere.
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : homeFor(user));
}

export async function signOut() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}

/** Locks this browser to a site's kiosk. Only a foreman/admin on that job can do it. */
export async function launchKiosk(data: FormData) {
  const s = await getSession();
  const job = await repo().getJob(String(data.get("jobId") ?? ""));
  if (!s || !job || !can(s.user.role, "crew.punch") || !canActOnJob(s.user, job, "crew.punch")) redirect("/");
  const jar = await cookies();
  jar.set(KIOSK_COOKIE, job.id, { ...cookieOpts, maxAge: 60 * 60 * 24 * 365 });
  // A kiosk is a shared device: sign the supervisor out of it.
  jar.delete(SESSION_COOKIE);
  redirect("/kiosk");
}

export async function exitKiosk(data: FormData) {
  const jar = await cookies();
  const jobId = jar.get(KIOSK_COOKIE)?.value;
  const job = jobId ? await repo().getJob(jobId) : null;
  const pin = String(data.get("pin") ?? "");
  const user = job ? await repo().findUserByPin(job.companyId, pin) : null;
  if (!user || !job || !canActOnJob(user, job, "crew.punch")) redirect("/kiosk?exit=denied");
  jar.delete(KIOSK_COOKIE);
  redirect("/login");
}
