# TRUST-P15 — Dr.G Green Mild Up Sun Plus Hosted Adoption Plan v1

## Status

`PHASE_A_DETERMINISTIC_PLAN_FREEZE`

Upstream authority is the merged TRUST-P14 same-formulation first-party recovery.

- P14 merge: `d1a6c7fa8107e17a38edf6c1f8413124666948c0`
- P14 artifact blob: `67e934678f9d901b9be765c3aa74f423cf1365e8`
- target product: `dc1ef3f3-db1b-4c3f-954a-b18343e3d9f3`
- target: `닥터지 그린 마일드 업 선 플러스 50ml`
- market: `KR`

## Deterministic subject

- variant: `GREEN_MILD_UP_SUN_PLUS_KR_50ML`
- formulation revision: `trust-p14-drg-9637-5174-current`
- subject semantic key: `5cf97a1d61279faaa9b5ae9368a287dd700a68ea9724aaa07b9c012bcc8489df`
- market applicability: `KR`
- identity status: `resolved`
- current state: `current`

## Evidence source and binding

Direct fact source:

`https://www.dr-g.co.kr/item/4415`

Companion target identity/formulation sources:

- `https://www.dr-g.co.kr/item/9637`
- `https://www.dr-g.co.kr/item/5174`

P14 proves the 35mL fact presentation and target 50mL presentation share the same current formulation: same manufacturer and the same 36 ingredients in identical order.

Controlled binding is frozen as:

- `binding_state = equivalent_presentation_match`
- `scope_relation = equivalent`
- formula digest: `307d5eb4714f4b015f7a8aeb135a6622a0cbd61ed417076ce059b7e2d7e8e6b8`
- source observation digest: `4f3a80e7068b714d486173bd92438b79279a473e4bffe7dfefe7bebd6b76a81c`

## Planned facts

### SPF

- `spf_value = 50`
- qualifier: `{"plus_modifier":"plus"}`
- proposition: `81fe34c1a59057a8fcba46a733500208600f04370e3faa106c0fc6f520db1da6`
- canonical evidence: `6d52a9f1b7b4f1db7fb9ffb1f8fe884fadb87d5c678e569d79b83c839431286a`

### UVA

- `uva_label = PA++++`
- proposition: `1035e763996ca2532e2c4e2a511bc01df623f945f440c5af91df5830330ad6b6`
- canonical evidence: `5e467c95dce1dbfdeac648ed44370b0a49ba3c16dd987700efe420926ea413a6`

Both are `product_specific_primary / high / supports` and are derived from the P14 first-party same-formulation recovery. No third-party positive support is admitted.

## Fresh Production prestate

Read at `2026-09-11T08:46:37.102735+09:00`:

`Subjects 20 / Sources 21 / Bindings 21 / Evidence 49 / Fact Instances 49 / Evidence Links 49 / Review Assignments 49 / Confirmations 49 / Current 49`

Target collisions are all zero:

- target Subject rows: 0
- semantic-key rows: 0
- source identity rows: 0
- SPF/UVA Current rows: 0
- SPF/UVA evidence digest rows: 0
- open review assignments: 0

## Phase B contract

Only after this plan merges and merged-main CI is green:

1. `admin_register_product_fact_subject_v1`
2. `admin_ingest_product_fact_evidence_v1` for SPF and UVA
3. `admin_prepare_product_fact_review_v1` → `under_review`
4. `admin_prepare_product_fact_review_v1` → `ready_for_confirm`
5. **both** confirmation preflights must be `ready`
6. only then call `admin_confirm_product_fact_v1`

Runtime UUIDs are server-returned only. Direct Product Fact DML remains forbidden.

Phase A writes: `0`.

Plan SHA-256:

`d515a8172644aa727ef836ed5ec68e69e5d73e73dbe369141d45154a9473e0a4`
