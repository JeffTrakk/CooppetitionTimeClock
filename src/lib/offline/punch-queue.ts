"use client";
// Offline punch queue (browser IndexedDB). Used when a site's offline mode is
// "queue": the punch is saved on the device with its real time and GPS and
// posted to /api/punches when signal returns. Each punch carries a clientId,
// so re-sending after a flaky connection never creates duplicates.

export interface QueuedPunch {
  clientId: string;
  body: Record<string, unknown>;
  queuedAt: string;
  lastError?: string;
}

const DB = "timeclock";
const STORE = "punch-queue";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "clientId" });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const req = fn(db.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export const enqueuePunch = (p: QueuedPunch) => tx("readwrite", (s) => s.put(p));
export const listQueued = () => tx<QueuedPunch[]>("readonly", (s) => s.getAll());
export const removeQueued = (clientId: string) => tx("readwrite", (s) => s.delete(clientId));

export const QUEUE_EVENT = "timeclock:queue-changed";

/** Posts every queued punch in time order. Stops at the first network failure. */
export async function syncQueue(): Promise<{ synced: number; rejected: { clientId: string; error: string }[]; remaining: number }> {
  const items = (await listQueued()).sort((a, b) => String(a.body.occurredAt).localeCompare(String(b.body.occurredAt)));
  let synced = 0;
  const rejected: { clientId: string; error: string }[] = [];
  for (const item of items) {
    let res: Response;
    try {
      res = await fetch("/api/punches", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(item.body) });
    } catch {
      break; // still offline
    }
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    if (res.ok) synced++;
    else rejected.push({ clientId: item.clientId, error: data.error ?? `HTTP ${res.status}` });
    // Rejected punches are dropped from the queue and surfaced to the user;
    // a foreman fixes them with a correction (the server keeps no partial state).
    await removeQueued(item.clientId);
  }
  const remaining = (await listQueued()).length;
  window.dispatchEvent(new Event(QUEUE_EVENT));
  return { synced, rejected, remaining };
}
