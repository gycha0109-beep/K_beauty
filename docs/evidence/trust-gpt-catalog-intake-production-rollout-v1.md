# TRUST GPT Catalog Intake — Production Rollout Closeout v1

## Decision

`TRUST_GPT_CATALOG_INTAKE_PRODUCTION_ROLLOUT_PASS`

Production project: `bygrczggxfuisupcevaz`

Captured: 2026-10-02 KST

Watchtower-Track: `pipeline-reliability`

## Deployed migration

- version: `20261001183000`
- name: `trust_gpt_catalog_intake_pipeline_v1`
- repository blob SHA: `f65596ab65408abbe41be76d8ec6d035c4ab8b39`
- migration history recorded with the original version/name
- 8G0 remains applied as `20261002142611_v21_8g0_registry_pinned_reconciliation_v1`
- 8G1 remains applied as `20261002153238_v21_8g1_identity_authority_preservation_v1`

The repository had no remote `supabase db push` deployment workflow. The migration body was therefore executed against Production with its outer `begin/commit` removed and wrapped together with the exact `supabase_migrations.schema_migrations` history insert in one transaction. No `migration repair` was used.

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

Immediately after migration and before the pilot, these pre-existing counts were unchanged:

- products: 175
- product_candidates: 198
- catalog_trust_intake: 174
- product_fact_subjects: 46
- product_fact_research_tasks: 451
- product_source_bindings: 151

## Production pilot

Pilot request:

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

Initial ingest result:

- state: `TRUST_RESEARCH_READY`
- automatic_confirmation: false
- product_fact_confirmation: false
- recommendation_admission: false
- idempotent replay: PASS
- changed-request reuse conflict: PASS
- unsupported taxonomy fail-closed: PASS
- product-scoped claim isolation: PASS
- Registry v2 forced probe: fail-closed PASS

## Registry v1 research result

All three sunscreen-required tasks remained pinned to:

`product-fact-registry-cross-category-v1`

Final task states:

| Fact | Value | Evidence class | State |
| --- | --- | --- | --- |
| `spf_value` | `50` | `product_claim` | `EVIDENCE_CANDIDATE` |
| `uva_label` | `PA++++` | `product_claim` | `EVIDENCE_CANDIDATE` |
| `uv_filter_type` | `organic` | `composition_identity` | `EVIDENCE_CANDIDATE` |

All three:

- attempt_count: 1
- evidence_candidate_id: present
- source_observation_id: present
- evidence_id: null
- candidate_state: `READY`
- evidence_authority: `product_specific_primary`
- confidence: `high`

No Registry v2 task was created for the pilot Product.

## Authority ceiling

After all three Evidence Candidates:

- Product Fact Current for the pilot Subject: 0
- Recommendation rows for the pilot Product: 0
- adopted Evidence task count: 0
- Evidence Candidate task count: 3
- research pending task count: 0

The GPT pipeline therefore stopped at Evidence Candidate. It did not perform:

- Product Fact Evidence adoption
- review preparation
- confirmation preflight
- Product Fact confirmation
- semantic SAME/CHANGED adjudication
- variant/supersession judgment
- Recommendation admission
- Recommendation runtime activation

The pilot intake remains `RESEARCH_PENDING`; this is expected because Evidence Candidate creation does not itself cross the controlled Evidence/Fact authority boundary.

## Coexistence with V2.1-8G3

After PR #1060 introduced the privileged manual claim STOP gate for the frozen Wave 1 set, the exact 16 frozen task IDs from `v21-8g2-wave1-required-fact-research-closeout-v1.json` were re-read.

Readback:

- total frozen tasks: 16
- pristine frozen tasks: 16
- attempt_count > 0: 0
- last_research_at non-null: 0
- max updated_at: `2026-10-02 15:43:44.136807+09`
- global Product Fact Current: 95

The Production pilot used only the newly created GPT Product `888eca86-af25-4a12-b9ea-47922d83f520`. The frozen Wave 1 task set was not claimed or mutated.

This preserves the #1060 requirement that 8G3-A must not invoke the GPT research claim RPC for those existing frozen Wave 1 Product IDs.

## Final Production delta

After the single pilot:

- products: 176
- product_candidates: 199
- catalog_trust_intake: 175
- product_fact_subjects: 47
- product_fact_research_tasks: 454
- product_source_bindings: 153
- trust_source_observations: 31
- trust_evidence_candidates: 32

## Closure

A single real Product has exercised the full bounded path:

`GPT research → validated identity → candidate → taxonomy → catalog-only Product → TRUST intake → Subject → required Fact tasks → official observation → Evidence Candidate`

No higher authority boundary was crossed.

Next authority gate remains controlled Evidence adoption / Product Fact governance, not GPT automation.
