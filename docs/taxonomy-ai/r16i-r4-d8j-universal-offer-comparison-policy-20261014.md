# R16I-R4 D8J — 모든 추천 상품 공통 구매처 비교 정책 (2026-10-14)

> Status: **OWNER-confirmed product scope and seller-first UX policy / DESIGN ONLY**.
> User decision: apply the same seller price/link comparison to **every recommended catalog Product** in free and premium paths.
> This does not independently authorize any protected Product migration, a particular 80ml/review identity change, seller link trust promotion, hosted data write, authentication/API/schema change, merge, or deployment.

## 1. 확정된 사용자 정책

- Recommendation surface: **all recommended products**, free and paid/premium, including top pick, supporting picks, routine step suggestions, functional-plan candidate(s), budget alternatives and other catalog recommendation cards. This is **not** a new rule to attach commercial CTAs to merely mentioned current/user-owned Products, or to override a hold/unknown candidate exposure state.
- Prefer four purchase channels as the initial supported group: **brand official store, Coupang, Olive Young, Hwahae**. Other channels must remain data-extensible; do not demand that every Product exist in every store. The original user mentioned three channels colloquially but enumerated four; the agreed design scope uses **four**.
- Canonical `Product` remains one recommendation/identity record. Multiple seller-selected checkout `Offer` records attach to the catalog Product; each stores seller, listing, exact selected option/package, observed amount, currency, time and link. Never copy a 2-pack or gift-set checkout into a single Product's universal price.
- Core skin-matching/scoring/rank is **separate** from the seller Offer price ordering. Do not replace an evidence-based top pick with a cheaper but less fitting Product. Existing budget-alternative admission still requires a separately defined known-price policy; absence of canonical price may legitimately change that list.
- **Offer sorting:** only exact comparable SKU/size/pack quantities in the same currency are compared by known full checkout cost (including shipping where observed). If shipping is unknown, label amounts as observed listing/selected checkout price, **not** total delivered cost. Noncomparable kits/gifts are a separate grouped option and cannot win an 80ml single-unit “cheapest” badge. Effective per-unit reference amounts may be secondary context only if composition is verified; never silently compare a gift bundle with a single.
- **Tie policy proposed, not independently approved:** official / Olive Young / Hwahae / Coupang only for a stable presentation tie, not an objective trustworthiness ranking.
- **No data:** missing price or seller listing does not create fake price, fabricated listing, search URL disguised as direct product URL, or falsely imply out-of-stock. Render a compact “판매처 확인 중” state when no verified Offers; render only independently admitted sellers when some are present.
- **Direct CTA admission:** require exact seller/listing identity, selected option and link-health/trust policy before rendering a clickable product URL. Seller URL observed as evidence is **not** automatically customer CTA authority. Clearly label generic search fallbacks separately. Purchase telemetry must preserve offer/seller/option context, not incorrectly attribute every link to `Product.buy_link`.

## 2. Actual repository entry points checked (2026-10-14 PR #1255)

| Surface | Existing source | Change target |
| --- | --- | --- |
| Free recommendation page/top/supporting items | `app/result/page.js` has local `getPurchaseLinkInfo` and several product purchase CTA call sites | Use one shared seller comparison view for every eligible recommended Product |
| Free recommendation step shell | `components/result/RecommendedProductsStep.jsx` accepts `renderProduct`; `components/result/free-v2/FreeResultV2RecommendationGuideStep.jsx` carries other free layout | Reuse a shared comparison component through actual product rendering paths, do not duplicate prices by page |
| Premium full report (functional, routine, alternatives, supporting) | `app/result/full-report/page.js` has multiple separate CTA call sites; `components/full-report/PremiumFunctionalDecisionSection.jsx`, `PremiumRoutineConsultSection.jsx` receive candidate products | Shared component plus one Product-ID-keyed Offer source across premium sections |
| Existing direct URL policy | `lib/product-purchase-link.js` currently recognizes Olive Young, Hwahae and selected official-brand domains, **not** a general Coupang or arbitrary official-store link | Trust/link-health expansion needs separate protected security review; never automatically trust URLs just because a seller key matches |
| Existing price correction | `lib/product-price-read-contract.mjs` prevents null Product price becoming zero; D8D v2 remains a two-seller, one-product dormant migration | Keep compatibility: source Offer prices do not become authoritative general Product prices |

Observed implication: although free and premium already have purchase buttons, they still depend on the single `buy_link` path. This agreement is **not yet a completed site-wide UI migration**.

## 3. Shared read model proposed — no response or DB schema changed

Consumer view contract *proposal* for each Product:
- `productId`: canonical ID, not inferred from title/seller.
- `offers[]`: only seller-specific, explicitly admissible listing options; each contains `sellerKey`, `listingId`, `listingUrl` (only if CTA-authorized), `selectedOption`, `packCount`, `unitSizeMl` (if established), `kitScope`, `checkoutPrice`, `shippingCost` (nullable), `currency`, `observedAt`, `priceConfidence`, `availabilityState`, `linkHealthState`, `ctaAuthority`, `comparisonGroup`.
- `comparisonGroup`: safe exact item/pack equivalence, not based on name or seller only.
- `displayState`: `offers_available` | `checking` | `unavailable`; unknown is not out-of-stock.
- A package with a serum gift cannot be expressed with only `size_ml=160` without explicit grouping and review; if the schema cannot preserve that semantic, **HOLD kit comparability** rather than guess.

The actual current `product_offers` table does **not** encode selectedOption, kit components or shipping cost as structured fields. This read model must be backed by verified evidence/schema before being treated as deployable. Do not inject invented fields into the existing Analyze response or DB without separate explicit scope approval.

## 4. Delivery order / acceptance

1. **Inventory (read only)** every actual rendered recommended Product across free and premium, including nested Product/candidate representations; identify a canonical Product ID and existing buyLink source for each. Do not conflate a proposed product with user's existing routine inventory.
2. **Evidence/Offer read contract**: connect canonical Product IDs to verified seller-selected options; create versioned, reusable projector with fail-closed guards, freshness and packaging comparison groups. Keep seller-listing trust independent of evidence.
3. **Shared UX component**: same list, sorting and empty-state semantics for all eligible free/premium recommendation cards; adapt only density/layout. Do not make the report hub an Offer price dashboard.
4. **Integration and tests**: free Top Pick/supporting, free-v2 recommendation, premium functional plan/AM-PM routine/budget alternatives, shared permalink if recommendations are actually rendered there; one/no/four/more sellers; missing price; differing packages; stale price; out-of-stock; malformed/unsafe URL; duplicate seller/listing; both `ko`/`en`; mobile/dark mode; CTA-click telemetry.
5. **Owner/release gates**: implement protected Product/Offer API/schema/DB/allowlist changes only with independent scoped approval and audited production identity. In particular D8D v2 seller-specific APPLY remains HOLD; existing supply-chain security #1208 must pass before merge/release.

**Decision record:** confirmed uniform **commerce UX and purchase data separation**, not a specific Product identity, real seller price, per-offer CTA trust, operational release, or permission to alter ranking scores.
