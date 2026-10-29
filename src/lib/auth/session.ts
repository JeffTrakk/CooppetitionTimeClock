import "server-only";
// Demo sessions: a cookie holding the signed-in user's id, chosen on /login.
//
// PRODUCTION (Supabase Auth — not connected): replace getSession() with
// `supabase.auth.getUser()` from an @supabase/ssr server client, then load
// the membership row (company + role) for that auth user. Employees sign in
// with a phone number (SMS one-time code) or email magic link; kiosks use a
// device token + employee PIN (see kioskJobId below). The rest of the app
// only calls getSession()/requireCap(), so nothing else changes.

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { repo } from "../data";
import { can, type Capability } from "../domain/permissions";
import type { Company, User } from "../domain/types";

export const SESSION_COOKIE = "tc_uid";
export const KIOSK_COOKIE = "tc_kiosk";

export interface Session {
  user: User;
  company: Company;
}

export async function getSession(): Promise<Session | null> {
  const uid = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!uid) return null;
  const user = await repo().getUser(uid);
  if (!user || !user.active) return null;
  const company = await repo().getCompany(user.companyId);
  if (!company) return null;
  return { user, company };
}

export async function requireSession(): Promise<Session> {
  const s = await getSession();
  if (!s) redirect("/login");
  return s;
}

export async function requireCap(cap: Capability): Promise<Session> {
  const s = await requireSession();
  if (!can(s.user.role, cap)) redirect("/");
  return s;
}

/** The job a kiosk device is locked to. In production: a signed device token stored in a `devices` table. */
export async function kioskJobId(): Promise<string | null> {
  return (await cookies()).get(KIOSK_COOKIE)?.value ?? null;
}

/** Where each role lands after sign-in. */
export function homeFor(user: User): string {
  if (user.role === "owner_admin" || user.role === "office_payroll") return "/admin";
  if (user.role === "foreman") return "/crew";
  return "/me";
}
