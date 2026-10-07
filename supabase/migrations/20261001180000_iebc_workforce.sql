-- ============================================================================
-- FILE    : supabase/migrations/20261001180000_iebc_workforce.sql
-- PROJECT : Handled (HandledServices) — AI-run home & business services
-- CREATED : 2026-10-01_1800 UTC
-- PURPOSE : IEBC Workforce integration. IEBC's AI employees (from the IEBC MasterHub
--           workforce roster) are assigned to departments of this business. Each
--           assignment lists the scopes the agent may use and an autonomy level:
--             suggest     — every write is a proposal a human must approve
--             approval    — same as suggest, labeled as delegated work awaiting sign-off
--             autonomous  — low-risk writes run immediately; high-risk still need approval
--           Every call is recorded in agent_actions (the audit log + approval queue).
-- ============================================================================

create table public.iebc_agents (
  id uuid primary key default gen_random_uuid(),
  iebc_employee_id text not null unique,   -- matches the id in the MasterHub workforce roster
  name text not null,
  title text not null,
  iebc_dept text not null,
  role_here text not null,                 -- what they run for this business
  scopes text[] not null default '{}',
  autonomy text not null default 'approval' check (autonomy in ('suggest','approval','autonomous')),
  active boolean not null default true,
  last_seen_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.agent_actions (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid references public.iebc_agents(id) on delete set null,
  action text not null,
  params jsonb not null default '{}',
  reason text,                             -- the agent's stated rationale
  status text not null check (status in ('executed','pending_approval','rejected','failed','denied')),
  result jsonb,
  decided_by text,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);
create index agent_actions_status_idx on public.agent_actions(status, created_at desc);

alter table public.iebc_agents enable row level security;
alter table public.agent_actions enable row level security;
create policy staff_all on public.iebc_agents for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy staff_all on public.agent_actions for all to authenticated using (public.is_staff()) with check (public.is_staff());

alter publication supabase_realtime add table public.agent_actions;

-- Default staffing plan — edit in the Command Center → IEBC Workforce.
insert into public.iebc_agents (iebc_employee_id, name, title, iebc_dept, role_here, scopes, autonomy) values
  ('evelyn',   'Dr. Evelyn Sterling', 'Chief Operating Officer',     'Operations', 'Executive oversight & escalations',
     array['read'], 'suggest'),
  ('arthur',   'Arthur Vance',        'VP Global Operations',        'Operations', 'Dispatch & daily operations',
     array['read','ops'], 'autonomous'),
  ('katerina', 'Katerina Rostova',    'Head of Process Auto',        'Operations', 'Pipeline hygiene & stuck-job sweeps',
     array['read','ops'], 'approval'),
  ('eleanor',  'Eleanor Wei',         'Chief Financial Officer',     'Finance',    'Unit economics, pricing & payouts',
     array['read','finance'], 'approval'),
  ('tylerw',   'Tyler Walsh',         'VP Talent Acquisition',       'Recruiting', 'Subcontractor recruiting & screening',
     array['read','recruiting'], 'approval'),
  ('marcushr', 'Marcus Hill',         'Head of HR & Compliance',     'Recruiting', 'Pro compliance: insurance & background checks',
     array['read','recruiting'], 'approval'),
  ('diego',    'Diego Martinez',      'Dir. Automated Client Care',  'Retention',  'Customer care, reviews & win-back',
     array['read','retention'], 'autonomous'),
  ('elenam',   'Elena Markov',        'Head of Global Accounts',     'Sales',      'Commercial (B2B) accounts',
     array['read','sales'], 'approval'),
  ('clara',    'Clara Dubois',        'Global Head Lead Gen',        'Outreach',   'Lead capture & follow-up',
     array['read','sales'], 'autonomous');
