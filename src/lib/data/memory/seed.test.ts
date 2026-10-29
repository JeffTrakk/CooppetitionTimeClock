import { describe, expect, it } from "vitest";
import { computeHours } from "../../domain/hours";
import { getRuleSet } from "../../domain/labour-rules";
import { buildSeed } from "./seed";

describe("demo seed", () => {
  it("flags only the planted break problem, not random variation", () => {
    const now = new Date("2026-10-29T01:00:00Z");
    const s = buildSeed(now);
    const company = s.companies[0];
    const flagged = new Set<string>();
    for (const u of s.users.filter((x) => x.companyId === company.id)) {
      const r = computeHours(s.punches.filter((p) => p.userId === u.id), { rules: getRuleSet(company.labourRuleSet), timezone: company.timezone, weekStartsOn: 0, now });
      if (r.days.some((d) => !d.breakCompliant)) flagged.add(u.id);
    }
    expect([...flagged]).toEqual(["u-ravi"]);
  });
});
