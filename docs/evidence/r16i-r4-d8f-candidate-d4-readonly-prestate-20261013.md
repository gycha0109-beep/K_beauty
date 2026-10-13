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

## 2026-10-13 supplemental public-seller drift negatives

- Public seller indexing of the official manufacturer 80ml single displays standard **35,000 KRW** and member-labeled **24,500 KRW**. Hwahae listing #45194 describes **80ml×2 + 10ml serum** and displays **29,900 KRW**. None is a selected-option payable checkout receipt or an approved Product price.
- The indexed Hwahae review count observed on 2026-10-13 is **43,652** with displayed rating 4.58, versus the frozen catalog `market_signals.review_count=41,475` stamped 2026-05-26. This public count may fluctuate and does not establish which Product, formulation, bundle or seller option the underlying review population covers. Do not update `products.market_signals` or reattribute reviews from this observation.
- Existing D8F offline verifier now exercises three additional **unapproved seller-to-Product promotion** negatives (35,000 list price, 24,500 member price, 43,652 public review count) and an independent **Offer URL collision** negative. All must fail closed with zero write or release authority.
- Merchant evidence: https://m.snature.kr/category/aqua/75/ (official catalog); https://www.hwahae.co.kr/goods/45194 (retailer listing and publicly indexed redirect). Page indexing is secondary public observation and **not** existing private owner VERIFIED evidence.
- Frozen candidate prestate and D4 logic remain unchanged. Original checkout images, promotion conditions, serum exact SKU, owner decisions and deployed server DB identity remain **HOLD**. No Product/Offer/Subject/DB write.

