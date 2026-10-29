// Landing page for the QR code posted at a site. Scanning it with the phone
// camera opens this page; clocking in from here counts as QR-verified.

import { redirect } from "next/navigation";
import type { CSSProperties } from "react";
import { ClockWidget } from "@/components/clock-widget";
import { OfflineSync } from "@/components/offline-sync";
import { getSession } from "@/lib/auth/session";
import { repo } from "@/lib/data";
import { clockViewFor } from "@/lib/services/clock-view";

export default async function QrPunch({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const job = await repo().findJobByQrToken(token);
  if (!job) return <main className="p-8 text-center">This QR code isn&apos;t linked to an active site.</main>;
  const session = await getSession();
  if (!session) redirect(`/login?next=/punch/qr/${token}`);
  if (session.company.id !== job.companyId) return <main className="p-8 text-center">This site belongs to a different company.</main>;

  const view = await clockViewFor(session.company, session.user);
  const scheduled = view.jobs.some((j) => j.id === job.id);
  const style = { "--brand": session.company.branding.primaryColor, "--accent": session.company.branding.accentColor } as CSSProperties;

  return (
    <main style={style} className="mx-auto max-w-md px-4 py-6">
      <OfflineSync />
      <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Site check-in · QR verified</p>
      <h1 className="mb-1 text-2xl font-bold">{job.name}</h1>
      <p className="mb-4 text-sm text-stone-500">{job.address}</p>
      {scheduled || view.state.status !== "out" ? (
        <ClockWidget jobs={view.jobs} costCodes={view.costCodes} initial={view.state} consentNeeded={!session.user.locationConsentAt} qrJobId={job.id} />
      ) : (
        <div className="card text-sm">You&apos;re not scheduled on this job today. Ask your foreman to add you, or have them punch you in.</div>
      )}
      <a href="/me" className="mt-4 block text-center text-sm font-semibold text-brand">Go to my app →</a>
    </main>
  );
}
