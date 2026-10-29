// GET /api/cron/:job — scheduled background work, triggered by Vercel Cron
// (see vercel.json). NOT CONNECTED: each job is a documented no-op.
// Vercel sends `Authorization: Bearer $CRON_SECRET`; reject anything else.
//
//   clock-out-reminders  every 15 min — push/SMS anyone still clocked in 30 min after shift end
//   auto-close-shifts    nightly — flag (never silently close) punches left open > 16 h
//   notify-dispatch      every minute — drain the messaging outbox (SMS/email/push)
//   payroll-sync         nightly — push approved periods to connected payroll providers
//
// Heavy jobs can move to Supabase Edge Functions + pg_cron instead
// (supabase/functions/); the contract stays the same.

import { NextResponse } from "next/server";

const JOBS = ["clock-out-reminders", "auto-close-shifts", "notify-dispatch", "payroll-sync"];

export async function GET(req: Request, ctx: { params: Promise<{ job: string }> }) {
  const { job } = await ctx.params;
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (!JOBS.includes(job)) return NextResponse.json({ error: "Unknown job." }, { status: 404 });
  return NextResponse.json({ job, status: "not_connected", message: "Background job scaffolded; implementation pending integration hookup." });
}
