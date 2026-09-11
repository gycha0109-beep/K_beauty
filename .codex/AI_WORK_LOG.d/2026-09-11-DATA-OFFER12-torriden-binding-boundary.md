# DATA-OFFER12 — Torriden listing 136 Product binding boundary

## Source evidence

- merged DATA-OFFER11 SHA: `30500ec5ad4c0e1ccd939e1c78a918a0b7eb27fa`
- merged-main DATA-OFFER11 run: `34546730051`
- merged-main artifact: `10179284044`
- captured payload: 175733 bytes
- payload SHA-256: `f56a3a4592c766f972da2cfcc1e529aca2eb68e657a22c82b244c2f8b727beb7`
- direct review of the admitted bytes found `다이브인 무기자차 마일드 선크림 60ml` 25 times and `다이브인 워터리 모이스처 선크림` 0 times.
- DATA-OFFER11 parser itself has no title authority; this title evidence is a direct reviewed-byte observation only.

## Production Supabase read-only inspection

Read-only inspection on 2026-09-11 found:

- `public.products`: present
- `public.product_source_bindings`: present
- `public.seller_listing_observations`: absent (DATA-OFFER4 remains CI-only / not Production-applied)
- existing binding for `torriden_official` + listing `136`: 0
- Torriden sunscreen catalog candidates: exactly one
  - Product `57e4a5ec-115d-4322-85a1-7976db669700`
  - `다이브인 워터리 모이스처 선크림`
  - category `sunscreen`
  - no legacy external triplet
  - no source binding

No Production write was performed.

## Decision

`UNRESOLVED` / fail closed.

The same brand and category are insufficient to equate `다이브인 무기자차 마일드 선크림 60ml` with `다이브인 워터리 모이스처 선크림`. Exact Product identity and formulation equivalence remain unproven. Therefore DATA-OFFER12 grants no `product_source_bindings` write authority, no Offer materialization authority, and no recommendation authority.

Next gate: establish exact Product identity from an independent catalog/identity authority, or admit the captured listing as a distinct governed catalog Product before any source binding.
