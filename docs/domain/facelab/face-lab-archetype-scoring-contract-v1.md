# Face Lab Archetype Scoring Contract v1

## 0. 상태

| 항목 | 값 |
| --- | --- |
| 단계 | `FACE-ENGINE-1` |
| 구현 모드 | Shadow only |
| Registry | `face-lab-archetype-rubric-20260727` |
| Calibration | Not ready |
| 제품 노출 | 금지 |
| 저장 | 금지 |

이 계약은 `FaceLabObservationAnalysis`를 입력으로 대표 상 후보의 규칙 기반 원시 점수와 기여도 ledger를 계산하는 내부 계약이다. 현재 단계는 분류 기준과 계산 경계를 고정하는 단계이며, 대표 상을 사용자 결과로 확정하는 단계가 아니다.

## 1. 목적

```text
FaceLabObservationAnalysis
  → Registry validation
  → Indicator matching
  → Raw score
  → Evidence coverage
  → Contribution ledger
  → Hold decision
  → Shadow result
```

목표는 다음과 같다.

1. Vision이 대표 상이나 유사도 숫자를 직접 생성하지 않게 한다.
2. 모든 점수 기여를 구조화 관찰 필드까지 역추적할 수 있게 한다.
3. 근거가 없거나 계약이 미완성인 경우 0점 또는 hold로 fail-closed 한다.
4. calibration 전에는 어떤 후보도 제품 판정으로 승격하지 않는다.

## 2. 제품 경계

이번 단계에서 변경하지 않는 항목:

- `/api/analyze` 응답
- `/api/face-reading` 응답
- 무료 Face Lab UI
- Premium Face Lab UI
- `face-lab-canonical-v1.archetype`
- Premium session
- `saved_reports`
- analytics event
- Provider prompt 및 Provider 호출 횟수

Shadow evaluator는 위 경로에 연결하지 않는다. 따라서 현재 canonical bundle의 `archetype`은 계속 `null`이다.

## 3. 입력 계약

입력은 정규화된 `FaceLabObservationAnalysis`다.

허용 상태:

- `available`
- `partial`

필수 품질 조건:

- `quality.status === "available"`
- `quality.confidence`가 0~1 범위로 정규화 가능
- `quality.value.structureSuitability !== "unsuitable"`

점수 입력으로 허용되는 값:

- `observations.<group>.<field>.value`
- `observations.<group>.<field>.confidence`
- `observations.<group>.<field>.status`
- `observations.<group>.<field>.evidence`의 존재 여부와 개수
- `quality.confidence`

금지 입력:

- evidence 문장의 단어 또는 정규식 매칭
- Provider 자유서술 원문
- 사용자 이름, 성별, 나이, 인종, 피부색
- 성격, 운세, 관상, 매력도
- locale 또는 사용자 선호
- fallback/default 값

## 4. Registry 계약

Registry schema:

```js
{
  schemaVersion: "face-lab-archetype-registry-v1",
  registryVersion: string,
  lifecycle: Lifecycle,
  calibrationStatus: "not_ready" | "ready",
  decisionPolicy: {
    minimumEvidenceCoverage: number | null,
    minimumTopScore: number | null,
    minimumTopMargin: number | null,
    maximumContradictions: integer | null
  },
  archetypes: ArchetypeDefinition[]
}
```

Lifecycle:

```text
proposed
→ rubric_ready
→ pilot
→ validated
→ active
→ paused
→ retired
```

현재 Registry와 모든 분류군은 `rubric_ready`, `unvalidated`다.

### 4.1 분류군

현재 shadow rubric은 기존 도메인 초안의 7개 key만 포함한다.

- `wolf`
- `cat`
- `puppy`
- `deer`
- `tofu`
- `potato`
- `dino`

이 목록과 가중치는 calibration 전 가설이다. 사용자 노출 taxonomy로 확정된 것이 아니다.

### 4.2 Indicator

```js
{
  path: "observations.<group>.<field>",
  expectedValues: string[],
  polarity: 1 | -1,
  weight: number,
  required: boolean,
  evidenceRequired: true
}
```

검증 규칙:

- path는 `FACE_LAB_OBSERVATION_DEFINITIONS`에 존재해야 한다.
- expected value는 해당 필드 enum에 존재해야 한다.
- weight는 0보다 크고 5 이하여야 한다.
- negative indicator도 실제 available field와 evidence가 있어야 적용된다.
- evidenceRequired는 항상 `true`다.
- taxonomy key는 중복될 수 없다.
- 7개 taxonomy가 모두 없으면 Registry는 invalid다.

## 5. 점수 계약

개별 indicator 기여도:

```text
contribution
= weight
× field confidence
× quality multiplier
× polarity
```

적용 조건:

- field status가 `available`
- value가 null이 아님
- 비어 있지 않은 evidence가 1개 이상 존재
- value가 expected values 중 하나와 일치

그 외에는 contribution이 0이다.

### 5.1 결측 처리

- missing field → 0
- unavailable field → 0
- insufficient evidence → 0
- empty evidence → 0
- invalid confidence → 0
- unmatched enum → 0
- fallback 값 생성 → 금지

### 5.2 Negative contribution

Negative indicator는 관찰값이 명시적으로 반대 조건과 일치하고 evidence가 존재할 때만 음수 기여를 만든다. 기대값과 일치하지 않았다는 사실만으로 음수를 부여하지 않는다.

### 5.3 Evidence coverage

Evidence coverage는 점수 일치도가 아니라 **양성 indicator 중 실제 관찰 근거가 존재하는 가중치 비율**이다.

```text
evidence coverage
= evidenced positive indicator weight
/ total positive indicator weight
```

관찰값이 해당 archetype 기대값과 일치하지 않아도, field와 evidence가 있으면 coverage에는 포함된다. 점수와 근거 보유량을 혼합하지 않는다.

## 6. Contribution ledger

각 후보는 indicator별 ledger를 가진다.

```js
{
  path,
  polarity,
  weight,
  required,
  fieldStatus,
  evidenceAvailable,
  matched,
  fieldConfidence,
  qualityMultiplier,
  evidenceCount,
  contribution
}
```

Ledger에는 evidence 문장을 복사하지 않는다. source path와 evidence count만 보유한다. 원시 이미지, base64, URL, Provider 원문도 포함하지 않는다.

Invariant:

```text
candidate.rawScore
=== sum(candidate.ledger[*].contribution)
```

소수점은 계산 재현성을 위해 6자리에서 고정한다.

## 7. Shadow decision

현재 evaluator 반환값:

```js
{
  schemaVersion: "face-lab-archetype-shadow-v1",
  mode: "shadow",
  productionEligible: false,
  status: "held",
  decision: null,
  registryVersion,
  topCandidate,
  ranking,
  holdReasons,
  privacy: {
    sourceImagePersisted: false,
    evidenceTextCopied: false
  }
}
```

Shadow 단계에서는 calibrated policy를 주입하더라도 `decision`을 만들지 않는다. 이는 계산 계약 검증을 위한 경계이며 제품 판정 adapter가 아니다.

## 8. Hold reason

고정 순서:

1. `ineligible`
2. `insufficient_quality`
3. `taxonomy_not_ready`
4. `missing_required_axis`
5. `low_evidence`
6. `low_top_score`
7. `low_top_margin`
8. `contradiction`
9. `calibration_not_ready`

정책 임계값이 null이면 해당 low-* 판정은 실행하지 않는다. 대신 `calibration_not_ready`를 유지한다.

기본 Registry는 다음 두 hold를 반드시 포함한다.

- `taxonomy_not_ready`
- `calibration_not_ready`

## 9. Fail-closed

- Registry validation 실패 → 빈 ranking + `taxonomy_not_ready`
- 분석 품질 실패 → 점수 multiplier 0 + `insufficient_quality`
- eligibility 실패 → `ineligible`
- required axis evidence 부재 → `missing_required_axis`
- 예외 발생 → 제품 판정 없음

어떤 실패에서도 임의 archetype, similarity, 설명 문구를 생성하지 않는다.

## 10. Activation gate

다음 조건을 모두 통과하기 전 production wiring을 금지한다.

1. Registry lifecycle `validated` 이상
2. 모든 active archetype lifecycle `validated` 이상
3. 모든 archetype calibration status `validated`
4. 네 개 decision threshold 확정
5. versioned human evaluation fixture 존재
6. top-1, top-margin, hold precision 평가 완료
7. 성별·연령·피부색·화장 조건 bias 검토 완료
8. regression guard와 rollback 기준 확정
9. 사용자 카피 수용성 검토 완료
10. 별도 승인된 activation PR

## 11. 검증 매트릭스

Verifier는 다음을 검사한다.

- positive fixture ranking
- explicit negative contribution
- negative evidence 부재 시 0점
- deterministic repeatability
- ledger sum invariant
- evidence text 미복사
- tie → `low_top_margin`
- low score → `low_top_score`
- insufficient analysis → fail-closed
- required evidence 부재 → `missing_required_axis`
- malformed Registry → `taxonomy_not_ready`
- 기본 Registry → taxonomy/calibration hold
- evidence text regex 사용 금지

## 12. 후속 단계

```text
FACE-ENGINE-1 Contract + Shadow Evaluator
→ FACE-EVAL-1 Calibration Dataset and Thresholds
→ FACE-EVAL-2 Bias / Regression Evaluation
→ FACE-ACTIVATE-1 Production Activation
→ FACE-ENGINE-2 Style Identity
```
