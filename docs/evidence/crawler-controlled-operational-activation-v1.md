# CRAWLER-CONTROLLED-OPERATIONAL-ACTIVATION v1

Status: `STRICT_SUCCESS_CLOSED`

Primary outcome:

`CONTROLLED_CRAWLER_OPERATION_VALIDATED__NO_SAFE_CANONICAL_ADOPTION_CANDIDATE`

## 1. Starting authority

- main: `4b6dfaf6d90826728f8029bcaa3be3fcde77c3f5`
- Production Git SHA: `4b6dfaf6d90826728f8029bcaa3be3fcde77c3f5`
- Production deployment: `dpl_EqbP54AMPdFPF3jta71Lcvd5CHCC`
- Production READY: `YES`
- PR #297: merged; structural-only canonical adoption and fail-closed identity resolution authority frozen
- related main drift: `NONE`
- initial crawler runtime/scheduler/auto-adoption: `OFF / OFF / OFF`

Frozen authority was not redesigned: `crawler-canonical-product-structural-adoption-v1`, `crawler-identity-resolution-v1`, G3/G3A/G2, PDA, CandidatePolicy, Recommendation scoring, and the Legacy 164 corpus.

## 2. Controlled run manifest

The exact manifest was frozen before any external request.

- stage_version: `crawler-controlled-operational-activation-v1`
- source: `hwahae`
- crawler_job_id: `hwahae-skincare-toner-category-all`
- source_category/theme: `toner / category_all / theme_id=5106`
- service_category: `toner_essence`
- target_url: `https://www.hwahae.com/en/rankings?english_name=category&theme_id=5106`
- expected_rank_ceiling: `10`
- crawl_execution_ceiling: `1`
- logical_navigation_ceiling: `2`
- gateway_api_request_ceiling: `0`
- delay_ms: `1500`
- retries: `2`
- observation_write_ceiling: `10`
- candidate_write_ceiling: `10`
- review_ceiling: `5`
- canonical_adoption_ceiling: `1`
- scheduler: `OFF`
- auto_adoption: `OFF`

Invocation:

```text
npm run crawl -- --config=config/controlled-operational-activation-v1.json --job-ids=hwahae-skincare-toner-category-all --delay-ms=1500 --retries=2
```

No `--all`, cron, scheduler activation, auto-adoption, bulk promotion, PF creation, PDA creation, or Recommendation admission mutation was used.

## 3. Pre-run Hosted state

```text
ranking_snapshots             = 27
source_rankings               = 780
product_candidates            = 164
candidate_promotion_reviews   = 50
structural_adoption_requests  = 0
products                      = 164
legacy                        = 164
non_legacy                    = 0
registry_versions             = 1
definition_snapshots          = 20
subjects                      = 16
fact_instances                = 41
evidence_links                = 41
review_assignments            = 41
review_events                 = 180
confirmations                 = 41
current_facts                 = 41
```

Legacy UUID SHA256:

`b6577d95353c4151152cf82e1705131516d5a2558cb68241a8f9fd48d9047a05`

## 4. Narrow operational defect remediation

The first execution attempts stopped before any Hwahae request because crawler ESM code imported named exports from root `lib/security/image-source-policy.js` through a package boundary that Node interpreted incompatibly.

A broad `lib/security/package.json {"type":"module"}` experiment was rejected because it changed unrelated root security module semantics and broke the Production build. It was fully removed.

The accepted narrow remediation is crawler-scoped only:

- `crawler/image-source-policy-loader.mjs` forces ESM interpretation for exactly `lib/security/image-source-policy.js` when the crawler runs.
- `crawler/package.json` routes only crawler entrypoints through that loader.
- `crawler/test-security-policy-runtime-import.ts` guards valid/invalid image-source behavior.
- root Production module semantics remain unchanged.

Before the real source request, the following passed on the controlled runner:

```text
crawler TypeScript typecheck = PASS
crawler security policy runtime import = PASS
Production Next build = PASS
```

A second narrow operational issue was credential retrieval: the current Supabase secret key requires Management API reveal semantics. The runner retrieves the active server credential without logging it, masks it, and does not persist it in repository artifacts.

## 5. Actual external source run

Exact source-run repository HEAD:

`79ce7361b0817dcdb60ec5f30836b40e4c9c2dbc`

GitHub Actions:

```text
run_id = 32559643335
job_id = 96999163271
```

Hosted crawl job:

```text
id         = 291278d9-6568-48b3-b12b-3b60de7dcf16
source     = hwahae
status     = completed
item_count = 10
started_at = 2026-08-22T16:29:05.353+09:00
ended_at   = 2026-08-22T16:29:12.700+09:00
error_log  = NULL
```

Run result:

```text
jobs crawled                  = 1
jobs succeeded                = 1
jobs failed                   = 0
rows observed                 = 10
snapshots written             = 1
source_rankings written       = 10
source ranking duplicates     = 0
new candidates                = 4
reobserved candidates         = 6
pending identity collisions   = 0
products written              = 0
errors                        = 0
```

Frozen snapshot:

```text
snapshot_id   = 61f23a01-1471-4a5d-82bc-66893d56ba06
snapshot_hash = f2fd49dd1bedd7ac593ff622af4fdd8885aa2123c7e3b9a3942b41d2d0c9a526
ingest_key    = 1e189bd7533c77bbf7cd4a413d6156f472f45d2df5ca9b4913eaa6725f531475
collected_at  = 2026-08-22T16:29:11.639+09:00
```

No source schema/contract drift was detected.

## 6. Candidate intake and review authority

Live review contract was read back from Hosted authority rather than assumed from historical documentation.

- rule version: `ranking-review-v2`
- observed date: KST calendar date
- immediate: latest concern rank `<=15`
- persistent: latest concern rank `16-30` and same concern on `>=2` distinct KST dates
- reinforced: latest concern rank `31-50` and same concern on `>=3` distinct KST dates plus reinforcement
- popularity-only evidence does not queue a candidate

The filtered crawl intentionally skipped automatic review refresh. Exactly one explicit Hosted refresh was then executed:

```text
candidates_examined        = 30
reviews_updated            = 30
reviews_inserted           = 0
reviews_deferred           = 0
protected_reviews_skipped  = 0
products_written           = 0
```

Post-refresh queue remains:

```text
ranking-review-v2 / queued   = 30
ranking-review-v2 / deferred = 20
```

All ten run-touched candidates retained source-native external identity, raw brand/name, source locator, rank evidence, and normalized comparison keys.

For all ten run-touched candidates:

```text
popularity_latest_rank          = 1..10
concern_best_rank               = NULL
concern_distinct_observed_dates = 0
distinct_concern_count          = 0
queue_eligible                  = false
queue_policy                    = NULL
identity_resolution_state       = unresolved
```

Therefore:

```text
run-touched review eligible = 0
manual review selected       = 0
```

This is correct fail-closed behavior. Popularity rank alone is not Recommendation/canonical identity authority.

## 7. Run-touched candidates

| Rank | Candidate | External ID | New/Reobserved | Review eligible |
|---:|---|---|---|---|
| 1 | mixsoon — Soondy Centella Asiatica Essence | 2090481 | new | no |
| 2 | mixsoon — Centella asiatica toner | 2095045 | new | no |
| 3 | S.NATURE — AQUA OASIS TONER | 1950255 | reobserved | no |
| 4 | Torriden — DIVE IN Low Molecular Hyaluronic Acid Toner | 1890897 | reobserved | no |
| 5 | mixsoon — Galactomyces Toner | 1901001 | new | no |
| 6 | SIDMOOL — GREEN TEA SKIN | 1991488 | reobserved | no |
| 7 | ROUNDLAB — 1025 Dokdo Toner | 1779219 | reobserved | no |
| 8 | TONYMOLY — Ceramide Mochi Toner | 2197271 | reobserved | no |
| 9 | manyo — Bifida Biome Ampoule Toner | 1872355 | new | no |
| 10 | Dr.twentyproject — 9 Toner | 2108567 | reobserved | no |

Normalization remained a comparison aid only and did not resolve identity.

## 8. Identity resolution and structural promotion

No run-touched candidate became review-eligible. Therefore the Stage did not bypass the review boundary merely to force a canonical write.

```text
identity candidates reviewed = 0
resolved                     = 0
identity ambiguous           = 0
variant conflicts            = 0
formulation conflicts        = 0
reformulation candidates     = 0
run-touched unresolved       = 10
selected for promotion       = 0
promotion attempted          = NO
canonical promotions         = 0
```

No duplicate check was elevated into canonical authority and no candidate was coerced from `unresolved` to `resolved`.

Because promotion was not reached, the structural semantic denylist remained untouched:

```text
skin_types       crawler delta = 0
concerns         crawler delta = 0
texture          crawler delta = 0
finish           crawler delta = 0
irritation_risk  crawler delta = 0
sensitivity_safe crawler delta = 0
```

## 9. G3 / Recommendation authority

No structural canonical product was created, so there is no legitimate new non-legacy UUID on which to perform the requested missing-PF runtime rejection probe.

```text
new product G3 probe = NOT_APPLICABLE_NO_STRUCTURAL_PROMOTION
```

The Stage does not fabricate a product or Product Fact merely to obtain a G3 counter. Instead, closeout CI revalidates the already-frozen G3, G3A, G2, PDA, CandidatePolicy and historical Recommendation contracts.

This is the Success Case B path defined by the Stage: operational crawler resumption can succeed while canonical adoption remains zero because no candidate safely crosses the review/identity boundary.

## 10. Hosted post-run state and delta ledger

Post-run:

```text
ranking_snapshots             = 28
source_rankings               = 790
product_candidates            = 168
candidate_promotion_reviews   = 50
structural_adoption_requests  = 0
products                      = 164
legacy                        = 164
non_legacy                    = 0
registry_versions             = 1
definition_snapshots          = 20
subjects                      = 16
fact_instances                = 41
evidence_links                = 41
review_assignments            = 41
review_events                 = 180
confirmations                 = 41
current_facts                 = 41
```

Authorized deltas:

```text
ranking_snapshots             +1
source_rankings               +10
product_candidates            +4
candidate reobservations      6
promotion review row count    0
promotion review rows refreshed 30
structural adoption requests  0
products                      0
```

Authority deltas:

```text
Product Fact authority delta              = 0
Recommendation semantic authority delta   = 0
unauthorized Hosted delta                  = 0
```

## 11. Legacy invariance

Post-run product count is still 164.

The frozen UUID hash was recomputed from sorted product UUIDs joined by newline with a trailing newline:

`b6577d95353c4151152cf82e1705131516d5a2558cb68241a8f9fd48d9047a05`

It exactly matches the frozen Legacy 164 authority.

Closeout CI runs the historical canonical `164×12` Recommendation invariance verifier and CandidatePolicy verifier without another source crawl.

## 12. Idempotency / repeat safety

No second external crawl was executed merely to prove idempotency.

Repeat safety is established from the frozen ingest/review contracts and closeout regression tests:

- source identity/upsert prevents the same observation from creating a second canonical identity authority;
- structural promotion remains impossible without explicit resolved identity and controlled adoption;
- same-day observations share one KST observed date and cannot inflate multi-day persistence;
- repeated observations do not erase `unresolved`/conflict identity state;
- canonical promotion was never attempted in this run.

## 13. Final activation state

```text
manual controlled crawler = CONTROLLED_RESUMPTION_VALIDATED
scheduled crawler          = OFF
cron                       = OFF
auto adoption              = OFF
bulk promotion             = OFF
```

## 14. Terminal classification

```text
CRAWLER-CONTROLLED-OPERATIONAL-ACTIVATION =
STRICT SUCCESS / CLOSED

PRIMARY OUTCOME =
CONTROLLED_CRAWLER_OPERATION_VALIDATED__NO_SAFE_CANONICAL_ADOPTION_CANDIDATE

CRAWLER_OPERATION =
CONTROLLED_RESUMPTION_VALIDATED

CANONICAL_ADOPTION =
0

RECOMMENDATION_AUTHORITY_SEPARATION =
FROZEN_BOUNDARY_REVALIDATED__NO_NEW_PRODUCT_RUNTIME_PROBE_APPLICABLE

CRAWLER_SCHEDULER =
OFF

AUTO_ADOPTION =
OFF

NEXT =
NEXT_BOUNDED_CONTROLLED_RUN
```

No remaining operational blocker is asserted by this Stage. A future bounded run may select another validated source job; periodic scheduling remains a separate authorization decision.
