# TRUST-P8 Sunscreen Hosted Adoption Execution v1

## Status

`TRUST-P8_PHASE_B_EXECUTION_CLOSEOUT = PRODUCTION_CONFIRMED`

Phase A authority remains `ed2b5204f4bd48207e7881974d8041610fabd547` with plan SHA-256 `305a49987c32382a36e0585ee2e41ce652395e182079db6544f4c73cfe963c8d`. Execution was captured against fresh main `d1f54d8e59c96f92c982aeab3c051fb57f755235` and Production Supabase project `bygrczggxfuisupcevaz`.

## Controlled execution

No Product Fact table direct DML was used. The six confirmations were executed only through `admin_confirm_product_fact_v1` after all six `admin_preflight_product_fact_confirmation_v1` calls returned `status=ready` and the fresh payload/prestate digests matched the previously frozen values exactly.

Fresh confirmation prestate:

| Relation | Count |
|---|---:|
| Subjects | 19 |
| Sources | 19 |
| Bindings | 19 |
| Evidence | 47 |
| Fact Instances | 41 |
| Review Assignments | 47 |
| Confirmations | 41 |
| Current | 41 |

Production poststate:

| Relation | Count |
|---|---:|
| Subjects | 19 |
| Sources | 19 |
| Bindings | 19 |
| Evidence | 47 |
| Fact Instances | 47 |
| Evidence Links | 47 |
| Review Assignments | 47 |
| Confirmations | 47 |
| Current | 47 |

## Product result

| Product | Product ID | Subject | Current | Scope |
|---|---|---:|---:|---|
| Beauty of Joseon Aqua-Fresh | `765b3ca1-6927-49b0-bee6-4138d03dd915` | 1 | 2 | GLOBAL |
| AESTURA Red Calming | `dd326b18-ea56-45fb-8571-42186b6c9159` | 1 | 2 | KR |
| AESTURA Barrier Hydro Mineral | `2d3591f2-2216-4043-8493-a9492806ef8b` | 1 | 2 | KR |
| La Roche-Posay Anthelios Sun Fluid | `9983f167-24e7-4223-bd86-446ce6ced31b` | 0 | 0 | EXCLUDED |

Each adopted product now has exactly two Current facts:

- `spf_value`: `supported`, `number=50`, qualifier `{"plus_modifier":"plus"}`, authority `product_specific_primary`, confidence `high`.
- `uva_label`: `supported`, `enum=PA++++`, qualifier `{}`, authority `product_specific_primary`, confidence `high`.

La Roche-Posay remains `FACT_SOURCE_RECOVERY_REQUIRED_EXCLUDED`; no SPF/PA inference or confirmation was performed.

## Authoritative runtime lineage

The execution JSON freezes the final Production readback for all six propositions, including exact Product/Subject/Source/Binding/Evidence/Assignment/Confirmation/Fact Instance/Current lineage, request IDs, payload digests, prestate digests, fusion-input digests, and result digests.

The six confirmation IDs are:

- BOJ SPF: `30f0bd04-51bc-4ccf-9c56-63f4d417bf8c`
- BOJ UVA: `54dff21f-615c-42c7-8a39-1035d2d93fac`
- AESTURA Red SPF: `c97dd04d-1850-460a-b572-721a44036950`
- AESTURA Red UVA: `fab057d7-a8a1-4faa-9c0e-fb9679404d94`
- AESTURA Barrier SPF: `c35684ad-8cea-4ef1-8501-b79bd9504ffe`
- AESTURA Barrier UVA: `3e042ebb-ff48-41fe-b7d4-642918a7e7f2`

## Invariants

- direct Product Fact table DML: **false**
- controlled RPC only: **true**
- all six fresh-ready before first confirm: **true**
- schema change: **false**
- RPC change: **false**
- registry change: **false**
- recommendation/ranking change: **false**
- La Roche inference: **false**
