# TRUST GPT Catalog Intake — Production Rollout Closeout v2

## Decision

`TRUST_GPT_CATALOG_INTAKE_PRODUCTION_ROLLOUT_PASS`

Production project: `bygrczggxfuisupcevaz`

Captured: 2026-10-03 KST

Watchtower-Track: `pipeline-reliability`

Integration main SHA:

`f10636cff39a5fd637e6e55f9bc1efec1dfd07a2`

## Deployed migration

- version: `20261001183000`
- name: `trust_gpt_catalog_intake_pipeline_v1`
- repository blob SHA: `f65596ab65408abbe41be76d8ec6d035c4ab8b39`
- migration history recorded with the original version/name
- 8G0 remains applied as `20261002142611_v21_8g0_registry_pinned_reconciliation_v1`
- 8G1 remains applied as `20261002153238_v21_8g1_identity_authority_preservation_v1`

The repository had no remote `supabase db push` deployment workflow. The migration body was executed against Production with its outer `begin/commit` removed and wrapped together with the exact `supabase_migrations.schema_migrations` history insert in one transaction. No `migration repair` was used.

## Post-migration boundary

Objects:

- `public.gpt_catalog_intake_runs` exists with RLS enabled
- `ingest_gpt_catalog_product_v1(text,jsonb)` exists
- `claim_gpt_catalog_research_tasks_v1(uuid,integer,integer)` exists
- `read_gpt_catalog_intake_run_v1(text)` exists
- `process_catalog_trust_product_v3(uuid,text)` remains present

RPC ACL:

- anon: denied
- authenticated: denied
- service_role: allowed

Immediately after migration and before the pilot, pre-existing counts were unchanged:

- products: 175
- product_candidates: 198
- catalog_trust_intake: 174
- product_fact_subjects: 46
- product_fact_research_tasks: 451
- product_source_bindings: 151

## Production pilot

Request:

`gpt-prod-pilot-20261002-cosrx-ultralight-001`

Product:

`COSRX Ultra-Light Invisible Sunscreen SPF50 PA++++`

Official source:

`https://www.cosrx.com/collections/sun-protection/products/ultra-light-invisible-sunscreen-spf50`

Independent identity cross-check:

`https://global.oliveyoung.com/product/detail?prdtNo=GA240925876`

Created chain:

- candidate_id: `ce1653d4-5ea2-47a0-bf79-d39f9fb72ae6`
- product_id: `888eca86-af25-4a12-b9ea-47922d83f520`
- intake_id: `f78e9366-6709-4c3e-8c36-4c643c805b56`
- subject_id: `994d7edb-7432-40c3-b09f-08cd59f91627`
- source_binding_id: `30612213-a156-4a69-bce1-d84ab4a5e1fe`

Initial result:

- state: `TRUST_RESEARCH_READY`
- automatic_confirmation: false
- product_fact_confirmation: false
- recommendation_admission: false
- idempotent replay: PASS
- changed-request reuse conflict: PASS
- unsupported taxonomy fail-closed: PASS
- product-scoped claim isolation: PASS
- Registry v2 forced probe: fail-closed PASS

## Registry-pinned research outcome

All three sunscreen-required tasks are pinned to:

`product-fact-registry-cross-category-v1`

| Fact | Normalized value | Evidence class | Final task state |
| --- | --- | --- | --- |
| `spf_value` | `50` | `product_claim` | `EVIDENCE_CANDIDATE` |
| `uva_label` | `PA++++` | `product_claim` | `EVIDENCE_CANDIDATE` |
| `uv_filter_type` | `organic` | `composition_identity` | `EVIDENCE_CANDIDATE` |

For all three pilot tasks:

- `attempt_count = 1`
- `source_observation_id` present
- `evidence_candidate_id` present
- `evidence_id = NULL`
- Evidence Candidate state: `READY`
- evidence authority: `product_specific_primary`
- confidence: `high`

No Registry v2 task was created for the pilot Product.

## GPT pilot authority ceiling

Latest Production readback on 2026-10-03:

- pilot Evidence Candidate tasks: 3
- pilot adopted Evidence tasks: 0
- pilot Product Fact Current: 0
- pilot Recommendation rows: 0

The GPT pilot therefore remains bounded at Evidence Candidate and has not performed:

- controlled Evidence adoption
- review preparation
- confirmation preflight
- Product Fact confirmation
- semantic SAME/CHANGED adjudication
- variant/supersession judgment
- Recommendation admission
- Recommendation runtime activation

## Coexistence with V2.1-8G3 governance

The independent V2.1 Product Fact governance track advanced after this GPT pilot:

- 8G3-A controlled Evidence ingest: COMPLETE
- 8G3-B Product Fact review preparation: COMPLETE
- current global Product Fact Current: 95
- current global review assignments: 102
  - confirmed: 95
  - ready_for_confirm: 6
  - superseded: 1
- current global Fact Instances: 96

Those 8G3-A/B writes belong to the frozen Wave 1 governance set, not to the GPT pilot Product.

The exact 16 frozen Wave 1 research tasks were re-read after the GPT pilot and after 8G3-A/B:

- total: 16
- pristine: 16
- attempt_count > 0: 0
- last_research_at non-null: 0

Therefore the GPT product-scoped manual claim operations did not mutate the #1060 frozen Wave 1 task set.

## Authority separation

The following two streams must remain distinct:

### GPT Catalog Intake pilot

`GPT research → validated identity → candidate → catalog-only Product → TRUST intake → Subject → required Fact tasks → official observation → Evidence Candidate`

Current ceiling: `Evidence Candidate`

### V2.1 frozen Wave 1 governance

`frozen Evidence → controlled Evidence ingest → governed review preparation`

Current global next gate from 8G3-B:

`V2.1-8G3-C_CONFIRMATION_PREFLIGHT_ONLY`

8G3-C may perform confirmation preflight only and must stop before Product Fact confirmation.

## Closure

The GPT Catalog Intake Production rollout is complete and remains authority-bounded.

The later 8G3-A/B governance progression does not retroactively authorize the GPT pilot to adopt Evidence or confirm Product Facts.

Any future GPT-pilot Evidence adoption must enter the controlled Product Fact governance path explicitly rather than being performed by the GPT automation itself.
