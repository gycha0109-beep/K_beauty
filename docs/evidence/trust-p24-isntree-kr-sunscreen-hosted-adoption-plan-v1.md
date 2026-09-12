# TRUST-P24 Isntree KR Sunscreen Hosted Adoption Plan v1

## Result

`PHASE_A_DETERMINISTIC_PLAN_FROZEN`

Target: Isntree `히아루론산 워터리 선젤` / official KR `히아루론산 워터리 선 젤 50ml` (`336bb533-0fe4-4380-8b9f-ab16fb24b807`).

Upstream authority: TRUST-P23 `KR_EXACT_PRODUCT_AND_DIRECT_SPF_PA_IMAGE_SOURCE_RECOVERED`, merged at `b6a90a2cfb89d9e54b0fddd046a1c06c221475ff`.

## Frozen identity

- variant: `HYALURONIC_ACID_WATERY_SUN_GEL_KR_50ML`
- formulation revision: `trust-p23-isntree-145-current`
- market: `KR`
- subject semantic key: `31b72283f5cd817d0dd41f62ef8ae4eb149ad8393cdd40810f2e0ad4eb797cd0`

## Frozen source

Canonical source:

`https://isntree.com/product/%ED%9E%88%EC%95%84%EB%A3%A8%EB%A1%A0%EC%82%B0-%EC%9B%8C%ED%84%B0%EB%A6%AC-%EC%84%A0-%EC%A0%A4-50ml/145/`

Direct first-party detail asset linked from that page:

`https://isntree01.openhost.cafe24.com/product/hyaluronic_acid_sun_gel/hyaluronic_acid_sun_gel_4.jpg`

Direct claim: `SPF50+ PA++++`.

Source content digest: `70125af670b8426d40122c5b41dccff5d0b422c361209b98615ec68ff50a2726`.

## Frozen propositions

SPF:
- `spf_value = 50`
- qualifier `{ "plus_modifier": "plus" }`
- proposition `172b2bdaf808a04e3f58c350afe79f0e9a6c9bedc175ae0b83992a50b1cbf78f`
- evidence digest `ab6b2539ae091ec14426057cdb49b1ee4a304ea0441506a901b2ba8d9a133069`

UVA:
- `uva_label = PA++++`
- proposition `b8372757ab58e27e658508700357ce6d4b37cb0614df4b86cce1bf7cd63e8e89`
- evidence digest `71a61ede73d25e81fd498a3e65704f7fe66225207b9963ad4f5a5f44aeb51759`

Both use `product_specific_primary / high` authority and confidence.

## Production prestate

Fresh readback at `2026-09-13T05:27:21.112198+09:00`:

`Subjects 24 / Sources 25 / Bindings 25 / Evidence 56 / Fact Instances 56 / Evidence Links 56 / Review Assignments 56 / Confirmations 56 / Current 56`

All target subject/source/evidence/proposition/request-ID collision checks are `0`.

## Phase B contract

Planned delta:

`+1 Subject / +1 Source / +1 Binding / +2 Evidence / +2 Fact Instances / +2 Evidence Links / +2 Review Assignments / +2 Confirmations / +2 Current`

Execution is **not authorized by Phase A alone**. Phase B requires this plan to pass exact-head CI, merge, pass merged-main CI, and then pass a fresh Production prestate plus all confirmation preflights.

Controlled RPCs only. Runtime IDs must be server-returned. No direct Product Fact DML, Registry/schema/RPC mutation, cross-market transfer, third-party positive fact support, or recommendation/ranking mutation.

Plan content SHA-256: `68a7e27d6e0ee5e000fae54287a30bd33d1014b5343194eee1d51291286e2941`
