// Starting-default labour rules per jurisdiction. These are defaults a
// company can pick and then override; they are NOT legal advice. Employment
// standards change and construction often has sector-specific rules
// (e.g. ICI/residential agreements, union contracts). Each company should
// confirm the values with their payroll provider or counsel.

export interface LabourRuleSet {
  code: string;
  name: string;
  country: "CA" | "US";
  /** Minutes worked in a day after which overtime (1.5x) starts. null = no daily overtime. */
  dailyOtAfterMin: number | null;
  /** Minutes worked in a day after which double time (2x) starts. */
  dailyDoubleAfterMin: number | null;
  /** Regular minutes in a week after which overtime starts. */
  weeklyOtAfterMin: number | null;
  otMultiplier: number;
  doubleMultiplier: number;
  /** A break of breakMinutes is required once a shift passes breakAfterMin. */
  breakAfterMin: number;
  breakMinutes: number;
  breaksPaid: boolean;
  notes: string;
}

const h = (hours: number) => hours * 60;

function rule(r: Omit<LabourRuleSet, "otMultiplier" | "doubleMultiplier" | "breaksPaid"> & Partial<LabourRuleSet>): LabourRuleSet {
  return { otMultiplier: 1.5, doubleMultiplier: 2, breaksPaid: false, ...r };
}

export const LABOUR_RULE_PRESETS: Record<string, LabourRuleSet> = {
  "CA-ON": rule({ code: "CA-ON", name: "Ontario", country: "CA", dailyOtAfterMin: null, dailyDoubleAfterMin: null, weeklyOtAfterMin: h(44), breakAfterMin: h(5), breakMinutes: 30, notes: "ESA: overtime after 44 h/week; 30-min eating period after 5 h." }),
  "CA-QC": rule({ code: "CA-QC", name: "Quebec", country: "CA", dailyOtAfterMin: null, dailyDoubleAfterMin: null, weeklyOtAfterMin: h(40), breakAfterMin: h(5), breakMinutes: 30, notes: "Overtime after 40 h/week. Construction is governed by the R-20 decree and sector agreements — review before use." }),
  "CA-BC": rule({ code: "CA-BC", name: "British Columbia", country: "CA", dailyOtAfterMin: h(8), dailyDoubleAfterMin: h(12), weeklyOtAfterMin: h(40), breakAfterMin: h(5), breakMinutes: 30, notes: "1.5x after 8 h/day, 2x after 12 h/day, 1.5x after 40 h/week." }),
  "CA-AB": rule({ code: "CA-AB", name: "Alberta", country: "CA", dailyOtAfterMin: h(8), dailyDoubleAfterMin: null, weeklyOtAfterMin: h(44), breakAfterMin: h(5), breakMinutes: 30, notes: "Overtime after 8 h/day or 44 h/week, whichever is greater." }),
  "CA-SK": rule({ code: "CA-SK", name: "Saskatchewan", country: "CA", dailyOtAfterMin: h(8), dailyDoubleAfterMin: null, weeklyOtAfterMin: h(40), breakAfterMin: h(5), breakMinutes: 30, notes: "Overtime after 8 h/day (10 h on a modified schedule) or 40 h/week." }),
  "CA-MB": rule({ code: "CA-MB", name: "Manitoba", country: "CA", dailyOtAfterMin: h(8), dailyDoubleAfterMin: null, weeklyOtAfterMin: h(40), breakAfterMin: h(5), breakMinutes: 30, notes: "Overtime after 8 h/day or 40 h/week. Construction industry wage regulations may apply." }),
  "CA-NB": rule({ code: "CA-NB", name: "New Brunswick", country: "CA", dailyOtAfterMin: null, dailyDoubleAfterMin: null, weeklyOtAfterMin: h(44), breakAfterMin: h(5), breakMinutes: 30, notes: "Overtime after 44 h/week (statutory rate is 1.5x minimum wage)." }),
  "CA-NS": rule({ code: "CA-NS", name: "Nova Scotia", country: "CA", dailyOtAfterMin: null, dailyDoubleAfterMin: null, weeklyOtAfterMin: h(48), breakAfterMin: h(5), breakMinutes: 30, notes: "Overtime after 48 h/week (1.5x minimum wage)." }),
  "CA-PE": rule({ code: "CA-PE", name: "Prince Edward Island", country: "CA", dailyOtAfterMin: null, dailyDoubleAfterMin: null, weeklyOtAfterMin: h(48), breakAfterMin: h(6), breakMinutes: 30, notes: "Overtime after 48 h/week; 30-min break after 6 h." }),
  "CA-NL": rule({ code: "CA-NL", name: "Newfoundland and Labrador", country: "CA", dailyOtAfterMin: null, dailyDoubleAfterMin: null, weeklyOtAfterMin: h(40), breakAfterMin: h(5), breakMinutes: 60, notes: "Overtime after 40 h/week; 1-h break after 5 h." }),
  "CA-YT": rule({ code: "CA-YT", name: "Yukon", country: "CA", dailyOtAfterMin: h(8), dailyDoubleAfterMin: null, weeklyOtAfterMin: h(40), breakAfterMin: h(5), breakMinutes: 30, notes: "Overtime after 8 h/day or 40 h/week." }),
  "CA-NT": rule({ code: "CA-NT", name: "Northwest Territories", country: "CA", dailyOtAfterMin: h(8), dailyDoubleAfterMin: null, weeklyOtAfterMin: h(40), breakAfterMin: h(5), breakMinutes: 30, notes: "Overtime after 8 h/day or 40 h/week." }),
  "CA-NU": rule({ code: "CA-NU", name: "Nunavut", country: "CA", dailyOtAfterMin: h(8), dailyDoubleAfterMin: null, weeklyOtAfterMin: h(40), breakAfterMin: h(5), breakMinutes: 30, notes: "Overtime after 8 h/day or 40 h/week." }),
  "CA-FED": rule({ code: "CA-FED", name: "Canada — federally regulated", country: "CA", dailyOtAfterMin: h(8), dailyDoubleAfterMin: null, weeklyOtAfterMin: h(40), breakAfterMin: h(5), breakMinutes: 30, notes: "Canada Labour Code: overtime after 8 h/day or 40 h/week." }),
  "US-FLSA": rule({ code: "US-FLSA", name: "United States — federal (FLSA)", country: "US", dailyOtAfterMin: null, dailyDoubleAfterMin: null, weeklyOtAfterMin: h(40), breakAfterMin: h(6), breakMinutes: 30, notes: "FLSA: overtime after 40 h/week. No federal meal-break rule; 6 h/30 min used as a sensible default. State law may add daily overtime." }),
  "US-CA": rule({ code: "US-CA", name: "United States — California", country: "US", dailyOtAfterMin: h(8), dailyDoubleAfterMin: h(12), weeklyOtAfterMin: h(40), breakAfterMin: h(5), breakMinutes: 30, notes: "1.5x after 8 h/day, 2x after 12 h/day, 1.5x after 40 h/week; 30-min meal break before the 5th hour." }),
};

export const DEFAULT_RULE_SET = "CA-ON";

export function getRuleSet(code: string | null | undefined): LabourRuleSet {
  return (code && LABOUR_RULE_PRESETS[code]) || LABOUR_RULE_PRESETS[DEFAULT_RULE_SET];
}
