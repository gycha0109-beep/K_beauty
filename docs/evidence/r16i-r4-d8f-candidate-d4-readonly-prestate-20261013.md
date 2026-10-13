# R16I-R4-D8F — candidate DB exact D4 prestate read-only replay (2026-10-13)

## Scope
- This is an **offline recheck of an observed connected Supabase candidate database**; not proof that the deployed Vercel server uses the same database.
- The original R16I target is at its prior immutable product revision, 160 ml, price_min/max 29,900 KRW and the Hwahae #45194 bundle link; no approved 80ml single price. Product and 176-row candidate catalog state are separate from an actually attested deployed recommendation source.
- Read-only SELECT observed: 1 Product, 1 source Binding, 1 catalog trust Intake, 0 Product Offers (including seller listing URL collision checks), 0 Product Fact Subjects, 0 admin correction applications, release gate disabled.
- Actual observational fixture: `fixtures/recommendation-metadata/r16i-d8f-candidate-d4-readonly-prestate-20261013.json` (contains selected nonsecret catalog/identity fields and observation time from linked DB).
- All data were retrieved using connected Supabase read-only SQL; no DDL, permission modification, release gate changes or production Product/Offer changes.

## Exact in-memory contract verification
- Existing `buildR16IR4D4LiveReview` from `lib/product-offer-r16i-r4-d4-live-review.mjs` will receive an independent read-only candidate DB SELECT-equivalent snapshot. Expected valid result: `REVIEW_REQUIRED` with 20 per-field owner decisions pending, no price or seller option approved, no `write_set`, no executable SQL, Offer price null, `release_ready=false`.
- New script `scripts/product-evidence/verify-r16i-r4-d8f-candidate-d4-readonly-prestate.mjs` checks baseline and 15 **synthetic mutation negatives**: product revised, size/price/unit price/buy link/reviews/identity tampering, Binding source/revision drift, Intake authorization/subject mutation, Offer or Subject collision, incomplete SELECT, invalid timestamp.
- Failed input must produce exact blocking reason and zero write or recommendation authority. Real database never receives the synthetic mutations.
- Runs in the existing Database Integration Authority CI job, which has Node and npm dependencies. No extra workflow.
- CI outcome to be read at exact PR SHA, not inferred from the checked-in file.

## Outstanding gates
- **D8F remains HOLD**: no actual official 80ml checkout screenshot, no Hwahae selected bundle option/checkout proof, gift serum SKU and review scope not verified, and no owner verdict/field approvals.
- Deployed runtime DB identity still NOT_ATTESTED; Vercel env inventory read denied 403 previously, and candidate Supabase SELECT is not the same proof.
- Security #1208 still open. D8G & D8H untouched. Product/Offer/Subject production writes 0; release gate stays disabled; no PR merge on red security.
