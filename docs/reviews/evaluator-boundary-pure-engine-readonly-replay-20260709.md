# Evaluator Boundary Pure Engine Read-only Replay - 2026-07-09

이 문서는 read-only product source 기반 pure engine replay evidence 문서이며, actual `/api/analyze` capture 또는 runtime 정책 변경 승인이 아니다.

## Phase 22 실패 요약

Phase 22는 `/api/analyze`를 호출하지 않고 shared decision engine path를 직접 호출했다.

```text
routeInvoked=false
supabaseWriteExecuted=false
runtimeMutation=false
```

하지만 4개 target scenario 모두 `candidate_source_empty_after_pure_engine_replay`로 실패했다. live product source는 direct Node 환경에서 unavailable이었고, fallback sanitized capture rows는 scorer가 요구하는 `name` / `brand` 등 필수 row field를 갖지 않아 candidate rows가 0개였다.

## Phase 24 Config Trace 결론

Phase 24에서 원인은 product policy가 아니라 direct Node env loading 차이로 확인됐다.

- `getRecommendationProducts()`는 `SUPABASE_URL` 또는 `NEXT_PUBLIC_SUPABASE_URL` 중 하나와 `SUPABASE_ANON_KEY` 또는 `NEXT_PUBLIC_SUPABASE_ANON_KEY` 중 하나가 필요하다.
- product read-only source에는 `SUPABASE_SERVICE_ROLE_KEY`가 필요하지 않다.
- `.env.local`에는 필요한 public Supabase URL/anon key 이름이 있었다.
- Phase 23/22 direct Node script는 `.env.local`을 자동 로드하지 않아 `missing_config`가 발생했다.

Phase 25 runner는 `.env.local`을 값 출력 없이 로드한 뒤 existing read-only `getRecommendationProducts()` source를 사용했다.

## Phase 25 목적

Phase 19의 4개 target scenario를 read-only Supabase product source로 pure engine replay 재실행하여, candidate rows가 생성되는지 확인했다.

대상 scenario:

- `target_active_acne_recent_instability`
- `target_redness_barrier_recent_instability`
- `target_pores_tone_active_recent_instability`
- `target_serum_tone_acne_recent_instability`

## Source Isolation

```text
evidenceType=pure_engine_replay
routeInvoked=false
apiAnalyzeInvoked=false
supabaseWriteExecuted=false
runtimeMutation=false
envValuesPrinted=false
productSource=getRecommendationProducts_read_only
syntheticProductsUsed=false
replayFallbackProductCount=0
```

No product names, brands, purchase URLs, review text, raw form data, image/base64, or PII are emitted in the replay artifact.

## Product Source Result

```text
productRowsLoaded=164
scorerCompatibleRows=164
scorerIncompatibleRows=0
serviceRoleRequired=false
```

Product category aggregate:

```text
cleanser=26
moisturizer_balm=20
moisturizer_cream=10
moisturizer_gel=10
moisturizer_lotion_emulsion=21
sunscreen=11
toner_essence=24
toner_pad=24
treatment=18
```

Recommendation slot aggregate:

```text
cleanser=26
moisturizer=61
serum=18
sunscreen=11
toner_essence=48
```

## Scenario Results

| Scenario | Status | Product rows | Scorer-compatible rows | Candidate rows | Boundary-applicable rows |
| --- | --- | ---: | ---: | ---: | ---: |
| `target_active_acne_recent_instability` | succeeded | 164 | 164 | 164 | 86 |
| `target_redness_barrier_recent_instability` | succeeded | 164 | 164 | 164 | 0 |
| `target_pores_tone_active_recent_instability` | succeeded | 164 | 164 | 164 | 86 |
| `target_serum_tone_acne_recent_instability` | succeeded | 164 | 164 | 164 | 86 |

Aggregate:

```text
scenariosAttempted=4
scenariosSucceeded=4
scenariosFailed=0
totalCandidateRows=656
boundaryApplicableRows=258
```

Candidate rows increased from Phase 22 `0` to Phase 25 `656`.

## Decision Summary

```text
downgrade_to_collapsed_candidate=156
preserve_hard_block=99
requires_metadata_review=0
not_applicable=401
```

## Gap Coverage

### Active-leaning Only

```text
status=not_observed_in_pure_engine_replay
totalRows=0
boundaryApplicableRows=0
```

No active-only / active-leaning-only product profile was observed in this replay distribution.

### Metadata Incomplete

```text
status=not_observed_in_pure_engine_replay
totalRows=0
boundaryApplicableRows=0
```

No metadata-incomplete product row was observed. This means the read-only product source is currently metadata-complete for the inspected fields; it does not validate the `requires_metadata_review` branch with real rows.

### Serum Category

```text
status=observed_in_pure_engine_replay
totalRows=168
boundaryApplicableRows=66
decisionDistribution:
  downgrade_to_collapsed_candidate=39
  preserve_hard_block=24
  not_applicable=105
  requires_metadata_review=0
```

Serum-family rows were observed through `essence` and `treatment` categories. Category alone did not force one uniform hard-block outcome; decisions depended on safety/profile context.

### Strong Caution Metadata

```text
status=not_observed_in_pure_engine_replay
totalRows=0
boundaryApplicableRows=0
```

No product-level strong caution tag candidate was observed in this replay artifact.

### Safe Low-risk Hidden

```text
status=observed_in_pure_engine_replay
totalRows=150
boundaryApplicableRows=150
decisionDistribution:
  downgrade_to_collapsed_candidate=150
```

This is pure replay evidence only. It must not be mixed with the 50 safe-low-risk hidden rows from actual complete/product_row captures.

## High-risk Protection

```text
highRiskCollapsedCount=0
```

No unsafe/high-risk candidate was downgraded to collapsed in this replay.

## Evidence Separation

This artifact is not actual `/api/analyze` capture evidence.

- It does not call `/api/analyze`.
- It does not execute guard/session/premium-store route mutation paths.
- It does not write Supabase.
- It does not increase actual complete/product_row capture counts.
- It does not approve evaluator or CandidatePolicy runtime integration.

## Remaining Limitations

- active-leaning-only rows are still not observed.
- metadata-incomplete rows are still not observed.
- strong caution metadata rows are still not observed.
- Product source is read-only but environment-dependent.
- Replay does not exercise route guard/session/premium-store boundaries.

## Runtime 미적용 확인

Phase 25 did not modify:

- [app/api/analyze/route.js](D:/Ji_hwan/K_Beauti%20AI/app/api/analyze/route.js)
- [lib/skin-match-decision-engine.js](D:/Ji_hwan/K_Beauti%20AI/lib/skin-match-decision-engine.js)
- evaluator hard filter / score / weight
- CandidatePolicy runtime
- UI/API response
- DB/Supabase schema/migration/policy
- product data
- existing capture fixture originals
- topPick / supportingProducts / budgetAlternatives runtime behavior

## Phase 26 Return Point

Phase 26 should review the new read-only replay evidence separately from actual capture evidence and decide whether remaining unobserved gaps need synthetic branch validation, targeted product metadata audit, or approved dev-only actual capture expansion. Runtime evaluator/CandidatePolicy wiring still requires a separate approved task.

## Validation

- `node scripts/run-pure-engine-target-scenario-replay.mjs` passed.
- `node scripts/verify-pure-engine-target-scenario-replay.mjs` passed.
- `node scripts/verify-pure-engine-replay-readonly-source.mjs` passed.

Node emitted existing direct-ESM `--experimental-loader` and `MODULE_TYPELESS_PACKAGE_JSON` warnings.
