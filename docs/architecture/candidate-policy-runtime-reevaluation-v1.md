# CandidatePolicy Runtime Responsibility Re-evaluation v1

## 1. 현재 상태

이 문서는 `7a32d497744352f43468da144be889893e8e5cba`를 기준으로 CandidatePolicy의 실제 실행 경로를 재감사한 설계 결과다. 이번 변경은 문서와 결정론적 감사 verifier만 추가하며 runtime, flag, candidate 배열, 응답, UI, 저장 데이터는 변경하지 않는다.

확인된 현재 상태:

- `/api/analyze`는 먼저 `buildSkinMatchDecisionBundle()`을 호출한다.
- `lib/skin-match-decision-engine.js`에는 default-off evaluator CandidatePolicy runtime이 실제 production graph로 존재한다.
- 이 runtime은 활성화될 경우 `visibleCandidateIds`로 `scoredProducts`를 필터링한다.
- 필터링된 배열은 Top Pick, alternatives, supporting products, routine, budget alternatives에 공통으로 사용된다.
- canonical `SharedSkinDecisionContext`와 effective `FunctionalPolicy`는 그 뒤 `rebuildPremiumDecisionState()`에서 생성된다.
- `lib/functional-candidate-policy.js`는 production importer가 없고 verifier에서만 직접 호출된다.
- evaluator runtime과 shadow API는 `currentProductFindings`를 받을 수 있지만 실제 engine caller는 전달하지 않는다.
- 실제 Vercel 프로젝트의 Preview/Production environment key 감사에서는 CandidatePolicy 관련 key가 없었다. 설정을 변경하지 않았으며 현재 배포 상태는 `runtime_disabled`다.
- read-only actual catalog pure-engine replay는 164 products, 4 scenarios, 656 candidate rows를 처리했다. `safeLowRiskHidden`과 serum category는 actual evidence가 있고, active-only, metadata-incomplete, strong-caution은 actual replay에서 관측되지 않아 synthetic evidence와 구분해야 한다.

현재 결론은 runtime이 “없다”가 아니다. **실행 가능한 필터는 있으나 canonical policy가 만들어지기 전에 별도 goal/safety 계산을 수행하고, 별도의 group policy는 verifier-only로 남아 있는 이중 책임 상태**다.

## 2. 실제 call graph

### 2.1 Production 경로

```text
app/api/analyze/route.js
→ buildSkinMatchDecisionBundle()
→ lib/skin-match-decision-engine.js
→ resolveEvaluatorBoundaryPolicyRuntimeControl()
→ buildEvaluatorBoundaryPolicyRuntime()
→ buildEvaluatorBoundaryPolicyExecution()
→ functional ranking
→ recent-instability guard
→ guard exposure
→ collapsed hint
→ hint receiver
→ visibleCandidateIds
→ scoredProducts 배열 필터
→ Top Pick / alternatives / supporting / routine / budget
→ freeResult / premium report
→ rebuildPremiumDecisionState()
→ SharedSkinDecisionContext / FunctionalPolicy / CrossDomainConsistency
→ Premium projection / snapshot
```

핵심 순서 문제는 CandidatePolicy가 canonical effective `FunctionalPolicy`보다 먼저 실행된다는 점이다. runtime caller는 raw survey와 free-result priority를 다시 조합해 `FunctionalGoalPolicy`를 만들며, 이후 CrossDomainConsistency가 확정하는 effective goal을 직접 소비하지 않는다.

### 2.2 Shadow 경로

```text
development-only flags
→ buildEvaluatorBoundaryPolicyShadow()
→ 같은 evaluator / guard / exposure / hint receiver
→ diagnostics only
→ recommendation response 불변
```

Shadow API 역시 `currentProductFindings`를 받을 수 있지만 engine caller는 전달하지 않는다. 별도의 isolated replay와 synthetic canary 자산은 존재하나 production response를 바꾸지 않는다.

### 2.3 functional-candidate-policy 경로

```text
scripts/verify-functional-candidate-policy.mjs
→ buildFunctionalCandidatePolicy()
→ group visibility / intent / maxVisibleCandidates
```

`app`, `components`, `hooks`, `lib`에서 이 export를 import하는 production caller는 0개다. UI display model이나 evaluator runtime과 연결되지 않는다.

### 2.4 파일별 분류

| 파일 | export/역할 | 분류 | 실제 입력 | 실제 출력/downstream | 중복 책임 |
| --- | --- | --- | --- | --- | --- |
| `app/api/analyze/route.js` | analyze orchestration | runtime caller | request/survey/photo | decision bundle, Premium rebuild | 실행 순서를 결정 |
| `lib/skin-match-decision-engine.js` | legacy decision assembly | runtime caller | raw input, catalog | 실제 추천 배열 | goal 재구성과 candidate 제거 |
| `lib/evaluator-boundary-policy-runtime.js` | runtime adapter | runtime | products, survey, goal, optional findings | visible IDs, exposure rows, diagnostics | exposure와 hard removal |
| `lib/evaluator-boundary-policy-shadow.js` | evaluator execution | runtime+shadow shared | product별 evaluator context | exposure/hint rows | policy 실행 본체 |
| `lib/evaluator-boundary-policy-runtime-observability.js` | flag/kill switch/telemetry | runtime control | env-like values | enabled/mode/telemetry | 없음 |
| `lib/functional-ranking-contract.js` | candidate scoring relation | evaluator | product, goal, safety, optional findings | eligibility/ranking relation | findings 기반 관계 판정 |
| `lib/functional-guard-exposure-policy.js` | safety→exposure | evaluator | guard state | exposure state | exposure authority |
| `lib/evaluator-boundary-collapsed-hint-contract.js` | exposure→hint | adapter | exposure result | collapsed/hidden/insufficient hint | display 의미 포함 |
| `lib/candidate-policy-hint-receiver-contract.js` | hint receiver | adapter | hint | receiver decision, message type | runtime/display 의미 혼합 |
| `lib/functional-candidate-policy.js` | group policy | verifier-only | canonical-like decision, findings, groups | visibility, intent, cap | visibility와 presentation |
| `lib/premium-decision-state.js` | canonical policy build | canonical runtime | report | context, effective policies, projection | CandidatePolicy보다 늦게 실행 |
| `lib/premium-functional-projection.js` | canonical projection | runtime projection | effective FunctionalPolicy, products | functional plan/findings | hold/suppression 후보 제거 |
| `lib/premium-functional-display-model.js` | UI compatibility | projection/UI | saved/current report | display model | exposure 상태를 모름 |
| 관련 `scripts/verify-*` | contracts/replay | verifier-only | fixtures/source | assertions/artifacts | runtime 아님 |

## 3. 분류와 입출력 schema

### 3.1 체계 1: functional-candidate-policy

입력:

- canonical-like functional decision
- current product findings
- Top Pick/supporting/budget candidate groups

출력:

- group-level `visibility`
- `intent`
- `reason`
- `maxVisibleCandidates`
- 각 candidate group display policy

현재 특성:

- candidate별 safety evidence를 직접 평가하지 않는다.
- 배열에서 실제 candidate를 제거하지 않는다.
- `not_using`, `unanswered`, `not_in_db`, duplicate axis, supports goal을 group visibility/cap으로 해석한다.
- production readiness를 입증하는 caller나 downstream enforcement가 없다.
- 따라서 현재는 UI 정책도 runtime 정책도 아닌 **검증된 설계 prototype**이다.

### 3.2 체계 2: evaluator CandidatePolicy runtime

입력:

- scored products
- survey contract
- engine이 재구성한 functional goal policy
- optional current findings API
- safety/metadata/ranking inputs

출력:

- candidate별 exposure/hint/receiver rows
- `visibleCandidateIds`
- before/after/removed summary
- safe telemetry

현재 특성:

- 실제 배열을 제거한다.
- `"unchanged"` receiver만 visible로 남기고 collapsed/hidden/insufficient를 모두 같은 제거 결과로 만든다.
- Top Pick/supporting/budget/routine의 공통 입력을 제어한다.
- current findings API가 있으나 actual caller에서는 null이다.
- unexpected receiver/safety violation은 visible 0으로 fail-closed지만 runtime exception은 상위로 재throw된다.

### 3.3 명시적 답변

1. 두 정책은 완전히 같은 문제를 해결하지 않지만 visibility 결정 책임은 겹친다.
2. functional policy는 domain findings와 presentation cap이 섞인 group policy이고, evaluator runtime은 per-candidate safety/exposure와 실제 filtering이다.
3. 둘 다 visibility verdict를 만든다.
4. 실제 배열 제거는 evaluator runtime만 수행한다.
5. display hint는 evaluator hint receiver와 functional policy 양쪽에 있다.
6. canonical effective goal을 직접 읽는 정책은 현재 둘 다 아니다. functional prototype은 caller가 없어 실제 authority가 없고 evaluator caller는 pre-canonical goal을 재구성한다.
7. findings를 실제로 읽는 것은 functional prototype과 ranking contract다. evaluator runtime API는 지원하지만 caller가 전달하지 않는다.
8. evaluator guard chain이 safety를 가장 강하게 집행하지만 canonical effective safety context와 실행 순서가 분리돼 있다.
9. 같은 입력에서 group collapse와 per-product unchanged가 충돌할 수 있다.
10. 둘을 그대로 동시에 활성화하면 group cap과 candidate filtering이 중첩되는 double-filter 위험이 있다.

## 4. canonical 책임 모델

권장 책임 순서:

```text
SharedSkinDecisionContext
→ facts / uncertainty
FunctionalPolicy
→ effective goal / timing / intensity
CrossDomainConsistency
→ invariant / effective fallback
CandidateExposurePolicy
→ candidate exposure와 lane eligibility
Ranking
→ 허용 후보 내부 순위
Projection/UI
→ 결정된 exposure를 변형 없이 표시
```

`CandidateExposurePolicy`는 피부 상태, stabilizing 여부, goal priority, start/maintain/hold, intensity, routine frequency, current-product facts를 재계산하지 않는다. versioned canonical context와 effective policies에서 읽는다.

권장 exposure contract:

| Exposure | 의미 | Top Pick | Supporting | Budget | Routine | UI |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| `primary` | canonical 조건과 근거가 모두 충족된 주 후보 | 가능 | 가능 | 가능 | 가능 | 주요 노출 |
| `contextual` | 안전하지만 보조 문맥/조건이 필요한 후보 | 조건부 | 가능 | 가능 | 조건부 | 보조 노출 |
| `collapsed` | 비교는 가능하나 기본 추천 lane에는 부적합 | 불가 | 접힌 lane만 | 접힌 lane만 | 불가 | 사용자가 펼칠 때만 |
| `hidden` | canonical safety/consistency에 의해 노출 금지 | 불가 | 불가 | 불가 | 불가 | 미노출 |
| `insufficient_evidence` | 안전한 추천 결론에 필요한 evidence 부족 | 불가 | 불가 | 불가 | 불가 | 근거 부족 안내 |

현재 동작은 이 표와 다르다. evaluator runtime은 `collapsed`, `hidden`, `insufficient_evidence`를 모두 배열에서 제거하며 exposure 의미를 downstream에 보존하지 않는다. 목표 모델은 candidate별 exposure와 lane eligibility를 versioned output으로 유지해야 한다.

Ranking은 exposure eligibility를 통과한 후보 안에서만 순위를 계산해야 한다. 단, migration shadow 기간에는 기존 ranking 결과를 그대로 입력해 exposure를 비교하고 response는 변경하지 않는다.

## 5. current product semantics

현재 findings의 실제 효과:

- `functional-ranking-contract`에서는 same product, duplicate axis, supports goal, empty slot, not-in-db 등의 ranking relation과 penalty를 바꾼다.
- `functional-candidate-policy`에서는 group visibility, intent, cap을 바꾼다.
- evaluator runtime/shadow actual caller에는 전달되지 않으므로 production candidate filtering 효과는 없다.
- Premium canonical projection과 display에는 findings가 존재하지만 evaluator exposure metadata와 연결되지 않는다.

권장 fixture verdict:

| 시나리오 | 현재 확인된 효과 | 권장 exposure/관측 |
| --- | --- | --- |
| `valid_empty` | findings 없음/가용 상태가 구현별 다름 | contextual, empty-state reason |
| `not_using` | functional prototype visible | primary/contextual eligibility, add-missing-step reason |
| `unanswered` | prototype collapsed | insufficient_evidence, 사용자 확인 필요 |
| `partial_unknown` | 일부 relation만 평가 가능 | known은 평가, unknown은 insufficient |
| `populated` | ranking relation 변화 | candidate별 relation 적용 |
| goal 이미 충족 | prototype group collapse | same-product는 hidden, 같은 축 대체품은 의도 확인 전 contextual/collapsed |
| duplicate axis | prototype collapse/ranking penalty | 기본 lane collapsed, 자동 replace 확정 금지 |
| 다른 axis | ranking relation 변화 | safety 통과 시 contextual/primary |
| `not_in_db` | prototype collapsed | insufficient_evidence |
| selected + not_in_db | 혼합을 group 단위로 단순화 가능 | candidate별 known/unknown 분리 |
| 동일 제품 candidate | ranking relation 존재 | hidden 또는 maintain lane; 중복 추천 금지 |
| 같은 축 다른 제품 | duplicate/support relation | 사용자의 교체 의도 없으면 contextual/collapsed |
| 기능 축 unknown candidate | metadata에 따라 evaluator 차단 | insufficient_evidence |
| snapshot version invalid | canonical contract 검증 필요 | fail-closed insufficient |
| duplicate product ID | 별도 normalization 필요 | dedupe 후 reason count |
| findings 누락 | current caller의 실제 상태 | invalid-context/fallback count, 자동 safe 간주 금지 |
| findings malformed | normalize 경계별 차이 | fail-closed insufficient |

현재 제품이 goal을 지원한다는 이유만으로 같은 축 모든 후보를 자동 hidden하지 않는다. 교체 의도, 만족도, 제품 상태, unknown과 safety가 canonical facts로 존재할 때만 candidate별 verdict를 내린다.

## 6. goal·safety authority

### Goal authority

Authority 순서는 다음으로 고정한다.

```text
requested goal (trace only)
→ FunctionalPolicy effective goal
→ CrossDomainConsistency effective fallback
→ CandidateExposurePolicy input
→ Ranking goal
→ UI label
```

현재 evaluator runtime은 raw request와 `freeResultPriority.axis`로 별도 goal policy를 만든다. 통합 시 이 계산을 제거하고 canonical effective goal ID/version을 adapter로 전달해야 한다.

### Safety authority

CandidateExposurePolicy가 읽어야 할 canonical 값:

- `stabilize_first`
- `activeExpansionAllowed`
- `protectionMustMaintain`
- allowed intensity
- sunscreen evidence completeness
- sensitivity/irritation risk
- unknown exposure

불변식:

- stabilization이면 active candidate의 visible eligibility는 0이다.
- `protectionMustMaintain`이면 protection-complete sunscreen만 유지 후보가 될 수 있다.
- UVA/SPF/filter evidence가 불완전하면 recommendation lane에는 들어갈 수 없고 `insufficient_evidence`다.
- unknown은 safe로 간주하지 않으며 근거 없이 replacement/hidden도 확정하지 않는다.
- CandidateExposurePolicy는 이 값을 다시 추론하지 않는다.

## 7. downstream enforcement와 bypass

### 현재 일관된 부분

Evaluator runtime이 활성화된 경우 `exposureProducts`가 Top Pick, alt picks, supporting, routine assembly, budget alternatives의 공통 입력이다. 따라서 main engine 내부 lane에는 한 번의 실제 filter가 적용된다.

### 확인된 bypass/손실

1. canonical Premium policies가 생성되기 전에 filter가 실행돼 effective goal/safety와 불일치할 수 있다.
2. `currentProductFindings`가 caller에서 누락돼 current-product relation이 runtime exposure에 반영되지 않는다.
3. collapsed/hidden/insufficient가 모두 제거되어 UI, 저장 snapshot, KO/EN projection이 상태를 구분할 수 없다.
4. legacy/saved display adapter는 exposure contract를 모르며 저장된 candidate 배열만 표시한다.
5. functional-candidate-policy는 어느 lane에도 enforcement가 없다.
6. evaluator runtime exception은 기존 추천으로 안전하게 복귀하지 않고 analyze 전체를 실패시킬 수 있다.
7. current-product group policy를 나중에 연결하면 evaluator filter 뒤에 두 번째 filter/cap이 생길 수 있다.
8. saved report reentry는 snapshot을 재분석하지 않는 점은 올바르지만, exposure state가 snapshot에 없으므로 미래 adapter가 재구성하면 안 된다.

Negative case별 현재 판정:

| Case | 현재 evaluator runtime on | 남은 위험 |
| --- | --- | --- |
| hidden이 budget 재등장 | 공통 배열 filter로 차단 | legacy/snapshot에 상태 없음 |
| insufficient가 supporting 재등장 | 차단 | insufficient 안내도 소실 |
| stabilization active가 routine 재등장 | evaluator 판정이 맞으면 차단 | canonical stabilization과 입력 불일치 가능 |
| protection-incomplete sunscreen이 budget 재등장 | evaluator 판정이 맞으면 차단 | actual catalog metadata-incomplete evidence 부족 |
| collapsed가 Top Pick 승격 | 제거되어 차단 | collapsed UX 자체 소실 |
| duplicate candidate가 한 lane만 제거 | 공통 filter | findings 미전달 |
| KO/EN grouping 차이 | grouping 자체 없음 | future projection contract 필요 |
| reentry에서 재계산 | 현재 saved snapshot 사용 | future exposure persistence 필요 |
| legacy adapter가 복구 | 저장 배열 기반 | exposure field 부재 |
| fallback이 policy 우회 | exception 시 request failure | versioned fallback contract 부재 |

## 8. flag·kill switch·canary

실제 설정:

- enable: `ENABLE_EVALUATOR_BOUNDARY_CANDIDATE_POLICY_RUNTIME`
- kill switch: `DISABLE_EVALUATOR_BOUNDARY_CANDIDATE_POLICY_RUNTIME`
- production canary scope: `EVALUATOR_BOUNDARY_CANDIDATE_POLICY_CANARY_SCOPE=deployment_canary`
- deployment marker: `EVALUATOR_BOUNDARY_CANDIDATE_POLICY_CANARY_DEPLOYMENT=1`
- development shadow: `DEV_ONLY_SHADOW_BOUNDARY_DRY_RUN=1`과 `DEV_ONLY_BOUNDARY_POLICY_SHADOW=1`
- Preview probe에는 별도 opt-in flag가 있다.

상태 해석:

| State | 조건 |
| --- | --- |
| `runtime_disabled` | enable/disable 요청 없음 또는 enable 값이 정확히 `1`이 아님 |
| `shadow_only` | dev shadow 조건만 충족 |
| `canary` | production enable + 두 deployment canary guard 충족 |
| `runtime_enabled` | non-production enable, kill switch off |
| `kill_switched` | disable이 `1`; enable보다 우선 |
| `invalid_configuration` | production enable이나 canary guard 불충족; 실행 차단/stop telemetry |

percentage canary와 사용자 allowlist는 존재하지 않는다. 실제 Vercel environment key 감사에서는 관련 key 0개였으므로 Preview/Production은 `runtime_disabled`다. 이번 작업은 값을 추가·수정하지 않았다.

Rollback의 첫 수단은 kill switch이며, 그 전에 response-change 없는 shadow 비교가 선행되어야 한다.

## 9. observability

활성화 전에 필요한 aggregate 필드:

- policy/context version
- runtime mode
- scenario classification
- exposure/primary/contextual/collapsed/hidden/insufficient count
- safety-block reason count
- current-findings state
- runtime/shadow divergence count
- downstream bypass count
- fallback count
- invalid-context count

금지 필드:

- 이메일, 제품명/브랜드/제품 ID
- raw survey/photo evidence
- cookie/JWT/session/report payload
- 구매 링크/자유 입력

Aggregate count와 enum은 작은 고정 vocabulary만 사용한다. sparse 조합을 사용자 단위로 저장하지 않고 deployment/window 단위 합계로 제한한다.

## 10. 옵션 A/B/C/D 비교

| 기준 | A | B | C | D |
| --- | --- | --- | --- | --- |
| canonical authority | adapter 이동 필요 | 불완전 | 가장 명확 | 새로 정의 |
| current findings | caller 보강 필요 | 이미 group 처리 | per-candidate로 통합 가능 | 새 구현 |
| safety fail-closed | 기존 자산 강점 | 약함 | 기존 자산 재사용 | 재작성 위험 |
| downstream 일관성 | 현재 filter 재사용 | enforcement 신규 | versioned eligibility로 개선 | 전면 신규 |
| shadow parity | 강함 | 약함 | migration으로 보존 | 재작성 |
| rollback 용이성 | 높음 | 중간 | 높음 | 낮음 |
| migration 규모 | 중간 | 중간 | 중상 | 큼 |
| dead code 감소 | 낮음 | 낮음 | 높음 | 중간 |
| double-filter 위험 | prototype 잔류 | 높음 | 제거 가능 | adapter 병행 시 중간 |
| Production 위험 | 중간 | 높음 | 단계화 시 중간 | 높음 |
| verifier 재사용 | 높음 | 일부 | 가장 높음 | 낮음 |

### A. evaluator runtime을 canonical CandidateExposurePolicy로 이전

장점은 기존 evaluator, guard, shadow, telemetry, kill switch를 최대한 재사용하는 것이다. 그러나 functional-candidate-policy의 findings/group 의미와 dead export가 남고, 현재 runtime의 exposure 상태 소실과 pre-canonical goal 문제를 이름만 바꿔서는 해결하지 못한다.

### B. functional-candidate-policy를 runtime에 연결

canonical decision/findings를 읽는 방향은 맞지만 현재 함수는 group visibility와 UI cap이 섞여 있고 per-candidate safety/metadata/lane enforcement가 없다. evaluator 뒤에 연결하면 double-filter가 되고, 대체하면 검증된 safety 자산을 잃는다.

### C. 두 정책을 하나의 canonical 정책으로 통합

Evaluator의 per-candidate safety/exposure와 shadow 자산을 내부 evaluator adapter로 보존하고, functional prototype의 current-product/group semantics를 versioned canonical contract로 흡수한다. 하나의 `CandidateExposurePolicy`만 lane eligibility를 내며 projection은 이를 표시한다. migration 동안 기존 response는 변경하지 않고 shadow parity를 측정할 수 있다.

### D. 기존 runtime을 폐기하고 새 adapter 작성

경계는 깨끗해질 수 있지만 evaluator/guard/hint/replay/kill-switch 자산을 재작성해야 한다. 확인된 결함은 adapter와 execution order로 교정 가능하므로 전면 폐기는 과도하다.

## 11. 최종 권장안

**옵션 C: 두 정책을 하나의 canonical `CandidateExposurePolicy`로 통합**을 권장한다.

통합의 의미는 두 함수를 단순 합치는 것이 아니다.

- canonical effective policies가 먼저 생성된다.
- evaluator/guard chain은 canonical input을 받는 순수 per-candidate evaluator adapter가 된다.
- current product semantics는 candidate별 relation으로 정규화한다.
- 한 개의 versioned policy가 exposure와 lane eligibility를 반환한다.
- ranking과 projection은 policy를 다시 해석하지 않는다.
- functional-candidate-policy의 group cap/UI intent는 projection adapter로 분리하거나 parity 완료 후 제거한다.
- 기존 evaluator runtime은 disabled-by-default shadow adapter로 이동하고, response 변경 없이 비교한다.

기각:

- A는 중복 policy와 missing findings를 남긴다.
- B는 verifier-only prototype을 production authority로 승격하며 double-filter/safety 공백이 크다.
- D는 검증된 evaluator 자산을 불필요하게 폐기한다.

## 12. 구현 단계 계획

| 단계 | 변경 대상 | 변경하지 않을 대상 | verifier/negative control | rollback/완료 조건 |
| --- | --- | --- | --- | --- |
| 1. contract | 신규 `candidate-exposure-policy-contract`와 fixtures | engine caller/response | schema, invalid/malformed, five states | 파일 제거; contract marker |
| 2. adapter | evaluator/guard 결과→canonical exposure adapter | scoring weight/hard filter | old/new evaluator parity | adapter off |
| 3. 동일 입력 | canonical decision state 뒤 shadow caller | runtime filter | requested/effective goal tension, findings parity | shadow flag off |
| 4. lane eligibility | pure lane eligibility verifier | 실제 lanes | hidden/insufficient/budget/routine bypass | enforcement 미연결 |
| 5. observability | aggregate serializer | identity/raw payload | redaction, bounded vocabulary | telemetry disable |
| 6. disabled shadow | analyze after canonical state, output no-op | API/UI/snapshot | response byte/fingerprint invariance | shadow disable |
| 7. actual replay | preserved export read-only replay | DB/export 파일 | hash/row count, actual vs synthetic | artifact 삭제 |
| 8. Preview no-change | exact-SHA shadow probe | Production | KO/EN response/snapshot parity | deployment 폐기 |
| 9. canary review | eligibility evidence 문서 | flag values | divergence/bypass/fallback threshold | 승인 거부 |
| 10. activation approval | 별도 승인 작업만 | 본 Stage 11A | kill switch drill | kill switch |

각 단계는 이전 단계 marker와 zero response-change evidence가 있어야 다음으로 진행한다. Runtime activation은 이 계획의 구현 단계와 별도의 승인 작업이다.

권장 구현 시 변경 후보:

- 신규 canonical contract/policy/adapter
- `premium-decision-state` 이후의 shadow orchestration
- aggregate telemetry serializer
- focused verifier/replay

변경 금지:

- ranking score/weight
- Functional/Routine/ConditionPolicy decision
- API response/storage schema
- UI exposure
- DB/Auth/Production flag

## 13. 회귀 검증 매트릭스

아래는 구현 전 minimum acceptance matrix다. `P/C/X/H/I`는 primary/contextual/collapsed/hidden/insufficient를 뜻한다.

| 입력 상태 | 후보 | Top/Support/Budget/Routine | 예상 exposure | 필수 reason |
| --- | --- | --- | --- | --- |
| stable | 다른 축 low-risk | 가능/가능/가능/가능 | P | canonical_goal_match |
| stable | same product | 불가/불가/불가/maintain 조건부 | H/C | already_using |
| stable | same axis replacement | 조건부/가능/조건부/조건부 | C/X | replacement_intent_unknown |
| stabilize_first | active | 모두 불가 | H | stabilization_active_block |
| active expansion prohibited | active | 모두 불가 | H | expansion_prohibited |
| protection required | protection complete | 조건부 유지 | P/C | protection_maintained |
| protection required | protection incomplete | 모두 불가 | I | protection_evidence_incomplete |
| sensitivity high | high irritation | 모두 불가 | H | irritation_risk |
| not_using | goal match | 가능 | P | missing_step |
| unanswered | 모든 candidate | 모두 불가 | I | usage_unknown |
| partial_unknown | known candidate | 알려진 범위만 | C | partial_context |
| not_in_db | unknown axis | 모두 불가 | I | product_not_evaluable |
| malformed context | 모든 candidate | 모두 불가 | I | invalid_context |
| duplicate axis | same axis | Top/routine 불가 | X | duplicate_axis |
| metadata incomplete | candidate | 모두 불가 | I | metadata_incomplete |

모드별:

| Mode | Response change | Policy execution | Required evidence |
| --- | --- | --- | --- |
| runtime disabled | 없음 | 없음 | baseline |
| shadow | 없음 | yes, aggregate only | runtime/shadow/input parity |
| future canary | 승인 후 제한적 | yes | zero bypass + rollback drill |
| kill switch | 즉시 baseline | no enforcement | deployment-wide confirmation |

모든 fixture는 Top Pick, supporting, budget, routine, treatment, UI, Premium save, reentry에 대해 같은 eligibility를 assertion한다. KO/EN은 decision key/exposure가 동일하고 문구만 번역되어야 한다. 저장 후 reentry는 exposure를 재계산하지 않는다.

## 14. rollback

1. Shadow 단계: shadow flag를 끄고 canonical response fingerprint가 baseline과 같은지 확인한다.
2. Future canary: kill switch를 `1`로 설정하고 runtime telemetry가 `kill_switched`인지 확인한다.
3. Adapter 회귀: 기존 evaluator shadow artifact version으로 되돌리되 response path는 계속 disabled로 둔다.
4. Snapshot contract가 도입되는 단계는 additive version으로만 진행하며 구버전 reentry는 저장 당시 snapshot을 유지한다.
5. runtime exception은 future integration에서 request failure가 아니라 bounded fallback+telemetry로 설계하되, safety-invalid context는 candidate eligibility 0을 유지한다.

Rollback은 flag 변경 승인, deployment SHA, aggregate marker로 검증한다. 사용자별 식별자나 payload를 기록하지 않는다.

## 15. Production activation 전제조건

- canonical CandidateExposurePolicy version 확정
- canonical effective goal/safety/current findings input parity
- all-lane eligibility verifier
- actual catalog replay와 부족 evidence 분리
- shadow response/snapshot fingerprint 불변
- runtime/shadow divergence 허용 기준 0 또는 승인된 명시 기준
- downstream bypass 0
- invalid-context/fallback bounded
- aggregate observability redaction 검증
- exact Preview KO/EN/save/reentry 검증
- kill-switch drill
- 별도 canary eligibility review
- 별도 Production activation 승인

이번 작업 결과 marker:

```text
CANDIDATE_POLICY_RUNTIME_REEVALUATION_COMPLETE
DESIGN_ONLY
RUNTIME_NOT_ACTIVATED
CANDIDATE_VISIBILITY_NOT_CHANGED
RECOMMENDATION_OUTPUT_NOT_CHANGED
CI_NOT_USED
GITHUB_ACTIONS_NOT_USED
LOCAL_SELF_VERIFICATION_COMPLETED
PRODUCTION_NOT_CHANGED
```
