import type { Company } from "./types";
import { addDays, daysBetween, localDate } from "./time";

export interface Period {
  start: string;
  end: string;
}

/** The pay period containing `date` (YYYY-MM-DD). */
export function periodFor(company: Pick<Company, "payPeriod">, date: string): Period {
  const len = company.payPeriod.type === "weekly" ? 7 : 14;
  const offset = daysBetween(company.payPeriod.anchorDate, date);
  const idx = Math.floor(offset / len);
  const start = addDays(company.payPeriod.anchorDate, idx * len);
  return { start, end: addDays(start, len - 1) };
}

export function currentPeriod(company: Pick<Company, "payPeriod" | "timezone">, now = new Date()): Period {
  return periodFor(company, localDate(now, company.timezone));
}

export function shiftPeriod(company: Pick<Company, "payPeriod">, period: Period, delta: number): Period {
  const len = company.payPeriod.type === "weekly" ? 7 : 14;
  return periodFor(company, addDays(period.start, delta * len));
}
