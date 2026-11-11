<!--
FILE    : docs/PROPOSAL_WRITER_GUIDE_2026-11-06_0400.md
PROJECT : Handled (HandledServices) / IEBC — government bids
CREATED : 2026-11-06_0400 UTC
PURPOSE : How to go from a SAM.gov opportunity to a submitted proposal with AI help (Hub → Bids), and how to clear
          out opportunities that aren't a fit.
-->

# From SAM.gov opportunity to submitted proposal, with AI help

## One-time setup (5 minutes)
1. **Run the SQL.** In Supabase, open **SQL Editor → New query**, paste `supabase/setup/ADD_BID_PROPOSALS_2026-11-06_0400.sql`, and press **Run**. It's safe to run twice.
2. **Run the Gov contracts search once more.** The search now saves each notice's attachment links. Your 37 existing notices get theirs on this run.
3. **Fill in a bidding profile.** Go to **Hub → Bids → Bidding profiles**. An "IEBC — AI automation" profile is already there. Add:
   - UEI, CAGE code, address and point of contact
   - certifications you actually hold
   - **real** past performance: customer, dates, value, what you did, results, reference
   - **real** key people

   The AI uses only these facts. If a fact is missing, it leaves a yellow `[[NEEDS: …]]` note instead of making something up.

## Clear out opportunities that aren't a fit
Go to **Hub → Bids → Find federal (SAM.gov)**:
- **✕ Not a fit** on a row moves that notice to the **Passed** tab. The daily search never brings it back.
- **Do several at once:** tick the boxes (or *Select all*), then press **✕ Not a fit**. You can add a reason, such as "outside Michigan" or "needs a clearance".
- **Changed your mind?** Open **Passed** and press **↩ Restore**. The notice goes back to New.
- **Delete for good:** open **Passed**, tick the notices, and press **🗑 Delete for good**. They're erased, and their notice IDs are remembered so a future search can't add them back.
- A notice's own page also has **✕ Not a fit** and **🗑 Delete** buttons.
- Notices with a bid in progress or a result can't be removed. Cancel the bid first.

## Bid on one
1. **Open the notice and press _Start a bid_.** The bid opens in Hub → Bids with the details filled in.
2. **2. Documents → ⬇ Pull the attachments from SAM.gov.** The SOW, Section L/M, price forms and amendments are downloaded into the bid. Each file uses one SAM.gov API call. Then press **Read the solicitation into the matrix**. The AI also reads the notice text.
   - Word and Excel attachments are stored, but the AI reads only PDFs and images. Save Word and Excel files as PDF and upload them if the AI needs to read them.
3. **1. Go / no-go.** Answer it honestly. Any "no" stops the bid.
4. **3b. Proposal — AI writer:**
   1. **Bidding as:** pick the profile (IEBC for AI automation, Handled for services).
   2. **✨ Build the outline with AI.** It follows the solicitation's own instructions (Section L, "proposal format"), in the agency's order and with its names. It assigns every compliance item to a section and notes page limits and format rules.
   3. **✨ Draft all empty sections.** The AI writes them one at a time, from the solicitation and your profile.
   4. **For each section:**
      - Fill the yellow `[[NEEDS]]` items.
      - Edit the text.
      - To redo a section, type an instruction for the AI ("shorter", "lead with the 30-day pilot") and press **Rewrite with AI**.
      - Press **✅ Approve**. Approval is blocked while any `[[NEEDS]]` item is left.
   5. **🔍 AI evaluator review.** The AI reads the draft like the agency's evaluation panel would. It lists unsupported or risky claims, requirements you haven't clearly answered, weak spots with fixes, and format problems. Fix them, then run it again.
   6. **🖨 Print / save the proposal as PDF.** You get a cover page, contents, every section, and a compliance cross-reference table. A yellow banner warns you if anything is unfinished.
5. **4. Pricing.** Fill this in for RFQs and RFPs. RFIs and sources-sought responses don't need a price.
   - For work IEBC does itself, enter IEBC's own cost per unit as the line's cost.
6. **6. Review & submit:**
   1. A second person signs off on the review.
   2. Submit exactly as the solicitation says (email, PIEE, a portal), at least one business day early.
   3. Upload the confirmation and press **Mark submitted**.
   4. The submitted proposal text is frozen in the submission record.

## What blocks submission
A bid can't be marked submitted until all of these are true:
- Every proposal section is written.
- No `[[NEEDS]]` item is left.
- Every section is approved.
- Everything that was already required before: go / no-go, compliance matrix, pricing (except RFIs and sources-sought), review sign-off, and the confirmation upload.

Any edit to the proposal clears the review sign-off.

## What the AI will and won't do
- **It will:** follow the solicitation's structure, mirror its wording, answer each requirement, and keep sections consistent with each other.
- **It won't:**
  - invent past performance, customers, contract values, people, certifications (FedRAMP, CMMC, SOC 2…) or prices
  - present AI agents as staff
  - submit anything for you

  A person approves every section and submits the proposal.
- **Treat the evaluator review as a second opinion.** Michigan's APEX Accelerator reviews proposals for free. Use them on the first few bids.
