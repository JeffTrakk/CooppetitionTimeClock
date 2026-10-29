"use client";
// Registers the service worker and syncs queued offline punches whenever
// the device comes back online. Shows a small banner while anything is
// waiting or when a synced punch was rejected.

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { listQueued, QUEUE_EVENT, syncQueue } from "@/lib/offline/punch-queue";

export function OfflineSync() {
  const router = useRouter();
  const [pending, setPending] = useState(0);
  const [online, setOnline] = useState(true);
  const [rejected, setRejected] = useState<string[]>([]);

  const refreshCount = useCallback(() => {
    listQueued().then((q) => setPending(q.length)).catch(() => {});
  }, []);

  const sync = useCallback(async () => {
    if (!navigator.onLine) return;
    try {
      const r = await syncQueue();
      if (r.rejected.length) setRejected((prev) => [...prev, ...r.rejected.map((x) => x.error)]);
      if (r.synced || r.rejected.length) router.refresh();
      setPending(r.remaining);
    } catch {
      /* IndexedDB unavailable (private mode) — nothing queued */
    }
  }, [router]);

  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
    setOnline(navigator.onLine);
    refreshCount();
    sync();
    const on = () => { setOnline(true); sync(); };
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    window.addEventListener(QUEUE_EVENT, refreshCount);
    const t = setInterval(sync, 60_000);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
      window.removeEventListener(QUEUE_EVENT, refreshCount);
      clearInterval(t);
    };
  }, [refreshCount, sync]);

  if (online && pending === 0 && rejected.length === 0) return null;
  return (
    <div className="space-y-1 px-4 pt-2">
      {!online && <div className="rounded-lg bg-stone-800 px-3 py-2 text-sm text-white">You&apos;re offline. On sites that allow it, punches are saved on this device and sent when signal returns.</div>}
      {pending > 0 && <div className="rounded-lg bg-amber-100 px-3 py-2 text-sm text-amber-900">{pending} punch{pending === 1 ? "" : "es"} waiting to sync.</div>}
      {rejected.map((e, i) => (
        <div key={i} className="flex items-start justify-between gap-2 rounded-lg bg-red-100 px-3 py-2 text-sm text-red-900">
          <span>An offline punch was not accepted: {e} Tell your foreman so they can add it.</span>
          <button className="font-bold" onClick={() => setRejected((r) => r.filter((_, j) => j !== i))} aria-label="Dismiss">×</button>
        </div>
      ))}
    </div>
  );
}
