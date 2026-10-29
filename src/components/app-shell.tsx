import Link from "next/link";
import type { ReactNode } from "react";
import { signOut } from "@/app/actions/auth";
import type { Session } from "@/lib/auth/session";
import { can, type Capability } from "@/lib/domain/permissions";
import { ROLE_LABELS } from "@/lib/domain/types";
import { NavLink } from "./nav-link";
import { OfflineSync } from "./offline-sync";

interface Item {
  href: string;
  label: string;
  cap: Capability;
}

const MY: Item[] = [
  { href: "/me", label: "Clock", cap: "clock.self" },
  { href: "/me/schedule", label: "Schedule", cap: "clock.self" },
  { href: "/me/hours", label: "Hours", cap: "clock.self" },
  { href: "/me/messages", label: "Messages", cap: "clock.self" },
];

const CREW: Item[] = [
  { href: "/crew", label: "Crew today", cap: "crew.view" },
  { href: "/crew/timesheets", label: "Crew timesheets", cap: "timesheet.approve.crew" },
  { href: "/crew/sites", label: "Site settings", cap: "site.modes" },
];

const ADMIN: Item[] = [
  { href: "/admin", label: "On site now", cap: "dashboard.view" },
  { href: "/admin/schedule", label: "Schedule", cap: "schedule.manage" },
  { href: "/admin/jobs", label: "Jobs & sites", cap: "jobs.manage" },
  { href: "/admin/people", label: "People", cap: "people.view" },
  { href: "/admin/timesheets", label: "Timesheets", cap: "timesheet.approve.all" },
  { href: "/admin/payroll", label: "Payroll export", cap: "payroll.export" },
  { href: "/admin/messages", label: "Messages", cap: "messages.send" },
  { href: "/admin/settings", label: "Company & branding", cap: "settings.manage" },
  { href: "/admin/integrations", label: "Integrations", cap: "integrations.manage" },
];

export function AppShell({ session, unread, children }: { session: Session; unread: number; children: ReactNode }) {
  const { user, company } = session;
  const groups = [
    { title: "My time", items: MY },
    { title: "Foreman", items: CREW },
    { title: "Office", items: ADMIN },
  ]
    .map((g) => ({ ...g, items: g.items.filter((i) => can(user.role, i.cap)) }))
    .filter((g) => g.items.length);
  // Field workers live on their phones: bottom tab bar. Others get a sidebar.
  const fieldOnly = user.role === "employee";

  return (
    <div className="min-h-screen md:flex">
      <aside className={`${fieldOnly ? "hidden" : "hidden md:block"} w-60 shrink-0 border-r border-stone-200 bg-white`}>
        <Brand session={session} />
        <nav className="space-y-5 p-3">
          {groups.map((g) => (
            <div key={g.title}>
              {groups.length > 1 && <div className="px-2 pb-1 text-[11px] font-bold uppercase tracking-wider text-stone-400">{g.title}</div>}
              {g.items.map((i) => (
                <NavLink key={i.href} href={i.href} badge={i.href === "/me/messages" ? unread : 0}>{i.label}</NavLink>
              ))}
            </div>
          ))}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-2 border-b border-stone-200 bg-white px-4 py-2">
          <div className={fieldOnly ? "" : "md:hidden"}><Brand session={session} compact /></div>
          <div className="ml-auto flex items-center gap-3 text-sm">
            <span className="hidden text-right sm:block">
              <span className="block font-semibold leading-tight">{user.name}</span>
              <span className="text-xs text-stone-500">{ROLE_LABELS[user.role]} · {company.name}</span>
            </span>
            <form action={signOut}><button className="btn-ghost px-3 py-1.5 text-xs">Sign out</button></form>
          </div>
        </header>
        {!fieldOnly && (
          <nav className="flex gap-1 overflow-x-auto border-b border-stone-200 bg-white px-2 py-1 md:hidden">
            {groups.flatMap((g) => g.items).map((i) => (
              <NavLink key={i.href} href={i.href} compact badge={i.href === "/me/messages" ? unread : 0}>{i.label}</NavLink>
            ))}
          </nav>
        )}
        <OfflineSync />
        <main className={`mx-auto w-full max-w-6xl flex-1 px-4 py-5 ${fieldOnly ? "pb-24" : ""}`}>{children}</main>
      </div>

      {fieldOnly && (
        <nav className="fixed inset-x-0 bottom-0 z-10 grid grid-cols-4 border-t border-stone-200 bg-white pb-[env(safe-area-inset-bottom)]">
          {MY.map((i) => (
            <NavLink key={i.href} href={i.href} tab badge={i.href === "/me/messages" ? unread : 0}>{i.label}</NavLink>
          ))}
        </nav>
      )}
    </div>
  );
}

function Brand({ session, compact }: { session: Session; compact?: boolean }) {
  const b = session.company.branding;
  return (
    <Link href="/" className={`flex items-center gap-2 ${compact ? "" : "border-b border-stone-200 px-4 py-4"}`}>
      {b.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={b.logoUrl} alt="" className="h-8 w-8 rounded-md object-contain" />
      ) : (
        <span className="grid h-8 w-8 place-items-center rounded-md bg-brand text-sm font-black text-white">{b.appName.slice(0, 1)}</span>
      )}
      <span className="font-bold leading-tight">{b.appName}</span>
    </Link>
  );
}
