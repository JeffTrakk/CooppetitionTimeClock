"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { enqueuePunch, QUEUE_EVENT } from "@/lib/offline/punch-queue";
import type { GpsFix, GpsMode, OfflineMode, PunchType } from "@/lib/domain/types";

export interface ClockJob {
  id: string;
  name: string;
  address: string;
  offlineMode: OfflineMode;
  gpsMode: GpsMode;
  requireQr: boolean;
  defaultCostCodeId: string | null;
  shiftLabel: string | null;
}

type State = { status: "out" } | { status: "in" | "on_break"; jobId: string; since: string };

const PING_EVERY_MS = 5 * 60_000;

function getFix(timeoutMs = 8000): Promise<GpsFix | null> {
  if (!("geolocation" in navigator)) return Promise.resolve(null);
  return new Promise((resolve) =>
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracyM: Math.round(p.coords.accuracy) }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 30_000 },
    ),
  );
}

function elapsed(since: string, now: number) {
  const m = Math.max(0, Math.floor((now - Date.parse(since)) / 60_000));
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m`;
}

export function ClockWidget({
  jobs, costCodes, initial, consentNeeded, qrJobId,
}: {
  jobs: ClockJob[];
  costCodes: { id: string; code: string; name: string }[];
  initial: State;
  consentNeeded: boolean;
  qrJobId?: string | null;
}) {
  const router = useRouter();
  const [state, setState] = useState<State>(initial);
  const [jobId, setJobId] = useState(qrJobId ?? (initial.status !== "out" ? initial.jobId : jobs[0]?.id ?? ""));
  const job = jobs.find((j) => j.id === (state.status === "out" ? jobId : state.jobId));
  const [costCodeId, setCostCodeId] = useState(job?.defaultCostCodeId ?? "");
  const [consent, setConsent] = useState(!consentNeeded);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "ok" | "warn" | "err"; text: string } | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => setState(initial), [initial]);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  // Continuous GPS mode: breadcrumbs while clocked in and the app is open.
  // (Background tracking with the screen off needs a native app — see docs.)
  const lastPing = useRef(0);
  const continuous = state.status !== "out" && job?.gpsMode === "continuous";
  useEffect(() => {
    if (!continuous || !job || !("geolocation" in navigator)) return;
    const id = navigator.geolocation.watchPosition(
      (p) => {
        if (Date.now() - lastPing.current < PING_EVERY_MS || !navigator.onLine) return;
        lastPing.current = Date.now();
        fetch("/api/location", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ jobId: job.id, gps: { lat: p.coords.latitude, lng: p.coords.longitude, accuracyM: Math.round(p.coords.accuracy) } }),
        }).catch(() => {});
      },
      () => {},
      { enableHighAccuracy: false, maximumAge: 60_000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [continuous, job]);

  async function act(type: PunchType) {
    if (!job) return;
    if (!consent) {
      setMsg({ tone: "err", text: "Please accept the location notice first." });
      return;
    }
    setBusy(true);
    setMsg(null);
    const gps = await getFix();
    const body = {
      source: "phone" as const, jobId: job.id, type, gps, qrVerified: qrJobId === job.id, costCodeId: costCodeId || null,
      clientId: crypto.randomUUID(), locationConsent: consent,
    };

    const next: State = type === "out" ? { status: "out" } : { status: type === "break_start" ? "on_break" : "in", jobId: job.id, since: new Date().toISOString() };
    const queue = async () => {
      if (job.offlineMode !== "queue") {
        setMsg({ tone: "err", text: `No signal. ${job.name} requires a live connection to clock in. Move to where you have signal and try again, or ask your foreman.` });
        return;
      }
      await enqueuePunch({ clientId: body.clientId, body: { ...body, offline: true, occurredAt: new Date().toISOString() }, queuedAt: new Date().toISOString() });
      window.dispatchEvent(new Event(QUEUE_EVENT));
      setState(next);
      setMsg({ tone: "warn", text: "No signal. Saved on this phone with the real time and location. It will send automatically." });
    };

    try {
      if (!navigator.onLine) return await queue();
      let res: Response;
      try {
        res = await fetch("/api/punches", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      } catch {
        return await queue();
      }
      const data = await res.json();
      if (!res.ok) {
        setMsg({ tone: "err", text: data.error ?? "Something went wrong." });
        return;
      }
      setState(next);
      setMsg(data.warning ? { tone: "warn", text: data.warning } : { tone: "ok", text: { in: "Clocked in.", out: "Clocked out. Nice work today.", break_start: "Break started.", break_end: "Back on the clock." }[type] });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (jobs.length === 0 && state.status === "out") {
    return <div className="card text-center text-sm text-stone-600">You&apos;re not scheduled on any job today. If that&apos;s wrong, contact your foreman.</div>;
  }

  return (
    <div className="card">
      {state.status === "out" ? (
        <div className="space-y-3">
          <div>
            <label className="label" htmlFor="job">Job</label>
            <select id="job" className="input" value={jobId} onChange={(e) => { setJobId(e.target.value); setCostCodeId(jobs.find((j) => j.id === e.target.value)?.defaultCostCodeId ?? ""); }}>
              {jobs.map((j) => <option key={j.id} value={j.id}>{j.name}{j.shiftLabel ? ` · ${j.shiftLabel}` : ""}</option>)}
            </select>
            {job && <p className="mt-1 text-xs text-stone-500">{job.address}</p>}
          </div>
          <div>
            <label className="label" htmlFor="cc">Task / cost code</label>
            <select id="cc" className="input" value={costCodeId} onChange={(e) => setCostCodeId(e.target.value)}>
              <option value="">Not specified</option>
              {costCodes.map((c) => <option key={c.id} value={c.id}>{c.code} · {c.name}</option>)}
            </select>
          </div>
          {job?.requireQr && qrJobId !== job.id && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">This site needs a QR scan. Scan the code at the site entrance with your phone camera to clock in.</p>
          )}
          {consentNeeded && (
            <label className="flex items-start gap-2 rounded-lg bg-stone-50 p-3 text-sm">
              <input type="checkbox" className="mt-1" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
              <span>
                I understand my location is recorded when I clock in, clock out or take a break, to confirm I&apos;m on site.
                {jobs.some((j) => j.gpsMode === "continuous") && " On some jobs, location is also recorded every few minutes while I'm clocked in and the app is open."}
              </span>
            </label>
          )}
          <button className="btn-primary w-full py-4 text-lg" disabled={busy || !job} onClick={() => act("in")}>{busy ? "Getting location…" : "Clock in"}</button>
        </div>
      ) : (
        <div className="space-y-4 text-center">
          <div>
            <div className={`mx-auto mb-2 inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-semibold ${state.status === "in" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-900"}`}>
              <span className={`h-2 w-2 rounded-full ${state.status === "in" ? "bg-emerald-600" : "bg-amber-500"}`} />
              {state.status === "in" ? "On the clock" : "On break"}
            </div>
            <div className="text-4xl font-bold tabular-nums">{elapsed(state.since, now)}</div>
            <div className="mt-1 text-sm text-stone-600">{job?.name ?? "Job"} · since {new Date(state.since).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</div>
          </div>
          {continuous && <p className="text-xs text-stone-500">This job records your location every few minutes while you&apos;re clocked in and the app is open.</p>}
          {state.status === "in" ? (
            <div className="grid grid-cols-2 gap-2">
              <button className="btn-ghost py-4" disabled={busy} onClick={() => act("break_start")}>Start break</button>
              <button className="btn-danger py-4" disabled={busy} onClick={() => act("out")}>{busy ? "…" : "Clock out"}</button>
            </div>
          ) : (
            <button className="btn-accent w-full py-4 text-lg" disabled={busy} onClick={() => act("break_end")}>End break</button>
          )}
        </div>
      )}
      {msg && (
        <p className={`mt-3 rounded-lg px-3 py-2 text-sm ${msg.tone === "ok" ? "bg-emerald-50 text-emerald-800" : msg.tone === "warn" ? "bg-amber-50 text-amber-900" : "bg-red-50 text-red-800"}`}>{msg.text}</p>
      )}
    </div>
  );
}
