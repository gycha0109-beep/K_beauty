# Face Lab V2 — PR A Semantic-Preserving Refactor Implementation Design v1

> Track: face-research
> Stage: post-16L / vCandidate preparation
> Scope: PR A only
> Goal: refactor current Style Delta internals with zero recommendation-semantic change
> Base main: 079bdc0d82ddedc2bb32c882f7602c87a2d1cbaf

## 1. PR A의 단일 목적

PR A는 vCandidate 기능을 구현하는 PR이 아니다.

PR A의 목적은 현재 style-delta.js 안에 섞여 있는 세 책임을 분리하는 것이다.

~~~text
A. Target → raw action 생성
B. Current Face → current modifier 적용
C. Scope / Constraint / rank / final Style Delta 조립
~~~

분리 후에도 production의 buildStyleDelta() 결과는 의미상뿐 아니라 가능한 범위에서 exact JSON-equivalent여야 한다.

PR A에서 바뀌면 안 되는 것:

- Target Style Vector threshold
- 생성되는 action domain
- 생성되는 parameter
- action direction
- action strength
- expectedEffect copy
- reason
- evidence
- blocked/allowed state
- blockedBy
- priority order
- rank
- conflicts
- Style Delta status
- summary
- confidence
- top-level evidence
- STYLE_DELTA_VERSION
- Route selection
- Domain execution
- Look Composer
- Product handoff
- canonical result schema
- persistence
- UI

## 2. 현재 코드 책임 분해

현재 lib/face-lab-v2/style-delta.js는 다음 책임을 모두 가진다.

~~~text
clamp01()
cleanList()
keyFeatureDirection()
isScopeAllowed()
hardExclusions()
action()
getTargetAxis()
buildTargetActions()
applyFaceModifiers()
applyScopeAndConstraints()
buildStyleDelta()
~~~

PR A 후 목표:

~~~text
target-action-pool.js
  └─ buildTargetActionPool()

personalization/face-action-relations.js
  └─ current relation registry only

personalization/current-face-modifier.js
  └─ applyCurrentFaceModifiers()

style-delta.js
  ├─ applyScopeAndConstraints()
  └─ buildStyleDelta()
~~~

Scope / Constraint / final assembly는 PR A에서 이동하지 않는다.

이유:

- 변경 반경 최소화
- candidate 기능과 current behavior 분리
- regression 발생 시 원인 범위 축소
- route / domain execution downstream contract 보호

## 3. 새 파일 1 — target-action-pool.js

경로:

~~~text
lib/face-lab-v2/target-action-pool.js
~~~

### 3.1 export

~~~text
export const TARGET_ACTION_POOL_VERSION =
  "face-lab-target-action-pool-v1";

export function buildTargetActionPool(targetStyle)
~~~

TARGET_ACTION_POOL_VERSION은 내부 구현 provenance 용도다.

PR A에서는 canonical lineage에 추가하지 않는다.
즉 사용자-facing / persisted result는 이 새 internal version 때문에 바뀌지 않는다.

### 3.2 이 파일로 이동할 함수

현재 style-delta.js에서 그대로 이동:

~~~text
clamp01()
cleanList()
action()
getTargetAxis()
buildTargetActions()
~~~

buildTargetActions() 이름만 외부 API 관점에서 buildTargetActionPool()로 변경한다.

함수 내부 의미는 바꾸지 않는다.

### 3.3 action schema exact preservation

각 action은 계속 정확히 다음 shape를 가진다.

~~~text
{
  rank: 0,
  domain,
  parameter,
  direction,
  strength,
  expectedEffect,
  reason,
  evidence,
  constraintState,
  blockedBy
}
~~~

새 metadata를 추가하지 않는다.

특히 PR B에서 필요할 facePersonalization 같은 field도 PR A에서는 절대 넣지 않는다.

### 3.4 axis 평가 순서 동결

action 생성 순서는 semantic behavior다.

현재 순서:

~~~text
1. softSharp
2. naturalPolished
3. playfulMature
4. minimalStatement
5. warmCool
6. classicTrendy
~~~

이 순서를 바꾸지 않는다.

Route Generator가 Style Delta priority 순서와 domain/axis diversity를 사용하므로
동일 action set이라도 배열 순서 변화는 downstream route 차이를 만들 수 있다.

### 3.5 threshold exact freeze

다음 경계의 비교 연산자를 그대로 유지한다.

~~~text
softSharp
  high >= 0.64
  strong >= 0.78
  low <= 0.36

naturalPolished
  high >= 0.64
  low <= 0.36

playfulMature
  high >= 0.66
  low <= 0.34

minimalStatement
  high >= 0.66
  strong >= 0.82
  low <= 0.34

warmCool
  active abs(value - 0.5) >= 0.16
  strong abs(value - 0.5) >= 0.28

classicTrendy
  high >= 0.68
  low <= 0.32
~~~

경계 수치 자체를 constant registry로 재구성하지 않는다.

PR A에서 숫자 구조까지 바꾸면 accidental semantic change의 표면적이 커진다.

## 4. 새 파일 2 — face-action-relations.js

경로:

~~~text
lib/face-lab-v2/personalization/face-action-relations.js
~~~

### 4.1 목적

현재 applyFaceModifiers() 안에 하드코딩된 네 relation을 declarative registry로 옮긴다.

PR A에서는 current relation만 존재한다.
candidate hypothesis는 한 건도 추가하지 않는다.

### 4.2 authority enum

~~~text
export const FACE_ACTION_RELATION_AUTHORITY = Object.freeze({
  CURRENT_CONTRACT: "CURRENT_CONTRACT",
  CANDIDATE_HYPOTHESIS: "CANDIDATE_HYPOTHESIS",
  BLOCKED_PENDING_VALIDATION: "BLOCKED_PENDING_VALIDATION"
});
~~~

PR A registry에는 CURRENT_CONTRACT만 허용한다.

나머지 enum은 PR B 이후 contract를 위한 vocabulary로만 존재시킬 수 있으나,
더 보수적으로 가려면 PR A에서는 CURRENT_CONTRACT만 정의하고 PR B에서 enum을 확장한다.

권장안은 PR A에서 세 enum을 모두 정의하되 verifier가 current registry에 CURRENT_CONTRACT 외 값이 존재하면 fail하도록 하는 것이다.

### 4.3 relation schema

각 relation은 JSON-serializable한 data-only object로 둔다.

~~~text
{
  relationId,
  authorityClass,
  sourceFeatureKey,
  sourceValues,
  actionMatch: {
    domain,
    parameter
  },
  operation: {
    type,
    parameter?,
    direction?,
    strength?,
    expectedEffect,
    reason
  },
  evidence: {
    prefix,
    includeSourceValue
  },
  conflict
}
~~~

predicate function이나 transform closure를 registry 안에 넣지 않는다.

이유:

- contract inspection 가능
- deterministic serialization 가능
- 향후 evaluator가 registry를 직접 읽기 쉬움
- candidate relation audit 용이
- hidden heuristic 방지

## 5. 현재 relation 4개 exact mapping

### FL-CURRENT-001 — eye direction guard

source:

~~~text
sourceFeatureKey = eyeDirection
sourceValues = [upturned]
~~~

action match:

~~~text
domain = makeup
parameter = outerEyeEmphasis
~~~

operation:

~~~text
type = redirect
parameter = eyeDefinition
direction = unchanged
strength = light
reason = face_modifier_eye_direction_already_upturned
~~~

expectedEffect exact copy:

~~~text
이미 상향 흐름이 보이는 눈매를 더 끌어올리기보다 선명도와 길이 조절로 목표 인상을 보탭니다.
~~~

evidence:

~~~text
face_feature:eyeDirection=upturned
~~~

conflict exact preservation:

~~~text
type = over_amplification_guard
domains = [makeup]
description =
  이미 상향 흐름이 보이는 눈매에 추가 상승 방향을 중첩하지 않습니다.
resolution =
  상승 각도 대신 눈의 선명도와 길이 쪽으로 이동합니다.
~~~

### FL-CURRENT-002 — feature contrast guard

source:

~~~text
featureContrast = high
~~~

action:

~~~text
makeup:selectedFeatureContrast
~~~

operation:

~~~text
type = strength_cap
strength = light
reason = face_modifier_existing_feature_contrast_high
~~~

expectedEffect와 conflict copy는 현재 코드와 byte-for-byte 동일하게 이동한다.

evidence:

~~~text
face_feature:featureContrast=high
~~~

### FL-CURRENT-003 — contour preserve

source:

~~~text
contourDefinition = defined
~~~

action:

~~~text
hair:outlineDefinition
~~~

operation:

~~~text
type = preserve
direction = maintain
strength = light
reason = face_modifier_contour_already_defined
~~~

evidence:

~~~text
face_feature:contourDefinition=defined
~~~

conflict = null

### FL-CURRENT-004 — curve preserve

source:

~~~text
straightCurveBalance = curved
~~~

action:

~~~text
hair:curvature
~~~

operation:

~~~text
type = preserve
direction = maintain
strength = light
reason = face_modifier_line_already_curved
~~~

evidence:

~~~text
face_feature:straightCurveBalance=curved
~~~

conflict = null

## 6. 새 파일 3 — current-face-modifier.js

경로:

~~~text
lib/face-lab-v2/personalization/current-face-modifier.js
~~~

export:

~~~text
export function applyCurrentFaceModifiers(
  actions,
  currentFaceProfile
)
~~~

반환 contract:

~~~text
{
  actions,
  conflicts
}
~~~

현재 applyFaceModifiers()와 동일하다.

## 7. executor 알고리즘

### 7.1 profile lookup

Current Face 값 조회는 현재와 동일하게 keyFeatures에서 한다.

~~~text
profile.keyFeatures
  .find(item => item.key === sourceFeatureKey)
  ?.direction
~~~

PR A에서 structuralProfile fallback을 추가하지 않는다.

그것은 recommendation authority 변경이다.

### 7.2 action loop order

반드시 action-first loop를 유지한다.

~~~text
for each action in original action order:
  clone action
  find/apply matching current relation
  append optional conflict
  return modified action
~~~

relation-first 방식으로 전체 actions를 여러 번 mutate하지 않는다.

현재 conflicts 배열의 순서는 action 배열 순서에 의해 결정되므로 이를 유지해야 한다.

### 7.3 evidence clone

현재와 동일:

~~~text
next = {
  ...item,
  evidence: [...item.evidence]
}
~~~

원본 Target Action Pool을 mutate하면 안 된다.

PR A verifier에서 raw pool non-mutation을 별도로 확인한다.

### 7.4 relation overlap

현재 네 relation은 actionMatch가 서로 겹치지 않는다.

PR A invariant:

~~~text
한 CURRENT_CONTRACT relation set에서
동일 domain + parameter actionMatch 중복 금지
~~~

registry verifier가 중복을 fail한다.

향후 candidate에서 multiple relation composition이 필요하면
별도 precedence contract를 추가한다.

PR A에서 미리 복잡한 precedence engine을 만들지 않는다.

## 8. style-delta.js 최종 역할

PR A 후 style-delta.js는 orchestration file이 된다.

imports:

~~~text
buildTargetActionPool
applyCurrentFaceModifiers
~~~

남길 local responsibility:

~~~text
EXECUTION_DOMAINS
cleanList()
isScopeAllowed()
hardExclusions()
applyScopeAndConstraints()
buildStyleDelta()
~~~

buildStyleDelta()의 핵심 flow:

~~~text
validate currentFaceProfile
validate targetStyle

rawActions =
  buildTargetActionPool(targetStyle)

guarded =
  applyCurrentFaceModifiers(
    rawActions,
    currentFaceProfile
  )

finalActions =
  applyScopeAndConstraints(
    guarded.actions,
    targetStyle
  )

active / blocked split
rank assignment
top-level evidence
return existing Style Delta object
~~~

이 flow 외에는 바꾸지 않는다.

## 9. Version 정책

PR A에서 다음 version은 변경하지 않는다.

~~~text
STYLE_DELTA_VERSION
  face-lab-style-delta-v3

STYLE_ROUTE_GENERATOR_VERSION
  face-lab-style-route-v6

FACE_LAB_V2_COMPOSER_VERSION
  face-lab-v2-composer-v1
~~~

이유:

PR A는 external semantic contract가 바뀌지 않는다.

새 internal module version:

~~~text
TARGET_ACTION_POOL_VERSION
FACE_ACTION_RELATION_REGISTRY_VERSION
CURRENT_FACE_MODIFIER_VERSION
~~~

은 정의 가능하지만 canonical result lineage에는 아직 노출하지 않는다.

Lineage schema 변경은 별도 설계 없이 PR A에 섞지 않는다.

## 10. Regression strategy — 두 층으로 검증

PR A는 기존 tests PASS만으로 충분하지 않다.

다음 두 검증층을 추가한다.

### Layer 1 — exact frozen baseline

새 verifier:

~~~text
scripts/verify-face-lab-v2-style-delta-refactor-equivalence.mjs
~~~

목적:

PR A 이전 main의 Style Delta output aggregate hash를 freeze하고
리팩터링 후 동일 hash를 요구한다.

### Layer 2 — structural contract

새 module별 contract를 직접 검사한다.

~~~text
Target action pool threshold
Action order
Modifier registry shape
Relation overlap
Raw pool non-mutation
Current modifier exact behavior
~~~

## 11. Golden baseline 생성 절차

중요: baseline hash는 refactor 후 만들면 의미가 없다.

따라서 실제 구현은 반드시 다음 순서다.

### Commit A0 — baseline probe only

main의 현재 code behavior를 그대로 실행하는 temporary/probe verifier를 추가한다.

다음 deterministic cohorts에서 styleDelta만 projection하여 hash를 출력한다.

~~~text
locked regression 96
coverage 96
adversarial 32
target sweep 96
~~~

추가로 current four-modifier explicit fixtures를 만든다.

출력:

~~~text
lockedStyleDeltaHash
coverageStyleDeltaHash
adversarialStyleDeltaHash
targetSweepStyleDeltaHash
modifierFixtureHash
~~~

CI에서 이 값을 확보한다.

이 hash는 main current behavior의 witness다.

### Commit A1 — baseline freeze

probe가 출력한 hash를 verifier constant로 고정한다.

그 다음부터 hash mismatch는 hard fail이다.

### Commit A2 이후 — refactor

이제 target-action-pool 추출과 modifier registry화를 한다.

즉 baseline을 refactor 코드로 생성하는 self-fulfilling test를 금지한다.

## 12. Golden projection 규칙

hash 대상은 canonical 전체가 아니라 Style Delta semantic payload다.

각 case에서 포함:

~~~text
caseId
styleDelta.status
styleDelta.version
styleDelta.targetProfileVersion
styleDelta.faceProfileVersion
styleDelta.summary
styleDelta.priorities
styleDelta.preservedFeatures
styleDelta.conflicts
styleDelta.confidence
styleDelta.evidence
styleDelta.unavailableReason
~~~

canonical resultId, analyzedAt 등 unrelated field는 제외한다.

stable serialization:

~~~text
object key sort
array order preserve
UTF-8 JSON
SHA-256
~~~

배열 order는 의미가 있으므로 sort하지 않는다.

## 13. 왜 4개 cohort가 필요한가

### locked 96

일반 조합 regression.

### coverage 96

Target × Scope domain coverage.

### adversarial 32

blocked / disabled / low-effort edge case.

### target sweep 96

모든 대표 Target과 동일 face matrix.

PR A는 Target Action Pool 추출을 하므로 Target sweep hash가 특히 중요하다.

## 14. modifier explicit fixture

랜덤 cohort만으로 네 modifier가 모두 항상 activation된다는 보장이 없다.

따라서 다음 exact fixture를 별도로 둔다.

~~~text
M1
Target = chic
eyeDirection: level → upturned

M2
Target = statement_glam
featureContrast: medium → high

M3
Target = chic
contourDefinition: moderate → defined

M4
Target = soft
straightCurveBalance: balanced → curved
~~~

각 pair에서 refactor 전 exact baseline action을 freeze한다.

검사 대상:

~~~text
parameter
direction
strength
expectedEffect
reason
evidence
conflicts
~~~

## 15. Target Action Pool direct boundary test

새 unit-level verifier section에서 threshold boundary를 직접 검사한다.

대표 boundary:

~~~text
softSharp
0.36 / 0.37 / 0.63 / 0.64 / 0.77 / 0.78

naturalPolished
0.36 / 0.37 / 0.63 / 0.64

playfulMature
0.34 / 0.35 / 0.65 / 0.66

minimalStatement
0.34 / 0.35 / 0.65 / 0.66 / 0.81 / 0.82

warmCool
0.21 / 0.22 / 0.23
0.34 / 0.35
0.65 / 0.66
0.77 / 0.78 / 0.79

classicTrendy
0.32 / 0.33 / 0.67 / 0.68
~~~

또한:

~~~text
null
undefined
NaN
-1
2
~~~

를 확인해 기존 clamp01 behavior를 보존한다.

## 16. Action ordering hard invariant

Target Action Pool output의 order를 별도 검사한다.

예를 들어 여러 axis가 동시에 활성인 fixture에서 action reason sequence를 freeze한다.

~~~text
target_softSharp_high
...
target_naturalPolished_high
...
target_playfulMature_high
...
target_minimalStatement_high
...
target_warmCool_cool
target_classicTrendy_high
~~~

domain sort를 하면 안 된다.

reason sort를 하면 안 된다.

## 17. Registry contract verifier

FACE_ACTION_RELATIONS에 대해 다음을 검사한다.

~~~text
relationId unique
relationId exact expected set
authorityClass = CURRENT_CONTRACT only
sourceFeatureKey non-empty
sourceValues non-empty
actionMatch domain/parameter non-empty
operation type allowed
reason non-empty
expectedEffect non-empty
evidence policy valid
duplicate actionMatch 없음
~~~

expected relation IDs:

~~~text
FL-CURRENT-001
FL-CURRENT-002
FL-CURRENT-003
FL-CURRENT-004
~~~

PR A에서 5번째 relation이 생기면 fail한다.

즉 리팩터링 PR에 새 heuristic이 섞이는 것을 기계적으로 차단한다.

## 18. Raw pool non-mutation test

다음 테스트를 추가한다.

~~~text
pool = buildTargetActionPool(target)
snapshot = structuredClone(pool)

applyCurrentFaceModifiers(pool, profile)

assert.deepEqual(pool, snapshot)
~~~

이 invariant가 필요한 이유:

PR B에서 current와 candidate가 동일 Target Action Pool을 공유할 때
한 policy가 원본 pool을 mutate하면 A/B isolation이 깨진다.

## 19. Exact current modifier test

각 current modifier에 대해 before/after action을 직접 검사한다.

예:

~~~text
outerEyeEmphasis
→ eyeDefinition

direction은 increase 유지
strength는 light
reason exact
expectedEffect exact
target_axis evidence 보존
face_feature evidence append
~~~

특히 evidence는 교체가 아니라 append다.

예상:

~~~text
[
  "target_axis:softSharp",
  "face_feature:eyeDirection=upturned"
]
~~~

순서까지 freeze한다.

## 20. Scope / Constraint regression

applyScopeAndConstraints()는 이동하지 않지만
upstream module split이 action object를 달리 만들 수 있으므로 기존 verifier를 그대로 모두 실행한다.

필수 기존 gate:

~~~text
verify-face-lab-v2-foundation
verify-face-lab-v2-premium-wiring
verify-face-lab-v2-persistence-authority
verify-premium-report-reentry-contract
verify-face-lab-v2-presentation
verify-face-lab-v2-survey-consumption
verify-face-lab-v2-route-quality
verify-face-lab-v2-recommendation-evaluation
verify-face-lab-v2-human-pairwise-contract
~~~

추가:

~~~text
verify-face-lab-v2-style-delta-refactor-equivalence
~~~

## 21. 기존 evaluation 결과 exact invariants

PR A merge 조건으로 기존 주요 baseline도 그대로여야 한다.

최소:

~~~text
16K
pairedComparisonCount = 22
recommendationModifierPairCount = 4
nonAuthorityPairCount = 18
styleDeltaChangedPairCount = 4
selectedRouteChangedPairCount = 4
hardFailureCount = 0

16L
caseCount = 96
targetFullyCollapsedCount = 6
averageTargetUniqueActionSignatureCount = 1.667
averageFaceUniqueActionSignatureCount = 10
hardFailureCount = 0
~~~

PR A에서 16L diversity가 좋아지거나 나빠져도 fail이다.

이 PR은 추천 품질 변경 PR이 아니기 때문이다.

## 22. style-delta.js diff budget

PR A에서 style-delta.js의 허용 변경:

~~~text
+ import buildTargetActionPool
+ import applyCurrentFaceModifiers

- moved target-action helper code
- moved current face modifier code

buildStyleDelta:
buildTargetActions(...)
→ buildTargetActionPool(...)

applyFaceModifiers(...)
→ applyCurrentFaceModifiers(...)
~~~

그 외 buildStyleDelta return object 변경 금지.

applyScopeAndConstraints() body 변경 금지.

summary copy 변경 금지.

confidence calculation 변경 금지.

## 23. canonical-composer.js

예상 변경 없음.

계속:

~~~text
import {
  buildStyleDelta,
  STYLE_DELTA_VERSION
} from "./style-delta.js";
~~~

PR A에서 target-action-pool이나 current modifier를 canonical composer가 직접 알면 안 된다.

composer의 abstraction boundary는 buildStyleDelta()다.

## 24. evaluation code 의존 방향

PR A 후 의존성:

~~~text
canonical-composer
  ↓
style-delta
  ├─ target-action-pool
  └─ personalization/current-face-modifier
          ↓
     face-action-relations
~~~

evaluation verifier는 각 module을 직접 import할 수 있다.

production caller는 새 internal module을 직접 import하지 않는다.

## 25. Circular dependency 금지

다음 방향만 허용한다.

~~~text
style-delta
→ target-action-pool

style-delta
→ current-face-modifier
→ face-action-relations
~~~

금지:

~~~text
target-action-pool
→ style-delta

face-action-relations
→ style-delta

current-face-modifier
→ canonical-composer
~~~

## 26. PR A에서 추가하지 않을 것

명시적으로 제외:

~~~text
buildCandidateStyleDelta()
face-fit-planner.js
candidate relation
candidate_relation evidence
facePersonalization metadata
CurrentStylingBaseline
survey question
Human pair builder
LLM judge
new route strategy
new product spec
new UI
new DB column
new persistence field
~~~

## 27. 커밋 순서

실제 구현은 다음 atomic commit 순서를 권장한다.

### Commit 1 — baseline probe

~~~text
test(face-lab): freeze pre-refactor style delta witnesses
~~~

- temporary/probe output
- current main behavior hash 획득

### Commit 2 — freeze equivalence verifier

~~~text
test(face-lab): lock style delta refactor equivalence
~~~

- hash constants
- explicit modifier fixtures
- target threshold boundary fixtures
- registry expected set 준비

이 시점까지 production code 변화 없음.

### Commit 3 — extract target action pool

~~~text
refactor(face-lab): extract target action pool
~~~

- target-action-pool.js
- style-delta import
- no modifier move yet

CI exact hash PASS 확인.

### Commit 4 — freeze current relation registry

~~~text
refactor(face-lab): register current face action relations
~~~

- face-action-relations.js
- current rule metadata only
- 아직 behavior executor는 기존과 동일하거나 registry-backed로 교체 가능

### Commit 5 — extract current modifier executor

~~~text
refactor(face-lab): extract current face modifier executor
~~~

- current-face-modifier.js
- style-delta import
- old applyFaceModifiers 제거

### Commit 6 — CI wiring / docs

~~~text
ci(face-lab): verify semantic-preserving style delta refactor
~~~

- new verifier workflow step
- new paths
- final docs

## 28. Merge gate

PR A merge 가능 조건:

~~~text
main semantic conflict 없음
PR mergeable
new equivalence verifier PASS
Face Lab V2 Foundation PASS
all existing recommendation evaluation PASS
16K baseline unchanged
16L baseline unchanged
exact golden hashes unchanged
STYLE_DELTA_VERSION unchanged
canonical-composer.js behavior unchanged
no candidate code
no UI/persistence change
~~~

## 29. 실패 분류

### Hash mismatch + direct boundary mismatch

Target Action Pool extraction bug 가능성이 높다.

### Hash mismatch + modifier fixture mismatch

registry / executor migration bug 가능성이 높다.

### Style Delta hash same + route evaluation fail

PR A 외 unrelated main movement 또는 verifier issue를 의심한다.

### 16L 수치 변화

semantic change로 간주하고 merge 중단한다.

PR A 목적상 “좋아진 변화”도 허용하지 않는다.

## 30. PR A 완료 후 확보되는 기반

PR A가 끝나면 current engine은 다음처럼 깨끗하게 분리된다.

~~~text
Target
↓
Target Action Pool
↓
CURRENT_CONTRACT Face Relation Policy
↓
Scope / Constraint
↓
Style Delta
~~~

그 다음 PR B에서 production current path를 건드리지 않고:

~~~text
same Target Action Pool
↓
CANDIDATE_HYPOTHESIS Relation Policy
↓
Candidate Face Fit Planner
↓
buildCandidateStyleDelta()
~~~

를 병렬로 만들 수 있다.

즉 PR A의 성공 기준은 코드가 더 예뻐지는 것이 아니라
vCurrent를 완전히 고정한 상태에서 vCandidate를 비교 가능하게 만드는 것이다.
