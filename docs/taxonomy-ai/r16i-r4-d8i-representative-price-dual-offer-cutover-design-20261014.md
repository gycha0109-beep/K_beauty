# R16I-R4 D8I — 대표가격·두 판매처 Offer 계약 설계 (2026-10-14)

> Scope: taxonomy-ai / [PR #1255](https://github.com/gycha0109-beep/K_beauty/pull/1255). **DECISION PROPOSAL / DESIGN SHADOW / NO APPLY**.
> The existing D8D SQL is not a valid implementation of this design. Historical connected candidate DB is not attested Production.
> No owner policy approval, Product/Offer write, release, merge, deployment, schema/RPC/auth/allowlist modification.

## 1. Policy decision — engineering recommendation, NOT owner approval

**Design-selected candidate: A — `A_PRODUCT_PRICE_NULL_SELLER_OFFERS_ONLY`.**

A Product is the catalog **80ml cream identity anchor**; seller selected checkout amounts must **not** define `products.price_min/max`, `unit_price_per_10ml`, or a universal Product `buy_link`. Under this *conditional* A design:

| Scope | Product candidate | Seller Offer candidate |
| --- | --- | --- |
| Cream presentation | `size_ml=80` only when Product identity/review attribution and field approval are separately verified | Official 80ml ×1; Hwahae 80ml ×2 + 10ml serum selected option |
| Price | `price_min=NULL`, `price_max=NULL`, `unit_price_per_10ml=NULL` | 24,500 KRW **official single checkout observation** / 29,900 KRW **Hwahae kit checkout observation** |
| List price | No Product reference/list-price authority; 35,000 KRW is screenshot-only screen text | Do not store 35,000 as a verified Offer MSRP or permanent list price without a separate evidence schema/approval |
| Purchase CTA | `buy_link=NULL` pending approved canonical seller/CTA policy; consumer may offer clearly labeled generic search | Neither seller listing URL becomes a trusted direct CTA until separately authorized |
| Offer scope | No automatic Product Fact/SKU/review population claim | `product_subject_unresolved`, availability `unknown`, link health `unchecked` |
| Scoring | Unchanged | Prices not fed into core scores/ranks; U10 budget alternative list shift is explicit |

**Why A over B/C now:** B cannot aggregate the incomparable 80ml unit and 160ml+gift bundle and has no admitted price-authority policy, freshness/comparability/SKU verification. C lacks a separately approved 80ml Product reference-price observation; neither a discount checkout nor a screenshot of 35,000 KRW supplies it. A is therefore the most conservative *engineering proposal*, not a proxy OWNER decision. If OWNER declines A or chooses B/C, stop and design that policy separately.

**OWNER sign-off remains an explicit next gate.** Do not interpret this document, a UI suggestion, the user's generic "continue", or a synthetic test input as a persisted approval. Until the owner explicitly approves price semantics and the Product identity/Source binding, the proposed 80ml/null snapshot is not ready to write. The existing catalog row stays 160ml / 29,900 KRW / legacy Hwahae link.

## 2. Exact source and intended new Offer rows

| Field | Official manufacturer | Hwahae |
| --- | --- | --- |
| `seller_key` | `snature` | `hwahae` |
| `seller_name` | 에스네이처 공식몰 | 화해 |
| `source_name` | `official_single` | `hwahae_bundle` |
| `listing_id` | `151` | `45194` |
| `listing_url` | `https://www.snature.kr/product/detail.html?product_no=151` | `https://www.hwahae.co.kr/goods/45194` |
| selected checkout option | 수분크림 80ml 1개 | 수분크림 80ml×2 + 세럼 10ml |
| `price_amount` evidence candidate | 24,500 KRW | 29,900 KRW |
| quantity / cream total / gift | 1 / 80ml / none | 2 / 160ml / 10ml serum, **serum SKU unverified** |
| `currency_code`, `market_code` | `KRW`, `KR` | `KRW`, `KR` |
| availability / product scope / health | `unknown`, `product_subject_unresolved`, `unchecked` | same |
| direct CTA / price authority | **false / false** | **false / false** |

- A fresh read of **the original evidence IDs, exact selected options, source URLs, timestamps, owner verdicts and current pricing** is required inside a future authorized transaction. The current normalized D8F price review **does not return evidence IDs/timestamps or re-attest URLs**. Do not fabricate them from its hardcoded source map or synthetic test fixture.
- The Hwahae set is **one Offer representing one selected kit listing**, not two separate Product rows plus a fabricated serum SKU. The two seller Offer prices must never be averaged or treated as comparable 80ml prices.
- Existing unique indexes `(seller_key, listing_id)` and `(seller_key, listing_url)` demand cross-Product collision checks, not only the target Product's Offer set. A duplicate is a blocked migration attempt, not an upsert.
- Per-offer MSRP, promotion validity, and structured kit-component SKU are not stored in the current `product_offers` columns. If needed for customer display or future direct linking, require a **separate protected schema/evidence proposal**; do not stuff them into unrelated fields.

## 3. D8D v2 replacement contract — proposed, NOT implemented

Existing protected migration `20261012181320_taxonomy_ai_r16i_d8d_transactional_apply_v1.sql` **forces Product min/max=official discount checkout and `buy_link`=manufacturer**; only one Hwahae Offer is inserted, application ledger has a single `offer_id`, and rollback deletes one Offer. It is unsuited to this policy. **Do not execute `r16i_d8d_apply_v1(APPLY)` or repurpose an installed migration.** If already deployed in an environment, use a **new versioned and reviewed migration/RPC** after independent verification; preserve historical audit and access boundaries.

Proposed protected topology after separate approval:

1. **Entry gates:** authenticate real owner session using existing server policy; verify Production deployment→DB identity and supply-chain gate #1208; independently approved policy A, Product identity/formulation/review scope, source-binding resolution, dual-offer listing evidence, and exact field-level before→after values. Require named change ticket, one-time decision and disabled-by-default versioned release gate. A client JSON `approved:true` has no authority.
2. **PREVIEW:** pure/no writes with current DB CAS revision, Product-before tuple, all source-binding and trust-intake revisions, zero target/cross-Product seller collisions, two distinct immutable owner VERIFIED evidence IDs with selected option, capturedAt, expiry and exact URL. Render Product after candidate `80/null/null/null/null` and both Offer candidates. Explicitly report incomplete review/population/serum binding. Any missing input is HOLD/blocked, **not** silently skipped.
3. **APPLY transaction (future):** lock Product/proposal/owner decision/evidence, both `(seller_key, listing_id/url)` collision domains, current bindings/trust rows in a deterministic order; compare Product and binding revisions. Set the exact approved five Product fields; insert **both** seller Offer rows with evidence-derived `first_observed_at=last_observed_at=capturedAt`. Persist **both offer IDs** in a new versioned application↔offer child ledger and immutable per-Offer evidence fingerprint (source, listing URL+ID, selected option, checkout price, timestamp, verdict ID). Record one apply request ID and one event. Use one DB transaction; any mismatch/error aborts **all three row writes** and ledger/event creation.
4. **Idempotency:** retry of the **same request ID** returns only the previously verified result if its payload fingerprint, actor, decision and application match. Different request ID for an active Product revision must fail. No silent duplicate insert, unverified conflict update, or second active correction.
5. **ROLLBACK transaction (future):** owner-only, distinct request ID, saved Product pre/after revision compare, **both created Offer IDs** and every relevant seller/price/URL/scope/status/timestamp value CAS match. Refuse rollback on edits, consumers/dependencies or external references. Under safe verified conditions, delete/retire **only the two newly created Offers**, restore exact Product-before tuple, append rollback audit and mark application rolled back atomically. Preserve historical offer IDs/evidence IDs in ledger. If existing schema privileges/foreign keys prevent safe rollback, **block** instead of broadening grants or applying partial rollback.
6. **After state:** require Product size 80/price null/unit null/buy link null, exactly the two Seller Offer rows, all reviews/market signals/ingredient signals unchanged, existing source bindings and trust-intake *not silently rewritten*, Product Fact Subject creation **0**, recommendation rank/score writes **0**, release gate restored to OFF after approved execution workflow. Any unresolved binding cohort that would misrepresent the Product is an **independent cutover blocker**.

### Atomicity/negative acceptance matrix

- Missing OWNER policy decision, non-owner actor, stale/expired/duplicated evidence, one missing Offer, wrong selected option, re-used listing across products, redirect/host spoof, unsupported serum SKU identity, review population drift → blocked before write.
- Tampered 24,500→35,000 list-price substitution; Hwahae 29,900 re-labeled as a single; averaging 24,500 and 29,900; noncomparable unit-pricing; fake `in_stock` or `healthy` → blocked/no new authority.
- Mid-transaction exception after Product update or first Offer insert → zero persisted Product/Offer changes and audit event.
- Retry same request ID → exactly one application/2 Offers; different/replayed approval → blocked.
- Manual mutation of **either Offer** or the Product after apply → rollback blocked; both intact until reconciled. Verified rollback → Product-before and both offers removed/retired in one transaction; zero residual active offers.
- All tests must run in isolated PG17 using a **new approved migration test fixture** plus 164×12 real-engine and 176/166 candidate shadow, premium NULL API serialization, fallback purchase CTA, authorization/RLS checks. Current D8H PG17 fixture is synthetic price 24,000 for manufacturer and is **not** live checkout proof.

## 4. Current D8I executable scope (unprotected)

- Pure preview: `lib/product-intelligence/r16i-d8i-dual-offer-cutover-preview-v1.mjs` is an offline **candidate projection only**, with two Offers, explicit requested policy/owner HOLD, and non-executable `afterCandidate`.
- Negative regression: `scripts/product-evidence/verify-r16i-d8i-dual-offer-cutover-preview-v1.mjs` runs in the existing D8F CI, denies stale prestate, malformed options, fake trust, approval spoof, one/duplicate seller and wrong price. 0 writes, no SQL output.
- Deliberately unchanged: protected migrations/RPC/RLS/offer schema, Product/Offer DB state, owner decisions, CTA allowlist and runtime seller-offer admission; PR still OPEN and mandatory security gate remains independent FAIL.
- Future execution requires **explicit OWNER policy and protected-change approval**. Do not infer authority from successful code tests or document status.

## 5. Review questions before protected code

1. Approve/decline **Product price policy A** for this 80ml Product, including no representative display price and no canonical direct CTA until separately authorized?
2. Is the existing Product/review population/linked Hwahae `product_source_bindings` still a valid **Product 80ml identity anchor** after changing the legacy 160ml kit representation? Otherwise design an alternate anchor/subject model first.
3. Approve **exactly two seller-scoped Offer rows** based on owner-verified checkout evidence, with no direct link or derived canonical price and unknown product/serum scope?
4. Authorize **a new versioned migration/RPC, two-offer ledger and CAS rollback** in a separate scoped protected implementation, only after security #1208 and Production identity have gates?

**Release disposition:** `DESIGN_READY_OWNER_AND_RELEASE_HOLD`; Product writes 0, Offer writes 0, `executableSql=null`, Production identity unattested; no D8D APPLY or merge/deploy.

## 6. D8D v2 dormant implementation — 2026-10-14

This section **supersedes §3's “not implemented” status**, while its approval/Production requirements remain unfulfilled. Explicit user direction authorized writing the versioned source and its isolated test; it did **not** supply owner pricing consent or permission to enable Production APPLY.

- New versioned migration: `supabase/migrations/20261014150000_taxonomy_ai_r16i_d8d_v2_owner_gated_dual_offer.sql`. Existing v1 migration and historical functions unchanged.
- `admin_r16i_d8d_v2_gate`: **OFF by default**; `admin_r16i_d8d_v2_owner_authorizations`: **empty by default** and `service_role` read-only, binding proposal, 80ml identity/review/source/seller attestation flags and SHA256 of two exact evidence tuples. Even owner role in a client payload cannot create this authorization.
- `r16i_d8d_apply_v2`: SECURITY INVOKER and service-role-only execution, owner-role and exact revision/prestate/unique listing/evidence checks. No changes in PREVIEW. Requires both independent gate and externally recorded authorization for APPLY. Commits Product 80ml/NULL price/NULL direct CTA, **2 Offer rows in one statement transaction**, immutable 2-ID ledger + apply event. A retry only returns `ALREADY_APPLIED` when Product and both Offers still match the ledger; mismatches fail closed. Does not rewrite binding/trust/reviews or ranking. No new live API route.
- `r16i_d8d_rollback_v2`: service-role-only SECURITY DEFINER due existing Offer DELETE grants; owner-role check, immutable Product revision and **both** ledgered Offer snapshots/CAS, rejects either Offer drift/untracked offers, deletes only these two rows, restores exact Product-before tuple, writes rollback event atomically. Any FK/permission error aborts the transaction.
- New isolated test: `tests/fixtures/r16i-d8d/50_v2_dual_offer_atomic_pg17.sql`, invoked by existing `.github/workflows/database-integration.yml` PG17 job. Uses **synthetic** evidence and authorizations inside an **outer ROLLBACK**. Verifies initial gate disabled, service-role inability to insert approvals, non-owner deny, false approval deny, failure injected **after first Offer** causes full rollback, two Offer insert, replay idempotency, Product/either Offer drift blocks rollback, two Offer restore, and zero residual writes.
- Initial isolated job [#38524385443](https://github.com/gycha0109-beep/K_beauty/actions/runs/38524385443) failed because the **historical v1 test already advanced `products.updated_at`** while the synthetic v2 proposal still had the old revision. Fixed the fixture to rebase synthetic proposal revision to current in-test Product (`ae96e670`); isolated PG17 [#38524568638](https://github.com/gycha0109-beep/K_beauty/actions/runs/38524568638) **SUCCESS** with every D8D v2 marker and no residual DB change. Later added stricter idempotent-retry drift check; new exact-HEAD CI must be verified separately.
- **Boundary:** installation only adds tables/RPCs with gate OFF and empty authorization; it is not a free-standing assurance that deployment is safe. Before any connected DB migration: manually inspect live schema/RPC grants/foreign keys, authenticate real owner session in server path, attest deployed DB identity, verify evidence freshness and source/review population, resolve #1208 security; seek explicit owner price A and protected-release approvals. No Production DB reads/writes, merge or deploy in this work.

**Disposition:** D8D v2 code drafted + isolated PG17 verification; Production APPLY/ROLLBACK not authorized, new RPC not wired to public/admin routes, no Product/Offer live changes.
