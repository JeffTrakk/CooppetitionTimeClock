// POST /api/punches — the one endpoint every clock action goes through:
// phone punches, kiosk punches and offline-queue sync. JSON in, JSON out, so
// a future native app can use it unchanged.

import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession, kioskJobId } from "@/lib/auth/session";
import { repo } from "@/lib/data";
import { recordPunch } from "@/lib/services/punch-service";

const Body = z.object({
  source: z.enum(["phone", "kiosk"]),
  jobId: z.string(),
  type: z.enum(["in", "out", "break_start", "break_end"]),
  gps: z.object({ lat: z.number(), lng: z.number(), accuracyM: z.number() }).nullable().optional(),
  qrVerified: z.boolean().optional(),
  costCodeId: z.string().nullable().optional(),
  occurredAt: z.string().optional(),
  offline: z.boolean().optional(),
  clientId: z.string().max(64).optional(),
  locationConsent: z.boolean().optional(),
  pin: z.string().regex(/^\d{4,6}$/).optional(),
});

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const b = parsed.data;

  if (b.source === "kiosk") {
    const kJob = await kioskJobId();
    const job = kJob ? await repo().getJob(kJob) : null;
    if (!job || !b.pin) return NextResponse.json({ error: "Kiosk is not set up." }, { status: 401 });
    const company = await repo().getCompany(job.companyId);
    const user = company && (await repo().findUserByPin(company.id, b.pin));
    if (!company || !user) return NextResponse.json({ error: "PIN not recognised." }, { status: 401 });
    const result = await recordPunch({ ...b, actor: user, company, userId: user.id, kioskJobId: kJob, source: "kiosk" });
    return result.ok ? NextResponse.json({ ...result, name: user.name }) : NextResponse.json({ error: result.error }, { status: 422 });
  }

  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Signed out. Sign in again to sync." }, { status: 401 });
  const result = await recordPunch({ ...b, actor: session.user, company: session.company, userId: session.user.id, source: "phone" });
  return result.ok ? NextResponse.json(result) : NextResponse.json({ error: result.error }, { status: 422 });
}
