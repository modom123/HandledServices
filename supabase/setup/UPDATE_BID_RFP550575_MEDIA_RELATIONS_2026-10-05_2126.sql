-- ============================================================================
-- FILE    : supabase/setup/UPDATE_BID_RFP550575_MEDIA_RELATIONS_2026-10-05_2126.sql
-- PROJECT : Handled / IEBC — bid engine (Hub → Bids)
-- CREATED : 2026-10-05_2126 UTC
-- PURPOSE : Updates the City Council marketing bid to the real solicitation, City of Detroit RFP No. 550575
--           "Media Relation Services" (Councilwoman Johnson, District 4): number, buyer, dates, Bonfire submission,
--           the RFP's own checklist (Attachments A, B, C, D1, E; 5-year minimum; CRIO credits; data standards; AI
--           disclosure) and price lines matching the tailored proposal's Attachment C.
--           Creates the bid if the earlier ADD_BID_... script wasn't run. Unchecked checklist items and the old
--           price lines from that script are replaced; anything already checked off is kept.
--           NOTE: proposals were due September 30, 2026, 3:00 PM EST — check Bonfire for an extension.
-- ============================================================================
do $$
declare b uuid := 'b1d0c0de-0c0c-4a4e-9d10-202610050001';
begin
  insert into public.bids (id, title, source, status, created_by)
  values (b, 'Media Relation Services', 'city', 'draft', 'setup script')
  on conflict (id) do nothing;

  update public.bids set
    title = 'Media Relation Services — Councilwoman Johnson, District 4 (City Council)',
    agency = 'City of Detroit, Office of Contracting and Procurement (buyer: Shekia Sewell)',
    source = 'city', solicitation_type = 'rfp', solicitation_number = '550575', term_years = 3,
    link = 'https://detroit.bonfirehub.com',
    due_at = '2026-09-30T19:00:00Z',            -- 3:00 PM EDT
    questions_due_at = '2026-09-14T19:00:00Z',  -- 3:00 PM EDT
    submit_method = 'EUNA Bonfire only (detroit.bonfirehub.com), signed in the portal by an officer who can bind the company. Upload Attachments A, B, C, D1 (Certificate of Authority, Non-Collusion Affidavit, Affidavit of Disclosure of Interests) and agreement or exceptions to the model contract (E). Late or emailed proposals are not accepted.',
    notes = 'Proposals were due September 30, 2026 at 3:00 PM EST — check Bonfire for an extension or re-issue before working further. '
      || 'Scoring: qualifications/experience 50, marketing strategy 25, price 25, plus up to 10 Detroit equalization points (CRIO certificates required). '
      || 'Minimum qualification: 5 years providing these services — team with an established Detroit firm (joint venture +2). '
      || 'Tailored proposal: https://claude.ai/code/artifact/59a6b1dd-de06-4c41-8a3f-12e4832c3333 (PDF: docs/IEBC_PROPOSAL_RFP550575_MEDIA_RELATIONS_2026-10-05_2125.pdf). '
      || 'Draft price: $70,500/yr at estimated volume, not-to-exceed $212,000 for 3 years; printing and promo production at cost.',
    updated_at = now()
  where id = b;

  delete from public.bid_requirements where bid_id = b and done = false;
  delete from public.bid_cost_lines where bid_id = b;

  insert into public.bid_requirements (bid_id, kind, text, source_ref, required, origin, sort) values
    (b, 'deadline', 'Proposal due September 30, 2026, 3:00 PM EST in EUNA Bonfire — confirm whether an addendum extended it', 'Cover page, 4.5', true, 'manual', 0),
    (b, 'eligibility', 'Minimum 5 years providing the requested services on projects of similar scope and size (team with an established firm if needed)', '3.1', true, 'manual', 1),
    (b, 'eligibility', 'Registered in EUNA Bonfire and the City of Detroit supplier / Oracle vendor portal', 'Cover, 5.3', true, 'manual', 2),
    (b, 'eligibility', 'City income tax and property tax clearances current', null, true, 'standard', 3),
    (b, 'attachment', 'CRIO certificates (Detroit Headquartered / Resident / Micro) for IEBC and Detroit subcontractors uploaded with the bid for equalization credits', '3.4', false, 'manual', 4),
    (b, 'form', 'Attachment A — Respondent Questionnaire complete (contacts, background, AI disclosure item r, Priority Hire answer)', '4.2 (1)', true, 'manual', 5),
    (b, 'attachment', 'Attachment A — three references from the last 5 years, similar size and scope', 'Att. A', true, 'manual', 6),
    (b, 'attachment', 'Attachment A — subcontractor details and reference form, debarment check done', 'Att. A', true, 'manual', 7),
    (b, 'attachment', 'Attachment A Part 2 — organization chart and a resume for each key person', 'Att. A Part 2', true, 'manual', 8),
    (b, 'form', 'Attachment B — introduction with the 120-day firm offer, firm description, commitment, licenses / registrations', 'Att. B', true, 'manual', 9),
    (b, 'requirement', 'Attachment B — solution and approach answering every Section 2.1 item (newsletter, digital newsletter, calendar, flyers, promo items, social / e-blast, PR statements, talking points, brochures, process tasks)', '2.1, Att. B', true, 'manual', 10),
    (b, 'requirement', 'Show knowledge of Councilwoman Johnson''s brand, priorities and District 4 positions with real examples', '2.1', true, 'manual', 11),
    (b, 'requirement', 'Attachment B — preliminary project schedule with completion dates', 'Att. B', true, 'manual', 12),
    (b, 'requirement', 'Attachment B — technical approach (procedures) incl. City data standards: machine-readable data access, documented JSON API, City may port and govern data', '2.3, Att. B', false, 'manual', 13),
    (b, 'requirement', 'AI disclosure: how AI is used, human review, no residents'' personal data in AI tools', '5.7, Att. A (r)', true, 'manual', 14),
    (b, 'price_form', 'Attachment C — firm, not-to-exceed pricing with hourly rates by staff type and deliverable prices; totals rechecked', '4.3, Att. C', true, 'manual', 15),
    (b, 'form', 'D1 — Certificate of Authority (matching entity type), signed', 'Att. D1', true, 'manual', 16),
    (b, 'form', 'D1 — Non-Collusion Affidavit, signed and notarized', 'Att. D1', true, 'manual', 17),
    (b, 'form', 'D1 — Affidavit of Disclosure of Interests, signed and notarized', 'Att. D1', true, 'manual', 18),
    (b, 'form', 'Attachment E — agreement to the model Professional Services Contract, or exceptions listed', '4.2 (6)', true, 'manual', 19),
    (b, 'insurance', 'If awarded (D2): certificate of insurance at the model contract limits, insurer registered with Michigan DIFS', 'Att. D2', false, 'manual', 20),
    (b, 'form', 'Every addendum acknowledged; answers to questions (posted Sept 16) reviewed', '3.3', true, 'manual', 21),
    (b, 'form', 'Internal notes and the job-application cover letter removed; one phone number on every form', null, true, 'manual', 22),
    (b, 'evaluation', 'Scored: qualifications and experience 50, marketing strategy 25, price 25, + up to 10 equalization points; oral presentation possible', '3.4–3.6', false, 'manual', 23);

  insert into public.bid_cost_lines (bid_id, item, unit, qty, years, pro_unit_cost, sort) values
    (b, 'District newsletter, up to 8 pages (print-ready)', 'issue', 4, 3, null, 0),
    (b, 'Digital / e-mail version of the newsletter', 'issue', 4, 3, null, 1),
    (b, 'Yearly calendar', 'each', 1, 3, null, 2),
    (b, 'Flyer (one page, print and digital)', 'each', 24, 3, null, 3),
    (b, 'Event handout brochure', 'each', 6, 3, null, 4),
    (b, 'Promotional item or sign design', 'design', 8, 3, null, 5),
    (b, 'Vehicle wrap design', 'each', 1, 3, null, 6),
    (b, 'Social media and e-blast package', 'month', 12, 3, null, 7),
    (b, 'PR messaging statement', 'each', 12, 3, null, 8),
    (b, 'Talking points / messaging guidance', 'each', 12, 3, null, 9),
    (b, 'Strategy, brand stewardship and campaign planning (10 hrs)', 'month', 12, 3, null, 10),
    (b, 'On-site attendance at district programs', 'hour', 60, 3, null, 11);
end $$;
