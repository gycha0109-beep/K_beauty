# R16I R4 / D8H — Official list, checkout and retail bundle price-scope shadow (2026-10-14)

> Track: taxonomy-ai · PR #1255 · Product #1204 · Security #1208 · **OFFLINE SHADOW + ADMIN READ-ONLY; NO APPROVAL, NO DEPLOY, NO DB MUTATION**.

## Scope and observed facts

The source prices are three **different commercial concepts**, not one canonical Product price:

| Scope | Basis | Observed amount | Scope / restrictions |
| --- | --- | ---: | --- |
| Official manufacturer displayed list price | User-supplied original checkout screenshot, **not separately structured in evidence ledger** | 35,000 KRW | Screen display observation only; may change and is not permanent MSRP authority |
| Manufacturer 80ml x1 payable-before-payment | Existing separate OWNER-VERIFIED private evidence | 24,500 KRW | Specific observed discount, not a universal Product price or completed order |
| Hwahae 80ml x2 + serum 10ml promo bundle payable-before-payment | Distinct OWNER-VERIFIED private evidence | 29,900 KRW | Seller kit checkout, not a 160ml single container and not an 80ml Product unit price |

The original screens indicated an official screen discount of 10,500 KRW. The serum's **exact SKU and Product Fact Subject attribution remain unverified**. No checkout screen provides a perpetual Product-wide price guarantee. Both real OWNER verdicts were present in read-only connected candidate queries; original images remain private.

## Inspected runtime contracts

- Existing Product `size_ml=160`, `price_min=price_max=29900`, `unit_price_per_10ml=1868.75`, `buy_link=Hwahae 45194` still mixes a kit listing with one cream Product row.
- Existing `public.product_offers` allows **different seller/listing rows** and individual `price_amount`; it has **no per-offer list price, promotion expiration, selected-option component quantities or gift SKU columns**. Do not invent them in the real DB.
- `lib/product-offer-read-path.js` keeps legacy Product price fields intact unless trusted source policy specifically grants price authority. **Neither** new manufacturer nor Hwahae kit offer has an admitted purchase CTA source rule for this case.
- The **currently deployed D8D SQL**, in `20261012181320_taxonomy_ai_r16i_d8d_transactional_apply_v1.sql`, requires `products.price_min/max` to equal manufacturer `checkout_price_krw` and `products.unit_price_per_10ml` to equal `round(checkout/80*10,2)`; it creates **one** Hwahae Offer. With the supplied photos this means 24,500 KRW Product price, **3,062.50 KRW/10ml** and a manufacturer buy link. That is a **specific assumed policy, NOT yet approved**.
- Connected candidate's effective deployed Production server identity remains unattested. The separate #1208 security lock-graph audit remains mandatory red. Neither is bypassed.

## Implemented non-writing model

`lib/product-intelligence/r16i-price-scope-review-v1.mjs` creates a **pure** review snapshot from an already-guarded D4 product view and two private evidence metadata rows plus their separate OWNER verdicts. It:
1. Fail-closes on bad/stale Product prestate, missing/duplicated seller, mismatched exact selected option, stale/future capture, invalid currency amount, unverified/duplicate verdict or invalid time.
2. Represents **Product anchor = 80ml single presentation candidate**, but sets canonical Product price_min/max, 10ml unit price, purchase URL and SQL to **null**. Product write and sale-link promotion are explicitly denied.
3. Keeps manufacturer 80ml one-unit checkout and Hwahae 80ml x2 + 10ml serum kit as **two seller-scoped Offer candidates** (`offerInsertAuthorized=false`). Components come from exact selected-option labels, not independently confirmed gift SKU. This is a preview, not a guarantee the current D8D SQL can persist both Offer rows.
4. Exposes the user screenshot's 35,000 KRW **display-only observation** separately; compares 24,500 KRW only for the observed 10,500 KRW screen discount and never imports either into canonical Product price.
5. Never creates an owner judgment, proposal, DB write, released CTA, executable SQL, product fact subject or ranking change.

The existing owner admin review screen now shows the three prices/seller scopes in an explicitly **read-only** two-column comparison when both VERIFIED metadata records and D4 guard match. A prominent warning says the old D8D SQL remains coupled to discounted checkout and **actual field approval/apply must wait for an explicit Product price/link policy**.

The existing D8F offline CI invokes `scripts/product-evidence/verify-r16i-price-scope-review-v1.mjs`: successful two-seller separation plus 17 negative/fail-closed scenarios, default-denied authority and static detection of the current legacy D8D checkout-price coupling. This doesn't test a new transactional Product/Offer migration; **no such protected migration is authorized or changed here**.

## Next owner/product decisions (blocking actual D8D correction)

1. Define which `products.price_min/price_max` semantics are intended for **an 80ml product anchor**, e.g., date-specific seller checkout, manufacturer list, or separately derived trusted offer ranges. Neither manufacturer's 35,000 nor 24,500 can be promoted to canonical Product values purely by observing one checkout.
2. Determine whether manufacturer 80ml selected-option checkout is to be persisted as its **own current Offer** alongside the distinct Hwahae kit. Existing `product_offers` can distinguish sellers, but can't store per-option list/discount/promotional lifetime or separate gift components.
3. Decide how `unit_price_per_10ml` and purchase CTA should behave when Product commercial price is withheld. Check the existing trusted direct-purchase source policy separately; **never** automatically admit official #151 or Hwahae #45194 solely because the screenshot exists.
4. With those semantics approved, scope a **separate, explicitly authorized D8D SQL/RPC migration** and isolated PostgreSQL 17 Product+Offer transaction/rollback tests. Only then may the owner create/approve the corresponding field proposal, obtain a fresh 0-write PREVIEW, and finally consider gated APPLY.
5. Independently resolve mandatory supply-chain #1208 and attest effective Production DB identity. No Production changes or PR merge until verified green.

**State:** Pricing attribution & two-option shadow implemented, actual Product/Offer SQL replacement HOLD. No schema/auth/RLS/API response mutation and no Product/Offer write.

## 5. Additional isolated PG17 schema capability probe

A second **synthetic-only** PostgreSQL 17 replay uses the existing disposable D8D fixture database and runs after the unchanged legacy one-offer transaction regression:

- `tests/fixtures/r16i-d8d/40_price_scope_offer_shadow_pg17.sql` starts a transaction, stages Product 80ml with **NULL canonical Product price_min/max/unit price and NULL buy_link**, and stages **two distinct seller Offer rows** (`snature #151`, `hwahae #45194`) with fabricated fixture prices 24,000 / 29,900 KRW. These are fixture prices, **not production observations**.
- Verifies offers are seller-specific, remain availability unknown and link-health unchecked, Fact Subjects stay absent, duplicate seller listing INSERT fails, and no Product price is inferred from the two prices.
- Ends with `ROLLBACK` and explicitly checks legacy Product and 0 Offer rows restored. The surrounding CI destroys the disposable database. No actual Product/Offer rows or D8D SQL, Auth/RLS, CTA trust policy, or production gate are changed.
- This demonstrates existing **nullable Product price columns and two Offer rows are technically representable**; it does **not** approve or execute a future two-Offer D8D migration, or prove downstream recommendation/UI/null-price compatibility.

The existing Database Integration Authority workflow runs the fixture under PostgreSQL 17, and the D8D static contract checks its expected marker and rollback guard. The exact new SHA result is authoritative; do not label this step PASS before CI reports it.
