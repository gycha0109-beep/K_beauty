# Synthetic Evaluation Toolkit #T5

# Judgment & Intent Alignment Design v1

## 0. 문서 상태

- Toolkit Track: `#T5`
- 작업 유형: 설계 전용
- 기준 브랜치: `feature/T4-observation-adapter`
- 기준 SHA: `c1b0cc527f277bfb9ac524b1a58e46a941ac92da`
- 구현 상태: 미구현
- Provider 호출: 0
- production runtime 변경: 금지
- candidate/observation artifact 변경: 금지
- dataset promotion: 범위 밖

`#T5`는 Toolkit 내부 작업 식별자이며 GitHub 실제 PR 번호가 아니다.

---

## 1. 목적

#T5는 #T4의 권위 있는 blind observation을 사람이 생성 의도를 모르는 상태에서 검토하고, 그 판단이 불변으로 봉인된 뒤에만 #T2의 생성 의도와 결합해 목적별 정합성을 판정하는 경계를 정의한다.

```text
G0 candidate
+ authoritative T4 observation
→ blind judgment assignments
→ immutable judgment submissions
→ consensus
→ sealed consensus artifact
→ verified GenerationSpec join
→ purpose-specific intent alignment
→ derived G2/G3 records
→ promotion review handoff
```

핵심 구분은 다음과 같다.

```text
생성 의도
≠ 관찰값
≠ 단일 판단
≠ 합의
≠ 정합성 판정
≠ Gold
```

#T5는 `G2_OBSERVED`와 `G3_CONSENSUS_VALIDATED`를 파생 기록으로 표현할 수 있으나, `G4_SYNTHETIC_GOLD`와 `G5_LOCKED_HOLDOUT` 승격은 후속 Track의 책임이다.

---

## 2. 기준 계약

### 2.1 #T2 GenerationSpec

#T5가 읽는 intent source는 #T3 candidate manifest가 참조하는 finalized `GenerationSpec` artifact뿐이다.

허용 purpose:

- `capture_control`
- `skin_cue_control`
- `face_feature_control`
- `paired_skin_edit`
- `mixed_control_pilot`

현재 승인된 feature axis:

- `eyeDirection`
- `eyeOpenness`
- `faceLengthBalance`
- `jawlineAngularity`
- `straightCurveBalance`
- `featureContrast`

현재 skin target:

- redness: `none | mild`
- blemishes: `none | mild`
- blemish count band: `none | three_to_five`
- region metadata

`archetypeIntent`는 활성 taxonomy가 없으므로 #T5 v1에서 평가하지 않는다.

### 2.2 #T3 candidate provenance

#T3 candidate manifest는 다음을 권위 있게 연결한다.

- candidate identity
- canonical image SHA-256
- finalized spec digest와 object reference
- compiled prompt digest와 object reference
- campaign/condition/lineage
- Provider provenance
- operator attestation/hints

Blind judgment 단계는 이 manifest 전체를 읽지 않는다. Intent alignment 단계에서만 검증된 reader를 통해 필요한 generation reference를 읽는다.

### 2.3 #T4 blind judgment input

#T5 blind stage의 유일한 시작 입력은 다음 구조다.

```ts
type BlindJudgmentInputV1 = {
  schemaVersion: "blind-judgment-input-v1";
  candidateId: string;
  observationRunId: string;
  observationDigest: string;
  canonicalAsset: {
    sha256: string;
    objectRelativePath: string;
  };
  observation: VisionObservationBundleV1;
};
```

이 입력은 다음 조건을 이미 만족해야 한다.

- observation run outcome = `observed_bundle`
- authority = `observed_image`
- execution mode = `provider_bounded`
- fixture result 아님
- canonical SHA, observation digest, snapshot digest 일치
- bundle status = `available`
- observation process image copy/raw response 비저장

---

## 3. 설계 전 리뷰 결과

### R-01. T4 observation을 곧바로 ground truth로 쓰면 안 된다

T4 결과는 구조화된 모델 관찰이다. 권위 있는 실행 기록이지만 인간 합의나 Gold label이 아니다.

조치:

- `observed_image` authority는 G2 근거까지만 사용
- G3는 독립 blind judgment consensus가 있어야 함
- fixture observation은 판단과 합의에서 차단

### R-02. 생성 의도를 먼저 보여주면 확인 편향이 생긴다

조치:

- judgment request schema에 spec, prompt, purpose, condition, campaign, intended label 필드를 금지
- judgment process와 intent join process를 별도 command/module/storage domain으로 분리
- consensus가 봉인되기 전 intent resolver 호출 금지

### R-03. T4 skin observation만으로 absence, 개수, 좌우 region을 확정할 수 없다

T4 contract의 `signals.* = 0`은 부재와 unsupported를 완전히 구분하지 못한다. acne/redness observation의 area도 `cheeks`처럼 coarse하고, blemish count는 제공하지 않는다.

조치:

- `none` target을 signal 0만으로 자동 match하지 않음
- blind human judgment에서 absence, count band, 세부 region을 별도 enum으로 기록
- evidence가 부족하면 `unverifiable`, match로 승격하지 않음

### R-04. 단일 총점은 치명적 불일치를 숨긴다

예: 정면/조명은 좋지만 intended skin cue가 반대로 생성된 경우 평균 점수는 높아질 수 있다.

조치:

- v1에서는 aggregate quality score를 만들지 않음
- gate, target, diagnostic axis를 분리
- critical mismatch 하나라도 있으면 overall aligned 금지

### R-05. paired edit의 동일 인물 보존은 현재 계약으로 검증할 수 없다

#T4는 identity recognition과 same-person verification을 금지한다. 시각적 유사성을 identity equality로 승격할 수 없다.

조치:

- `paired_skin_edit`에서 skin mutation alignment는 기록 가능
- identity/preservation status는 `not_assessed_v1`
- overall `aligned`와 promotion eligible을 금지
- 결과는 `target_match_pair_unverified` 또는 더 낮은 상태만 허용

### R-06. judge의 자유 문장은 개인정보와 임의 추론을 유입한다

조치:

- v1 authoritative artifact에 free-text note 금지
- enum decision, enum reason code, observation field path만 저장
- judge identity는 pseudonymous local ID만 사용

### R-07. alignment는 prompt text가 아니라 canonical spec을 사용해야 한다

조치:

- compiled prompt prose를 target parser로 사용하지 않음
- candidate manifest의 spec digest와 object reference를 재검증
- exact GenerationSpec validator를 통과한 semantic payload만 join

### R-08. intent join 결과가 기존 candidate/observation을 변경하면 안 된다

조치:

- judgment, consensus, alignment, grade는 별도 append-only artifacts
- candidate manifest와 observation run/object는 불변
- grade는 파생 registry record로만 표현

---

## 4. 절대 불변식

### J-01. Judgment는 process-level blind다

```text
image + T4 observation
→ judgment submission
→ consensus sealed
→ 이후에만 intent join
```

함수 인자로 full candidate manifest를 전달한 뒤 관례로 intent를 무시하는 방식은 허용하지 않는다.

### J-02. 한 judge는 한 assignment에 한 번만 제출한다

동일 candidate, observation digest, judge ID, assignment ID 조합은 immutable claim으로 보호한다. 기존 claim만 있고 submission이 없으면 hidden resubmission을 허용하지 않고 상태를 uncertain으로 처리한다.

### J-03. Judge는 observation을 검증하거나 제한적으로 교정한다

Judge는 personality, beauty, celebrity similarity, archetype, diagnosis를 새로 생성하지 않는다. 승인된 axis registry의 값만 선택한다.

### J-04. Unsupported는 absence가 아니다

`unavailable`, `uncertain`, `not_visible`은 `none` target과 일치하지 않는다.

### J-05. Fixture는 consensus에 참여하지 않는다

`fixture_only` authority 또는 `fixture_replay` observation은 assignment 생성 단계에서 fail-closed한다.

### J-06. Consensus는 intent를 모른다

Consensus engine의 입력에는 purpose, spec digest, target axis, condition ID가 없다.

### J-07. Consensus는 불일치를 숨기지 않는다

Critical axis disagreement는 평균, 다수결 추측, LLM tie-break로 자동 해소하지 않는다. 별도 adjudicator submission이 필요하다.

### J-08. Alignment는 순수 deterministic join이다

Provider/API/browser 호출 없이 sealed consensus와 verified GenerationSpec을 versioned policy로 비교한다.

### J-09. Alignment 결과는 purpose-specific이다

같은 candidate도 평가 목적이 다르면 usable 의미가 다르다. 단일 전역 Gold 판정을 만들지 않는다.

### J-10. T5는 G4/G5를 만들지 않는다

Alignment pass는 promotion review 입력일 뿐 Gold가 아니다.

### J-11. 원본·canonical image를 복제하지 않는다

Judgment process는 #T3 canonical object를 read-only로 열며 crop, screenshot, thumbnail, annotation file을 authoritative storage에 만들지 않는다.

### J-12. Production은 Toolkit에 의존하지 않는다

Production route/UI/DB/Auth/Payment는 변경하지 않는다.

---

## 5. 책임 분리

```text
Blind Assignment Resolver
  └─ authoritative T4 judgment input 검증, intent 없는 assignment 발급

Judgment Registrar
  └─ judge claim, strict submission validation, immutable write

Consensus Builder
  └─ 독립 submission 비교, disagreement 보존, sealed consensus 생성

Intent Resolver
  └─ candidate manifest와 finalized GenerationSpec 무결성 검증

Alignment Engine
  └─ purpose policy로 consensus와 intended target 비교

Grade Deriver
  └─ G2/G3 append-only 파생 기록

Promotion Projection
  └─ 후속 Track용 검증된 handoff 생성
```

---

## 6. Judgment axis registry v1

```ts
type JudgmentAxisRegistryV1 = {
  schemaVersion: "judgment-axis-registry-v1";
  registryId: "bejewely-synthetic-judgment-v1";
  registryVersion: "1.0.0";
  captureAxes: string[];
  skinAxes: string[];
  faceAxes: string[];
};
```

### 6.1 Capture gate axes

| axis | allowed values |
|---|---|
| `capture.photorealisticSingleAdult` | `confirmed | rejected | uncertain` |
| `capture.directFrontal` | `confirmed | rejected | uncertain` |
| `capture.levelPitch` | `confirmed | rejected | uncertain` |
| `capture.levelRoll` | `confirmed | rejected | uncertain` |
| `capture.cameraGaze` | `confirmed | rejected | uncertain` |
| `capture.neutralExpression` | `confirmed | rejected | uncertain` |
| `capture.headShouldersFraming` | `confirmed | rejected | uncertain` |
| `capture.fullHeadNeckUpperShoulders` | `confirmed | rejected | uncertain` |
| `capture.plainLightGrayBackground` | `confirmed | rejected | uncertain` |
| `capture.softEvenDiffuseLighting` | `confirmed | rejected | uncertain` |
| `capture.sharpFace` | `confirmed | rejected | uncertain` |
| `appearance.hairTiedBack` | `confirmed | rejected | uncertain` |
| `appearance.hairClearOfForeheadCheeks` | `confirmed | rejected | uncertain` |
| `appearance.plainCrewNeckTop` | `confirmed | rejected | uncertain` |
| `appearance.glassesAbsent` | `confirmed | rejected | uncertain` |
| `appearance.jewelryAbsent` | `confirmed | rejected | uncertain` |
| `appearance.visibleAccessoriesAbsent` | `confirmed | rejected | uncertain` |
| `appearance.visibleMakeupAbsent` | `confirmed | rejected | uncertain` |

Capture gate는 T4 eligibility와 face quality evidence를 참고할 수 있으나 judge가 image에서 직접 확인한다.

### 6.2 Skin axes

```ts
type BlindSkinJudgmentV1 = {
  redness: {
    presence: "none" | "mild" | "moderate_or_higher" | "uncertain";
    regions: Array<"left_cheek" | "right_cheek" | "sides_of_nose" | "other">;
  };
  blemishes: {
    presence: "none" | "mild" | "moderate_or_higher" | "uncertain";
    countBand: "none" | "one_to_two" | "three_to_five" | "six_plus" | "uncertain";
    regions: Array<"left_cheek" | "right_cheek" | "chin" | "other">;
  };
};
```

규칙:

- `presence = none`이면 regions는 빈 배열
- `countBand = none`이면 blemish presence도 `none`
- `uncertain`이면 positive/absence match 근거로 사용하지 않음
- makeup/filter/lighting이 판정을 방해하면 `uncertain`
- 피부 질환·의학적 severity를 판정하지 않음

### 6.3 Face feature axes

T2 generation registry와 T4 observation enum의 공통 축만 사용한다.

| axis | allowed values |
|---|---|
| `face.eyeDirection` | `upturned | level | downturned | mixed | uncertain` |
| `face.eyeOpenness` | `narrow | medium | wide | uncertain` |
| `face.faceLengthBalance` | `short | balanced | long | uncertain` |
| `face.jawlineAngularity` | `soft | moderate | angular | uncertain` |
| `face.straightCurveBalance` | `curved | balanced | straight | uncertain` |
| `face.featureContrast` | `low | medium | high | uncertain` |

`mixed`는 generation target 값이 아니므로 exact match가 아니다.

### 6.4 금지 axis

- archetype/animal type
- beauty score/rank
- celebrity or real-person similarity
- personality, physiognomy, fortune
- ethnicity classification
- health diagnosis
- recommended hair/makeup/palette/style
- same-person identity equality

---

## 7. Assignment와 claim

### 7.1 BlindJudgmentAssignment v1

```ts
type BlindJudgmentAssignmentV1 = {
  schemaVersion: "blind-judgment-assignment-v1";
  assignmentId: string;
  candidateId: string;
  observationRunId: string;
  observationDigest: string;
  canonicalAsset: {
    sha256: string;
    objectRelativePath: string;
  };
  registry: {
    id: "bejewely-synthetic-judgment-v1";
    version: "1.0.0";
  };
  issuedAt: string;
  assignmentDigest: string;
};
```

포함 금지:

- purpose
- GenerationSpec/prompt/campaign/condition/series
- intended skin/feature target
- Provider generation metadata
- operator hint
- candidate filename

### 7.2 JudgmentExecutionClaim v1

Submission 저장 전에 immutable claim을 만든다.

```ts
type JudgmentExecutionClaimV1 = {
  schemaVersion: "judgment-execution-claim-v1";
  assignmentId: string;
  candidateId: string;
  observationDigest: string;
  judgeId: string;
  claimedAt: string;
};
```

`judgeId` 규칙:

- local pseudonymous ID
- email, 실명, 전화번호, 계정 token 금지
- safe ID pattern만 허용

---

## 8. Blind judgment submission

```ts
type BlindJudgmentSubmissionV1 = {
  schemaVersion: "blind-judgment-submission-v1";
  submissionId: string;
  assignmentId: string;
  candidateId: string;
  observationRunId: string;
  observationDigest: string;
  judge: {
    judgeId: string;
    judgeType: "human_reviewer";
  };
  registry: {
    id: "bejewely-synthetic-judgment-v1";
    version: "1.0.0";
  };
  reviewability: {
    status: "reviewable" | "unreviewable";
    reasons: JudgmentReasonCode[];
  };
  capture: Record<string, "confirmed" | "rejected" | "uncertain">;
  skin: BlindSkinJudgmentV1;
  face: Record<string, string>;
  observationReview: {
    agreement: "agree" | "partial_disagreement" | "disagree" | "unreviewable";
    disputedObservationPaths: string[];
    reasons: JudgmentReasonCode[];
  };
  completedAt: string;
  submissionDigest: string;
};
```

### 8.1 Reason codes

```text
image_not_reviewable
face_not_clear
skin_not_clear
lighting_confounds_skin
makeup_confounds_skin
filter_or_editing_possible
occlusion_confounds_axis
pose_confounds_axis
observation_value_supported
observation_value_disputed
axis_evidence_insufficient
count_band_uncertain
region_uncertain
capture_contract_violation
```

자유형 note는 없다.

### 8.2 Submission identity

```text
submission semantic payload =
assignment digest
+ candidate ID
+ observation digest
+ judge ID
+ registry ID/version
+ reviewability
+ capture/skin/face decisions
+ observation review
```

`completedAt`은 digest identity에서 제외한다. 동일 semantic submission은 idempotent하게 같은 ID를 만든다.

---

## 9. Consensus

### 9.1 독립성

- 최소 2명의 서로 다른 human reviewer
- 각 reviewer는 별도 assignment/claim
- 서로의 submission을 볼 수 없음
- intent를 볼 수 없음
- T4 Provider observation은 reviewer 한 명으로 계산하지 않음

### 9.2 합의 정책

```ts
type JudgmentConsensusPolicyV1 = {
  id: "strict-two-plus-adjudicator-v1";
  version: "1.0.0";
  minimumIndependentReviewers: 2;
  criticalAgreement: "exact";
  disagreementResolution: "explicit_adjudicator";
  automaticMajorityTieBreak: false;
  modelTieBreak: false;
};
```

두 submission이 critical axis에서 모두 일치하면 consensus를 만들 수 있다.

불일치가 있으면:

```text
status = needs_adjudication
→ 별도 adjudicator assignment
→ adjudicator도 intent blind
→ 기존 submission을 수정하지 않음
```

Adjudicator는 기존 판단을 볼 수 있지만 generation intent는 볼 수 없다.

### 9.3 JudgmentConsensus v1

```ts
type JudgmentConsensusV1 = {
  schemaVersion: "judgment-consensus-v1";
  consensusId: string;
  candidateId: string;
  observationRunId: string;
  observationDigest: string;
  policy: {
    id: "strict-two-plus-adjudicator-v1";
    version: "1.0.0";
  };
  submissionDigests: string[];
  adjudicatorSubmissionDigest: string | null;
  status: "consensus_reached" | "needs_adjudication" | "unreviewable";
  agreed: {
    reviewability: string;
    capture: Record<string, string>;
    skin: BlindSkinJudgmentV1 | null;
    face: Record<string, string> | null;
  };
  disagreements: Array<{
    axis: string;
    values: string[];
  }>;
  sealedAt: string;
  consensusDigest: string;
};
```

`consensus_reached` artifact만 intent alignment 입력으로 허용한다.

---

## 10. Intent resolver

Intent join은 consensus가 봉인된 뒤 실행한다.

검증 순서:

1. consensus digest와 submission references 검증
2. observation run/object integrity 재검증
3. canonical image SHA 재검증
4. candidate manifest 위치와 candidate identity 검증
5. candidate manifest가 참조하는 finalized spec object read
6. exact `GenerationSpec` validation
7. spec digest 재계산 및 manifest reference와 비교
8. candidate identity semantic payload와 generation references 재검증
9. alignment policy resolve

금지:

- filename/condition ID로 target 추정
- compiled prompt prose parsing
- operator hint를 target으로 사용
- 사람이 alignment request에 intended value를 재입력
- 다른 candidate의 spec을 임의 join

---

## 11. Alignment axis model

```ts
type AlignmentAxisResultV1 = {
  axis: string;
  role: "gate" | "target" | "diagnostic";
  intended: string | string[] | null;
  judged: string | string[] | null;
  verdict: "matched" | "mismatched" | "unverifiable" | "not_applicable";
  reasonCode: string;
};
```

### 11.1 Gate

다음은 모든 목적에서 선행 gate다.

- authoritative observation and consensus integrity
- reviewability = reviewable
- synthetic single adult photorealistic human
- face/skin target에 필요한 visibility
- purpose가 요구하는 capture contract

Gate가 reject 또는 uncertain이면 overall `aligned`를 만들지 않는다.

### 11.2 Target

GenerationSpec에서 명시적으로 target된 축이다.

- positive target
- absence target
- feature enum
- target region/count band

### 11.3 Diagnostic

명시적으로 target되지 않았지만 drift 분석에 필요한 값이다. Diagnostic mismatch는 자동 실패가 아니며 후속 campaign 분석에만 사용한다.

---

## 12. Purpose-specific policy

### 12.1 `capture_control`

Critical target:

- subject/capture/appearance 고정 계약의 visible axes

Overall aligned 조건:

- 모든 mandatory capture gate = confirmed
- unreviewable/uncertain 없음

`regionalAppearanceHint`는 observed ethnicity label로 평가하지 않는다.

### 12.2 `skin_cue_control`

Critical gate:

- skin reviewable
- lighting/filter/makeup confound 없음
- mandatory capture axes confirmed

Critical target:

- redness presence
- redness regions
- blemish presence
- blemish count band
- blemish regions

정합성 예:

```text
intended redness = none
judged redness = none
→ matched

intended redness = none
judged redness = uncertain
→ unverifiable

intended redness = mild
judged redness = moderate_or_higher
→ mismatched / overshoot

intended blemish count = three_to_five
judged count = six_plus
→ mismatched / overshoot
```

T4 signal 수치만으로 absence를 자동 확인하지 않는다.

### 12.3 `face_feature_control`

Critical gate:

- structure reviewable
- pose/occlusion/quality confound 없음
- mandatory capture axes confirmed

Critical target:

- GenerationSpec `featureIntent.cues`에 들어 있는 각 axis

규칙:

- exact enum match만 `matched`
- intended가 없는 face axis는 diagnostic
- judged `mixed` 또는 `uncertain`은 exact match가 아님
- cue `strength`는 현재 observation/judgment contract에서 정량 검증하지 않으므로 `unverifiable` metadata로 남김

따라서 v1 alignment는 feature value 정합성을 판정하지만 `subtle | moderate` 강도 일치까지 주장하지 않는다.

### 12.4 `mixed_control_pilot`

- skin critical target 전체
- feature critical target 전체
- capture gate 전체
- 하나라도 mismatch/unverifiable이면 overall aligned 금지
- pilot 결과로만 기록
- 후속 promotion policy가 별도 승인되기 전 `promotionReviewEligible = false`

### 12.5 `paired_skin_edit`

평가 가능:

- target candidate의 skin mutation alignment
- reference candidate linkage와 lineage integrity
- 두 후보의 capture/face diagnostic drift

평가 불가:

- same-person identity equality
- identity preservation guarantee

Overall states:

- `target_match_pair_unverified`
- `target_mismatch`
- `unverifiable`
- `blocked`

`aligned`와 `promotionReviewEligible = true`는 v1에서 금지한다.

---

## 13. Overall verdict

```ts
type IntentAlignmentVerdict =
  | "aligned"
  | "partially_aligned"
  | "misaligned"
  | "unverifiable"
  | "target_match_pair_unverified"
  | "blocked";
```

결정 순서:

1. artifact integrity failure → `blocked`
2. consensus status != reached → `blocked`
3. critical gate rejected → `misaligned`
4. critical gate uncertain → `unverifiable`
5. critical target mismatch 존재 → `misaligned`
6. critical target unverifiable 존재 → `unverifiable`
7. paired edit pair verification unavailable → `target_match_pair_unverified`
8. diagnostic drift만 존재 → `partially_aligned`
9. 그 외 → `aligned`

숫자 평균 점수는 없다.

---

## 14. IntentAlignment artifact

```ts
type IntentAlignmentV1 = {
  schemaVersion: "intent-alignment-v1";
  alignmentId: string;
  candidate: {
    candidateId: string;
    candidateDigest: string;
    canonicalSha256: string;
  };
  observation: {
    runId: string;
    observationDigest: string;
  };
  consensus: {
    consensusId: string;
    consensusDigest: string;
  };
  generation: {
    specDigest: string;
    purpose: string;
  };
  policy: {
    id: "bejewely-intent-alignment-v1";
    version: "1.0.0";
  };
  axisResults: AlignmentAxisResultV1[];
  overallVerdict: IntentAlignmentVerdict;
  promotionReviewEligible: boolean;
  promotionBlockReasons: string[];
  alignedAt: string;
  alignmentDigest: string;
};
```

`promotionReviewEligible` 조건:

- overall = `aligned`
- purpose = `capture_control | skin_cue_control | face_feature_control`
- authoritative observation
- consensus reached
- critical mismatches/unverifiable 0
- no unresolved visible external mark licensing/provenance hold
- duplicate/policy hold 없음

이 boolean은 Gold 승격이 아니다.

---

## 15. Derived grade records

Candidate manifest state는 변경하지 않는다.

```ts
type DerivedGradeRecordV1 = {
  schemaVersion: "derived-grade-record-v1";
  gradeRecordId: string;
  candidateId: string;
  grade: "G2_OBSERVED" | "G3_CONSENSUS_VALIDATED";
  sourceDigests: string[];
  policyVersion: string;
  recordedAt: string;
  gradeRecordDigest: string;
};
```

### G2

조건:

- T4 authoritative observed bundle
- integrity verified
- fixture 아님

### G3

조건:

- G2 source
- consensus reached
- consensus artifact integrity verified
- reviewable

Alignment mismatch가 있어도 G3는 가능하다. G3는 “생성 의도와 일치”가 아니라 “보이는 값에 대한 합의가 존재”함을 뜻한다.

---

## 16. Storage layout

```text
.synthetic-local/
  judgment/
    claims/<assignmentId>/<judgeId>.json
    submissions/<submissionDigest>.json
    consensus/<candidateId>/<consensusDigest>.json
  alignment/
    objects/<alignmentDigest>.json
    manifests/<candidateId>/<alignmentId>.json
  grades/
    <candidateId>/<gradeRecordDigest>.json
```

원칙:

- content-addressed object 먼저
- manifest/record 마지막 publish
- absolute path 비저장
- symlink 거부
- existing object byte conflict fail-closed
- partial claim이 있으면 hidden retry 금지

---

## 17. CLI 경계

제안 command:

```bash
npm run synthetic:judge -- \
  --assignment .synthetic-local/requests/judge-0001.json \
  --preflight

npm run synthetic:judge -- \
  --assignment .synthetic-local/requests/judge-0001.json \
  --submit .synthetic-local/requests/judgment-0001.json

npm run synthetic:consensus -- \
  --candidate cand_xxx \
  --build

npm run synthetic:align -- \
  --candidate cand_xxx \
  --consensus jcon_xxx \
  --preflight

npm run synthetic:align -- \
  --candidate cand_xxx \
  --consensus jcon_xxx \
  --confirm
```

`judge` command는 generation source를 import하지 않는다. `align` command만 verified intent resolver를 사용한다.

v1에서 금지:

- batch judgment/alignment
- browser automation
- Provider judge
- production UI
- database write
- automatic promotion

---

## 18. Privacy와 안전

- synthetic-only candidate만 허용
- canonical image read-only
- screenshot/crop/annotation image 저장 금지
- raw Provider response 저장 금지
- judge 실명/email 저장 금지
- free-text authoritative note 금지
- identity/celebrity/personality/health/beauty inference 금지
- visible external mark의 provenance를 추측하지 않음
- licensing/provenance hold가 있으면 promotion review 차단

---

## 19. 실패 코드

```text
blind_judgment_input_unavailable
fixture_judgment_forbidden
judgment_assignment_invalid
judgment_intent_leak_detected
judgment_axis_registry_unsupported
judgment_claim_exists
judgment_submission_invalid
judgment_submission_conflict
judge_identity_invalid
insufficient_independent_reviewers
judgment_consensus_unresolved
judgment_consensus_integrity_invalid
candidate_manifest_integrity_invalid
generation_spec_integrity_invalid
intent_join_mismatch
alignment_policy_unsupported
alignment_artifact_conflict
paired_identity_verification_unavailable
promotion_review_blocked
```

---

## 20. 테스트 계획

### Contract

- exact key validation, unknown/missing field fail-closed
- assignment/submission/consensus/alignment digest determinism
- pseudonymous judge ID validation
- free-text/sensitive data rejection

### Blind boundary

- judgment request에 purpose/spec/prompt/condition 포함 시 거부
- judgment source가 generation/import modules를 runtime import하지 않음
- consensus source가 generation intent를 읽지 않음

### Authority/integrity

- fixture observation assignment 거부
- tampered observation object/run 거부
- canonical SHA mismatch 거부
- tampered submission/consensus/spec/alignment 거부

### Idempotency

- identical submission returns existing artifact
- same claim without submission blocks hidden resubmit
- same consensus inputs produce same digest
- same sealed consensus/spec/policy produce same alignment ID

### Consensus

- reviewer 1명으로 G3 불가
- duplicate judge ID 제외
- exact agreement success
- disagreement requires adjudicator
- intent 없는 adjudication enforcement

### Alignment

- A/B/C/D skin fixtures의 none/mild/overshoot/uncertain cases
- feature exact match/mixed/uncertain cases
- absence target가 signal 0만으로 match되지 않음
- strength는 unverifiable로 보존
- mixed pilot promotion blocked
- paired skin target match라도 pair unverified

### State boundary

- candidate manifest byte unchanged
- observation run/object byte unchanged
- G2/G3 record append-only
- G4/G5 생성 command 없음

### Architecture

- production app → toolkit dependency 금지
- batch command 없음
- network/browser/DB/Provider import 없음

---

## 21. 완료 기준

#T5 설계 완료 조건:

- blind judgment와 intent join이 process-level로 분리됨
- T4 observation authority와 human consensus 의미가 분리됨
- absence/count/region 한계를 명시함
- feature strength 한계를 명시함
- paired identity verification을 과장하지 않음
- aggregate score 없이 gate/target/diagnostic policy가 정의됨
- immutable artifact와 idempotency가 정의됨
- G2/G3와 G4/G5 책임이 분리됨
- privacy/safety/production boundary가 유지됨
- implementation PR의 테스트 matrix가 확정됨

---

## 22. 비대상

- actual human judging 수행
- actual Provider 호출
- automatic LLM judge
- browser or production UI
- batch processing
- archetype scoring
- same-person identity verification
- recommendation/style generation
- Gold/holdout promotion
- dataset split/lock
- production route, database, auth, payment integration
