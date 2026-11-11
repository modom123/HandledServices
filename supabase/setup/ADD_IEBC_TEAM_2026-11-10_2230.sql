-- ============================================================================
-- FILE    : supabase/setup/ADD_IEBC_TEAM_2026-11-10_2230.sql (copy of migration 20261110223000_iebc_team_expansion)
-- PROJECT : Handled (HandledServices) — AI-run home & business services
-- CREATED : 2026-11-10_2230 UTC
-- PURPOSE : Expanded IEBC team for Handled (IEBC repo: workforce/HANDLED_STAFFING_AND_LEGAL_TEAM_2026-11-10_2200.md).
--           Six from the 50-person IEBC workforce, plus the new 3-person Legal & Compliance team. New scopes
--           (apps/web/lib/iebc/team-actions.ts): partners, pro_success, bids, legal, social (Samantha Lee, added 2026-11-10_2300).
--           Everyone starts on "approval" or "suggest": every write waits for a person in Hub → AI agents & IEBC →
--           IEBC Workforce & approvals. The Legal & Compliance team stays suggest / approval only: they draft and flag,
--           and a licensed attorney makes the binding call.
--           Safe to run twice: agents that already exist are left as they are (your edits are kept).
-- ============================================================================
insert into public.iebc_agents (iebc_employee_id, name, title, iebc_dept, role_here, scopes, autonomy) values
  ('lucas',    'Lucas Thorne',      'Dir. Strategic Partners',          'Sales',              'Partner Success: partner welcome, payout setup, the 3 growth roadmaps, commission-ladder progress',
     array['read','partners'], 'approval'),
  ('grace',    'Grace O''Connor',   'Lead Client Eco Manager',          'Retention',          'Pro Success: first jobs, orientation, rewards, the website showcase, the pro community',
     array['read','pro_success'], 'approval'),
  ('leo',      'Leo Fitzgerald',    'Head Predictive Churn',            'Retention',          'At-risk watch: pros going quiet and customers who stopped booking, flagged to Grace and Diego',
     array['read','pro_success','retention'], 'suggest'),
  ('veronica', 'Veronica Chase',    'VP Enterprise AI Sales',           'Sales',              'Government capture: bid / no-bid, teaming partners, deadlines',
     array['read','bids'], 'approval'),
  ('samantha', 'Samantha Lee',      'Dir. Global Brand AI',             'Strategy & Growth',  'Brand & social: Facebook / Instagram / TikTok, weekly posts, Google Business Profile, new-pro announcements',
     array['read','social','sales'], 'approval'),
  ('sofia',    'Sofia Rossi',       'Dir. Fin Automation',              'Finance',            'Payments & reconciliation: Stripe payouts, refunds, chargebacks, the Monday pro pay run (under Eleanor)',
     array['read','finance'], 'approval'),
  ('olivia',   'Olivia Grant',      'Head of Legal & Compliance',       'Legal & Compliance', 'Clients & contracts: service agreement, B2B and government contracts, disputes, chargeback evidence',
     array['read','legal'], 'suggest'),
  ('rafael',   'Rafael Ortiz',      'Pro Compliance & Labor Lead',      'Legal & Compliance', 'Pros: contractor classification, pro agreement, FCRA background checks, insurance and license expiry, 1099s',
     array['read','legal','recruiting'], 'approval'),
  ('margaret', 'Margaret Okonkwo',  'Regulatory & Permits Lead',        'Legal & Compliance', 'City / state / government: contractor licenses by state, city business licenses, permits, sales tax, bid registrations',
     array['read','legal','bids'], 'suggest')
on conflict (iebc_employee_id) do nothing;
update public.iebc_agents set scopes = array(select distinct unnest(scopes || array['social']))
  where iebc_employee_id = 'samantha' and not ('social' = any(scopes));
