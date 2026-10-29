// POST /api/location — breadcrumbs for jobs in "continuous" GPS mode. Only
// accepted while the worker is clocked in on that job.

import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { recordLocationPing } from "@/lib/services/punch-service";

const Body = z.object({ jobId: z.string(), gps: z.object({ lat: z.number(), lng: z.number(), accuracyM: z.number() }) });

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Signed out." }, { status: 401 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const r = await recordLocationPing({ actor: session.user, company: session.company, ...parsed.data });
  return r.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: r.error }, { status: 422 });
}
