// Date helpers that respect the company's timezone. Timestamps are stored
// as ISO strings in UTC; "local dates" are YYYY-MM-DD in the company tz.

const dateFmtCache = new Map<string, Intl.DateTimeFormat>();

function dateFmt(timezone: string) {
  let fmt = dateFmtCache.get(timezone);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" });
    dateFmtCache.set(timezone, fmt);
  }
  return fmt;
}

/** YYYY-MM-DD for the instant in the given timezone. */
export function localDate(iso: string | Date, timezone: string): string {
  return dateFmt(timezone).format(typeof iso === "string" ? new Date(iso) : iso);
}

/** Adds whole days to a YYYY-MM-DD string. */
export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** 0 = Sunday. */
export function dayOfWeek(date: string): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}

export function startOfWeek(date: string, weekStartsOn: number): string {
  const diff = (dayOfWeek(date) - weekStartsOn + 7) % 7;
  return addDays(date, -diff);
}

export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

/**
 * Converts a local wall-clock time (YYYY-MM-DD + HH:MM) in `timezone` to a
 * UTC ISO string. Handles DST by correcting with the zone's offset.
 */
export function zonedTimeToUtc(date: string, time: string, timezone: string): string {
  const guess = new Date(`${date}T${time}:00Z`);
  const offset = tzOffsetMinutes(guess, timezone);
  const utc = new Date(guess.getTime() - offset * 60_000);
  // Re-check once in case the guess straddled a DST transition.
  const offset2 = tzOffsetMinutes(utc, timezone);
  return new Date(guess.getTime() - offset2 * 60_000).toISOString();
}

function tzOffsetMinutes(at: Date, timezone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(at);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return Math.round((asUtc - at.getTime()) / 60_000);
}

export function formatTime(iso: string, timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone, hour: "numeric", minute: "2-digit" }).format(new Date(iso));
}

export function formatDate(date: string, opts: Intl.DateTimeFormatOptions = { weekday: "short", month: "short", day: "numeric" }): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "UTC", ...opts }).format(new Date(`${date}T12:00:00Z`));
}

export function formatDateTime(iso: string, timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone, month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(iso));
}

/** Minutes as "7h 30m". */
export function formatMinutes(min: number): string {
  const m = Math.round(min);
  const hours = Math.floor(m / 60);
  const rest = m % 60;
  if (hours === 0) return `${rest}m`;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}

/** Minutes as decimal hours "7.50" for payroll. */
export function toDecimalHours(min: number): string {
  return (min / 60).toFixed(2);
}
