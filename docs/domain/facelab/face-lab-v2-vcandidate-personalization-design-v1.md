# Face Lab V2 — vCandidate Personalization Design v1

> Track: Face Lab / recommendation quality
> Status: design frozen, engine implementation not started
> Base: main @ b566e978c9e1b8249a31d03f9aee3b52f027f191
> Watchtower-Track: face-research

## 1. 배경

16K / 16L 평가에서 현재 엔진의 구조가 다음처럼 확인됐다.

- 22개 face observation 중 recommendation semantics를 직접 바꾸는 field는 4개다.
- 동일 얼굴에서 Target을 바꾸면 추천은 충분히 달라진다.
- 동일 Target에서 얼굴을 바꾸면 개인화 폭이 작다.
- 8 faces × 12 targets = 96 cases에서 target별 평균 unique action signature는 1.667이다.
- 12 targets 중 6개는 8개 얼굴에서 exact action signature가 완전히 동일했다.
  - classic
  - mature_calm
  - minimal
  - natural
  - sophisticated
  - trendy
- 반대로 동일 얼굴에서 12 Target을 바꾸면 평균 unique action signature는 10이다.

이 결과는 현재 Face Lab이 Target authority는 강하지만 Current-side personalization authority가 얕다는 것을 뜻한다.

단, 16L의 반복 수치는 synthetic diagnostic이며 그 자체가 aesthetic failure를 증명하지 않는다.

## 2. 현재 구조의 근본 원인

현재 Style Delta는 개념적으로 다음 순서다.

~~~text
Target Style
→ fixed Target action pool
→ applyFaceModifiers()
→ Scope / Constraints
→ Route
~~~

즉 얼굴이 Target action을 만드는 것이 아니라 이미 만들어진 Target action의 일부를 사후 보정한다.

현재 modifier authority는 주로 다음 visual-language family에 집중돼 있다.

- eyeDirection
- straightCurveBalance
- contourDefinition
- featureContrast

따라서 Target action이 이 family와 만나지 않는 경우 Current Face가 달라도 결과가 동일해지기 쉽다.

## 3. 절대로 하지 않을 해결책

16L 수치를 낮추기 위해 다음을 하지 않는다.

~~~text
round face → hairstyle X
square face → glasses Y
long face → accessory Z
large features → always reduce visual weight
~~~

이 방식은 synthetic diversity metric을 개선할 수는 있지만 Face Lab 제품 계약에 없는 미용 상식을 엔진에 몰래 넣는다.

또한 다음도 금지한다.

- targetFullyCollapsedCount 자체를 최적화 목표로 사용
- 서로 다른 얼굴이면 반드시 서로 다른 추천을 내도록 강제
- Target vector를 face observation이 수정
- Scope / Constraints를 face observation이 수정
- 현재 operational definition이 미완성인 cue를 새 rule에 확대 사용
- Human calibration 전에 vCandidate를 production authority로 승격

## 4. 핵심 설계 결론

vCandidate는 한 번에 하나의 큰 heuristic engine으로 만들지 않는다.

두 레이어로 분리한다.

~~~text
Layer A — Face Fit Personalization
현재 얼굴 구조 / visual language가
Target이 허용한 action의 강도·우선순위·보존 여부에만 개입

Layer B — Current Styling Gap
현재 스타일 상태와 Target Style 사이의 실제 styling gap을 계산
~~~

이 둘은 서로 다른 질문이다.

~~~text
Face Fit:
이 얼굴에서 이 Target action을 얼마나 강조할 것인가?

Current Styling Gap:
사용자는 이미 이 스타일 방향을 어느 정도 하고 있는가?
~~~

얼굴 구조를 Current Styling State의 대용물로 사용하지 않는다.

## 5. 왜 Current Styling Gap이 별도로 필요한가

현재 production face observation contract는 의도적으로 다음을 관찰하지 않는다.

- hairstyle state
- makeup styling state
- accessory styling state
- trend adoption state
- final style recommendation

그런데 Target Vector에는 다음 축이 있다.

- naturalPolished
- playfulMature
- minimalStatement
- warmCool
- classicTrendy

이 축 중 다수는 얼굴 골격만 보고 Current 값을 정할 수 없다.

예를 들어 classic Target이 모든 얼굴에서 같은 recommendation을 낸다는 이유만으로 jawline이나 face shape를 classic/trendy action에 억지로 연결하면 category error가 된다.

따라서 collapsed target 중 상당수는 face modifier 확장만으로 해결하려 해서는 안 된다.

## 6. vCandidate-1 — Face Fit Personalization

### 6.1 목표

vCurrent의 Target authority와 action vocabulary를 유지하면서 얼굴 근거가 action 선택에 더 명시적으로 개입하도록 한다.

### 6.2 허용 operation

vCandidate-1에서 face observation은 다음 네 종류의 operation만 수행할 수 있다.

~~~text
1. strength_cap
2. preserve
3. priority_adjust
4. existing_parameter_redirect
~~~

금지 operation:

~~~text
- Target에 없던 반대 방향 action 생성
- 새 domain 강제 추가
- Scope 밖 action 생성
- hard exclusion 우회
- target vector 수정
~~~

### 6.3 Target Action Pool은 authority로 유지

먼저 current buildTargetActions()를 별도 pure module로 추출한다.

제안 파일:

~~~text
lib/face-lab-v2/target-action-pool.js
~~~

vCurrent와 vCandidate가 동일 pool을 사용한다.

추출 전후 vCurrent output은 semantic-equivalent여야 한다.

이렇게 해야 Human pairwise에서 차이가 Target generator 변경 때문인지 personalization policy 때문인지 분리할 수 있다.

## 7. Face Personalization Relation Registry

현재 applyFaceModifiers()의 if문을 계속 늘리지 않는다.

제안 파일:

~~~text
lib/face-lab-v2/personalization/face-action-relations.js
~~~

relation 예시 schema:

~~~text
relationId
sourceObservation
sourceValues
targetPrecondition
actionMatch
operation
expectedEffectPolicy
evidencePolicy
cueReadiness
authorityClass
knownExceptions
humanCalibrationRequired
~~~

authorityClass:

~~~text
CURRENT_CONTRACT
CANDIDATE_HYPOTHESIS
BLOCKED_PENDING_VALIDATION
~~~

### 7.1 현재 rule은 CURRENT_CONTRACT

현재 4개 modifier는 behavior를 바꾸지 않고 registry로 옮긴다.

- eyeDirection / outerEyeEmphasis
- featureContrast / selectedFeatureContrast
- contourDefinition / outlineDefinition
- straightCurveBalance / curvature

### 7.2 새 candidate rule의 원칙

새 relation은 observation과 action 사이에 직접적인 semantic family가 있을 때만 우선 후보로 둔다.

예:

~~~text
straightCurveBalance=curved
+
Target softSharp low
+
hair:curvature increase
or eyewear:curvature increase
→ repeated softening amplification을 cap하는 후보
~~~

반대 방향도 동일하다.

~~~text
straightCurveBalance=straight
+
Target softSharp high
+
sharp/definition family action
→ 과잉 중첩을 줄이는 saturation-guard 후보
~~~

이 관계도 production truth가 아니라 CANDIDATE_HYPOTHESIS다.

Human pairwise를 통과하기 전에는 current engine authority가 아니다.

## 8. Cue readiness gate

기존 operational-definition 상태를 그대로 존중한다.

### 8.1 Candidate expansion 허용 후보

현재 blind Human cue audit 준비 상태가 상대적으로 높은 구조 cue:

- jawlineAngularity
- faceLengthBalance
- eyeDirection
- eyeOpenness
- featureScale
- featureConcentration
- straightCurveBalance
- faceShape

단 READY라는 이유만으로 styling rule authority가 생기는 것은 아니다.

READY는 observation 의미가 비교 가능하다는 뜻일 뿐이다.

### 8.2 확장 금지

featureContrast:

~~~text
DECOMPOSITION_REQUIRED_BEFORE_DIRECT_USE
~~~

따라서 기존 vCurrent legacy modifier는 regression compatibility로 유지하되,
새 vCandidate relation을 추가하지 않는다.

contourDefinition:

~~~text
NOT_READY_REQUIRES_VALIDATION
~~~

기존 current modifier는 유지하되 새 relation expansion은 보류한다.

eyeLength:

~~~text
NOT_READY_REQUIRES_VALIDATION
~~~

새 rule에 사용하지 않는다.

## 9. Face Fit Planner

제안 파일:

~~~text
lib/face-lab-v2/personalization/face-fit-planner.js
~~~

입력:

~~~text
currentFaceProfile
targetStyle
targetActions
personalizationPolicyVersion
~~~

출력:

~~~text
personalizedActions
personalizationLedger
conflicts
~~~

각 action에는 optional metadata를 추가한다.

~~~text
facePersonalization: {
  relationId,
  operation,
  sourceObservation,
  sourceValue,
  authorityClass
}
~~~

evidence에는 반드시:

~~~text
face_feature:<field>=<value>
candidate_relation:<relationId>
~~~

를 남긴다.

Target evidence는 절대 삭제하지 않는다.

## 10. vCandidate-1에서 최적화하지 않을 것

### routeConcentration = 1.0

16L에서 selected route가 모두 balanced였지만 이 값 자체를 고치지 않는다.

현재 broad scope + moderate constraints에서는 balanced가 default가 되는 구조이므로 route strategy 분산을 위해 억지로 route를 바꾸면 metric gaming이 된다.

vCandidate-1의 핵심 평가는:

~~~text
action specificity
face evidence usage
action priority
strength / preserve behavior
human-visible rationale
~~~

다.

## 11. Current Styling Baseline — vCandidate-2

vCandidate-1만으로 classic / trendy / natural / polished 계열의 근본 gap을 해결하려 하지 않는다.

별도 Current Styling State를 추가한다.

제안 모델:

~~~text
CurrentStylingBaseline {
  naturalPolished
  playfulMature
  minimalStatement
  classicTrendy
  warmCool
}
~~~

각 field:

~~~text
value: low | middle | high | unknown
source: self_report | future_style_observer
confidence
evidence
~~~

첫 버전 source는 self_report를 우선한다.

현재 Vision face observer는 얼굴 구조 전용 계약이므로 hairstyle / makeup / accessories를 몰래 관찰 범위에 추가하지 않는다.

## 12. Current Styling Baseline 최소 UX

추가 질문은 가능한 한 적게 한다.

예상 4~5개의 선택형 질문:

~~~text
평소 헤어·그루밍 마감
→ relaxed / middle / polished

평소 얼굴 주변 포인트 수
→ minimal / middle / statement

평소 스타일 분위기
→ playful / middle / calm

평소 유행 반영 정도
→ classic / middle / trendy

현재 얼굴 주변 색 방향
→ warm / neutral / cool / unknown
~~~

사용자가 모르면 unknown 가능.

unknown은 실패가 아니라 기존 target-only behavior로 fallback한다.

## 13. Style Gap v2

vCandidate-2의 conceptual flow:

~~~text
Current Face Profile
+
Current Styling Baseline
+
Target Style Profile
+
Scope
+
Constraints
        ↓
Target Action Pool
        ↓
Face Fit Planner
        ↓
Current Styling Gap Planner
        ↓
Scope / Constraint Authority
        ↓
Routes
~~~

Current Styling Gap Planner는 Target axis와 Current baseline이 이미 같은 방향이면 중복 강도를 줄이고,
차이가 클 때 기존 Target action을 유지한다.

중요:

- face anatomy를 styling baseline으로 변환하지 않는다.
- Current Styling Baseline이 unknown이면 추정하지 않는다.
- 사용자의 Target은 항상 최종 authority다.

## 14. vCurrent / vCandidate 격리

production current path를 직접 덮어쓰지 않는다.

제안:

~~~text
buildStyleDelta()              // current
buildCandidateStyleDelta()     // candidate
~~~

공통:

~~~text
buildTargetActionPool()
applyScopeAndConstraints()
~~~

분리:

~~~text
current modifier policy
candidate personalization policy
~~~

Human pairwise 전에는 UI production path가 buildCandidateStyleDelta()를 호출하면 안 된다.

## 15. Candidate deterministic evaluator

제안 파일:

~~~text
lib/face-lab-v2/evaluation/candidate-personalization.js
~~~

필수 hard invariant:

### CP1 Target Authority

candidate action은 반드시 동일 Target Action Pool lineage를 가져야 한다.

### CP2 No Direction Reversal

candidate personalization은 target direction을 반대로 뒤집을 수 없다.

예외는 기존 current contract에 이미 존재하는 maintain / redirect relation뿐이다.

### CP3 Scope / Constraint Authority

현재 hard exclusion / styling scope / makeup intensity 계약을 그대로 지킨다.

### CP4 Evidence Lineage

candidate personalization이 action을 바꾸면 relationId와 face evidence가 반드시 action까지 이어져야 한다.

### CP5 Current Regression Isolation

vCurrent output은 candidate module 도입 전후 동일해야 한다.

### CP6 Blocked Cue Guard

BLOCKED_PENDING_VALIDATION cue가 candidate-only relation에 사용되면 실패한다.

## 16. Candidate diagnostics

threshold 없이 먼저 측정한다.

~~~text
candidateChangedCaseCount
candidateChangedActionCount
faceEvidenceUtilization
relationActivationCounts
targetSpecificMutationRate
sameTargetActionSignatureCount
sameTargetEvidenceSignatureCount
humanVisibleRationaleMutationRate
routeMutationRate
~~~

16L metric을 그대로 재사용하되 추가로 다음 signature를 둔다.

### personalization signature

~~~text
domain
parameter
direction
strength
reason
facePersonalization.relationId
sourceObservation
sourceValue
~~~

단순 action ordering 변화도 별도로 기록한다.

## 17. Human Pairwise Pilot

이미 merge된 Human Pairwise Contract v1을 그대로 사용한다.

비교:

~~~text
same input
vCurrent
vs
vCandidate
~~~

reviewer는 A/B 중 어느 쪽이 current인지 모른다.

평가 dimension:

- target_fit
- specificity
- evidence_action_linkage

### Pilot sample은 metric 개선만 보고 고르지 않는다.

세 그룹을 섞는다.

~~~text
A. candidate relation activation case
B. current와 candidate가 거의 같은 boundary case
C. 16L high-repetition target case
~~~

classic / mature_calm / minimal / natural / sophisticated / trendy는 반드시 포함하되,
vCandidate-1이 이들을 억지로 변화시키지는 않는다.

이 그룹에서 Human이 generic하다고 판단한다면 vCandidate-2 Current Styling Baseline의 필요성이 직접 검증된다.

## 18. LLM Judge는 아직 비활성

Human calibration artifact가 실제로 존재하기 전에는 LLM pairwise judge를 만들지 않는다.

후속 단계에서만:

~~~text
same blind A/B payload
same three dimensions
Human vs LLM agreement by dimension
disagreement preserved
diagnostic-only
~~~

로 사용한다.

## 19. 구현 PR 순서

### PR A — Refactor without semantic change

- target-action-pool.js 추출
- current modifier registry화
- vCurrent exact/semantic regression verifier
- production output 변화 0

### PR B — vCandidate-1 foundation

- face-action-relations.js
- face-fit-planner.js
- buildCandidateStyleDelta()
- candidate lineage
- production wiring 없음

### PR C — Candidate deterministic evaluation

- candidate-personalization evaluator
- current vs candidate replay
- 16L side-by-side diagnostics
- no arbitrary diversity threshold

### PR D — Human pair builder

- same input에서 current/candidate 생성
- deterministic blind A/B assignment
- Human Pairwise Contract v1 artifact 생성
- Human judgment은 아직 없음

### PR E — Human pilot execution

- independent Human responses 수집
- seal
- private reveal
- dimension별 descriptive aggregate
- candidate 승격 여부는 별도 판단

### PR F — Current Styling Baseline

Human 결과가 collapsed-target genericity를 실제 문제로 지지할 때 진행한다.

- survey schema
- baseline mapper
- styling-gap planner
- candidate v2
- 다시 deterministic + Human pairwise

### PR G — bounded LLM judge

Human calibration 이후에만 시작한다.

## 20. Promotion rule

vCandidate는 다음 순서를 건너뛸 수 없다.

~~~text
deterministic hard gates PASS
→ candidate diagnostics
→ Human blind pair calibration
→ finding review
→ 필요 시 candidate revision
→ bounded LLM judge calibration
→ production activation review
~~~

16L repetition metric 하나가 좋아졌다는 이유로 승격하지 않는다.

## 21. 현재 결론

현재 문제를 단순히 “face modifier 4개라서 부족하다”로만 보면 안 된다.

실제 구조는 두 문제다.

~~~text
Problem A
face-aware action arbitration이 너무 좁다.

Problem B
Target의 일부 축은 얼굴 구조와 직접 비교할 Current styling state 자체가 없다.
~~~

따라서 올바른 vCandidate 설계는 얼굴형별 미용 공식 추가가 아니라 다음이다.

~~~text
Target authority 유지
+
Face Fit Personalization
+
Current Styling Gap의 별도 authority
+
Human blind pair calibration
~~~

이 설계의 첫 구현은 PR A부터 시작한다.
