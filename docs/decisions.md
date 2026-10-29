# Decisions

## 2026-10-29: Initial scope (agreed with Jeff Bowman before the build)

| Question | Decision |
| --- | --- |
| Platform | Phone web app (installable) **and** a site kiosk mode. A native app later only if background GPS is needed. |
| On-site verification | GPS geofence **and** site QR codes. |
| Payroll targets | QuickBooks Online, Wagepoint, Ceridian/Dayforce, ADP, plus generic CSV. Interfaces only; CSV works. |
| Hosting | Supabase (ca-central-1) + Vercel, the same stack as Adminspace and Quotes. |
| Roles | Employee, Foreman, Office/Payroll, Owner/Admin. |
| Time features | Breaks, overtime rules, cost codes, timesheet approval with audit trail. |
| Messaging | In-app (works), SMS, email, push (scaffolded). |
| Tenancy | Multi-company from day one. |
| Offline | Both modes, chosen **per site** by the foreman: save and sync later, or require a connection. |
| GPS capture | Both modes: at punches only, or continuous while clocked in. Company default with per-job override. |
| Labour rules | Presets for every province and territory, federal, US FLSA and California. Company default with per-job override. |
| Branding | White-label. Each client sets its app name, logo and colours. |
| Integrations | Lay out the infrastructure and where it's housed. **Don't connect** anything yet. |

## Why a Repository interface with an in-memory adapter

The brief was to lay out the backend without connecting it. A single data
interface with a working in-memory adapter lets every screen be built and
tested now. Connecting Supabase then means implementing one class and
flipping `DATA_BACKEND`, with no page or service changes.

## Why punches are immutable

Payroll disputes and labour audits need to show what was recorded and who
changed it. Corrections are new rows, voids need a reason, and both are
audited. Postgres triggers enforce this, so it holds even if the app has a bug.

## Why overtime is computed by walking minutes in order

Splitting daily totals after the fact puts overtime on the wrong job or
cost code when a worker moves between jobs in a day. Charging each segment
against running daily and weekly counters puts it on the hours actually
worked past the threshold.
