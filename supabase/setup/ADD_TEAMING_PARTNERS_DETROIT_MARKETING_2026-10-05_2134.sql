-- ============================================================================
-- FILE    : supabase/setup/ADD_TEAMING_PARTNERS_DETROIT_MARKETING_2026-10-05_2134.sql
-- PROJECT : Handled / IEBC — Hub → Business leads → Teaming partners
-- CREATED : 2026-10-05_2134 UTC
-- PURPOSE : Adds seven Detroit marketing / PR firms as teaming partners for City of Detroit communications bids
--           (RFP 550575 and its re-issues). Status "to contact"; no email addresses stored, so nothing can be sent
--           automatically — send the drafted partnership emails from your own mailbox and update the status.
--           Firm details came from web search results: confirm each on the firm's own site.
--           Run once in Supabase → SQL Editor. Safe to run twice.
-- UPDATED : 2026-10-05_2141 UTC — also starts each partner's permanent notes history (account_notes) with its note.
-- ============================================================================
alter table public.biz_leads drop constraint if exists biz_leads_segment_check;
alter table public.biz_leads add constraint biz_leads_segment_check
  check (segment in ('property_manager','real_estate','stager','storage','retail','facilities','partner'));

insert into public.biz_leads (source, external_id, business_name, segment, city, website, score, status, notes) values
  ('manual', 'partner:mcconnell-communications', 'McConnell Communications', 'partner', 'Detroit', 'https://www.dmcconnell.com', 95, 'call',
   'First call. Represents elected officials; newsletters, brochures; social media for government entities — closest fit to council-office work. Email #1 drafted.'),
  ('manual', 'partner:allen-lewis-agency', 'The Allen Lewis Agency', 'partner', 'Detroit', 'https://theallenlewisagency.com', 90, 'call',
   'Full-service marketing, grassroots engagement; clients reported to include Detroit Water and Sewerage Department and DPSCD Foundation. Email #2 drafted.'),
  ('manual', 'partner:milo-agency', 'MILO Agency', 'partner', 'Detroit', null, 80, 'call',
   'Black-owned, Detroit-headquartered full-service agency; government and nonprofit clients (e.g. Wayne State). Find website and contact. Email #3 drafted.'),
  ('manual', 'partner:98forward', '98Forward', 'partner', 'Michigan', null, 80, 'call',
   'Reported as Michigan''s largest Black-owned, women-led PR agency; 200+ clients. Find website and contact. Email #4 drafted.'),
  ('manual', 'partner:lovio-george', 'Lovio George', 'partner', 'Detroit (Midtown)', 'https://www.loviogeorge.com', 75, 'call',
   'Branding, design, marketing and PR in Midtown for ~30 years — strong design and print partner. Email #5 drafted.'),
  ('manual', 'partner:impact-digital-marketing', 'IMPACT Digital Marketing', 'partner', 'Detroit', 'https://impactdms.com', 70, 'call',
   'Woman-owned, Detroit-headquartered; 10+ years across private and public sectors; government marketing practice. Email #6 drafted.'),
  ('manual', 'partner:marx-layne', 'Marx Layne & Company', 'partner', 'Metro Detroit', 'https://www.marxlayne.com', 60, 'call',
   'Backup. 35+ years of communications for business, government and nonprofit clients; larger firm — pitch IEBC as production subcontractor. Email #7 drafted.')
on conflict (source, external_id) do nothing;

-- start each partner's history with its note (when the account-notes table exists)
do $$
begin
  if to_regclass('public.account_notes') is not null then
    insert into public.account_notes (subject_type, subject_id, kind, body, author)
    select 'biz_lead', l.id, 'note', l.notes, 'setup script'
    from public.biz_leads l
    where l.segment = 'partner' and l.notes is not null
      and not exists (select 1 from public.account_notes n where n.subject_type = 'biz_lead' and n.subject_id = l.id);
  end if;
end $$;
