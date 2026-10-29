import { Badge, PageHeader, Section } from "@/components/ui";
import { requireCap } from "@/lib/auth/session";
import { MESSAGING_CHANNELS } from "@/lib/integrations/messaging/channels";
import { PAYROLL_PROVIDERS } from "@/lib/integrations/payroll/registry";

// Infrastructure the app is laid out for. Nothing below is connected yet;
// each card lists the env var NAMES that turn it on (values go in Vercel
// project settings / Supabase Vault — never in the repo).
const PLATFORM = [
  { name: "Database", where: "Supabase Postgres (ca-central-1)", detail: "Schema and row-level security in supabase/migrations. Switch DATA_BACKEND=supabase once applied.", env: ["DATA_BACKEND", "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"] },
  { name: "Sign-in", where: "Supabase Auth", detail: "Text-message codes for crews, email magic links for office staff. Kiosks use device tokens + PIN.", env: ["SUPABASE_AUTH_SMS_PROVIDER (set in Supabase dashboard)"] },
  { name: "File storage", where: "Supabase Storage", detail: "Buckets: branding (logos), exports (payroll files). Private, served through signed URLs.", env: [] },
  { name: "Live updates", where: "Supabase Realtime", detail: "Punches and messages publish changes so dashboards update instantly. Today the pages refresh every 30 s instead.", env: [] },
  { name: "Background jobs", where: "Vercel Cron → /api/cron/*  (or Supabase Edge Functions + pg_cron)", detail: "Clock-out reminders, open-shift checks, notification dispatch, nightly payroll sync.", env: ["CRON_SECRET"] },
  { name: "Hosting", where: "Vercel", detail: "Next.js app. Each client can get its own subdomain (client.timeclock.app) or custom domain.", env: ["NEXT_PUBLIC_APP_URL"] },
];

function EnvList({ vars }: { vars: string[] }) {
  if (!vars.length) return <p className="text-xs text-stone-500">No credentials needed.</p>;
  return <div className="flex flex-wrap gap-1">{vars.map((v) => <code key={v} className="rounded bg-stone-100 px-1.5 py-0.5 text-[11px]">{v}</code>)}</div>;
}

export default async function Integrations() {
  await requireCap("integrations.manage");
  return (
    <div>
      <PageHeader title="Integrations" subtitle="Where each outside service plugs in. Connections are scaffolded, not live. See docs/ARCHITECTURE.md for the hookup steps." />

      <Section title="Payroll">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {PAYROLL_PROVIDERS.map((p) => (
            <div key={p.key} className="card space-y-2">
              <div className="flex items-center justify-between gap-2"><span className="font-bold">{p.name}</span>{p.ready ? <Badge tone="green">Working</Badge> : <Badge tone="amber">Not connected</Badge>}</div>
              <p className="text-sm text-stone-600">{p.description}</p>
              <div className="text-xs text-stone-500">Region {p.region} · auth {p.auth} · {p.capabilities.join(", ").replace(/_/g, " ")}</div>
              <EnvList vars={p.envVars} />
              {p.docsUrl && <a href={p.docsUrl} target="_blank" rel="noreferrer" className="text-xs font-semibold text-brand">API docs →</a>}
            </div>
          ))}
        </div>
      </Section>

      <Section title="Messaging">
        <div className="grid gap-3 md:grid-cols-2">
          {MESSAGING_CHANNELS.map((c) => (
            <div key={c.key} className="card space-y-2">
              <div className="flex items-center justify-between gap-2"><span className="font-bold">{c.name}</span>{c.ready ? <Badge tone="green">Working</Badge> : <Badge tone="amber">Not connected</Badge>}</div>
              <div className="text-xs text-stone-500">{c.provider}</div>
              <p className="text-sm text-stone-600">{c.description}</p>
              <EnvList vars={c.envVars} />
            </div>
          ))}
        </div>
      </Section>

      <Section title="Platform">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {PLATFORM.map((p) => (
            <div key={p.name} className="card space-y-2">
              <div className="flex items-center justify-between gap-2"><span className="font-bold">{p.name}</span><Badge tone="amber">Planned</Badge></div>
              <div className="text-xs font-semibold text-stone-600">{p.where}</div>
              <p className="text-sm text-stone-600">{p.detail}</p>
              <EnvList vars={p.env} />
            </div>
          ))}
        </div>
      </Section>

      <Section title="Inbound webhooks">
        <div className="card text-sm text-stone-600">
          Third-party events arrive at <code>/api/webhooks/&lt;provider&gt;</code> (twilio, quickbooks, adp, ceridian, wagepoint, email, push). Every route returns 501 until its handler and signature check are added in <code>src/app/api/webhooks/[provider]/route.ts</code>.
        </div>
      </Section>
    </div>
  );
}
