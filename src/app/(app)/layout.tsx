import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { requireSession } from "@/lib/auth/session";
import { repo } from "@/lib/data";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await requireSession();
  const inbox = await repo().listMessagesForUser(session.company.id, session.user.id);
  return (
    <AppShell session={session} unread={inbox.filter((m) => !m.delivery.readAt).length}>
      {children}
    </AppShell>
  );
}
