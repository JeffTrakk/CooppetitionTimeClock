"use client";
// Shared site tablet. Worker types a PIN, sees their name and status, taps
// an action. Resets after a few seconds for the next person. On "queue"
// sites it keeps working with no signal: the PIN is checked at sync time.

import { useEffect, useState } from "react";
import { kioskIdentify, type KioskIdentity } from "@/app/actions/kiosk";
import { enqueuePunch, QUEUE_EVENT } from "@/lib/offline/punch-queue";
import type { GpsFix, OfflineMode, PunchType } from "@/lib/domain/types";

const LABEL: Record<PunchType, string> = { in: "Clock in", out: "Clock out", break_start: "Start break", break_end: "End break" };
const RESET_MS = 6000;

function siteFix(): Promise<GpsFix | null> {
  if (!("geolocation" in navigator)) return Promise.resolve(null);
  return new Promise((resolve) =>
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracyM: Math.round(p.coords.accuracy) }),
      () => resolve(null),
      { timeout: 5000, maximumAge: 10 * 60_000 },
    ),
  );
}

export function KioskPad({ jobId, jobName, offlineMode }: { jobId: string; jobName: string; offlineMode: OfflineMode }) {
  const [pin, setPin] = useState("");
  const [who, setWho] = useState<KioskIdentity | null>(null);
  const [offlineId, setOfflineId] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const reset = () => { setPin(""); setWho(null); setOfflineId(false); setResult(null); };

  useEffect(() => {
    if (!result && !who && !offlineId) return;
    const t = setTimeout(reset, result ? 3500 : RESET_MS * 2);
    return () => clearTimeout(t);
  }, [result, who, offlineId]);

  async function identify() {
    setBusy(true);
    try {
      if (!navigator.onLine) throw new Error("offline");
      setWho(await kioskIdentify(pin));
    } catch {
      if (offlineMode === "queue") setOfflineId(true);
      else setResult({ ok: false, text: "No connection. This site requires signal to clock in. See your foreman." });
    } finally {
      setBusy(false);
    }
  }

  async function punch(type: PunchType) {
    setBusy(true);
    const gps = await siteFix();
    const body = { source: "kiosk", jobId, type, gps, pin, clientId: crypto.randomUUID() };
    const queue = async () => {
      await enqueuePunch({ clientId: body.clientId, body: { ...body, offline: true, occurredAt: new Date().toISOString() }, queuedAt: new Date().toISOString() });
      window.dispatchEvent(new Event(QUEUE_EVENT));
      setResult({ ok: true, text: `${LABEL[type]} saved offline. It will be checked and sent when signal returns.` });
    };
    try {
      if (!navigator.onLine) return await queue();
      let res: Response;
      try {
        res = await fetch("/api/punches", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      } catch {
        return offlineMode === "queue" ? await queue() : setResult({ ok: false, text: "Connection lost. Try again." });
      }
      const data = await res.json();
      setResult(res.ok ? { ok: true, text: `${data.name?.split(" ")[0] ?? ""}: ${LABEL[type].toLowerCase()} at ${new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` } : { ok: false, text: data.error });
    } finally {
      setBusy(false);
    }
  }

  const key = (d: string) => () => setPin((p) => (p.length < 6 ? p + d : p));

  if (result) {
    return <div className={`rounded-2xl p-10 text-center text-2xl font-bold ${result.ok ? "bg-emerald-600 text-white" : "bg-red-700 text-white"}`}>{result.text}</div>;
  }

  if (who?.ok || offlineId) {
    const actions: PunchType[] = offlineId ? ["in", "break_start", "break_end", "out"] : who && who.ok ? who.allowed : [];
    return (
      <div className="space-y-4 text-center">
        <div className="text-3xl font-bold">{who?.ok ? `Hi ${who.name.split(" ")[0]}` : "Offline mode"}</div>
        <div className="text-stone-600">
          {who?.ok ? (who.elsewhere ? `You're clocked in at ${who.elsewhere}. Clock out there first, or ask your foreman.` : who.status === "out" ? `Not clocked in · ${jobName}` : who.status === "in" ? "On the clock" : "On break") : "Can't confirm your PIN without signal. Pick what you're doing."}
        </div>
        <div className="grid grid-cols-2 gap-3">
          {actions.map((a) => (
            <button key={a} disabled={busy} onClick={() => punch(a)} className={`rounded-2xl py-8 text-xl font-bold ${a === "in" ? "bg-brand text-white" : a === "out" ? "bg-red-700 text-white" : "bg-accent text-black"}`}>{LABEL[a]}</button>
          ))}
        </div>
        <button className="btn-ghost" onClick={reset}>Cancel</button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xs space-y-4">
      <div className="h-14 rounded-xl bg-white text-center text-4xl font-bold leading-[3.5rem] tracking-[0.5em]">{pin.replace(/./g, "•") || <span className="text-xl tracking-normal text-stone-400">Enter PIN</span>}</div>
      {who && !who.ok && <p className="text-center font-semibold text-red-700">{who.error}</p>}
      <div className="grid grid-cols-3 gap-3">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => <button key={d} onClick={key(d)} className="rounded-xl bg-white py-5 text-2xl font-bold shadow-sm active:bg-stone-100">{d}</button>)}
        <button onClick={() => setPin("")} className="rounded-xl bg-stone-200 py-5 text-sm font-bold">Clear</button>
        <button onClick={key("0")} className="rounded-xl bg-white py-5 text-2xl font-bold shadow-sm">0</button>
        <button onClick={identify} disabled={pin.length < 4 || busy} className="rounded-xl bg-brand py-5 text-lg font-bold text-white disabled:opacity-40">Go</button>
      </div>
    </div>
  );
}
