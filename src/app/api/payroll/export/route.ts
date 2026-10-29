// POST /api/payroll/export (form fields: provider, start=YYYY-MM-DD) — runs
// an export for the pay period containing `start`. POST because it changes
// state: successful exports lock the timesheets. CSV returns a file download; the other
// providers return a JSON preview of what they would send (not connected).

import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { periodFor } from "@/lib/domain/pay-period";
import { can } from "@/lib/domain/permissions";
import { runPayrollExport } from "@/lib/services/payroll-service";

export async function POST(req: Request) {
  const session = await getSession();
  if (!session || !can(session.user.role, "payroll.export")) return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  const form = await req.formData().catch(() => null);
  const start = form?.get("start")?.toString() ?? null;
  const provider = form?.get("provider")?.toString() ?? "csv";
  if (!start || !/^\d{4}-\d{2}-\d{2}$/.test(start)) return NextResponse.json({ error: "start=YYYY-MM-DD is required." }, { status: 400 });

  const period = periodFor(session.company, start);
  const r = await runPayrollExport(session.company, session.user, provider, period);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 422 });
  if (r.result.status === "succeeded" && r.result.file) {
    return new NextResponse(r.result.file.body, {
      headers: { "content-type": r.result.file.contentType, "content-disposition": `attachment; filename="${r.result.file.filename}"` },
    });
  }
  return NextResponse.json(r.result);
}
