# Cross-category Pilot Product Fact Materialization Dry-run v1

> Offline deterministic proposal only. Hosted Product Fact business writes = 0.

## Authority

- execution authority main: `22c20146192e9075c9d9cb36be7e5f49f83d3119`
- frozen pilot head: `596493154b74548187ed71f8d522bb41c7ad1900`
- registry blob: `32fdaa2d3a181c9d18888fc48c1343e083ad20f7`
- corpus SHA-256: `47457c0242451a35305fd8eceba0ebb7e210eb9ee2e73134ccf41696d18e517d`
- mapping SHA-256: `c746c5d02f654ed7f0a8e8385611ac65ca30b9c4648fa4c6454ac863e7c9314f`
- gap SHA-256: `5a4580d76cca62d90a3ac306744054c507a6d5e45b0b91a41dffb3b754980215`

## Summary

- products: 12
- sources: 15
- evidence records: 29
- frozen fused facts: 23
- subjects: 11 resolved / 1 ambiguous
- evidence proposals: 29 (23 materializable / 6 blocked)
- fact proposals: 26 (23 confirmation-eligible / 3 blocked)
- forced mappings: 0
- Hosted writes: 0

## Materialization boundary

The dry-run preserves Product != Product Fact Subject, Evidence != Fact, and Fact Instance != Current. The single ambiguous NEEDLY subject remains provisional and confirmation/current-ineligible. Registry gaps, source gaps, and relationship-identity gaps are retained rather than force-mapped.

Source `content_digest` proposals hash the frozen source provenance record because the frozen pilot contains locators and extraction provenance but no external page-byte snapshot. The digest basis is explicitly tagged and must not be represented as a byte hash of the live webpage.

The proposal `fusion_input_digest` is deterministic over frozen semantic identities. PF runtime fusion digests that include Hosted UUID identities remain deferred until a future approved Hosted materialization allocates those UUIDs.

## Expected writes if the full deterministic eligible set were later materialized

| relation | inserts | updates | deletes | phase |
|---|---:|---:|---:|---|
| product_fact_registry_versions | 1 | 0 | 0 | registry_publish |
| product_fact_definition_snapshots | 20 | 0 | 0 | registry_publish |
| product_fact_subjects | 12 | 0 | 0 | subject_registration |
| product_evidence_sources | 15 | 0 | 0 | evidence_ingest |
| product_evidence_source_subject_bindings | 15 | 0 | 0 | evidence_ingest |
| product_evidence_records | 23 | 0 | 0 | evidence_ingest |
| product_fact_instances | 23 | 0 | 0 | future_full_eligible_confirmation_envelope |
| product_fact_evidence_links | 23 | 0 | 0 | future_full_eligible_confirmation_envelope |
| product_fact_review_assignments | 34 | 46 | 0 | review_then_future_confirmation |
| product_fact_review_events | 115 | 0 | 0 | subject/evidence/review/future_confirmation |
| product_fact_confirmations | 23 | 0 | 0 | future_full_eligible_confirmation_envelope |
| product_fact_current | 23 | 0 | 0 | future_full_eligible_confirmation_envelope |

These are a deterministic full-eligible-set planning envelope, not authorization for V2.1-3. V2.1-3 remains coordinator-selected and may confirm only a smaller subset.

## Lifecycle

- PRODUCT_FACT_CATALOG_ADOPTED = NO
- CATALOG_ADOPTED = NO
- DECISION_AXIS_CONSUMPTION = NO
- RECOMMENDATION_ACTIVATED = NO
