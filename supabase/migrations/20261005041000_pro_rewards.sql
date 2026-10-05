-- ============================================================================
-- FILE    : supabase/migrations/20261005041000_pro_rewards.sql
-- PROJECT : Handled (myhumanai) — AI-run home & business services
-- CREATED : 2026-10-05_0418 UTC
-- PURPOSE : Handled Pro Rewards (packages/core/src/rewards.ts) — loyalty points for independent pros.
--             • reward_settings     — earn rate, point value, pending days… (Hub → Rewards)
--             • reward_ledger       — every point movement: earn (per job, pending → available), milestone,
--                                     redeem (negative), return (cancelled order), adjust, expire, forfeit
--             • reward_catalog      — what points buy (gear, gift cards, tools, electronics, trips); starter items below
--             • reward_redemptions  — orders: requested → approved → ordered → shipped → delivered (or cancelled);
--                                     fair market value goes on the pro's 1099 for the year it's delivered
--             • reward_balances     — view: available and pending points per pro
--           Pros read their own ledger and orders; the catalog is readable by signed-in users; writes go through the API.
-- ============================================================================
create table if not exists public.reward_settings (
  id int primary key default 1 check (id = 1),
  settings jsonb not null default '{}'::jsonb,
  updated_by text,
  updated_at timestamptz not null default now()
);
alter table public.reward_settings enable row level security;
create policy staff_all on public.reward_settings for all to authenticated using (public.is_staff()) with check (public.is_staff());

create table if not exists public.reward_ledger (
  id uuid primary key default gen_random_uuid(),
  contractor_id uuid not null references public.contractors(id) on delete cascade,
  kind text not null check (kind in ('earn','milestone','redeem','return','adjust','expire','forfeit')),
  points int not null,
  status text not null default 'available' check (status in ('pending','available','void')),
  job_id uuid references public.jobs(id) on delete set null,
  redemption_id uuid,
  milestone text,
  available_at timestamptz,
  detail jsonb,
  note text,
  created_by text not null default 'system',
  created_at timestamptz not null default now()
);
create unique index if not exists reward_ledger_job_uniq on public.reward_ledger (contractor_id, job_id) where kind = 'earn';
create unique index if not exists reward_ledger_milestone_uniq on public.reward_ledger (contractor_id, milestone) where kind = 'milestone';
create index if not exists reward_ledger_pro_idx on public.reward_ledger (contractor_id, created_at desc);
create index if not exists reward_ledger_pending_idx on public.reward_ledger (available_at) where status = 'pending';
alter table public.reward_ledger enable row level security;
create policy "pro reads own rewards" on public.reward_ledger for select to authenticated using (contractor_id = public.my_contractor_id());
create policy staff_all on public.reward_ledger for all to authenticated using (public.is_staff()) with check (public.is_staff());

create table if not exists public.reward_catalog (
  id uuid primary key default gen_random_uuid(),
  slug text unique,
  name text not null,
  name_es text,
  category text not null check (category in ('merch','gift_card','tools','electronics','travel','experience')),
  points int not null check (points > 0),
  cost_usd numeric(10,2) not null check (cost_usd >= 0),
  description text,
  description_es text,
  image_url text,
  stock int check (stock is null or stock >= 0),
  active boolean not null default true,
  sort int not null default 0,
  created_at timestamptz not null default now()
);
alter table public.reward_catalog enable row level security;
create policy "signed-in users read the catalog" on public.reward_catalog for select to authenticated using (active or public.is_staff());
create policy staff_all on public.reward_catalog for all to authenticated using (public.is_staff()) with check (public.is_staff());
insert into public.reward_catalog (slug, name, name_es, category, points, cost_usd, description, description_es, sort) values
  ('hat', 'Handled hat', 'Gorra Handled', 'merch', 2500, 25, 'Embroidered cap.', 'Gorra bordada.', 0),
  ('tee', 'Handled T-shirt', 'Camiseta Handled', 'merch', 2500, 25, 'Heavyweight cotton tee.', 'Camiseta de algodón grueso.', 10),
  ('hoodie', 'Handled hoodie', 'Sudadera Handled', 'merch', 6000, 60, 'Warm pullover hoodie.', 'Sudadera cálida con capucha.', 20),
  ('jacket', 'Handled work jacket', 'Chamarra de trabajo Handled', 'merch', 12000, 120, 'Insulated, water-resistant.', 'Aislada y resistente al agua.', 30),
  ('gas-50', '$50 gas card', 'Tarjeta de gasolina de $50', 'gift_card', 5000, 50, 'For the miles you drive.', 'Para las millas que maneja.', 40),
  ('tools-100', '$100 tool store gift card', 'Tarjeta de regalo de $100 para ferretería', 'gift_card', 10000, 100, 'Home-improvement store gift card.', 'Tarjeta de una tienda de mejoras para el hogar.', 50),
  ('drill-kit', 'Cordless drill & driver kit', 'Kit de taladro y atornillador inalámbrico', 'tools', 20000, 200, 'Brushless, two batteries.', 'Sin escobillas, dos baterías.', 60),
  ('earbuds', 'Wireless earbuds', 'Audífonos inalámbricos', 'electronics', 15000, 150, 'Noise-cancelling.', 'Con cancelación de ruido.', 70),
  ('tv-55', '55" 4K TV', 'Televisión 4K de 55"', 'electronics', 45000, 450, 'Smart TV, delivered.', 'Smart TV, con entrega.', 80),
  ('tablet', 'Tablet', 'Tableta', 'electronics', 35000, 350, 'For quotes, photos and the app.', 'Para cotizaciones, fotos y la app.', 90),
  ('game-day', 'Detroit game-day tickets (2)', 'Boletos para un partido en Detroit (2)', 'experience', 30000, 300, 'Two tickets to a home game.', 'Dos boletos para un partido en casa.', 100),
  ('weekend-trip', 'Weekend getaway (2 nights)', 'Escapada de fin de semana (2 noches)', 'travel', 90000, 900, 'Hotel for two nights in Michigan or nearby.', 'Hotel por dos noches en Michigan o cerca.', 110),
  ('trip-for-two', '4-day trip for two', 'Viaje de 4 días para dos', 'travel', 200000, 2000, 'Flights and hotel, booked with you.', 'Vuelos y hotel, reservados con usted.', 120)
on conflict (slug) do nothing;

create table if not exists public.reward_redemptions (
  id uuid primary key default gen_random_uuid(),
  contractor_id uuid not null references public.contractors(id) on delete cascade,
  item_id uuid references public.reward_catalog(id) on delete set null,
  item_name text not null,
  points int not null check (points > 0),
  fmv_usd numeric(10,2) not null check (fmv_usd >= 0),
  status text not null default 'requested' check (status in ('requested','approved','ordered','shipped','delivered','cancelled')),
  ship_to jsonb,
  tracking text,
  note text,
  delivered_at timestamptz,
  tax_year int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists reward_redemptions_status_idx on public.reward_redemptions (status, created_at);
alter table public.reward_redemptions enable row level security;
create policy "pro reads own orders" on public.reward_redemptions for select to authenticated using (contractor_id = public.my_contractor_id());
create policy staff_all on public.reward_redemptions for all to authenticated using (public.is_staff()) with check (public.is_staff());

create or replace view public.reward_balances with (security_invoker = true) as
select contractor_id,
  coalesce(sum(points) filter (where status = 'available'), 0)::int as available,
  coalesce(sum(points) filter (where status = 'pending'), 0)::int as pending,
  coalesce(sum(points) filter (where kind in ('earn','milestone') and status <> 'void'), 0)::int as lifetime
from public.reward_ledger group by contractor_id;
