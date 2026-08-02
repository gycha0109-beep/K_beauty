# Synthetic Evaluation Toolkit #T7

# Pilot Campaign Runner Design v1

## 0. 문서 상태

- Toolkit Track: `#T7`
- 작업 유형: 설계 전용
- 기준 브랜치: `feature/T6-promotion-policy`
- 기준 SHA: `0d8bca1d31616deb485c32c627cb99cf5b3ef337`
- 구현 상태: 미구현
- 실제 campaign 실행: 0
- 실제 이미지 생성: 0
- 실제 Provider observation: 0
- 실제 human judgment / promotion review: 0
- 실제 G4 생성: 0
- G5 / dataset split / holdout lock: 제외
- production route/UI/DB/Auth/Payment/Storage 변경: 0

`#T7`는 Toolkit 내부 작업 식별자이며 GitHub 실제 PR 번호가 아니다.

---

## 1. 목적

#T7는 T2부터 T6까지의 단일 후보용 계약과 CLI를 **고정된 소규모 pilot campaign**으로 반복 실행하기 위한 orchestration 경계를 정의한다.

```text
Campaign Plan
→ fixed condition matrix
→ generation work packet
→ manual generation handoff
→ T3 candidate import
→ T4 authoritative observation
→ T5 blind judgment / consensus / alignment
→ T6 promotion review / decision
→ append-only campaign slot outcome
→ machine-readable closeout package
```

#T7가 새로 판단하는 것은 없다.

```text
campaign runner status
≠ image observation
≠ human consensus
≠ intent alignment
≠ G4 approval
≠ dataset split
≠ pilot success report
```

권위는 그대로 유지한다.

- 생성 의도: T2
- candidate provenance와 canonical asset: T3
- observed image facts: T4
- blind human consensus, alignment, G2/G3: T5
- purpose-scoped G4와 non-Gold disposition: T6
- campaign orchestration, 예산, checkpoint, resume 상태: T7
- review/export/report와 해석: T8
- leakage-aware split, G5 lock, regression integration: T9

---

## 2. 설계 대상 pilot

### 2.1 첫 pilot의 질문

첫 T7 pilot은 다음 질문을 검증하기 위한 운영 실험이다.

> 현재 T2–T6 파이프라인이 A/B/C/D skin-control 조건을 소규모로 끝까지 처리하면서, 조건별 실패·보류·승격 근거를 누락 없이 보존할 수 있는가?

이 질문은 다음을 묻지 않는다.

- 어떤 Provider가 절대적으로 더 좋은가
- 20장이 인구 대표성을 갖는가
- G4 승격률이 특정 제품 품질을 증명하는가
- skin cue가 실제 질환 또는 건강 상태를 의미하는가
- 이 pilot이 train/validation/test split으로 사용 가능한가

### 2.2 고정 condition matrix

T2의 `SKIN_CONTROL_FIXTURES`를 그대로 사용한다.

| condition | fixture | intended skin cue | primary slots |
|---|---|---|---:|
| A | `A_clean` | redness none, blemishes none | 5 |
| B | `B_redness_only` | mild diffuse redness, blemishes none | 5 |
| C | `C_blemishes_only` | redness none, mild discrete blemishes | 5 |
| D | `D_combined` | mild diffuse redness + mild discrete blemishes | 5 |

총 primary slot은 정확히 20개다.

### 2.3 Provider profile 정책

한 campaign run은 정확히 하나의 T2 generation provider profile만 사용한다.

허용 후보:

- `gemini-image-manual-v1`
- `gpt-image-manual-v1`

`sdxl-comfyui-reference-v1`는 `reference_only`이므로 첫 authoritative pilot의 primary provider로 사용할 수 없다.

T7 설계는 Gemini와 GPT 중 하나를 자동 선택하지 않는다. 실제 campaign plan 생성 시 하나를 명시적으로 선택해야 하며, Provider가 달라지면 같은 run 안에서 섞지 않고 별도 campaign run으로 만든다.

Provider 비교가 필요하면:

```text
same matrix
+ same frozen T2 fixture digests
+ separate campaignRunId
+ separate provider profile
+ shared comparisonGroupId
```

으로 실행한다.

---

## 3. 설계 전 리뷰 결과

### R-01. batch wrapper가 새로운 판단 권위가 되면 안 된다

위험:

- runner가 T4 observation을 요약하면서 값을 바꿈
- runner가 T5 disagreement를 자체 해결
- runner가 승격률을 보고 T6 outcome을 수정

조치:

- T7 artifact는 기존 T2–T6 object digest와 상태만 참조
- observed value, consensus value, alignment verdict, promotion outcome을 복제하거나 수정하지 않음
- 현재 상태는 append-only event projection으로만 계산

### R-02. 20개 G4를 채울 때까지 재생성하면 cherry-picking이 된다

위험:

```text
미정렬/불량 후보 폐기
→ Gold가 나올 때까지 같은 slot 재생성
→ 실제 yield와 실패 분포가 사라짐
```

조치:

- 20은 G4 목표가 아니라 **primary generation slot 수**
- T3에 candidate가 등록된 순간 slot은 해당 candidate에 영구 결합
- 품질 불량, ineligible, misaligned, held, rejected를 이유로 slot을 교체하지 않음
- 기술적 생성 실패 또는 T3 등록 전 파일 손상에만 제한된 retry 허용

### R-03. 20장을 한 번에 생성하면 동일 실패를 대량 복제할 수 있다

조치:

```text
Wave 1: 4 slots  = A/B/C/D 각 1
Wave 2: 8 slots  = A/B/C/D 각 2
Wave 3: 8 slots  = A/B/C/D 각 2
```

각 wave 사이에 명시적 checkpoint approval이 필요하다. runner는 다음 wave를 자동 발행하지 않는다.

### R-04. manual generation을 자동 실행한 것처럼 기록하면 안 된다

T2의 active pilot provider profiles는 `manual_web`이다.

조치:

- T7 v1은 이미지 generation Provider를 호출하지 않음
- compiled prompt와 work packet만 발행
- operator가 로컬 파일과 generation handoff attestation을 제출
- account ID, session token, browser storage, raw Provider response를 저장하지 않음

### R-05. valid but poor candidate를 technical failure로 분류하면 안 된다

조치:

- image file이 정상이고 T3 import가 성립하면 candidate outcome으로 보존
- visual quality, cue mismatch, ineligibility는 T4–T6 결과
- technical retry는 no-output, unreadable file, unsupported/animated format, truncated transfer처럼 candidate 등록 전 실패로 한정

### R-06. campaign 중간에 prompt/template/policy를 고치면 조건 비교가 깨진다

조치:

- plan은 T2–T6 policy/version/digest set을 동결
- drift 감지 시 run을 pause 또는 close
- 수정된 prompt/template/policy는 새 campaign plan version과 새 run으로 시작
- 기존 run의 slot을 새 정책으로 재해석하지 않음

### R-07. campaign summary가 T8 report 역할을 침범하면 안 된다

조치:

- T7는 exact denominator와 machine-readable count만 제공
- 성공/실패 원인 해석, Provider 비교, 시각 보고서, CSV export는 T8
- T7에는 aggregate score 또는 자동 go/no-go 결론 없음

### R-08. T7가 split을 배정하면 T9 leakage 경계가 무너진다

조치:

- T6 split coupling keys는 보존만 함
- T7 closeout은 active G4 reference와 coupling digest를 전달
- train/development/validation/test/holdout 필드 금지

---

## 4. 절대 불변식

### C-01. Campaign plan은 immutable이다

plan digest가 생성된 뒤 matrix, provider, budgets, wave, stop policy, source version을 수정하지 않는다.

### C-02. 한 run은 한 generation provider profile만 사용한다

run 내부 provider mixing을 금지한다.

### C-03. Generation intent는 observed label이 아니다

T2 spec과 prompt는 work packet에 포함되지만 T4/T5 blind boundary를 넘지 않는다.

### C-04. Registered candidate는 교체하지 않는다

T3 manifest가 발행된 slot은 같은 slot에서 다른 image/candidate로 대체할 수 없다.

### C-05. 유효한 negative/held/rejected outcome을 삭제하지 않는다

campaign yield를 높이기 위해 non-Gold 결과를 숨기거나 재분류하지 않는다.

### C-06. Runner는 인간 역할을 대행하지 않는다

- T5 reviewer submission 자동 생성 금지
- adjudicator decision 자동 생성 금지
- rights review 자동 승인 금지
- visual/leakage review 자동 승인 금지
- T6 promotion review 자동 승인 금지

### C-07. Provider 실행은 명시적이다

- generation Provider 실행: T7 v1에서 없음
- T4 observation Provider 실행: 기존 T4 CLI를 통해서만 가능
- named key env와 명시적 command authorization 필요
- 자동 credential discovery 금지

### C-08. Stage artifact는 content-addressed reference로만 연결한다

runner가 T2–T6 artifact를 복사·수정·재서명하지 않는다.

### C-09. 총점으로 gate를 상쇄하지 않는다

campaign-level aggregate score를 만들지 않는다.

### C-10. T7는 G5와 split을 만들지 않는다

### C-11. Production은 Toolkit에 의존하지 않는다

### C-12. 동일 semantic retry는 새 outcome을 만들지 않는다

같은 plan, slot, attempt, handoff, source digest에 대한 재실행은 기존 valid object를 반환한다.

---

## 5. Campaign plan contract

```ts
type PilotCampaignPlanV1 = {
  schemaVersion: "pilot-campaign-plan-v1";
  campaignId: string;
  campaignVersion: string;
  comparisonGroupId: string | null;
  objective: {
    questionId: "skin-control-abcd-e2e-v1";
    purpose: "skin_cue_control";
    primarySlotCount: 20;
    interpretationOwner: "t8";
  };
  sourceFreeze: {
    generationSpecSchemaVersion: "generation-spec-v1";
    fixtureSetId: "skin-control-abcd-v1";
    fixtureDigests: {
      A: string;
      B: string;
      C: string;
      D: string;
    };
    promptCompilerVersion: string;
    providerProfileId: "gemini-image-manual-v1" | "gpt-image-manual-v1";
    providerProfileVersion: "1.0.0";
    t3ImportPolicyVersion: string;
    t4ObservationPolicyVersion: string;
    t5JudgmentPolicyVersion: string;
    t6PromotionPolicyId: "bejewely-promotion-policy-v1";
    t6PromotionPolicyVersion: "1.0.0";
  };
  matrix: Array<{
    conditionId: "A" | "B" | "C" | "D";
    fixtureId:
      | "A_clean"
      | "B_redness_only"
      | "C_blemishes_only"
      | "D_combined";
    primarySlots: 5;
    waveAllocation: [1, 2, 2];
  }>;
  budgets: PilotCampaignBudgetV1;
  retryPolicy: PilotRetryPolicyV1;
  checkpointPolicy: PilotCheckpointPolicyV1;
  stopPolicy: PilotStopPolicyV1;
  outputPolicy: {
    retainAllRegisteredCandidates: true;
    retainAllTerminalOutcomes: true;
    reportAuthority: "t8";
    splitAuthority: "t9";
  };
  authoredBy: string;
  authoredAt: string;
  planDigest: string;
};
```

### Plan identity

identity에 포함:

- campaign ID/version
- objective
- source freeze
- matrix
- budgets
- retry/checkpoint/stop/output policy

identity에서 제외:

- authoredAt
- execution timestamps
- mutable progress

---

## 6. Budget contract

```ts
type PilotCampaignBudgetV1 = {
  primaryGenerationSlots: 20;
  technicalGenerationRetryReserve: 10;
  maxGenerationAttemptsTotal: 30;
  maxGenerationAttemptsPerSlot: 2;
  maxAuthoritativeObservationRuns: 20;
  maxObservationRecoveryRuns: 10;
  maxObservationRunsTotal: 30;
  requiredPrimaryReviewersPerCandidate: 2;
  maxAdjudicationsPerCandidate: 1;
  maxPromotionReviewsPerEligibleCandidate: 1;
};
```

규칙:

- retry reserve는 Gold yield를 채우기 위한 예산이 아님
- unused reserve를 새 primary slot으로 전환하지 않음
- valid T4 observed/ineligible outcome에는 observation recovery를 사용하지 않음
- Provider/contract transport failure에만 새 replicate ordinal을 사용할 수 있음
- budget 초과 요청은 fail-closed

---

## 7. Retry policy

```ts
type PilotRetryPolicyV1 = {
  generationRetryAllowedReasons: [
    "provider_no_output",
    "provider_refusal_without_asset",
    "local_transfer_incomplete",
    "asset_unreadable",
    "asset_format_unsupported_before_registration"
  ];
  generationRetryForbiddenReasons: [
    "capture_quality_low",
    "observation_ineligible",
    "cue_mismatch",
    "judgment_disagreement",
    "alignment_misaligned",
    "promotion_held",
    "promotion_rejected"
  ];
  registeredCandidateReplacement: "forbidden";
  observationRecoveryAllowedReasons: [
    "provider_transport_failure",
    "provider_contract_parse_failure",
    "execution_claim_failed_before_observation_publication"
  ];
  observationRecoveryForbiddenOutcomes: [
    "observed_bundle",
    "valid_ineligible_observation"
  ];
};
```

---

## 8. Run and slot identity

```ts
type PilotCampaignRunV1 = {
  schemaVersion: "pilot-campaign-run-v1";
  campaignRunId: string;
  campaignPlanDigest: string;
  providerProfileId: string;
  sourceFreezeDigest: string;
  startedBy: string;
  startedAt: string;
  runIdentityDigest: string;
};
```

```ts
type PilotSlotV1 = {
  schemaVersion: "pilot-slot-v1";
  campaignRunId: string;
  slotId: string;
  conditionId: "A" | "B" | "C" | "D";
  conditionOrdinal: 1 | 2 | 3 | 4 | 5;
  waveOrdinal: 1 | 2 | 3;
  fixtureDigest: string;
  slotIdentityDigest: string;
};
```

권장 identity:

```text
campaignRunId = hash(planDigest + explicit run nonce)
slotId = hash(campaignRunId + conditionId + conditionOrdinal)
attemptId = hash(slotId + attemptOrdinal + compiledPromptDigest + providerProfileDigest)
```

run nonce는 같은 plan의 독립 반복 실험을 구분하기 위한 명시적 random ID다. timestamp만으로 run identity를 만들지 않는다.

---

## 9. Generation work packet

```ts
type GenerationWorkPacketV1 = {
  schemaVersion: "generation-work-packet-v1";
  campaignRunId: string;
  slotId: string;
  attemptId: string;
  attemptOrdinal: 1 | 2;
  providerProfileId: string;
  providerProfileVersion: string;
  finalizedSpecDigest: string;
  compiledPromptDigest: string;
  promptArtifactRef: string;
  expectedOutput: {
    oneImageOnly: true;
    allowedFormats: ["png", "jpeg", "webp_static"];
    requiredWidth: 1024;
    requiredHeight: 1024;
  };
  blindBoundary: {
    judgmentIntentDisclosure: "forbidden";
    rawAccountMetadataRetention: "forbidden";
  };
  issuedAt: string;
  packetDigest: string;
};
```

work packet은 generation operator에게 intended prompt를 제공한다. T4/T5 blind reviewer packet에는 포함되지 않는다.

---

## 10. Manual generation handoff

```ts
type GenerationHandoffV1 = {
  schemaVersion: "generation-handoff-v1";
  campaignRunId: string;
  slotId: string;
  attemptId: string;
  providerProfileId: string;
  compiledPromptDigest: string;
  localAssetRelativePath: string | null;
  outcome:
    | "asset_ready"
    | "provider_no_output"
    | "provider_refusal_without_asset"
    | "local_transfer_incomplete";
  operator: {
    operatorId: string;
    syntheticOnlyConfirmed: true;
    realPersonReferenceUsed: false;
    termsAndRightsReviewedForImport: true;
  };
  generatedAt: string;
  handoffDigest: string;
};
```

금지 필드:

- Provider account ID
- email
- browser cookie
- authorization header
- session token
- raw response body
- chat transcript
- prompt screenshots
- absolute file path

`asset_ready` handoff는 T3 import 승인 자체가 아니다. T3가 canonical bytes와 provenance를 다시 검증한다.

---

## 11. Campaign event ledger

T7 authoritative state는 mutable row가 아니라 append-only event chain이다.

```ts
type PilotCampaignEventV1 = {
  schemaVersion: "pilot-campaign-event-v1";
  campaignRunId: string;
  slotId: string | null;
  eventType: PilotCampaignEventTypeV1;
  sourceRefs: Array<{
    track: "T2" | "T3" | "T4" | "T5" | "T6" | "T7";
    artifactType: string;
    artifactDigest: string;
  }>;
  reasonCodes: string[];
  predecessorEventDigest: string | null;
  recordedAt: string;
  eventDigest: string;
};
```

```ts
type PilotCampaignEventTypeV1 =
  | "run_started"
  | "wave_issued"
  | "generation_packet_issued"
  | "generation_handoff_registered"
  | "generation_retry_reserved"
  | "candidate_registered"
  | "observation_authorization_recorded"
  | "observation_registered"
  | "judgment_assignment_issued"
  | "judgment_consensus_sealed"
  | "alignment_registered"
  | "promotion_preflight_registered"
  | "promotion_decision_registered"
  | "slot_terminal"
  | "checkpoint_requested"
  | "checkpoint_approved"
  | "checkpoint_stopped"
  | "run_paused"
  | "run_resumed"
  | "run_closed";
```

규칙:

- slot event chain은 하나의 선형 predecessor chain
- run-level checkpoint chain도 하나의 선형 chain
- duplicate, branch, cycle, disconnected successor는 invalid
- T2–T6 artifact digest가 바뀌면 기존 event를 수정하지 않고 새 event 또는 새 run 필요

---

## 12. Slot state machine

```text
planned
→ generation_packet_issued
→ awaiting_generation_handoff
→ generation_handoff_received
→ import_preflight_ready
→ candidate_registered
→ awaiting_observation_authorization
→ observation_registered
→ awaiting_blind_review
→ consensus_sealed
→ alignment_registered
→ awaiting_promotion_policy_reviews
→ promotion_preflight_registered
→ awaiting_promotion_review
→ terminal
```

terminal outcome:

```ts
type PilotSlotTerminalOutcomeV1 =
  | "promoted_g4"
  | "retained_g3_negative_control"
  | "promotion_held"
  | "promotion_rejected"
  | "candidate_import_failed"
  | "observation_failed"
  | "judgment_incomplete"
  | "cancelled_budget_exhausted"
  | "cancelled_campaign_stop"
  | "cancelled_operator";
```

`valid_ineligible_observation`은 T4 authority를 보존한 뒤 T5/T6로 진행하지 않는 terminal reason으로 projection될 수 있다. 이를 provider failure로 바꾸지 않는다.

---

## 13. Wave 정책

### Wave 1

- A/B/C/D 각 1개
- 총 4 primary slots
- 목적: systemic contract, external mark, file/import, observation path 조기 확인

### Wave 2

- A/B/C/D 각 2개
- 총 8 primary slots
- Wave 1 checkpoint 승인 후에만 issue

### Wave 3

- A/B/C/D 각 2개
- 총 8 primary slots
- Wave 2 checkpoint 승인 후에만 issue

### Wave 불변식

- 다음 wave packet은 checkpoint approval 전에 생성하지 않음
- 이미 발행된 wave를 취소해 결과를 숨기지 않음
- stopped wave의 미발행 slot은 `cancelled_campaign_stop`으로 명시
- checkpoint는 previous wave의 exact projection digest에 결합

---

## 14. Checkpoint contract

```ts
type PilotCheckpointApprovalV1 = {
  schemaVersion: "pilot-checkpoint-approval-v1";
  campaignRunId: string;
  completedWaveOrdinal: 1 | 2;
  runProjectionDigest: string;
  budgetSnapshotDigest: string;
  checklist: {
    sourceFreezeStillValid: boolean;
    providerProfileStillAllowed: boolean;
    noRealPersonReferenceEvidence: boolean;
    noSystemicExternalMarkIssue: boolean;
    noCandidateReplacementOccurred: boolean;
    allRegisteredOutcomesRetained: boolean;
    unresolvedCriticalIntegrityFailureCount: number;
  };
  decision: "continue" | "pause" | "stop";
  reasonCodes: string[];
  approvedBy: string;
  approvedAt: string;
  approvalDigest: string;
};
```

checkpoint reviewer는 T5/T6 판단을 바꾸지 않는다. campaign continuation만 결정한다.

---

## 15. Stop policy

### Immediate stop

- `real_person_reference_detected`
- `synthetic_only_attestation_invalid`
- `source_artifact_integrity_invalid`
- `campaign_source_freeze_drift`
- `provider_profile_disabled_or_changed`
- `systemic_external_mark_present`
- `registered_candidate_replacement_attempted`
- `campaign_event_chain_invalid`
- `budget_hard_cap_exceeded`

### Pause for review

- Provider rights/terms scope becomes uncertain
- repeated exact canonical duplicates across independent slots
- perceptual leakage cluster requires review
- source policy version changed after run start
- unexplained condition-wide observation failure
- reviewer role separation cannot be satisfied

### No automatic stop

다음은 그 자체로 systemic stop reason이 아니다.

- low G4 yield
- valid ineligible observation
- misalignment
- G3 negative-control retention
- individual hold/reject
- one condition의 poor visual quality

이 항목은 정확한 outcome으로 보존하고 T8에서 해석한다.

---

## 16. T2–T6 adapter boundary

### T2 adapter

허용:

- fixture digest revalidation
- finalized spec 생성/검증
- prompt compile
- generation work packet 발행

금지:

- image generation Provider 호출
- prompt template 변경

### T3 adapter

허용:

- import request 생성
- dry-run
- confirm
- candidate manifest digest 등록

금지:

- failed visual candidate replacement
- canonical asset mutation

### T4 adapter

허용:

- observation request 생성
- preflight
- explicit authorization이 있을 때 기존 bounded Provider execution 호출
- authoritative run digest 등록

금지:

- hidden retry
- fixture replay를 authoritative로 승격
- raw Provider response retention

### T5 adapter

허용:

- blind assignment issue
- reviewer submission artifact 등록
- consensus build
- post-seal alignment

금지:

- generation intent를 reviewer에게 노출
- runner-generated review
- aggregate score로 disagreement 해결

### T6 adapter

허용:

- source preflight
- policy-review preflight
- independent promotion review artifact 등록
- confirm/revoke outcome reference

금지:

- T7가 rights/visual/leakage/promotion review를 자동 승인
- G4 scope 확대
- G5 생성

---

## 17. Runner command design

```bash
npm run synthetic:campaign -- \
  --plan .synthetic-local/requests/campaign-plan.json \
  --compile
```

- plan 검증
- source freeze 검증
- 20 slot과 wave allocation 생성
- persistent Provider/human action 0

```bash
npm run synthetic:campaign -- \
  --run <campaignRunId> \
  --issue-wave 1
```

- Wave 1의 4개 generation work packet만 발행

```bash
npm run synthetic:campaign -- \
  --run <campaignRunId> \
  --slot <slotId> \
  --generation-handoff requests/generation-handoff.json
```

- handoff 등록
- asset-ready면 T3 request 준비
- technical failure면 retry eligibility 계산

```bash
npm run synthetic:campaign -- \
  --run <campaignRunId> \
  --slot <slotId> \
  --advance
```

- 정확히 한 slot을 다음 deterministic local boundary까지 진행
- Provider authorization 또는 human artifact가 필요하면 멈춤

```bash
npm run synthetic:campaign -- \
  --run <campaignRunId> \
  --slot <slotId> \
  --advance \
  --allow-provider-observation \
  --api-key-env OPENAI_API_KEY
```

- T4 bounded observation만 명시적으로 허용
- image generation 호출은 없음

```bash
npm run synthetic:campaign -- \
  --run <campaignRunId> \
  --checkpoint requests/checkpoint-wave-1.json
```

```bash
npm run synthetic:campaign -- --run <campaignRunId> --status
npm run synthetic:campaign -- --run <campaignRunId> --resume
npm run synthetic:campaign -- --run <campaignRunId> --close
```

금지 command:

- `--auto-all`
- `--generate-provider`
- `--auto-review`
- `--auto-promote`
- `--assign-split`
- `--lock-holdout`

---

## 18. Campaign projection

```ts
type PilotCampaignProjectionV1 = {
  schemaVersion: "pilot-campaign-projection-v1";
  campaignRunId: string;
  planDigest: string;
  latestEventDigest: string;
  runStatus: "active" | "paused" | "stopped" | "closed";
  waveStatus: Array<{
    waveOrdinal: 1 | 2 | 3;
    status: "not_issued" | "active" | "awaiting_checkpoint" | "approved" | "stopped" | "complete";
  }>;
  budget: {
    generationAttemptsUsed: number;
    generationRetryReserveUsed: number;
    observationRunsUsed: number;
    observationRecoveryRunsUsed: number;
  };
  denominators: {
    plannedPrimarySlots: 20;
    issuedPrimarySlots: number;
    generationHandoffs: number;
    registeredCandidates: number;
    authoritativeObservations: number;
    sealedConsensus: number;
    alignments: number;
    promotionDecisions: number;
    terminalSlots: number;
  };
  terminalOutcomeCounts: Record<PilotSlotTerminalOutcomeV1, number>;
  reasonCodeCounts: Record<string, number>;
  activeG4Refs: Array<{
    slotId: string;
    gradeRecordDigest: string;
    promotionKey: string;
    splitCouplingKeysDigest: string;
  }>;
  projectionDigest: string;
};
```

T7 projection은 count와 reference만 제공한다.

금지:

- `successScore`
- `qualityScore`
- `providerRank`
- 자동 recommendation
- 자동 go/no-go

---

## 19. Closeout package

```ts
type PilotCampaignCloseoutV1 = {
  schemaVersion: "pilot-campaign-closeout-v1";
  campaignRunId: string;
  planDigest: string;
  finalProjectionDigest: string;
  slotEventHeadDigests: string[];
  checkpointDigests: string[];
  activeG4Refs: string[];
  nonGoldDecisionRefs: string[];
  unresolvedHoldRefs: string[];
  splitCouplingKeyDigests: string[];
  closedBy: string;
  closedAt: string;
  closeoutDigest: string;
};
```

closeout package는 T8 입력이다. 사람이 읽는 결과 보고서가 아니다.

T9에는 T8을 거치더라도 active, non-revoked G4만 Gold 후보로 전달할 수 있다.

---

## 20. 저장 구조 제안

```text
.synthetic-local/
  campaigns/
    plans/
      <campaignId>/<planDigest>.json
    runs/
      <campaignRunId>/
        run.json
        slots/
          <slotId>/
            slot.json
            packets/
              <attemptId>.json
            handoffs/
              <handoffDigest>.json
            events/
              <eventDigest>.json
        checkpoints/
          <approvalDigest>.json
        projections/
          <projectionDigest>.json
        closeouts/
          <closeoutDigest>.json
```

규칙:

- content-addressed object 먼저 저장
- event/manifest publication 마지막
- mutable global JSONL을 authority로 사용하지 않음
- `.synthetic-local/` 외부 write 금지
- external raw image는 T3 canonical storage가 authority가 된 뒤 runner가 복제하지 않음

---

## 21. Concurrency와 resume

### Single-writer run claim

- 하나의 campaign run에는 하나의 active writer claim만 허용
- claim은 run identity와 last event digest에 결합
- stale claim 회수는 명시적 recovery artifact가 필요
- force overwrite 금지

### Resume

resume은 다음을 수행한다.

1. plan/run identity 검증
2. 전체 event chain 검증
3. 각 T2–T6 referenced artifact digest 검증
4. budget 재계산
5. slot projection 재생성
6. next actionable boundary 계산

resume이 수행하지 않는 것:

- 누락된 review 자동 생성
- failed slot 자동 retry
- 새 Provider 호출
- held/rejected outcome 변경

---

## 22. Reason code registry v1

### Planning

- `campaign_plan_valid`
- `campaign_source_freeze_valid`
- `campaign_source_freeze_drift`
- `campaign_provider_profile_invalid`
- `campaign_matrix_invalid`
- `campaign_budget_invalid`

### Generation handoff

- `generation_asset_ready`
- `provider_no_output`
- `provider_refusal_without_asset`
- `local_transfer_incomplete`
- `generation_retry_reserved`
- `generation_retry_not_allowed`
- `generation_attempt_budget_exhausted`

### Candidate binding

- `candidate_registered_to_slot`
- `registered_candidate_replacement_attempted`
- `candidate_import_failed`

### Observation

- `observation_authorization_required`
- `observation_registered`
- `observation_recovery_reserved`
- `observation_recovery_not_allowed`
- `observation_budget_exhausted`

### Human authority

- `judgment_reviews_pending`
- `consensus_sealed`
- `promotion_policy_reviews_pending`
- `promotion_review_pending`

### Checkpoint / stop

- `checkpoint_continue`
- `checkpoint_pause`
- `checkpoint_stop`
- `systemic_external_mark_present`
- `real_person_reference_detected`
- `campaign_event_chain_invalid`
- `budget_hard_cap_exceeded`
- `campaign_closed_complete`
- `campaign_closed_stopped`

---

## 23. T8 handoff boundary

T8가 받을 수 있는 것:

- plan and source freeze digest
- exact slot/wave denominators
- terminal outcome counts
- reason-code distributions
- T2–T6 artifact references
- active G4 references
- G3 negative-control references
- held/rejected references
- checkpoint and closeout digests

T7가 하지 않는 것:

- markdown/html report 생성
- thumbnail/contact sheet export
- CSV review sheet 생성
- Provider 우열 판단
- failure pattern interpretation
- 다음 prompt 개선안 자동 작성

---

## 24. T9 handoff boundary

T9 입력 후보:

- active non-revoked G4 record
- purpose and claim scope
- split coupling keys digest
- campaign and lineage references
- source evidence digests

T7/T8가 T9 대신 할 수 없는 것:

- train/development/validation/test split assignment
- holdout selection
- G5 creation
- dataset lock version publication
- regression baseline activation
- leakage-aware group placement

---

## 25. 구현 순서

```text
T7-1 shared campaign contracts and reason registry
→ T7-2 plan validator and 20-slot A/B/C/D matrix compiler
→ T7-3 run/slot identity and append-only event ledger
→ T7-4 generation work packet and manual handoff registrar
→ T7-5 T2/T3/T4/T5/T6 stage adapters
→ T7-6 budget, retry, wave, checkpoint, and stop policy
→ T7-7 projection, resume, and closeout derivation
→ T7-8 single-slot campaign CLI
→ T7-9 architecture, tamper, idempotency, and anti-cherry-picking tests
```

---

## 26. 구현 검증 요구

Implementation PR은 최소 다음을 증명해야 한다.

### Plan / identity

- exact 20 primary slots
- A/B/C/D 각 5
- wave allocation 각 `[1,2,2]`
- one provider profile per run
- provider/source/policy drift rejection
- timestamp-excluded deterministic plan/slot identity

### Anti-cherry-picking

- T3 registered candidate replacement 차단
- cue mismatch, ineligible, misaligned, held, rejected retry 차단
- technical pre-registration retry만 허용
- 모든 registered candidate terminal outcome 보존

### Budget / wave

- total generation attempt 30 hard cap
- per-slot max 2
- observation total 30 hard cap
- next wave issue requires exact checkpoint approval
- stopped wave의 미발행 slot이 명시적으로 종료됨

### Authority separation

- generation Provider call 없음
- T4 Provider execution은 explicit authorization 없으면 0
- reviewer/promotion decision 자동 생성 0
- T2 intent가 T5 blind packet에 없음
- T7가 T4/T5/T6 values를 변경하지 않음

### Integrity / resume

- event chain branch/cycle/disconnect rejection
- source artifact tamper rejection
- semantic retry idempotency
- partial write recovery
- closeout references exact terminal heads

### Track boundaries

- T8 report/export API 없음
- split/G5/holdout API 없음
- production dependency 0
- DB/API/UI/Auth/Payment/Storage integration 0

---

## 27. 비대상

- 실제 20장 생성
- generation Provider API/browser automation
- actual OpenAI observation call
- human reviewer assignment execution
- actual human consensus
- actual rights/legal judgment
- actual promotion review
- G4 quota 채우기
- prompt tuning during run
- provider leaderboard
- archetype scoring
- same-person verification
- admin review UI
- CSV/HTML/report export
- train/development/validation/test split
- G5 holdout lock
- production runtime
- Supabase/DB/API route

---

## 28. 설계 자체 리뷰 체크

- [x] T7가 새 label authority가 되지 않음
- [x] 20 primary slot과 G4 목표를 분리함
- [x] registered candidate replacement를 금지함
- [x] manual generation provenance를 자동 Provider 실행과 구분함
- [x] wave checkpoint로 대량 실패 복제를 제한함
- [x] source/policy version drift를 새 run으로 분리함
- [x] exact denominators를 보존하고 aggregate score를 금지함
- [x] T8 report와 T9 split/G5 권한을 분리함
- [x] Provider/human/production 실행 없이 구현 가능한 설계임

---

## 29. 최종 설계 판정

`READY_FOR_IMPLEMENTATION_REVIEW`

#T7 구현은 다음 범위로 제한한다.

```text
fixed 20-slot pilot orchestration
+ manual generation handoff
+ single-slot T2–T6 advancement
+ hard budgets and anti-cherry-picking
+ append-only event/projection/resume
+ wave checkpoint
+ machine-readable closeout
```

다음은 별도 Track으로 유지한다.

```text
T8 = review / export / report
T9 = leakage-aware split / G5 lock / regression
```
