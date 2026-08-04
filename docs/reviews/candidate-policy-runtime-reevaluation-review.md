# CandidatePolicy Runtime Re-evaluation Review

## Critical

없음. 실제 Vercel Preview/Production environment에는 CandidatePolicy 관련 key가 없고 현재 runtime은 disabled다. 따라서 아래 설계 결함이 현재 Production 추천 결과를 바꾸고 있다는 증거는 없다.

## Important

1. **Pre-canonical authority**: 실제 evaluator runtime은 canonical `FunctionalPolicy`와 CrossDomainConsistency보다 먼저 실행되며 raw survey/free priority로 goal policy를 다시 만든다. Future activation 전에 실행 순서를 canonical state 이후로 옮겨야 한다.
2. **Current findings caller gap**: runtime/shadow API는 `currentProductFindings`를 받지만 actual engine caller가 전달하지 않는다. same-product/duplicate/supports-goal 관계가 실제 visibility에 반영되지 않는다.
3. **Exposure semantic loss**: collapsed, hidden, insufficient evidence가 모두 candidate 배열 제거로 축약된다. UI, KO/EN, snapshot, reentry가 이유와 exposure를 보존할 수 없다.
4. **Exception boundary**: safety violation은 visible 0으로 fail-closed지만 unexpected runtime exception은 analyze 전체로 재throw된다. Future runtime integration에는 안전한 eligibility 0 또는 기존 baseline fallback 중 오류 category별 명시 계약이 필요하다.
5. **Canonical downstream contract 부재**: main engine 안에서는 공통 filtered 배열을 사용하지만 exposure/lane eligibility가 versioned output으로 저장되지 않는다. Legacy/display/future fallback adapter의 우회 방지가 구조적으로 보장되지 않는다.

## Minor

- receiver/hint row의 `runtimeConnected: false`는 runtime wrapper가 실행된 경우에도 남아 있어 관측 의미가 stale하다.
- Preview probe 자산은 특정 과거 branch 이름을 고정하고 있어 future canonical shadow verification에 그대로 재사용하기 어렵다.
- percentage canary나 allowlist는 없으며 deployment-scoped canary만 존재한다. 현 단계에서는 결함이 아니지만 activation plan에 명시돼야 한다.

## Dead path

`lib/functional-candidate-policy.js`의 `buildFunctionalCandidatePolicy()`는 production importer가 0개다. 현재 직접 caller는 `scripts/verify-functional-candidate-policy.mjs`뿐이다. 검증된 prototype이지만 runtime/UI policy라고 표현하면 안 된다.

## 중복 정책

- functional prototype: current findings를 group visibility/intent/cap으로 해석한다.
- evaluator runtime: per-product safety/exposure를 실제 candidate filtering으로 집행한다.
- 두 정책을 연결하면 duplicate axis/supports goal에서 group collapse와 per-product verdict가 중첩된다.
- Premium functional projection도 hold/suppression에서 product candidates를 제거하므로 canonical execution order 없이 추가 filter를 붙이면 삼중 책임이 된다.

## Stale adapter

- collapsed hint receiver는 UI message type과 runtime receiver decision을 함께 반환한다.
- evaluator runtime은 exposure class를 downstream에 전달하지 않고 visible ID만 사용한다.
- premium display/reentry adapter는 exposure version을 모른다.
- 이 adapter들은 canonical CandidateExposurePolicy output과 projection adapter로 분리해야 한다.

## Unguarded bypass

- canonical goal/safety가 evaluator runtime filter를 사후 교정하지 않는다.
- current findings가 evaluator runtime caller에서 누락된다.
- saved/legacy projection은 exposure metadata가 없으므로 future recomputation을 금지할 계약이 필요하다.
- runtime exception용 bounded fallback contract가 없다.
- functional candidate group policy는 어느 downstream lane에도 enforcement가 없다.

## Missing evidence

- actual read-only catalog replay: 164 products, 4 scenarios, 656 rows, artifact SHA-256 `8f746fbfb277d88d8d59a6d572cdef7514b04b1d6efe08a4b5027ca0bd0a6f9a`.
- actual evidence: `safeLowRiskHidden`, serum category.
- actual replay에서 미관측: active-only, metadata-incomplete, strong-caution. 이 세 항목은 synthetic evidence와 분리한다.
- actual Production runtime 결과는 미검증이다. 현재 runtime이 disabled이므로 의도된 상태이며 이번 설계의 PASS 근거로 사용하지 않는다.
- current-product 12-fixture 전 lane execution은 후속 disabled shadow integration 전 verifier로 보강해야 한다.

## 최종 판정

권장안은 **C — evaluator safety/exposure 자산과 functional current-product semantics를 하나의 canonical `CandidateExposurePolicy`로 통합**이다.

- A는 pre-canonical authority와 dead duplicate policy를 남긴다.
- B는 verifier-only group policy를 production authority로 연결하며 double-filter 위험이 크다.
- D는 검증된 evaluator/shadow/replay 자산을 과도하게 폐기한다.

현재 Critical은 없지만 Important 항목 때문에 runtime activation은 허용할 수 없다. 다음 단계는 disabled-by-default, no-response-change `CandidateExposurePolicy Shadow Runtime Integration`이다.

```text
CANDIDATE_POLICY_RUNTIME_REEVALUATION_COMPLETE
DESIGN_ONLY
RUNTIME_NOT_ACTIVATED
CANDIDATE_VISIBILITY_NOT_CHANGED
RECOMMENDATION_OUTPUT_NOT_CHANGED
```
