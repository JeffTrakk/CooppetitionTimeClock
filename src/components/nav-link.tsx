"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export function NavLink({ href, children, badge = 0, compact, tab }: { href: string; children: ReactNode; badge?: number; compact?: boolean; tab?: boolean }) {
  const path = usePathname();
  const active = href === "/me" || href === "/crew" || href === "/admin" ? path === href : path.startsWith(href);
  const pill = badge > 0 && <span className="ml-auto rounded-full bg-accent px-1.5 text-[11px] font-bold text-black">{badge}</span>;

  if (tab) {
    return (
      <Link href={href} className={`relative flex flex-col items-center py-3 text-xs font-semibold ${active ? "text-brand" : "text-stone-500"}`}>
        <span className={`mb-1 h-1 w-8 rounded-full ${active ? "bg-brand" : "bg-transparent"}`} />
        {children}
        {badge > 0 && <span className="absolute right-[22%] top-2 h-2 w-2 rounded-full bg-accent" />}
      </Link>
    );
  }
  return (
    <Link
      href={href}
      className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium ${compact ? "shrink-0 whitespace-nowrap" : ""} ${active ? "bg-brand/10 text-brand" : "text-stone-700 hover:bg-stone-100"}`}
    >
      {children}
      {pill}
    </Link>
  );
}
