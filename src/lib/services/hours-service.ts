import "server-only";
import { repo } from "../data";
import { computeHours, type HoursReport } from "../domain/hours";
import { getRuleSet, type LabourRuleSet } from "../domain/labour-rules";
import type { Period } from "../domain/pay-period";
import { addDays } from "../domain/time";
import type { Company, Job } from "../domain/types";
import { utcBounds } from "./scope";

/**
 * Rule set for a stretch of work: the company default, unless every hour in
 * the period was worked on jobs that share the same override (e.g. a crew
 * sent to a job in another province for the whole period).
 */
function resolveRules(company: Company, jobIds: string[], jobs: Job[]): LabourRuleSet {
  const overrides = new Set(jobIds.map((id) => jobs.find((j) => j.id === id)?.labourRuleOverride ?? null));
  if (overrides.size === 1) {
    const only = [...overrides][0];
    if (only) return getRuleSet(only);
  }
  return getRuleSet(company.labourRuleSet);
}

export async function hoursForUser(company: Company, userId: string, period: Period, jobs?: Job[]): Promise<HoursReport & { rules: LabourRuleSet }> {
  // Start a week early so weekly overtime knows about days before the period.
  const bounds = utcBounds(company, addDays(period.start, -7), period.end);
  const [punches, allJobs] = await Promise.all([repo().listPunches(company.id, { userId, ...bounds }), jobs ?? repo().listJobs(company.id)]);
  const rules = resolveRules(company, punches.filter((p) => p.occurredAt >= utcBounds(company, period.start, period.end).from).map((p) => p.jobId), allJobs);
  const report = computeHours(punches, { rules, timezone: company.timezone, weekStartsOn: company.weekStartsOn, from: period.start, to: period.end });
  return { ...report, rules };
}
