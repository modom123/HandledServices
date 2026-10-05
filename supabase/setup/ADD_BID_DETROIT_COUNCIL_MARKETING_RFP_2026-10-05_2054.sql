-- ============================================================================
-- FILE    : supabase/setup/ADD_BID_DETROIT_COUNCIL_MARKETING_RFP_2026-10-05_2054.sql
-- PROJECT : Handled / IEBC — bid engine (Hub → Bids)
-- CREATED : 2026-10-05_2054 UTC
-- PURPOSE : Adds the City of Detroit RFP "Marketing and Communication Consulting Services" (on behalf of the
--           City Council, 3-year term) to the bid engine as a draft: details, the standard City checklist plus this
--           RFP's own items, and the fee lines from the draft proposal (pro / partner cost left blank to fill in).
--           Run once in Supabase → SQL Editor, after the bid-engine and archive migrations. Safe to run twice
--           (does nothing if the bid already exists).
--           Then in Hub → Bids → open it → Documents: upload the RFP package and the draft proposal
--           (docs/IEBC_PROPOSAL_DETROIT_COUNCIL_MARKETING_2026-10-05_2054.pdf) as "Our draft response".
-- ============================================================================
do $$
declare b uuid := 'b1d0c0de-0c0c-4a4e-9d10-202610050001';
begin
  if exists (select 1 from public.bids where id = b) then
    raise notice 'Bid already added — nothing to do.';
    return;
  end if;

  insert into public.bids (id, title, agency, source, solicitation_type, term_years, status, created_by, notes)
  values (b,
    'Marketing and Communication Consulting Services — City Council',
    'City of Detroit, Office of Contracting and Procurement (for the City Council)',
    'city', 'rfp', 3, 'draft', 'setup script',
    'Bidding as IEBC (Integrated Efficiency Business Consultants). Scope: strategy, media plan and consulting services, 3 years. '
    || 'Draft proposal: https://claude.ai/code/artifact/59a6b1dd-de06-4c41-8a3f-12e4832c3333 (PDF in docs/IEBC_PROPOSAL_DETROIT_COUNCIL_MARKETING_2026-10-05_2054.pdf). '
    || 'Draft fees: discovery/audit $19,000 + strategy/media plan $19,000 (fixed), retainer $7,500/month months 5–36, training $2,500 x 2/yr = $293,000 over 3 years plus pass-through media at cost. '
    || 'Fill in the RFP number, due date, questions deadline and submit method in Details; enter IEBC and partner cost per unit in Pricing to check the margin.');

  -- standard City of Detroit checklist (same as the bid engine adds for a city bid)
  insert into public.bid_requirements (bid_id, kind, text, origin, sort) values
    (b, 'eligibility', 'Approved for the schedule / prequalified vendor list the solicitation requires', 'standard', 0),
    (b, 'eligibility', 'Supplier portal registration current', 'standard', 1),
    (b, 'eligibility', 'City income tax and property tax clearances current', 'standard', 2),
    (b, 'form', 'City affidavits and disclosures in the package (equal opportunity, hiring policy, political contributions, other city-code disclosures)', 'standard', 3),
    (b, 'attachment', 'Local business certification (e.g. Detroit-Based / Headquartered Business) attached if held', 'standard', 4),
    (b, 'form', 'Every page / form that asks for a signature is signed and dated by an authorized officer', 'standard', 5),
    (b, 'form', 'Every addendum acknowledged (signed acknowledgment or as the solicitation says)', 'standard', 6),
    (b, 'price_form', 'Prices entered on the agency''s own price form, in its units, totals rechecked', 'standard', 7),
    (b, 'insurance', 'Certificate of insurance meets every limit and names the agency as additional insured (as required)', 'standard', 8),
    (b, 'attachment', 'References and any required past-performance, staffing or subcontractor lists attached', 'standard', 9),
    (b, 'deadline', 'Response uploaded at least one business day before the deadline; confirmation saved', 'standard', 10);

  -- this RFP's own items (from the draft proposal's checklist)
  insert into public.bid_requirements (bid_id, kind, text, required, origin, sort) values
    (b, 'requirement', 'Proposal follows the RFP''s required outline, page limits and format', true, 'manual', 100),
    (b, 'requirement', 'Approach covers all three asks: communications strategy, media plan, and ongoing consulting for the 3-year term', true, 'manual', 101),
    (b, 'attachment', 'Resumes for every named team member and partner (media planner/buyer, public affairs/PR, creative/content, community engagement, translation)', true, 'manual', 102),
    (b, 'attachment', 'Three references for marketing / communications work (IEBC or partners), each agreed to be called', true, 'manual', 103),
    (b, 'requirement', 'Fee proposal: fixed fees, monthly retainer, hourly rates and pass-through costs at cost — checked against costs and partner quotes', true, 'manual', 104),
    (b, 'requirement', 'One phone number and one experience story across every document (resume, capabilities sheet, proposal)', true, 'manual', 105),
    (b, 'requirement', 'Claims in the proposal can be backed up (e.g. "50+ AI agents", "22 hours/week saved per client")', true, 'manual', 106),
    (b, 'form', 'Internal "Before you submit" section and the job-application cover letter removed from the package', true, 'manual', 107),
    (b, 'question', 'Ask the buyer: expected budget or prior award amount for this work', false, 'manual', 108),
    (b, 'question', 'Ask the buyer: which languages resident materials must be in', false, 'manual', 109),
    (b, 'question', 'Ask the buyer: is paid media bought through the consultant or directly by the City?', false, 'manual', 110),
    (b, 'evaluation', 'Find the evaluation criteria and weights in the RFP and make sure each one is answered clearly', false, 'manual', 111);

  -- fee lines from the draft proposal (pro_unit_cost = IEBC + partner cost per unit, to fill in)
  insert into public.bid_cost_lines (bid_id, item, unit, qty, years, pro_unit_cost, sort) values
    (b, 'Discovery, audit and resident input (weeks 1–8)', 'fixed fee', 1, 1, null, 0),
    (b, 'Strategy and media plan (weeks 8–16)', 'fixed fee', 1, 1, null, 1),
    (b, 'Ongoing consulting retainer, up to 50 hours a month (months 5–36)', 'month', 32, 1, null, 2),
    (b, 'Media and spokesperson training', 'session', 2, 3, null, 3);
end $$;
