import type { CSSProperties } from "react";
import { exitKiosk } from "@/app/actions/auth";
import { KioskPad } from "@/components/kiosk-pad";
import { OfflineSync } from "@/components/offline-sync";
import { kioskJobId } from "@/lib/auth/session";
import { repo } from "@/lib/data";

export default async function Kiosk({ searchParams }: { searchParams: Promise<{ exit?: string }> }) {
  const jobId = await kioskJobId();
  const job = jobId ? await repo().getJob(jobId) : null;
  const company = job ? await repo().getCompany(job.companyId) : null;

  if (!job || !company) {
    return (
      <main className="mx-auto max-w-md p-8 text-center">
        <h1 className="text-2xl font-bold">Kiosk not set up</h1>
        <p className="mt-2 text-stone-600">A foreman or admin sets up a kiosk from <strong>Site settings → Use this device as kiosk</strong>.</p>
        <a className="btn-primary mt-4" href="/login">Sign in</a>
      </main>
    );
  }

  const style = { "--brand": company.branding.primaryColor, "--accent": company.branding.accentColor } as CSSProperties;
  const denied = (await searchParams).exit === "denied";
  return (
    <main style={style} className="min-h-screen bg-stone-100">
      <header className="flex items-center justify-between bg-brand px-6 py-4 text-white">
        <div>
          <div className="text-xl font-bold">{company.branding.appName}</div>
          <div className="text-sm opacity-90">Site kiosk · {job.name}</div>
        </div>
        <details className="text-right text-sm">
          <summary className="cursor-pointer opacity-80">Exit kiosk</summary>
          <form action={exitKiosk} className="mt-2 flex gap-2">
            <input name="pin" inputMode="numeric" className="input w-28 text-black" placeholder="Foreman PIN" />
            <button className="btn-accent">Exit</button>
          </form>
        </details>
      </header>
      <OfflineSync />
      {denied && <p className="mt-4 text-center font-semibold text-red-700">Only a foreman or admin on this job can exit the kiosk.</p>}
      <div className="px-4 py-10">
        <KioskPad jobId={job.id} jobName={job.name} offlineMode={job.offlineMode} />
      </div>
    </main>
  );
}
