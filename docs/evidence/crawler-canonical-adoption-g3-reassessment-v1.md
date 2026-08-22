# CRAWLER-CANONICAL-ADOPTION-REASSESSMENT v1

## Scope

This artifact freezes the read-only reassessment of the historical crawler blocker:

`CRAWLER_CANONICAL_ADOPTION_BLOCKED_BY_RECOMMENDATION_ELIGIBILITY_AUTHORITY_GAP`

Starting repository / Production authority:

- repository: `gycha0109-beep/K_beauty`
- starting `main`: `4acc939ce487e9fa277672b5b2da63b31bfcca2c`
- Production deployment SHA: `4acc939ce487e9fa277672b5b2da63b31bfcca2c`
- Production deployment state: `READY`
- G3 PR: `#291`, merged
- G3 branch final HEAD: `b017404fbda3073d821aa076f62b46b4426f185a`
- G3 merge SHA: `4acc939ce487e9fa277672b5b2da63b31bfcca2c`
- PR `#288`: open, Persona Evaluation-only changes; `UNRELATED_PARALLEL_DRIFT`

This reassessment does not activate the crawler, run an external crawl, create canonical Production products, create Product Fact authority, modify G3/G3A/G2/PDA/scoring/ranking/CandidatePolicy/ENFORCE, or mutate hosted business data.

## Historical blocker

Before G3, canonical presence in `products` was sufficient to enter the Recommendation product path. There was no fail-closed Product Fact/PDA/G2 admission boundary between canonical storage and Recommendation normalization/scoring. Therefore crawler canonical adoption was blocked.

Historical state:

- blocker: `CRAWLER_CANONICAL_ADOPTION_BLOCKED_BY_RECOMMENDATION_ELIGIBILITY_AUTHORITY_GAP`
- crawler canonical adoption: `BLOCKED`
- crawler resume: `NO`

## Current G3 authority

Current Production `fetchSupabaseProducts()` performs deterministic complete `products` enumeration and then invokes `admitRecommendationProducts(data)` before `buildSupabaseProduct()` normalization and before scoring/CandidatePolicy consumption.

The frozen G3 route is:

```text
raw canonical products
-> deterministic complete enumeration
-> exact frozen legacy UUID membership?
   YES -> LEGACY_COMPATIBILITY_ADMISSION
   NO  -> protected PF authority read
       -> existing PDA mapper
       -> frozen G2 initial-admission evaluator
       -> admit only INITIAL_ADMISSION_GRANT
-> admitted rows only
-> normalization / legacy semantic mapping
-> scoring
-> CandidatePolicy
-> Recommendation output
```

Authority or infrastructure failure throws closed and Recommendation product sourcing fails rather than bypassing admission.

Production telemetry emits:

- `enumerated_count`
- `legacy_admitted_count`
- `nonlegacy_checked_count`
- `nonlegacy_granted_count`
- `nonlegacy_rejected_count`
- `authority_failure_count`

Therefore the historical Recommendation eligibility authority gap is resolved by G3.

## Legacy isolation

Frozen legacy authority:

- corpus key: `LEGACY_FROZEN_RECOMMENDATION_CORPUS_V1`
- count: `164`
- SHA256: `b6577d95353c4151152cf82e1705131516d5a2558cb68241a8f9fd48d9047a05`

The exact Production `products.id` set was read back in sorted UUID order and produced the same SHA256 with count `164`.

Legacy membership is exact UUID membership from the frozen fixture. It is not inferred from `created_at`, database presence, row ordering, count, source, brand, category, or ID range. A newly generated canonical product UUID cannot inherit legacy compatibility status.

Current Production catalog state at reassessment:

- products: `164`
- exact legacy members: `164`
- non-legacy products: `0`
- G3 enumerated: `164`
- legacy admitted: `164`
- nonlegacy checked: `0`
- nonlegacy granted: `0`
- nonlegacy rejected: `0`
- authority failures: `0`

The runtime counter values above are the frozen current-state result for the exact 164 legacy input and match the G3 Production probe contract.

## Fail-closed non-legacy behavior

Existing G3 controlled fixtures/verifier establish:

- missing PF authority -> rejected
- unsupported G2 v1 category -> rejected
- evidence insufficient -> rejected
- evidence conflict -> rejected
- malformed/missing authority -> rejected
- malformed/unavailable PDA -> rejected
- authority infrastructure failure -> fail closed
- valid PF/PDA/G2 `INITIAL_ADMISSION_GRANT` -> admitted
- rejection occurs before normalization/scoring

G2 v1 supported categories remain `treatment`, `toner_essence`, and `toner_pad`. Unsupported categories may exist canonically but cannot obtain G2 v1 admission through fallback semantics.

## Current crawler architecture

Observation path:

```text
Hwahae/source observation
-> ranking snapshot
-> source_rankings
-> product_candidates
-> candidate_promotion_reviews
-> manual reviewed intake / legacy promotion tooling
-> products
```

Phase-1/2 ranking ingestion is observational and does not write `products`. Candidate identity uses stable external source identity and repeated ranking observations are conflict-safe/idempotent.

Canonical product writes exist outside ranking collection through manual promotion/review-confirm paths. `crawler/promote-approved.ts` invokes `promote_product_candidate`; reviewed intake confirmation ultimately invokes the same canonical promotion contract.

No Vercel cron is configured, no Supabase `cron.job` table exists in the current hosted project, and no active crawler-specific branch/PR or repository workflow was found that schedules `npm run crawl`. Current crawler execution and canonical auto-adoption are therefore not active Production schedulers. Canonical promotion remains an explicit/manual privileged action.

## Crawler authority ceiling

Crawler/review authority may cover:

- source observation
- external product identity candidate
- brand/name/category candidate
- variant candidate
- source URL and source metadata
- raw descriptive observation
- canonical product candidate/adoption workflow state

Crawler/review authority must not assert:

- efficacy
- safety
- irritation authority
- potency
- governed `contains_active` truth
- Product Fact Current authority
- PDA authority
- `INITIAL_ADMISSION_GRANT`
- Recommendation admission
- Recommendation score/ranking
- CandidatePolicy authority
- ENFORCE authority

Required lineage remains:

```text
crawler observation
-> canonical product
-> governed PF process
-> Product Fact Current
-> PDA
-> G2
-> G3 admission
```

## Residual crawler-specific blocker: canonical write authority overreach

Although G3 now prevents crawler-written fields from granting Recommendation admission, the current crawler canonical promotion contract still requires and writes legacy Recommendation semantic fields into `products`:

- `skin_types`
- `concerns`
- `texture`
- `finish`
- `irritation_risk`
- `sensitivity_safe`

`crawler/lib/reviews/reviewed-intake-contract.ts` requires field evidence for these semantics, and `admin_confirm_product_review_import_batch` / `promote_product_candidate` forwards them into canonical `products` INSERT/UPDATE.

This does **not** bypass G3 admission. However, after a separate governed PF/PDA/G2 grant, these values are still consumed by downstream normalization/scoring. They therefore exceed the frozen crawler authority ceiling and make the current canonical adoption contract unsuitable for resume.

Precise residual blocker:

`CRAWLER_REASSESSMENT_BLOCKED_BY_CANONICAL_WRITE_AUTHORITY_OVERREACH`

## Residual identity / variant / reformulation gap

Current promotion identity normalization removes volume and option/renewal markers including `renewal`, `리필`, `한정`, `기획`, and other packaging/options before normalized product comparison. Current candidate/review storage does not preserve explicit governed states such as:

- `identity_ambiguous`
- `variant_scope_conflict`
- `formulation_scope_conflict`
- `reformulation_candidate`

External source identity remains useful and prevents repeated source observations from duplicating candidates, but normalized brand/name fallback is not sufficient to freeze formulation lineage. A renewal/reformulation candidate must not be silently collapsed into an existing canonical product.

This is a second resume-gate defect to be remediated with the canonical write authority overreach; it does not reopen G3.

## Bypass audit

- Production `/api/analyze` Recommendation path consumes `getRecommendationProducts()` and is protected by G3 before normalization/scoring.
- crawler ranking ingestion does not import or invoke Recommendation scoring/output.
- no crawler executable path was found that can directly set `INITIAL_ADMISSION_GRANT`.
- no crawler executable path was found that can directly create/override Product Fact Current or PDA authority.
- manual `promote_product_candidate` writes canonical `products`; it does not itself invoke Recommendation scoring or G3 grant.
- current `products` readers used for recommendation normalization are downstream of the G3 admission projection.

Result: `NO_ACTIVE_CRAWLER_TO_RECOMMENDATION_BYPASS`.

## Controlled reassessment fixtures

| Case | Expected | Result | Evidence basis |
| --- | --- | --- | --- |
| C1 new non-legacy / no PF | admission NO | PASS | G3 missing-authority fail-closed fixture |
| C2 new non-legacy / unsupported category | admission NO | PASS | G3 unsupported-category fixture |
| C3 valid PF/PDA/G2 grant | admission YES | PASS | G3 complete-chain fixture |
| C4 evidence insufficient | admission NO | PASS | G3 insufficient fixture |
| C5 evidence conflict | admission NO | PASS | G3 conflict fixture |
| C6 malformed authority | fail closed | PASS | G3 malformed-authority fixture |
| C7 new product cannot become legacy | exact UUID isolation | PASS | frozen corpus count/hash + exact membership implementation |
| C8 rejection before normalization/scoring | no downstream processing | PASS | static gate ordering + G3 verifier |
| C9 crawler cannot directly set admission grant | no direct authority writer | PASS | crawler executable authority scan |
| C10 crawler cannot create/override PF/PDA authority | no direct authority writer | PASS | crawler executable authority scan |

No fixture creates or persists a Production catalog row.

## Hosted zero-data-delta baseline

Read-only hosted baseline during reassessment:

| Relation | Count |
| --- | ---: |
| `products` | 164 |
| `product_fact_registry_versions` | 1 |
| `product_fact_definition_snapshots` | 20 |
| `product_fact_subjects` | 16 |
| `product_fact_instances` | 41 |
| `product_fact_evidence_links` | 41 |
| `product_fact_review_assignments` | 41 |
| `product_fact_review_events` | 180 |
| `product_fact_confirmations` | 41 |
| `product_fact_current` | 41 |

This Stage permits only readback against hosted business data. Final closeout requires the same counts and `reassessment-induced business data delta = 0`.

## Frozen resume gate

| Gate | Requirement | Current state |
| --- | --- | --- |
| R1 | canonical identity/variant/category normalization preserves ambiguity and formulation lineage | **FAIL** — explicit variant/formulation/reformulation states absent |
| R2 | canonical write path does not assert Recommendation authority semantics | **FAIL** — legacy semantic fields are required/written |
| R3 | new products are guaranteed non-legacy | PASS |
| R4 | every new non-legacy Recommendation candidate passes G3 | PASS |
| R5 | missing PF fails closed | PASS |
| R6 | unsupported category fails closed | PASS |
| R7 | crawler cannot mutate PF/PDA/G2 admission authority | PASS |
| R8 | no active crawler Recommendation bypass exists | PASS |
| R9 | rollback/disable control exists | PASS — no scheduler/auto-adoption; privileged promotion is explicit and transactional |
| R10 | Production monitoring distinguishes catalog/admission outcomes | PASS — G3 emits enumerated/legacy/nonlegacy grant/reject/authority-failure counters; promotion returns write outcome |

The gate is frozen but not satisfied. Crawler activation remains prohibited.

## Classification

```text
Original Recommendation eligibility gap = RESOLVED
Crawler-specific residual blocker = CRAWLER_REASSESSMENT_BLOCKED_BY_CANONICAL_WRITE_AUTHORITY_OVERREACH
CRAWLER-CANONICAL-ADOPTION-REASSESSMENT = PARTIALLY_RESOLVED
PRIMARY OUTCOME = G3_RECOMMENDATION_ELIGIBILITY_GAP_RESOLVED__CRAWLER_CANONICAL_ADOPTION_REMEDIATION_REQUIRED
CRAWLER_CANONICAL_ADOPTION_BLOCKER = PARTIALLY_RESOLVED
CRAWLER_RESUME_GATE = FROZEN_NOT_SATISFIED
CRAWLER_RESUME = NO
```

## Required next Stage

`CRAWLER-CANONICAL-ADOPTION-AUTHORITY-REMEDIATION`

Minimum remediation scope:

1. Decouple structural canonical product adoption from crawler/review assertion of legacy Recommendation semantic fields.
2. Preserve explicit identity ambiguity, variant scope, formulation scope, and reformulation candidate states before canonical merge/adoption.
3. Preserve external-source identity and repeated-crawl idempotency.
4. Route newly adopted structural canonical products into the governed Product Fact research/adoption process without creating PF/PDA/G2 authority directly.
5. Re-run C1-C10 plus canonical adoption fixtures and existing Recommendation regression checks without modifying G3/G3A/G2/PDA/scoring/CandidatePolicy.
6. Only after R1-R10 all pass may a separate controlled crawler continuation Stage perform bounded canonical adoption.
