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
