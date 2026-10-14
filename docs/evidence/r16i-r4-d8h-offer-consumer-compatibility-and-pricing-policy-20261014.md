# R16I R4 / D8H — Product-price policy and two-Offer consumer compatibility (2026-10-14)

> Track: taxonomy-ai · PR #1255 · Issue #1204 · Security #1208 · **DESIGN + OFFLINE RUNTIME SHADOW ONLY**.
> Baseline inspection: `aecbf10595a7b92505ad041c23771b62102ceec2`; follow-up code commits in PR #1255. Never assume an older baseline is current Production.
> Authority ceiling: no OWNER price choice, no Production release approval, no D8D apply, no schema/RPC/RLS/auth or catalog mutation.

## 1. Problem / separate prices

The verified evidence consists of *distinct checkout-option observations*: manufacturer 80ml ×1 for 24,500 KRW, and Hwahae 80ml ×2 plus a 10ml serum kit for 29,900 KRW. Manufacturer screenshot also displays 35,000 KRW list-price-like **screen text**; this is not an independently structured MSRP or permanent catalog-price attestation.

- The currently installed D8D apply contract forces the manufacturer **discounted checkout** into `products.price_min/max` (24,500/24,500), computes 3,062.50 KRW/10ml and changes Product `buy_link` to manufacturer #151; it inserts only the Hwahae Offer. This is incompatible with the unapproved price-scope Shadow contract.
- The D8H Shadow proposes a **Product 80ml identity anchor only**; canonical Product price/range/unit-price/CTA are `null`, and both offers are evidence-bound **candidates only**.
- An isolated PG17 transaction demonstrated that nullable Product prices plus two seller Offers can be represented and rolled back. It did *not* prove production consumers or approve an actual migration.

## 2. Actual code consumers and compatibility findings

| Consumer / source | Existing behavior | Null / two-Offer impact | Gate |
| --- | --- | --- | --- |
| `lib/product-source.js` | `Number(product.price_min || 0) || null` retains null numeric price; `mapPriceRange(..., "$$")` supplies `"$$"` for missing prices | **False visible price band** when numeric prices are unknown | HOLD for A |
| `lib/skin-match-decision-engine-core.js` | `buildBudgetAlternatives` treats missing top-price as `MAX_SAFE_INTEGER`, and requires positive candidate price for `isCheaper` | No false cheap-price assertion for missing top price; budget ranking and explanatory semantics may change | Shadow only; replay parity required |
| `app/api/analyze/route.js` | Premium `budgetAlternatives` maps with `Number.isFinite(Number(item?.price_min)) ? Number(item.price_min) : null` (also max) | `Number(null) === 0`; **null may serialize as zero** in this path | HOLD for A |
| `app/result/page.js` | `getDisplayPriceRange` displays `"$$"` as `"₩₩"`; blank band hidden. CTA invokes `resolveProductPurchaseLink` | Wrong fallback band propagates to visible UI; null Product CTA falls back to **explicit Naver search/compare**, not an asserted direct seller listing | HOLD for A price band; fallback acceptable if labeled correctly |
| `lib/product-offer-read-path.js` | Only configured `source_name::seller_key` policies can project direct CTA; all current policies have `priceAuthority:false` | Neither `official_single::snature` nor `hwahae_bundle::hwahae` is trusted; their checkout amounts never override Product price | PASS for denied authority, not released link |
| `lib/server/product-offer-read-service.js` | Controlled `read_product_offer_presentation_authority_v2` RPC, network/role guard, throws on unavailable authority; `applyProductOfferReadPath` catches and returns original decision | A stale existing Product `buy_link` can survive read failure if not independently cleared; Product null link must be guaranteed before opening any actual correction | HOLD for cutover |
| `lib/product-purchase-link.js` | Generic validated Hwahae goods URLs may be trusted even without Offer/SKU scope; manufacturer #151 has no explicit official source allowlist | Domain allowlisting **does not** attest Hwahae kit equals an 80ml single. Stale legacy `buy_link` is unsafe to preserve | HOLD for source-specific direct CTA |
| `supabase/migrations/20260910103000_product_offers_shadow_v1.sql` | Independent seller/listing rows; `price_amount`, `currency_code`, last observation | No per-offer MSRP, explicit promotion validity or structured kit component authority | Contract proposal needed if these become hard requirements |
| `supabase/migrations/20260925121815_product_offers_health_presentation_read_v2.sql` | Existing governed presentation RPC returns seller listing authority rows | Readability does not grant purchase-link authority or Product price derivation | No change |

`unit_price_per_10ml` is derived from canonical Product price/size in the old D8D SQL; do not compute it from the Hwahae 160ml kit or the screenshot discount without an approved Product pricing rule. NULL storage alone is not a consumer pass.

The Hwahae review population / source binding and the identity of the serum gift SKU remain **unproven for the 80ml single**. No review reassignment, Product Fact Subject creation, or recommendation score/ranking change is authorized.

## 3. Pricing-policy options, not decisions

| Option | Product price semantics | Benefits | Blockers / required follow-up |
| --- | --- | --- | --- |
| **A: Product commercial fields null** | Product = 80ml identity; checkout/list prices exclusively seller scoped | No accidental Product-wide price authority; strongest separation | Fix misleading `$$` price band and premium `null → 0` coercion; validate all result/score/storage consumers; explicit stale CTA clearing; policy for unit price display |
| **B: derived from verified Offers** | Product display/range calculated from eligible fresh Offers with comparable product/quantity scope | Can retain price-based recommendations when authority exists | Current `priceAuthority:false`; checkout options differ in units/kit; time, availability, seller trust, expiry and price derivation/versioning not governed. No derivation currently valid |
| **C: independently approved Product reference price** | Separately attested price for **80ml single** on Product; checkout discounts belong to Offers | Maintains existing numeric price/UI contracts | Owner must define exact reference semantics, observation date, refresh/staleness policy and proof. Screenshot 35,000 KRW alone is not permanent baseline authority |

**Decision: OPEN / OWNER REQUIRED.** An A/B/C selection by this document or automated tests is forbidden. No `products.price_*` mutation or derived `unit_price_per_10ml` is authorized.

## 4. New runtime consumer Shadow test

Added `scripts/product-evidence/verify-r16i-d8h-offer-consumer-runtime-v1.mjs` to exercise the **actual** `lib/product-offer-read-path.js` and `lib/product-purchase-link.js` functions with synthetic, in-memory data. Existing `verify-r16i-price-scope-review-v1.mjs`, already imported by the D8F verifier, starts the test with `scripts/node-alias-loader.mjs`; no new workflow or test authority surface was created.

Contract assertions:
1. Two current checkout-amount Offers stay seller scoped, but no unapproved Offer source is chosen; price/ranking data is not overwritten.
2. Fake `in_stock`, `healthy`, altered price, mismatched Product scope or host spoof cannot elevate a new seller source into a trusted Offer.
3. Manufacturer official #151 falls back; generic Hwahae URL format may be direct in the separate URL resolver **but is not** an authority grant to link the Hwahae kit as the canonical 80ml Product.
4. Product price NULL is not filled from Offer amounts; legacy Product price is not overwritten; recommendation projection remains pure.
5. A simulated unavailable Offer reader returns the original Product decision; therefore Product buy-link clearance is a separate precondition for cutover.

This is an *existing-code behavior and fail-closed regression*, **not** proof that option A is already UI-compatible. Known gaps are printed under `unresolved`.

Run from repository root:

```sh
node scripts/product-evidence/verify-r16i-price-scope-review-v1.mjs
node scripts/product-evidence/verify-r16i-r4-d8f-candidate-d4-readonly-prestate.mjs
```

GitHub: existing Database Integration Authority calls the D8F verifier (and has separate PG17 fixtures). Check exact PR HEAD and run ID after this commit; **historical CI success never proves new commits**.

## 5. Required protected changes before D8D replacement

**Not implemented; request explicit scope/owner approval after the pricing choice:**

1. Define Product reference-price rule (A/B/C), freshness and comparable seller-option units; add structured list/promotion/component fields only if justified by that rule. Specify migration, backfill, double-run and rollback.
2. Ensure `price_range` does not invent a currency band when `price_min/max` are genuinely unknown; preserve `null` through premium API, UI and persisted/report projections without renaming response fields.
3. Review actual price-sensitive scoring/budget ranking behavior with 164×12 and 176-row scenario replays. Numeric price may not imply comparable unit prices for kit offers.
4. Add no seller direct-CTA trust automatically. Any allowlist/Offer source policy needs independent seller/listing/SKU scope proof, link health and negative redirect tests.
5. Redesign D8D controlled transaction + CAS rollback for **two Offers**, idempotency, before-state binding, one-time owner approval and release gates only after explicit protected schema/RPC/migration review.
6. Preserve review population/source binding and serum SKU uncertainty; do not manufacture Subject/Fact or move reviews.

## 6. Release and safety status

- Product writes **0**, Offer writes **0**, owner decisions created by code **0**, Fact Subject writes **0**, release gate change **0**.
- Existing owner VERIFIED checkout evidence remains a prerequisite, **not** an approval of Product price policy or Production APPLY.
- Production Vercel runtime DB identity: **UNATTESTED**; candidate DB state is not substitute evidence.
- Independent supply-chain security #1208: **OPEN**; Draft PR #1288 is not remediation completion.
- Current D8D SQL remains **unsafe to execute as the new policy**. No merge/deploy/Production apply authorized.

## 7. D8H actual engine NULL-price policy what-if — 2026-10-14

**Execution:** Added `scripts/product-evidence/verify-r16i-d8h-null-price-engine-replay-v1.mjs` and invoked it from the existing `verify-r16i-price-scope-review-v1.mjs` D8F offline CI. This does **not** select A: Product NULL or authorize live price mutation. Inputs are the frozen 164 Product rows, 12 exact existing user scenarios, one synthetic 80ml/Product-price-null replacement, and two seller-scoped Offer candidates. The same current `buildRecommendationProductFromSource`, `buildSkinMatchDecisionBundle`, `projectProductWithOfferAuthority` functions execute inside the sandbox; external fetch is rejected.

**Exact tested HEAD:** `aea49f54197e6bdc4291421741a0f7c96595fd6b`. [Database Integration Authority #38518123678](https://github.com/gycha0109-beep/K_beauty/actions/runs/38518123678) **SUCCESS** (Database integration authority and isolated PostgreSQL 17 jobs both PASS). The initially attempted `056a3259` failed solely because its verifier parsed multi-line engine diagnostics as one JSON string; updated the verifier's newline split in `aea49f54` and independently reconfirmed PASS. This is a test-harness parser correction, not a recommendation-policy change.

| Actual engine check | Exact result |
| --- | ---: |
| Scenarios / candidate-score comparisons | 12 / 1,968 |
| Score delta | 0 |
| Ranking delta | 0 |
| Top Pick delta | 0 |
| Top 3 delta | 0 |
| Candidate-count delta | 0 |
| **Budget alternatives list delta** | **1 scenario** |
| R16I product present in budget alternatives, before → after | **1 → 0 scenario** |
| R16I Product selected as topPick | 0 scenarios |
| DB Product writes / Offer writes | 0 / 0 |

Interpretation: The 80ml/NULL commercial price **does not change core scoring or rank in this frozen 164×12 set**, but **does change a user-facing budget-alternative selection** because that secondary consumer depends on price. This is a measured delta, not necessarily a regression, and must not be described as *complete* recommendation parity, Production price readiness, or evidence that synthetic NULL was approved. New catalog admission, 176-row actual production authority, user purchase/checkout and persisted report compatibility remain separate.

Separately, the current `buildRecommendationProductFromSource` still emits `price_range="$$"` for `price_min/max=null`, so Result can render a false mid-price band. The premium API numeric conversion of NULL is **static-code identified** but **not dynamically exercised by this engine replay**. Offer reader failures can return an original decision; never assume a stale Product buy link has been cleared unless verified. The current Product price policy (A/B/C), Offer seller-link authority, retailer set/SKU attribution, serum identity, Product review population and canonical pricing remain **OWNER HOLD**.

**Remediation/approval sequence:**
1. Owner defines canonical Product price semantics and review criteria for 80ml single, not merely from screenshot checkout. Explicitly decide whether the official seller persists as the second Offer.
2. Scope and review unknown-price `price_range` suppression (avoid `$$`), premium NULL numeric serialization, budget-alternative classification/message, and fallback CTA behavior. These are existing **consumer contract changes**; no deployed consumer was modified in this stage.
3. Test any approved read-path changes against the same 164×12, the candidate 176-row admission/recommendation fixture and result/premium API presentation. Require no **unapproved** scoring or ranking changes, explicit accounting for the one budget-alternative difference, and zero unauthorized purchase link promotion.
4. Only after approved semantics, review protected two-Offer D8D migration/RPC, CAS rollback and release gate; #1208 security resolution and actual Production DB identity still required.

**Scope check:** Only offline test files and evidence/roadmap; NO schema/migration/RPC, Production DB, Product/Offer, owner judgment, auth, purchase allowlist, package, release gate, ranking policy, API field-name or deployment mutation. Expected production writes = **0**.

## 8. D8H 176-candidate NULL price actual-engine replay — 2026-10-14

`scripts/product-evidence/verify-r16i-d8h-null-price-candidate-admission-shadow-v1.mjs` executes the **real** source projector/decision engine using the previously read-only 2026-10-13 candidate snapshot (176 raw rows, candidate DB identity UNATTESTED), unchanged frozen 12 scenarios, and only one simulated Product change: 160ml/29,900/Hwahae CTA -> 80ml/price NULL/unit-price NULL/CTA NULL. Two seller-specific Offer candidates remain *untrusted* and cannot restore Product price or an unsupported direct CTA. This is **not** a new DB read, actual Production admission assertion, or authorization of option A.

- Structural comparison: **166 projectable products**, 12 scenarios, **1,992 scored candidate pairs**. Candidate count, scores, rank, Top1 and Top3: **0 changes**.
- Synthetic legacy-only negative control: **164 previously-frozen IDs**, 12 scenarios, **1,968 scored pairs**. Candidate count, scores, rank, Top1 and Top3: **0 changes**. The two newly projectable products have NOT been granted current PF admission authority by this test; the ten null-category rows remain excluded.
- **Both comparisons:** budget alternative **identity lists changed in one scenario (`U10`)**. Target R16I Product occurrence went from **1 to 0** in that list. The replacement Product ID in the snapshot is `637782f6-709e-45e3-a886-a279c142667d` (not a production recommendation approval). The difference is user-visible budget alternative selection, not Skin Match core ranking.
- `price_range="$$"` for Product NULL is a confirmed **incorrect existing UI fallback**, not an authorized display contract. Premium API `Number(null) -> 0` is still only a static-code finding; **not** claimed dynamically validated here.
- Actual tested execution at HEAD `56d1d92d9e743ae503874a5840b76f0d5380ed6a`: new R16I D8H runtime script **passed** within Database Integration job [#38519946918](https://github.com/gycha0109-beep/K_beauty/actions/runs/38519946918); that *overall* run **failed at final `git diff --check` due to one trailing space**, not at an engine assertion. Whitespace was removed in `63812fde2e72fe939e2f2664800dea532f4018d9`; check the latest exact PR HEAD CI separately before reporting the overall job PASS.
- **Scope:** offline runtime replay/test wiring and this evidence only. Product/Offer writes 0, no premium API, DB schema, Product pricing, CTA trust, recommendation rank or operational code change. Pricing policy A/B/C, kit scope, review population, Production DB identity, supply chain #1208, protected D8D revision and release authorization all **HOLD**.

## 9. D8H bounded nullable-price consumers — 2026-10-14

**Executed code-only consumer safety repair, without choosing Product policy A/B/C:**
- Added pure read-contract `lib/product-price-read-contract.mjs`, accepting only finite positive numeric Product price values. Unknown/null/empty/invalid Product prices have **no price band**, not a fabricated `"$$"`; known prices preserve thresholds at KRW 20,000 and 40,000.
- `lib/product-source.js` now emits empty `price_range` when both Product price values are unverified/unknown. The existing Result-page consumer already hides empty price labels (`getPriceLabel -> null`), so **no Result UI contract change was necessary**.
- `app/api/analyze/route.js` maintains exact existing premium `price_min`/`price_max` field names and outputs explicit `null` for absent Product prices; formerly `Number(null)===0` incorrectly serialized unknown as zero. No response field was renamed or added.
- `lib/skin-match-decision-engine-core.js`: a candidate is described as *cheaper* **only when both Product min prices are known and the candidate's known price is lower**. Unknown price is neutral; **do not retain the former U10 product by inventing a price comparator**. The U10 budget-alternative identity substitution remains a **known justified consumer delta** under hypothetical NULL, not core ranking drift. No SKU checkout Offer amounts are transferred into Product prices.
- Added `scripts/product-evidence/verify-r16i-d8h-price-consumer-contract-v1.mjs`, linked to existing D8F CI along with the 164×12 and 166×12 candidate replays. This checks null/invalid/threshold prices, consumer result suppression, same premium API field names, and no new direct-CTA authority.

**Scope:** Product prices and checkout amounts are NOT written, owner approval for canonical price remains ABSENT, 2 seller Offers unadmitted, production DB identity still UNATTESTED, #1208 Supply Chain Security still independent BLOCKER, no migration/RPC/Auth/RLS/Package/Deployment changes. This is a bounded **consumer-read semantics** repair; D8D APPLY remains HOLD. Verify latest exact HEAD CI before claiming complete regression success. In particular, an unknown product price cannot be said to be cheaper, and a change to the U10 *alternative list* is acceptable only when explicitly reported.
