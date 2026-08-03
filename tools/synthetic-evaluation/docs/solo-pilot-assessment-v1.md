# Synthetic Evaluation Toolkit #T11

# Solo Pilot Assessment & Wave Brief Design v1

## 0. 문서 상태

- Toolkit Track: `#T11`
- 작업 유형: 상세 설계 전용
- 기준 브랜치: `main`
- 기준 SHA: `3ef41e41109d948fd1c66c63f0fee454b01f6f08`
- 구현 상태: 미구현
- 실제 Pilot 실행: 0
- 실제 이미지 생성: 0
- 실제 Provider observation: 0
- 실제 solo assessment: 0
- T5 consensus / T6 G4 / T9 G5 생성: 0
- production route/UI/DB/Auth/Payment 변경: 0

`#T11`은 Toolkit 내부 작업 식별자이며 GitHub 실제 PR 번호가 아니다.

---

## 1. 목적

#T11은 단독 운영자가 T7의 실제 A/B/C/D Pilot Wave를 진행하면서도, 다인 검수 계약을 위조하지 않고 다음을 구조화해 보존하는 경계를 정의한다.

```text
verified T7 issued wave
+ verified T3 candidate
+ authoritative T4 observation
→ target-withheld solo screening
→ immutable screening seal
→ verified intent reveal
→ intent-aware solo assessment
→ exact wave assessment set
→ descriptive solo wave brief
→ manual T7 checkpoint decision
```

핵심 구분은 다음과 같다.

```text
1인 탐색 평가
≠ T5 독립 blind judgment
≠ T5 consensus
≠ G3_CONSENSUS_VALIDATED
≠ T6 promotion review
≠ G4_SYNTHETIC_GOLD
≠ T9 G5 / locked dataset
```

#T11의 권위는 `operator_exploratory_assessment`에 한정한다.

---

## 2. 해결하려는 실제 운영 문제

현재 T7 plan은 후보당 2명의 독립 reviewer와 필요 시 intent-blind adjudicator를 요구한다. 이는 Gold 근거를 만들기 위한 올바른 계약이지만, 단독 운영자가 첫 Pilot을 실행할 때 다음 문제가 생긴다.

- 실제 이미지 품질과 cue 통제력을 혼자 점검할 수는 있으나 T5 consensus를 만들 수 없다.
- reviewer ID를 여러 개 만들어 동일인이 제출하면 독립 검수 위조가 된다.
- T5/T6를 약화하면 기존 G3/G4 authority 전체가 오염된다.
- T8는 closed 20-slot run만 authoritative report로 받으므로 Wave 1의 4장 결과를 즉시 정리할 수 없다.
- 품질 문제 때문에 같은 slot을 다시 생성하면 T7 anti-cherry-picking 계약을 위반한다.

#T11은 T5/T6를 우회하지 않는다. 별도의 탐색 평가 artifact를 만들고, 기존 T7/T8/T9 권위를 그대로 유지한다.

---

## 3. 범위

### 포함

- T7 Wave 1/2/3에 대한 단독 운영자 평가
- Wave별 exact denominator 유지: `4 / 8 / 8`
- T3/T4 source integrity 재검증
- target-withheld screening과 intent reveal 순서 봉인
- A/B/C/D skin cue relation의 deterministic derivation
- technical outcome까지 포함한 exact wave row set
- single-operator limitation이 명시된 wave brief
- T7 checkpoint approval과의 사후 digest link
- 전체 Pilot 종료 후 T8 report에 붙일 수 있는 비권위 appendix handoff

### 제외

- T5 submission, consensus, adjudication
- G2/G3/G4/G5 생성 또는 승격
- T6 rights, visual, leakage, promotion review 대체
- T8 authoritative campaign report 대체
- T9 split, holdout, dataset lock
- 자동 generation Provider 호출
- 자동 T4 Provider 호출
- 같은 slot의 품질 재생성
- production UI/API/DB 연결
- 실제 사람 identity, demographic, clinical inference

---

## 4. 기존 계약과의 관계

### 4.1 T7는 그대로 유지한다

- 20 primary slots
- A/B/C/D 각 5
- Wave `4 → 8 → 8`
- 한 run당 generation Provider profile 하나
- technical retry만 허용
- registered candidate replacement 금지
- checkpoint와 closeout authority는 T7

#T11은 T7 plan, slot, event, projection을 읽기만 한다.

### 4.2 T5는 그대로 유지한다

- 최소 2명의 독립 reviewer
- intent-free consensus
- explicit adjudication
- G3는 sealed consensus가 있을 때만 가능

#T11 artifact는 T5 submission input으로 변환하거나 재사용할 수 없다.

### 4.3 T8는 그대로 유지한다

T8 authoritative report는 closed 20-slot run을 요구한다. #T11 wave brief는 active run에서도 만들 수 있으나 다음 label을 강제한다.

```text
reportAuthority = "t11_solo_exploratory"
authoritativeCampaignReport = false
singleOperator = true
```

전체 run 종료 후 T8 report가 생성되면 #T11은 별도 appendix가 T8 report digest를 참조하도록 할 수 있다. T8 metric이나 terminal outcome은 변경하지 않는다.

---

## 5. 설계 전 리뷰 결과

### R-01. reviewer ID를 두 개 만들면 안 된다

동일한 사람이 `reviewer_a`, `reviewer_b`로 제출해도 독립성이 생기지 않는다.

조치:

- #T11 session은 정확히 한 `operatorId`만 가진다.
- `actorCount = 1`을 schema와 verifier에서 강제한다.
- T5 registrar, consensus builder, grade deriver를 import하지 않는다.

### R-02. target을 처음부터 보여주면 확인 편향이 커진다

운영자가 직접 생성했기 때문에 완전한 blind는 불가능하다. 그러나 software surface에서 target을 먼저 보여주지 않는 것은 여전히 유용하다.

조치:

- 첫 단계 명칭은 `blind`가 아니라 `target_withheld`다.
- screening projection에서 condition, fixture, spec, prompt, intended cue, slot ID를 제거한다.
- operator가 target을 기억할 수 있음을 `priorTargetKnowledgePossible = true`로 명시한다.
- screening이 immutable하게 저장된 뒤에만 intent reveal을 허용한다.

### R-03. solo assessment가 T4 observation을 덮어쓰면 안 된다

조치:

- T4 value는 source reference로만 유지한다.
- solo screening은 별도 observed value와 `supports | disputes | uncertain` 관계를 기록한다.
- T4 artifact와 candidate manifest는 수정하지 않는다.

### R-04. 성공한 이미지에만 assessment를 만들면 denominator가 바뀐다

조치:

- issued wave의 모든 slot은 정확히 한 row를 가진다.
- no asset, import failure, observation failure, valid-ineligible도 row로 보존한다.
- assessable image가 없는 row는 human assessment를 위조하지 않고 `technical_or_unavailable`로 기록한다.

### R-05. 품질 불량을 같은 slot retry로 연결하면 cherry-picking이다

조치:

- solo assessment에는 `sameSlotQualityRegenerationAllowed = false`를 고정한다.
- 품질 문제는 `continue`, `pause_and_replan`, `stop` 중 다음 wave 결정에만 사용한다.
- 정책 또는 prompt 변경이 필요하면 현재 run을 유지한 채 slot을 교체하지 않고 새 plan/run으로 시작한다.

### R-06. Wave brief가 T7 checkpoint를 자동 승인하면 안 된다

조치:

- #T11은 recommendation과 근거만 만든다.
- T7 checkpoint approval은 별도 명령과 별도 artifact로 제출한다.
- 이후 `SoloCheckpointLinkV1`이 두 digest와 decision 일치만 검증한다.

### R-07. 기존 T7의 observation failure terminal은 checkpoint를 막을 수 있다

현재 projection은 `observation_failed` terminal을 허용하지만 checkpoint-ready technical terminal set에는 포함하지 않는다. 따라서 recovery budget을 소진해 terminal 처리한 slot이 있으면 wave가 영구적으로 checkpoint-ready가 되지 않을 수 있다.

조치:

- 구현 단계에서 `observation_failed`를 technical checkpoint terminal로 포함한다.
- authoritative observation object가 없는 실패만 해당한다.
- 회귀 테스트로 Wave 1의 3 observed + 1 exhausted observation failure가 checkpoint-ready인지 검증한다.

### R-08. screening을 intent reveal 뒤에 수정하면 target-withheld claim이 깨진다

조치:

- reveal 전에는 predecessor-linked correction을 허용한다.
- reveal 뒤 screening replacement는 금지한다.
- reveal 후 오류 발견은 별도 `post_reveal_annotation`으로만 기록하며 primary screening을 바꾸지 않는다.

---

## 6. 절대 불변식

### S-01. 정확히 한 operator

한 session은 하나의 pseudonymous local operator ID만 가진다.

### S-02. fake independence 금지

#T11 artifact를 T5 reviewer submission, consensus, adjudication, G3/G4/G5 근거로 사용할 수 없다.

### S-03. target-withheld before reveal

screening seal이 없으면 intent reveal을 생성하지 않는다.

### S-04. exact wave denominator

Wave 1은 4 rows, Wave 2와 3은 각각 8 rows다. 성공 row만 필터링한 summary는 primary brief를 대체할 수 없다.

### S-05. source integrity before assessment

T7/T3/T4 reference가 검증되지 않으면 assessable row를 만들지 않는다.

### S-06. no upstream mutation

T2–T10 artifact를 수정하지 않는다.

### S-07. no quality retry

유효 candidate의 품질, cue mismatch, usability 문제로 같은 slot을 재생성하지 않는다.

### S-08. no aggregate score

quality score, provider score, pass percentage composite를 만들지 않는다.

### S-09. descriptive only

count, fraction, direct structured relation, explicit limitation만 표현한다.

### S-10. local-only

이미지, assessment, brief는 `.synthetic-local/` 아래에만 존재한다. 외부 upload와 production import는 없다.

---

## 7. 실행 흐름

```text
1. T7 wave issued
2. slot source preflight
3. target-withheld review package 생성
4. operator screening claim
5. structured screening submit / seal
6. verified T2 intent reveal
7. target relation deterministic derivation
8. operator usability / next-wave assessment
9. exact wave assessment set build
10. solo wave brief confirm
11. operator submits T7 checkpoint separately
12. checkpoint link verifies run / wave / decision match
```

기술 실패 slot은 3–8을 생략하고 verified T7 technical row로 직접 들어간다.

---

## 8. Source readiness

### 8.1 Session readiness

필수 조건:

- T7 plan/run/slots/event ledger/projection integrity valid
- requested wave가 실제 issued 상태
- wave slot 수가 exact `4 | 8 | 8`
- 모든 slot이 issued packet 또는 terminal source를 가짐
- candidate가 있는 slot은 T3 manifest와 canonical SHA valid
- observation이 있는 slot은 T4 run/object integrity valid
- target-withheld projection에 T2 intent field가 없음

실패 코드:

```text
solo_source_not_ready
solo_wave_not_issued
solo_wave_slot_count_invalid
solo_t7_projection_invalid
solo_candidate_source_invalid
solo_observation_source_invalid
solo_target_withholding_invalid
```

### 8.2 Slot readiness class

```ts
type SoloSlotReadiness =
  | "assessable_observed"
  | "assessable_valid_ineligible"
  | "technical_no_asset"
  | "technical_import_failure"
  | "technical_observation_failure"
  | "cancelled"
  | "not_ready";
```

`not_ready`가 하나라도 있으면 wave brief를 confirm할 수 없다.

---

## 9. Contract 설계

### 9.1 SoloAssessmentPolicyV1

```ts
type SoloAssessmentPolicyV1 = {
  schemaVersion: "solo-assessment-policy-v1";
  policyId: "bejewely-solo-pilot-assessment-v1";
  policyVersion: "1.0.0";
  authority: "operator_exploratory_assessment";
  requiredOperatorCount: 1;
  targetWithheldScreeningRequired: true;
  intentRevealAfterScreeningOnly: true;
  sameSlotQualityRegenerationAllowed: false;
  t5ReuseAllowed: false;
  promotionAllowed: false;
  datasetLockAllowed: false;
  policyDigest: string;
};
```

### 9.2 SoloWaveSessionV1

```ts
type SoloWaveSessionV1 = {
  schemaVersion: "solo-wave-session-v1";
  sessionId: string;
  campaignRunId: string;
  campaignPlanDigest: string;
  sourceProjectionDigest: string;
  waveOrdinal: 1 | 2 | 3;
  expectedSlotCount: 4 | 8;
  operatorId: string;
  actorCount: 1;
  policyDigest: string;
  privateReviewMapDigest: string;
  createdAt: string;
  sessionDigest: string;
};
```

Session identity에는 run, wave, projection, operator, policy, private review map이 포함된다. `createdAt`은 제외한다.

### 9.3 TargetWithheldReviewItemV1

operator에게 제공되는 projection이다.

```ts
type TargetWithheldReviewItemV1 = {
  schemaVersion: "target-withheld-review-item-v1";
  reviewItemId: string;
  canonicalAsset: {
    sha256: string;
    objectRelativePath: string;
  } | null;
  readiness: SoloSlotReadiness;
  priorTargetKnowledgePossible: true;
  excludedFields: [
    "slotId",
    "conditionId",
    "fixtureId",
    "generationSpec",
    "compiledPrompt",
    "intendedSkinCue",
    "providerGenerationMetadata"
  ];
  itemDigest: string;
};
```

`reviewItemId`와 실제 slot의 mapping은 별도 private map에 저장되며 brief/export에 노출하지 않는다.

### 9.4 SoloScreeningClaimV1

```ts
type SoloScreeningClaimV1 = {
  schemaVersion: "solo-screening-claim-v1";
  sessionDigest: string;
  reviewItemId: string;
  operatorId: string;
  itemDigest: string;
  claimState: "claimed";
  claimedAt: string;
  claimDigest: string;
};
```

동일 session/item/operator 조합은 한 claim만 허용한다.

### 9.5 SoloTargetWithheldScreeningV1

```ts
type SoloTargetWithheldScreeningV1 = {
  schemaVersion: "solo-target-withheld-screening-v1";
  sessionDigest: string;
  reviewItemId: string;
  operatorId: string;
  claimDigest: string;
  reviewability: {
    face: "reviewable" | "unreviewable" | "uncertain";
    skin: "reviewable" | "unreviewable" | "uncertain";
  };
  capture: {
    singleAdultSyntheticPerson: "confirmed" | "rejected" | "uncertain";
    directFrontalLevelPose: "confirmed" | "rejected" | "uncertain";
    cameraGazeNeutralExpression: "confirmed" | "rejected" | "uncertain";
    headShouldersFraming: "confirmed" | "rejected" | "uncertain";
    plainBackground: "confirmed" | "rejected" | "uncertain";
    softEvenLighting: "confirmed" | "rejected" | "uncertain";
    sharpFace: "confirmed" | "rejected" | "uncertain";
    hairMakeupAccessoriesControlled: "confirmed" | "rejected" | "uncertain";
  };
  skinObservation: {
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
  artifactFlags: {
    distortedAnatomy: "absent" | "present" | "uncertain";
    duplicatedOrMissingFeature: "absent" | "present" | "uncertain";
    visibleTextOrExternalMark: "absent" | "present" | "uncertain";
    filterOrRetouchPossible: "absent" | "present" | "uncertain";
  };
  reasonCodes: string[];
  priorTargetKnowledgeAcknowledged: true;
  submittedAt: string;
  screeningDigest: string;
};
```

자유서술은 v1 authoritative artifact에 포함하지 않는다.

### 9.6 SoloIntentRevealReceiptV1

screening이 저장·검증된 뒤 verified T2/T3 source에서 생성한다.

```ts
type SoloIntentRevealReceiptV1 = {
  schemaVersion: "solo-intent-reveal-receipt-v1";
  sessionDigest: string;
  reviewItemId: string;
  screeningDigest: string;
  slotId: string;
  conditionId: "A" | "B" | "C" | "D";
  fixtureId: string;
  finalizedSpecDigest: string;
  compiledPromptDigest: string;
  intendedSkinCue: {
    redness: "none" | "mild";
    blemishes: "none" | "mild";
    blemishCountBand: "none" | "three_to_five";
  };
  revealedAt: string;
  revealDigest: string;
};
```

caller가 intended cue를 직접 입력할 수 없다.

### 9.7 SoloIntentAssessmentV1

```ts
type SoloIntentAssessmentV1 = {
  schemaVersion: "solo-intent-assessment-v1";
  sessionDigest: string;
  reviewItemId: string;
  operatorId: string;
  screeningDigest: string;
  revealDigest: string;
  derivedTargetRelation: {
    redness: "exact_match" | "under_target" | "over_target" | "contradictory" | "unverifiable";
    blemishPresence: "exact_match" | "under_target" | "over_target" | "contradictory" | "unverifiable";
    blemishCount: "exact_match" | "under_target" | "over_target" | "contradictory" | "unverifiable";
  };
  faceLabInputUsability: "usable" | "usable_with_caution" | "unusable" | "not_assessable";
  operationalDisposition:
    | "retain_exploratory"
    | "retain_negative_or_edge_case"
    | "pause_and_replan_next_run"
    | "stop_for_integrity_or_safety";
  nextWaveRecommendation: "continue" | "pause" | "stop";
  sameSlotQualityRegenerationAllowed: false;
  reasonCodes: string[];
  submittedAt: string;
  intentAssessmentDigest: string;
};
```

`derivedTargetRelation`은 screening value와 verified intended cue로 계산하며 caller override를 허용하지 않는다.

### 9.8 SoloWaveAssessmentRowV1

```ts
type SoloWaveAssessmentRowV1 = {
  schemaVersion: "solo-wave-assessment-row-v1";
  campaignRunId: string;
  waveOrdinal: 1 | 2 | 3;
  slotId: string;
  conditionId: "A" | "B" | "C" | "D";
  readiness: SoloSlotReadiness;
  candidateId: string | null;
  canonicalSha256: string | null;
  observationDigest: string | null;
  screeningDigest: string | null;
  revealDigest: string | null;
  intentAssessmentDigest: string | null;
  authoritativeT5Status: "not_started" | "incomplete" | "present_but_not_used";
  soloAuthority: "operator_exploratory_assessment" | "technical_source_only";
  rowDigest: string;
};
```

### 9.9 SoloWaveAssessmentSetV1

```ts
type SoloWaveAssessmentSetV1 = {
  schemaVersion: "solo-wave-assessment-set-v1";
  sessionDigest: string;
  campaignRunId: string;
  waveOrdinal: 1 | 2 | 3;
  expectedSlotCount: 4 | 8;
  rows: SoloWaveAssessmentRowV1[];
  conditionCounts: { A: number; B: number; C: number; D: number };
  exactDenominatorVerified: true;
  assessmentSetDigest: string;
};
```

Wave 1 condition count는 `1/1/1/1`, Wave 2와 3은 `2/2/2/2`여야 한다.

### 9.10 SoloWaveBriefV1

```ts
type SoloWaveBriefV1 = {
  schemaVersion: "solo-wave-brief-v1";
  authority: "t11_solo_exploratory";
  authoritativeCampaignReport: false;
  singleOperator: true;
  sessionDigest: string;
  assessmentSetDigest: string;
  sourceProjectionDigest: string;
  summaries: {
    readinessCounts: Record<SoloSlotReadiness, number>;
    reviewabilityCounts: object;
    usabilityCounts: object;
    targetRelationCounts: object;
    artifactFlagCounts: object;
    technicalOutcomeCounts: object;
  };
  operatorDecision: {
    decision: "continue" | "pause" | "stop";
    reasonCodes: string[];
    confirmedSingleOperatorLimitation: true;
    confirmedNoT5ConsensusClaim: true;
    confirmedNoG3G4G5Claim: true;
    confirmedNoSameSlotQualityRetry: true;
    decidedBy: string;
  };
  limitations: [
    "single_operator",
    "prior_target_knowledge_possible",
    "not_independent_consensus",
    "not_gold_evidence",
    "not_population_evidence"
  ];
  briefDigest: string;
};
```

### 9.11 SoloCheckpointLinkV1

```ts
type SoloCheckpointLinkV1 = {
  schemaVersion: "solo-checkpoint-link-v1";
  campaignRunId: string;
  waveOrdinal: 1 | 2;
  soloWaveBriefDigest: string;
  t7CheckpointApprovalDigest: string;
  soloDecision: "continue" | "pause" | "stop";
  t7Decision: "continue" | "pause" | "stop";
  decisionMatch: true;
  linkedAt: string;
  linkDigest: string;
};
```

이 artifact는 T7 checkpoint를 생성하거나 수정하지 않는다.

---

## 10. Target relation derivation

### 10.1 Redness

- target `none`, observed `none` → `exact_match`
- target `none`, observed `mild|moderate_or_higher` → `over_target`
- target `mild`, observed `none` → `under_target`
- target `mild`, observed `mild` → `exact_match`
- target `mild`, observed `moderate_or_higher` → `over_target`
- observed `uncertain` → `unverifiable`

### 10.2 Blemish presence

동일 규칙을 적용한다.

### 10.3 Blemish count

- target `none`, observed `none` → `exact_match`
- target `none`, observed positive band → `over_target`
- target `three_to_five`, observed `none|one_to_two` → `under_target`
- target `three_to_five`, observed `three_to_five` → `exact_match`
- target `three_to_five`, observed `six_plus` → `over_target`
- observed `uncertain` → `unverifiable`

`contradictory`는 source contract 상 mutually exclusive 값 충돌 또는 invalid semantic combination이 검출될 때만 사용한다.

---

## 11. Wave decision 규칙

#T11은 자동 승인하지 않는다. 다만 invalid decision을 막는다.

### continue 허용 조건

- exact wave denominator valid
- 모든 row가 terminal/assessable classification을 가짐
- source integrity error 0
- `stop_for_integrity_or_safety` disposition 0
- single-operator limitation 확인
- no T5/G3/G4/G5 claim 확인
- same-slot quality retry 금지 확인
- T7 source freeze를 다음 wave에서도 그대로 유지할 의사 확인

### pause

다음 상황에서 사용할 수 있다.

- 같은 capture issue가 여러 slot에서 반복
- target relation이 여러 조건에서 `under_target` 또는 `over_target`
- artifact flag가 반복
- Provider output policy 또는 rights scope 재검토 필요
- observation failure recovery 정책 검토 필요

pause는 현재 slot을 교체하지 않는다.

### stop

- real-person reference 또는 synthetic-only boundary 문제
- source integrity invalid
- systematic external mark 또는 안전 경계 문제
- registered candidate replacement 시도
- campaign source freeze drift

---

## 12. T7 terminal 전략

Solo assessment는 T7 terminal outcome이 아니다.

### assessable observed slot

단독 운영 Pilot을 authoritative T5 없이 종료하려면 operator가 별도 T7 명령으로 다음을 선택할 수 있다.

```text
T7 terminal outcome = judgment_incomplete
T11 solo assessment = present
```

이는 "아무 평가도 없음"이 아니라 "T5 독립 consensus가 없음"을 뜻한다.

### valid-ineligible

```text
T7 terminal outcome = observation_valid_ineligible
T11 solo assessment = optional exploratory annotation
```

### technical failures

기존 technical terminal을 유지하고 #T11 row는 `technical_source_only`로 기록한다.

#T11은 terminal event를 자동으로 append하지 않는다.

---

## 13. T8 / T9 handoff

### T8

전체 20-slot run을 close한 뒤 T8 report는 기존 terminal outcome을 그대로 표시한다. #T11은 선택적으로 다음 appendix handoff를 만든다.

```ts
type SoloCampaignAppendixHandoffV1 = {
  schemaVersion: "solo-campaign-appendix-handoff-v1";
  t8ReportDigest: string;
  waveBriefDigests: [string, string, string];
  campaignRunId: string;
  authority: "t11_solo_exploratory";
  modifiesT8Metrics: false;
  appendixDigest: string;
};
```

### T9

#T11 artifact는 source universe, leakage graph, split, G5 eligibility에 참여하지 않는다. T9는 current T6 G4만 사용한다.

---

## 14. Storage layout

```text
.synthetic-local/
  solo-assessment/
    policies/
    sessions/
    private-review-maps/
    claims/
    screenings/
    reveals/
    intent-assessments/
    rows/
    wave-sets/
    wave-briefs/
    checkpoint-links/
    manifests/
```

규칙:

- content-addressed object
- manifest-last publication
- absolute path 저장 금지
- symbolic link traversal 금지
- canonical image 복제 금지
- raw Provider response, account, session, token, URL 저장 금지
- screening과 reveal 이후 artifact overwrite 금지
- 동일 predecessor에 successor 하나만 허용

---

## 15. CLI 설계

예정 script:

```text
npm run synthetic:solo
```

예정 명령:

```bash
npm run synthetic:solo -- \
  --campaign-run <campaignRunId> \
  --wave 1 \
  --operator solo_operator \
  --prepare

npm run synthetic:solo -- \
  --session <sessionId> \
  --item <reviewItemId> \
  --screen screening.json \
  --submit

npm run synthetic:solo -- \
  --session <sessionId> \
  --item <reviewItemId> \
  --reveal-intent

npm run synthetic:solo -- \
  --session <sessionId> \
  --item <reviewItemId> \
  --assessment intent-assessment.json \
  --submit-intent

npm run synthetic:solo -- \
  --session <sessionId> \
  --decision continue \
  --build-wave-brief

npm run synthetic:solo -- \
  --wave-brief <briefDigest> \
  --checkpoint <t7CheckpointApprovalDigest> \
  --link-checkpoint
```

모든 request path는 `.synthetic-local/requests/` 아래 relative path만 허용한다.

---

## 16. 구현 구조

### Shared contracts

```text
packages/face-contracts/src/synthetic-solo-assessment/
  constants.js
  policy-contract.js
  screening-contract.js
  intent-contract.js
  wave-contract.js
  index.js
```

### Toolkit runtime

```text
tools/synthetic-evaluation/src/solo/
  source-preflight.js
  session.js
  screening.js
  reveal.js
  relation.js
  assessment.js
  derive.js
  wave-brief.js
  checkpoint-link.js
  storage.js
  cli/solo.js
```

### Existing T7 correction

```text
tools/synthetic-evaluation/src/campaign/projection.js
```

`observation_failed` terminal의 checkpoint readiness만 수정한다. 그 외 T7 authority는 변경하지 않는다.

---

## 17. 테스트 계획

### Contract tests

- unknown/missing field 거부
- actorCount 정확히 1
- T5 reuse/promotion flags 항상 false
- free-text field 거부
- target relation caller override 거부

### Withholding tests

- screening projection에서 slot/condition/spec/prompt/target 제거
- private map 없이는 reviewItem → slot reverse lookup 불가
- screening seal 전 intent reveal 거부
- reveal 후 screening replacement 거부

### Source tests

- T7 plan/run/slot/event/projection tamper 거부
- T3 candidate/canonical SHA tamper 거부
- T4 run/object tamper 거부
- technical row exact classification

### Denominator tests

- Wave 1 exact 4 and A/B/C/D 1 each
- Wave 2/3 exact 8 and A/B/C/D 2 each
- assessable row만 필터링한 brief 거부
- duplicate/missing slot row 거부

### Authority tests

- T11 artifact를 T5 submission으로 전달할 수 없음
- G2/G3/G4/G5 derivation export 없음
- T7 checkpoint 자동 write 없음
- T8 metric mutation 없음

### T7 regression

- exhausted `observation_failed` terminal이 checkpoint-ready
- recovery가 남은 non-terminal observation failure는 checkpoint-ready 아님
- authoritative observation이 있는 slot은 기존대로 checkpoint-ready

### Storage tests

- idempotent semantic retry
- manifest-last
- symlink/traversal rejection
- predecessor branch rejection
- reveal 후 screening overwrite rejection

### Integration tests

- Wave 1: 4 assessable rows
- Wave 1: 3 observed + 1 valid-ineligible
- Wave 1: 3 observed + 1 exhausted observation failure
- Wave brief → 별도 T7 checkpoint → matching link
- decision mismatch link 거부

---

## 18. 실제 첫 실행 계획

### Provider

```text
generation profile = gemini-image-manual-v1
```

### Wave 1

| condition | slots | 목적 |
|---|---:|---|
| A | 1 | clean control |
| B | 1 | redness only |
| C | 1 | blemishes only |
| D | 1 | combined |

### 실행 순서

```text
T7 plan/run compile
→ Wave 1 issue
→ Gemini에서 4장 수동 생성
→ T7 handoff
→ T3 import
→ T4 authoritative observation 최대 4 primary calls
→ T11 screening/intent assessment 4건
→ T11 wave brief
→ 사용자 T7 checkpoint continue/pause/stop
```

Provider 호출과 비용은 #T11 구현에 포함되지 않는다. 실제 T4 execution은 named key env와 별도 명시적 명령을 요구한다.

---

## 19. 완료 기준

설계 승인 후 구현 PR은 다음을 모두 만족해야 한다.

- T5/T6/T8/T9 authority 변경 없음
- fake reviewer 경로 없음
- exact 4/8/8 denominator
- target-withheld → reveal 순서 강제
- technical slot 보존
- no quality retry
- T7 checkpoint 자동 승인 없음
- `observation_failed` checkpoint regression 수정
- Node 20/24 synthetic tests·verify 통과
- architecture guard 통과
- production build 통과
- actual Provider call 0
- actual Pilot write 0
- production change 0

---

## 20. 구현 순서

```text
T11-1 contracts / reason registry
→ T11-2 T7/T3/T4 source preflight
→ T11-3 session / private review map
→ T11-4 target-withheld screening claim / storage
→ T11-5 verified intent reveal
→ T11-6 relation derivation / intent assessment
→ T11-7 exact wave set / brief
→ T11-8 checkpoint link
→ T11-9 T7 observation_failed readiness correction
→ T11-10 CLI
→ T11-11 tamper / denominator / authority / storage tests
→ T11-12 Node 20/24 full verification
```

구현은 별도 branch와 Draft PR에서 수행하며 이 설계 PR은 병합하지 않는다.
