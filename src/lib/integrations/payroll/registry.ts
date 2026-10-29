import { csvProvider } from "./csv";
import { adpProvider, ceridianProvider, quickbooksProvider, wagepointProvider } from "./providers";
import type { PayrollProvider } from "./types";

export const PAYROLL_PROVIDERS: PayrollProvider[] = [csvProvider, quickbooksProvider, wagepointProvider, ceridianProvider, adpProvider];

export function getPayrollProvider(key: string): PayrollProvider | undefined {
  return PAYROLL_PROVIDERS.find((p) => p.key === key);
}
