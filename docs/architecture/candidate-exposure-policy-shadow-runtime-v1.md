# CandidateExposurePolicy Shadow Runtime v1

## 1. 목표

`candidate-exposure-policy-v1`은 최종 canonical decision state를 입력으로 받아 각 후보의 노출 상태와 lane eligibility를 한 번만 계산하는 순수 정책이다. Stage 11B는 이 결과를 관찰만 하며 실제 후보 배열, 추천 결과, 응답, snapshot, 저장 또는 UI를 변경하지 않는다.

## 2. Actual insertion point

실행 지점은 `app/api/analyze/route.js`에서 `rebuildPremiumDecisionState`가 완료된 직후다. 이 위치보다 앞선 raw survey 또는 pre-canonical goal은 정책 입력으로 사용하지 않는다. shadow 반환값은 이후 추천 조립이나 응답 생성에 연결하지 않는다.

## 3. Canonical input

adapter는 rebuild 결과에서 다음 authority만 읽는다.

- `SharedSkinDecisionContext`
- effective `FunctionalPolicy`
- effective `CrossDomainConsistency`
- canonical current-product findings
- 기존 normalized candidate source

입력 계약이 누락되거나 잘못되면 정책은 `invalid_canonical_input`으로 fail closed한다.

## 4. Exposure contract

노출 상태는 정확히 다섯 가지다.

- `primary`
- `contextual`
- `collapsed`
- `hidden`
- `insufficient_evidence`

각 결정은 policy version, opaque candidate reference, 고정 reason code 목록, current-product relation, evidence state, lane eligibility, canonical provenance를 가진다.

## 5. Lane eligibility

`primary`는 Top Pick, supporting, budget, routine에 참여할 수 있고 treatment는 별도 treatment eligibility가 참일 때만 가능하다. `contextual`은 supporting, budget, routine만 가능하다. 나머지 세 노출 상태는 모든 lane에서 false다. Stage 11B에서는 이 값으로 실제 lane을 필터링하지 않는다.

## 6. Current-product semantics

정책은 missing/invalid findings, unanswered, partial, `not_in_db`, `not_using`, same product, same axis/replacement, duplicate axis를 구분한다. 같은 상품은 `already_using`, replacement 의도가 불명확한 같은 축은 `replacement_intent_unknown`, 중복 축은 `duplicate_axis`로 표현한다. 불충분하거나 평가 불가능한 상태를 임의의 primary로 승격하지 않는다.

## 7. Evaluator adapter

기존 evaluator safety 계산은 `buildEvaluatorBoundaryPolicyExecution` adapter를 통해 재사용한다. adapter는 canonical context와 effective policy를 전달하며 route의 raw 설문 goal을 재구성하지 않는다. verifier-only functional prototype을 production caller로 연결하지 않는다.

## 8. Shadow execution control

기본값은 disabled다. Preview/development에서 `DEV_ONLY_CANDIDATE_EXPOSURE_POLICY_SHADOW=1`인 경우에만 shadow가 실행된다. `DISABLE_CANDIDATE_EXPOSURE_POLICY_SHADOW=1`은 즉시 kill switch로 동작한다. 알 수 없는 환경 값이나 malformed flag는 disabled다.

## 9. Production hard-disable

`VERCEL_ENV=production`이면 opt-in 값과 무관하게 `productionHardDisabled=true`, `enabled=false`다. Stage 11B는 Vercel Preview/Production 프로젝트 환경 설정에 CandidatePolicy key를 영구 등록하지 않는다.

## 10. Exception boundary

정책, adapter, comparison 또는 telemetry 경계의 예외는 route 밖으로 전파하지 않는다. 예외는 고정 category와 bounded count로 축약되고 기존 응답 경로는 계속된다. fail-open 추천 변경은 없으며 shadow 결과 자체는 fail closed다.

## 11. Observability

`candidate-exposure-policy-shadow-aggregate-v1`은 고정 schema의 집계만 기록한다. candidate/exposure/lane/reason/divergence count, canonical version, findings state, 세 fingerprint 일치 여부, fallback 및 exception count만 허용한다. 사용자·계정·제품·브랜드·URL·설문·cookie·token·session·report identifier field는 거부한다.

## 12. Response/storage invariants

shadow 실행 전후 response value, snapshot value, candidate order를 각각 fingerprint하거나 순서를 비교한다. shadow는 인자를 수정하지 않으며 route는 shadow 반환값을 무시한다. API response field, snapshot schema, 저장 구조, DB schema, reentry, UI 연결은 변경하지 않는다.

## 13. Divergence classification

분류 vocabulary는 다음으로 고정한다.

- `equivalent`
- `expected_canonical_goal_alignment`
- `expected_current_product_semantics`
- `expected_exposure_state_expansion`
- `expected_invalid_context_hardening`
- `unexpected_divergence`

분류되지 않은 값은 허용하지 않는다. Stage 11C eligibility를 논하려면 실제 Preview evidence에서 unexpected 및 unclassified divergence가 모두 0이어야 한다.

## 14. Rollback

가장 빠른 rollback은 opt-in을 두지 않거나 kill switch를 `1`로 두는 것이다. 코드 rollback이 필요하면 route의 shadow import/call과 신규 정책 모듈을 제거할 수 있으며 기존 추천, response, storage graph는 원래 경로를 유지한다. Production 활성화 rollback은 필요하지 않다. Production은 처음부터 hard-disabled다.

## 15. 다음 단계 전제조건

Stage 11C는 Stage 11B local/pure-engine/actual-catalog 검증과 exact-SHA Preview KO/EN shadow 실행이 모두 완료되고, fingerprint 3종이 일치하며, unexpected divergence와 shadow exception이 0인 경우에만 제안할 수 있다. Stage 11C도 Production runtime activation이 아니라 누적 shadow evidence와 canary eligibility를 검토하는 단계다.
