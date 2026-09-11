# DATA-OFFER13 — Torriden listing 136 independent identity convergence

## Inputs

### Official seller evidence

- seller: `torriden_official`
- listing: `https://www.torriden.com/goods/goods_view.php?goodsNo=136`
- reviewed product title: `다이브인 무기자차 마일드 선크림 60ml`
- DATA-OFFER11 merged captured-source payload SHA-256: `f56a3a4592c766f972da2cfcc1e529aca2eb68e657a22c82b244c2f8b727beb7`

### Independent Hwahae evidence

Public source review on 2026-09-11 found:

- Korean: `https://www.hwahae.co.kr/goods/56376`
  - brand `토리든`
  - title `다이브인 무기자차 마일드 선크림 60ml`
- Global: `https://www.hwahae.com/en/products/1986669`
  - brand `Torriden`
  - title `DIVE IN Mild Sun Cream [SPF50+/PA++++]`
  - size `60mL`

Identity evidence is limited to brand/title/size convergence. Mutable price, ranking, review-count, and availability observations are intentionally not frozen as identity authority.

### Production Supabase read-only candidate

Production already contains unresolved Product candidate:

- candidate UUID `ccf23119-b067-4076-bb9e-01a83cf88fa0`
- source `hwahae`
- external type/id `products / 1986669`
- raw name `DIVE IN Mild Sun Cream [SPF50+/PA++++]`
- raw brand `Torriden`
- review status `new`
- matched Product: null
- identity resolution state `unresolved`
- seen count `6`

No Production write was performed.

## Existing Product boundary

The only Production Torriden sunscreen Product remains:

- `57e4a5ec-115d-4322-85a1-7976db669700`
- `다이브인 워터리 모이스처 선크림`
- `DIVE IN WATERY MOISTURE SUN CREAM`

It is not an exact title identity match and must not receive listing 136 by brand/category proximity.

## Decision

Independent identity convergence is sufficient only to advance the existing unresolved Hwahae source identity into a **distinct Product candidate ready for governed manual catalog review**.

This phase does not approve or promote the candidate and does not create Product identity authority:

- Product row write: 0
- `product_source_bindings` write: 0
- Offer materialization: 0
- recommendation authority: 0
- automatic match to the existing Watery Moisture Sun Cream: prohibited

Next gate: governed manual catalog admission. Only after a distinct Product is explicitly admitted may a separate source-binding review consider Torriden listing 136 and Hwahae product 1986669.
