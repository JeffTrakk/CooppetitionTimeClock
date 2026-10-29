import { currentPeriod, periodFor, shiftPeriod } from "../domain/pay-period";
import type { Company } from "../domain/types";

/** Reads ?p=YYYY-MM-DD into a pay period (current period if absent/invalid). */
export function periodFromParam(company: Company, p: string | string[] | undefined) {
  const v = typeof p === "string" && /^\d{4}-\d{2}-\d{2}$/.test(p) ? p : null;
  const period = v ? periodFor(company, v) : currentPeriod(company);
  return { period, prev: shiftPeriod(company, period, -1), next: shiftPeriod(company, period, 1) };
}
