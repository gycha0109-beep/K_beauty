# R16I-R4 D8E2 — read-only candidate catalog / listing-price replay (2026-10-13)

## Scope and authority
- Captured 176 distinct Product IDs by ordered, read-only SELECT from connected Supabase candidate project. This project's equality to the deployed Vercel runtime DB is UNATTESTED.
- All 164 IDs from the historical fixture are still present. 12 IDs are new. Ten new rows have null category and are excluded by the real source projector; two sunscreen rows are structurally projectable but DO NOT have a verified production admission grant. Thus 176 raw catalog rows != 176 authorized recommendation candidates.
- Captured source: fixtures/recommendation-metadata/products-candidate-readonly-20261013.json (dated evidence only, not a live source or deployed authority). Snapshot can go stale.

## Public-facing price observations — NOT actual checkout proof
- Official 80ml #151: https://www.snature.kr/product/detail.html?product_no=151 displays ordinary 35,000 KRW and member special 24,500 KRW; it explicitly states final discounted price is confirmed when placing an order. The runner tests these two displayed price hypotheses separately; it does not decide which amount to write to Product.
- Hwahae bundle #45194: https://www.hwahae.co.kr/goods/45194 displays 29,900 KRW for 80ml ×2 + serum 10ml. This is not a single 80ml checkout price. Member option, actual checkout, exact serum SKU and review scope remain unverified.
- Another Hwahae single listing #35905 has appeared with 19,500 KRW, but this is not authority for the official 80ml Product price and is not injected into the official price branches.
- Old actual candidate Product ID b639c8b4-6a61-440e-b4db-fac7381593ff remains size_ml=160, price_min=price_max=29900, unit_price_per_10ml=1868.75, buy_link=Hwahae #45194. No update.

## Non-production execution contract
- Script: scripts/product-evidence/verify-r16i-r4-d8e2-readonly-catalog-replay.mjs
- Real buildSkinMatchDecisionBundle + buildRecommendationProductFromSource and 12 actual frozen answer scenarios. Raw 176 rows fully checked for unique IDs and legacy overlap; 10 null-category rows fail closed. 166 structurally projectable rows × 12 scenarios × 2 official display-price hypotheses = 3,984 score/rank comparisons IF CI succeeds.
- Exact Product reviews, market and ingredient signals remain unchanged. Offer price and link cannot override the Product because Hwahae Offer is not trusted; spoofed host rejected. Official-brand direct link currently falls back pending source-policy approval.
- A nonzero score/rank, top-pick or candidate count delta fails the verifier. No stubs, no external network, no Product/Offer production writes.
- The two new structurally projectable sunscreen rows are included solely in a sandbox comparison, bypassing admission in that sandbox; the test does not authorize them in production.
- This tests public *listing* display prices and structural impact, NOT checkout-verified correction price, actual production admission, D8C approval, D8D actual preview, or deployed DB identity. D8E2 final authorization HOLD; D8F/G/H HOLD.

## Ops and security
- Vercel alias k-beauty-two.vercel.app points to production deployment dpl_7VNeyxZNCRAjJrxsMSX6TAAYDJsh (READY at observation); alias/project metadata does not establish server DB identity.
- Security #1208 remains open; do not bypass/extend expired advisory exception. Do not merge while Supply Chain Security is failing.
- Product writes=0; Offer writes=0; release gate changes=0; owner approval=none.
