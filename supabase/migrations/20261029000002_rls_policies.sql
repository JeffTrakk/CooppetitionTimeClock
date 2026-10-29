-- Row Level Security: the database enforces the same role matrix as
-- src/lib/domain/permissions.ts, so a bug in the app can't leak another
-- company's data or let an employee edit time.
--
--   employee        own punches/shifts/timesheets/messages, read own company's jobs
--   foreman         + crew on jobs they lead: read time, insert punches/corrections, foreman-approve
--   office_payroll  + read everything in the company, approve timesheets, payroll exports
--   owner_admin     everything in their company
--
-- Background jobs use the service role, which bypasses RLS.

-- ── Helpers (security definer so policies don't recurse into memberships) ─

create function app.my_profile_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from profiles where auth_user_id = auth.uid()
$$;

create function app.has_role(company uuid, roles app_role[]) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from memberships m
    where m.company_id = company and m.profile_id = app.my_profile_id() and m.active and m.role = any (roles)
  )
$$;

create function app.is_member(company uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select app.has_role(company, enum_range(null::app_role))
$$;

create function app.is_office(company uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select app.has_role(company, array['owner_admin', 'office_payroll']::app_role[])
$$;

create function app.is_admin(company uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select app.has_role(company, array['owner_admin']::app_role[])
$$;

create function app.leads_job(job uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from job_foremen f where f.job_id = job and f.profile_id = app.my_profile_id())
$$;

-- Foreman's crew: anyone with a shift on a job they lead in the last/next 14 days.
create function app.in_my_crew(company uuid, person uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select app.has_role(company, array['foreman']::app_role[]) and exists (
    select 1 from shifts s join job_foremen f on f.job_id = s.job_id
    where s.company_id = company and s.profile_id = person and f.profile_id = app.my_profile_id()
      and s.starts_at > now() - interval '14 days' and s.starts_at < now() + interval '14 days'
  )
$$;

-- ── Enable RLS everywhere ────────────────────────────────────────────────

alter table companies                enable row level security;
alter table profiles                 enable row level security;
alter table memberships              enable row level security;
alter table jobs                     enable row level security;
alter table job_foremen              enable row level security;
alter table cost_codes               enable row level security;
alter table shifts                   enable row level security;
alter table punches                  enable row level security;
alter table location_pings           enable row level security;
alter table timesheets               enable row level security;
alter table timesheet_approvals      enable row level security;
alter table audit_log                enable row level security;
alter table messages                 enable row level security;
alter table message_deliveries       enable row level security;
alter table notification_preferences enable row level security;
alter table devices                  enable row level security;
alter table integration_connections  enable row level security;
alter table external_ids             enable row level security;
alter table integration_outbox       enable row level security;   -- no policies: service role only
alter table payroll_exports          enable row level security;

-- ── Companies & people ───────────────────────────────────────────────────

create policy "members read their company" on companies for select using (app.is_member(id));
create policy "admins update their company" on companies for update using (app.is_admin(id)) with check (app.is_admin(id));

create policy "read self" on profiles for select using (id = app.my_profile_id());
create policy "read co-workers" on profiles for select using (
  exists (select 1 from memberships m where m.profile_id = profiles.id and app.is_member(m.company_id))
);
create policy "update self" on profiles for update using (id = app.my_profile_id()) with check (id = app.my_profile_id());
create policy "admins manage people" on profiles for all using (
  exists (select 1 from memberships m where m.profile_id = profiles.id and app.is_admin(m.company_id))
);

create policy "members read memberships" on memberships for select using (app.is_member(company_id));
create policy "admins manage memberships" on memberships for all using (app.is_admin(company_id)) with check (app.is_admin(company_id));

-- ── Jobs ─────────────────────────────────────────────────────────────────

create policy "members read jobs" on jobs for select using (app.is_member(company_id));
create policy "admins manage jobs" on jobs for all using (app.is_admin(company_id)) with check (app.is_admin(company_id));
-- Foremen change site modes through public.set_site_modes() (bottom of file).

create policy "members read job foremen" on job_foremen for select using (exists (select 1 from jobs j where j.id = job_id and app.is_member(j.company_id)));
create policy "admins manage job foremen" on job_foremen for all using (exists (select 1 from jobs j where j.id = job_id and app.is_admin(j.company_id)));

create policy "members read cost codes" on cost_codes for select using (app.is_member(company_id));
create policy "admins manage cost codes" on cost_codes for all using (app.is_admin(company_id)) with check (app.is_admin(company_id));

-- ── Schedule ─────────────────────────────────────────────────────────────

create policy "read own shifts" on shifts for select using (profile_id = app.my_profile_id());
create policy "foremen read crew shifts" on shifts for select using (app.leads_job(job_id));
create policy "office reads shifts" on shifts for select using (app.is_office(company_id));
create policy "admins manage shifts" on shifts for all using (app.is_admin(company_id)) with check (app.is_admin(company_id));

-- ── Punches ──────────────────────────────────────────────────────────────

create policy "read own punches" on punches for select using (profile_id = app.my_profile_id());
create policy "foremen read crew punches" on punches for select using (app.leads_job(job_id));
create policy "office reads punches" on punches for select using (app.is_office(company_id));

create policy "employees punch themselves" on punches for insert with check (
  profile_id = app.my_profile_id() and created_by = app.my_profile_id()
  and source = 'phone' and app.is_member(company_id)
);
create policy "foremen punch crew on their jobs" on punches for insert with check (
  app.leads_job(job_id) and created_by = app.my_profile_id() and source in ('foreman', 'admin_edit')
);
create policy "office enters corrections" on punches for insert with check (
  app.is_office(company_id) and created_by = app.my_profile_id() and source = 'admin_edit'
);
-- Voiding (trigger allows only voided/note to change).
create policy "foremen void on their jobs" on punches for update using (app.leads_job(job_id));
create policy "office voids" on punches for update using (app.is_office(company_id));
-- Kiosk punches arrive through the server with the service role after the
-- device token and PIN are checked, so no anon insert policy exists.

create policy "read own pings" on location_pings for select using (profile_id = app.my_profile_id());
create policy "foremen read crew pings" on location_pings for select using (app.leads_job(job_id));
create policy "office reads pings" on location_pings for select using (app.is_office(company_id));
create policy "employees send own pings" on location_pings for insert with check (profile_id = app.my_profile_id());

-- ── Timesheets ───────────────────────────────────────────────────────────

create policy "read own timesheets" on timesheets for select using (profile_id = app.my_profile_id());
create policy "foremen read crew timesheets" on timesheets for select using (app.in_my_crew(company_id, profile_id));
create policy "office reads timesheets" on timesheets for select using (app.is_office(company_id));
create policy "employees submit own" on timesheets for insert with check (profile_id = app.my_profile_id() and status in ('open', 'submitted'));
create policy "employees update own open" on timesheets for update using (profile_id = app.my_profile_id() and status = 'open') with check (status = 'submitted');
create policy "foremen approve crew" on timesheets for update using (app.in_my_crew(company_id, profile_id)) with check (status in ('open', 'submitted', 'foreman_approved'));
create policy "office approves" on timesheets for all using (app.is_office(company_id)) with check (app.is_office(company_id));

create policy "read approvals of visible timesheets" on timesheet_approvals for select using (exists (select 1 from timesheets t where t.id = timesheet_id));
create policy "approvers record approvals" on timesheet_approvals for insert with check (by_profile_id = app.my_profile_id());

-- ── Audit ────────────────────────────────────────────────────────────────

create policy "office reads audit" on audit_log for select using (app.is_office(company_id));
create policy "members append audit" on audit_log for insert with check (app.is_member(company_id) and actor_id = app.my_profile_id());

-- ── Messaging ────────────────────────────────────────────────────────────

create policy "recipients read messages" on messages for select using (
  exists (select 1 from message_deliveries d where d.message_id = messages.id and d.profile_id = app.my_profile_id())
);
create policy "senders read sent" on messages for select using (app.is_office(company_id) or sender_id = app.my_profile_id());
create policy "office sends" on messages for insert with check (app.is_office(company_id) and sender_id = app.my_profile_id());
create policy "foremen message their crews" on messages for insert with check (
  sender_id = app.my_profile_id() and app.has_role(company_id, array['foreman']::app_role[])
  and audience_type in ('job', 'user') and (audience_job_id is null or app.leads_job(audience_job_id))
);

create policy "read own deliveries" on message_deliveries for select using (profile_id = app.my_profile_id());
create policy "senders read deliveries" on message_deliveries for select using (
  exists (select 1 from messages m where m.id = message_id and (m.sender_id = app.my_profile_id() or app.is_office(m.company_id)))
);
create policy "mark own read" on message_deliveries for update using (profile_id = app.my_profile_id()) with check (profile_id = app.my_profile_id());
create policy "senders create deliveries" on message_deliveries for insert with check (
  exists (select 1 from messages m where m.id = message_id and m.sender_id = app.my_profile_id())
);

create policy "own notification prefs" on notification_preferences for all using (profile_id = app.my_profile_id()) with check (profile_id = app.my_profile_id());

create policy "own push devices" on devices for all using (kind = 'push' and profile_id = app.my_profile_id()) with check (kind = 'push' and profile_id = app.my_profile_id());
create policy "admins and foremen manage kiosks" on devices for all using (kind = 'kiosk' and (app.is_admin(company_id) or app.leads_job(job_id)));

-- ── Integrations ─────────────────────────────────────────────────────────

create policy "admins manage integrations" on integration_connections for all using (app.is_admin(company_id)) with check (app.is_admin(company_id));
create policy "office reads integrations" on integration_connections for select using (app.is_office(company_id));
create policy "admins manage external ids" on external_ids for all using (app.is_admin(company_id)) with check (app.is_admin(company_id));
create policy "office reads external ids" on external_ids for select using (app.is_office(company_id));
create policy "office runs exports" on payroll_exports for all using (app.is_office(company_id)) with check (app.is_office(company_id));

-- ── RPCs (public schema so supabase.rpc() can call them) ─────────────────

-- Foremen change only the two site-mode columns, through this function.
create function public.set_site_modes(job uuid, new_offline offline_mode, new_gps gps_mode)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not (app.leads_job(job) or app.is_admin((select company_id from jobs where id = job))) then
    raise exception 'not allowed';
  end if;
  update jobs set offline_mode = new_offline, gps_mode = new_gps where id = job;
end $$;

create function public.record_location_consent(company uuid)
returns void language sql security definer set search_path = public as $$
  update memberships set location_consent_at = coalesce(location_consent_at, now())
  where company_id = company and profile_id = app.my_profile_id();
$$;

-- Policies call the app.* helpers as the signed-in role.
grant usage on schema app to authenticated, anon;
grant execute on all functions in schema app to authenticated;
