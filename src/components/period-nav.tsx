import Link from "next/link";
import type { Period } from "@/lib/domain/pay-period";
import { formatDate } from "@/lib/domain/time";

export function PeriodNav({ period, prev, next, basePath, extra = "" }: { period: Period; prev: Period; next: Period; basePath: string; extra?: string }) {
  return (
    <div className="mb-4 flex items-center gap-2 text-sm">
      <Link className="btn-ghost px-3 py-1" href={`${basePath}?p=${prev.start}${extra}`}>←</Link>
      <span className="font-semibold">{formatDate(period.start, { month: "short", day: "numeric" })} – {formatDate(period.end, { month: "short", day: "numeric", year: "numeric" })}</span>
      <Link className="btn-ghost px-3 py-1" href={`${basePath}?p=${next.start}${extra}`}>→</Link>
      <Link className="ml-1 text-xs font-semibold text-brand" href={`${basePath}${extra ? `?${extra.slice(1)}` : ""}`}>Current</Link>
    </div>
  );
}
