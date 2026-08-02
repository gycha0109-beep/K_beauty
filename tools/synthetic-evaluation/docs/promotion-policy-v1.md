# Synthetic Evaluation Toolkit #T6

# Promotion Policy Design v1

## 0. 문서 상태

- Toolkit Track: `#T6`
- 작업 유형: 설계 전용
- 기준 브랜치: `feature/T5-judgment-intent-alignment`
- 기준 SHA: `ec19b48bcc0cf9cac2019259b6d320e91e548ae9`
- 구현 상태: 미구현
- 실제 promotion: 0
- G4 생성: 0
- G5 생성: 0
- Provider/API/browser/DB/production 실행: 0

`#T6`는 Toolkit 내부 작업 식별자이며 GitHub 실제 PR 번호가 아니다.

---

## 1. 목적

#T6는 T3 후보 provenance, T4 권위 있는 관찰, T5 blind consensus·intent alignment·G2·G3를 다시 검증한 뒤, 특정 목적과 claim 범위에 한정된 `G4_SYNTHETIC_GOLD` 승격 여부를 결정하는 정책 경계를 정의한다.

```text
T3 candidate manifest
+ T4 authoritative observation
+ T5 sealed blind consensus
+ T5 intent alignment
+ G2_OBSERVED
+ purpose-scoped G3_CONSENSUS_VALIDATED
+ rights / mark / leakage review
→ deterministic promotion preflight
→ independent promotion review
→ append-only promotion decision
→ purpose-scoped G4_SYNTHETIC_GOLD or non-Gold disposition
```

핵심 구분:

```text
aligned
≠ promotion approved
≠ candidate-global Gold
≠ real-person ground truth
≠ training license
≠ locked holdout
```

#T6는 G4까지만 담당한다. `G5_LOCKED_HOLDOUT`, split 배치, dataset lock, regression integration은 `#T9` 책임이다.

---

## 2. 기준 입력

### 2.1 T3 candidate

T6는 저장된 candidate manifest를 읽고 다음을 재검증한다.

- `state = G0_GENERATED`
- candidate ID와 candidate digest 재계산
- canonical asset SHA와 content-addressed path
- finalized spec / compiled prompt digest와 object reference
- Provider profile와 provider run provenance
- campaign / condition / lineage
- synthetic-only attestation
- rights-reviewed flag
- visible external mark hint
- exact canonical duplicate references
- perceptual-neighbor references

T3의 `candidateDigest`는 operator hints, attestation, duplicate references 전체를 포괄하지 않는다. 따라서 T6는 candidate digest만으로 promotion evidence의 역사적 완전성을 주장하지 않는다. 현재 full immutable projection을 별도 snapshot digest로 봉인하고 promotion operator re-attestation을 요구한다.

### 2.2 T4 observation

- stored run manifest와 observation object integrity 재검증
- `authority = observed_image`
- `execution.mode = provider_bounded`
- `outcome = observed_bundle`
- fixture authority 금지
- candidate ID, canonical SHA, observation run ID, observation digest 일치
- G2 source digest 일치

### 2.3 T5 judgment / alignment

- consensus status: `sealed_complete | sealed_partial`
- consensus digest와 purpose-free axis semantics 재검증
- G3 required axes가 모두 `agreed`
- alignment candidate/spec/prompt/consensus references 일치
- `overallVerdict = aligned`
- required-axis digest와 actual consensus claim values 재계산
- `promotion_policy_pending_t6`는 T5가 의도적으로 추가한 handoff marker로만 처리
- 그 외 promotion block reason은 T6에서 명시적으로 해소되지 않으면 blocker

---

## 3. 설계 전 리뷰 결과

### R-01. `aligned`를 Gold로 바로 승격하면 안 된다

T5 alignment는 생성 의도와 blind consensus 값의 일치만 말한다. rights, visible mark, duplicate leakage, review separation, downstream use 범위를 증명하지 않는다.

조치:

- T5는 항상 promotion eligible false
- T6가 별도 evidence bundle과 human review를 요구
- T6 preflight 통과와 final G4 승격을 별도 상태로 분리

### R-02. Gold는 candidate-global claim이 아니다

하나의 이미지가 skin cue 평가에는 적합하지만 face-feature strength, archetype, identity 보존에는 근거가 없을 수 있다.

조치:

- G4는 `candidate + purpose + claim axis/value set + use scope`에 묶음
- claim 값은 intended spec이 아니라 sealed consensus에서 가져옴
- excluded claims를 grade record에 명시

### R-03. T3 candidate identity만으로 policy evidence를 보호할 수 없다

operator hints와 duplicate references가 candidate identity digest 밖에 있다.

조치:

- full promotion evidence projection을 별도 digest로 봉인
- current manifest를 promotion reviewer가 재확인하는 re-attestation 추가
- T6 결정은 projection digest와 re-attestation digest에 결합
- pre-T6 비식별 필드의 역사적 불변성은 주장하지 않음

### R-04. T6와 T9가 G5 권한을 공유하면 안 된다

조치:

- T6: G4와 non-Gold disposition만 생성
- T9: active G4만 받아 leakage-aware split과 G5 lock 수행
- T6에는 holdout/train/test split 필드 없음

### R-05. 일반 이미지 duplicate threshold를 그대로 쓰면 과잉 차단된다

합성 얼굴은 구도와 배경이 의도적으로 비슷하다. dHash distance만으로 자동 reject하면 잘못된 판단이 발생한다.

조치:

- exact canonical duplicate는 deterministic rule 적용
- perceptual neighbor는 calibrated threshold가 생기기 전 수동 leakage review 필요
- visual similarity review는 identity equality를 주장하지 않음

### R-06. misaligned 후보도 분석 가치가 있을 수 있다

조치:

- `misaligned`를 G4로 승격하지 않음
- 무결성과 G3를 만족하면 `retained_g3_negative_control`로 보존 가능
- negative-control 보존은 Gold나 holdout 승격이 아님

### R-07. 승인 뒤 권리·중복 문제가 발견될 수 있다

조치:

- promotion과 revocation을 append-only event로 기록
- 기존 grade artifact를 수정하거나 삭제하지 않음
- active status는 event projection으로 계산

---

## 4. 절대 불변식

### P-01. Promotion은 기존 artifact를 변경하지 않는다

candidate, raw/canonical asset, observation, judgment, consensus, alignment, G2/G3는 read-only다.

### P-02. G4 claim 값은 consensus에서 온다

GenerationSpec은 목적과 요구 axis를 선택하지만, Gold label 값의 source는 sealed blind consensus다.

### P-03. 총점과 보상 평균을 사용하지 않는다

한 gate mismatch 또는 unresolved mandatory policy gate를 높은 다른 점수로 상쇄하지 않는다.

### P-04. T6 v1은 internal evaluation only다

G4는 다음을 허가하지 않는다.

- model training / fine-tuning
- public dataset release
- marketing or user-facing representative image
- real-person inference
- health/medical diagnosis
- beauty ranking
- personality/physiognomy
- external benchmark publication

### P-05. 실제 인물 reference는 영구 blocker다

`syntheticOnly != true` 또는 `realPersonReferenceUsed != false`이면 G4 검토 자체를 금지한다.

### P-06. visible external mark는 G4 blocker다

`present` 또는 `unknown`은 G4로 승격하지 않는다. raw/canonical image에서 mark를 제거하거나 crop하지 않는다.

### P-07. Rights review는 import attestation과 별개다

T3의 `termsAndRightsReviewed=true`는 import 허가다. G4에는 `internal_evaluation_only` 범위의 별도 rights review가 필요하다.

### P-08. Promotion reviewer는 T5 label을 바꾸지 않는다

reviewer는 provenance, scope, leakage, rights, mark, policy completeness만 판단한다. 관찰값을 수정하려면 새 T5 judgment/consensus가 필요하다.

### P-09. Paired identity를 주장하지 않는다

`paired_skin_edit`는 T6 v1 G4 대상이 아니다.

### P-10. Mixed pilot은 G4 대상이 아니다

`mixed_control_pilot`은 파일럿 분석용으로만 보존하고 G4로 승격하지 않는다.

### P-11. G5를 만들지 않는다

T6는 `G5_LOCKED_HOLDOUT` 또는 split assignment를 생성하지 않는다.

### P-12. Production은 Toolkit에 의존하지 않는다

production route/UI/DB/Auth/Payment/Storage는 변경하지 않는다.

---

## 5. 목적별 G4 정책

| purpose | T6 v1 G4 | claim scope | 제외 claim |
|---|---:|---|---|
| `capture_control` | 허용 | agreed capture/appearance gates | skin, face feature, archetype |
| `skin_cue_control` | 허용 | agreed capture gates + agreed skin targets | diagnosis, severity beyond registry |
| `face_feature_control` | 조건부 허용 | agreed capture gates + exact feature enum values | feature strength, archetype, style advice |
| `paired_skin_edit` | 금지 | non-Gold pilot only | same-person preservation |
| `mixed_control_pilot` | 금지 | non-Gold pilot only | combined Gold claim |

### 5.1 `capture_control`

모든 required capture/appearance axis가 agreed `confirmed`이고 alignment가 `aligned`여야 한다.

### 5.2 `skin_cue_control`

- capture gates 모두 match
- redness presence/regions exact match
- blemish presence/countBand/regions exact match
- absence target은 human consensus가 명시적으로 `none`을 지지해야 함
- unsupported/unavailable/uncertain을 none으로 승격하지 않음

### 5.3 `face_feature_control`

- T2 registry에 승인된 exact enum axis만 claim
- consensus value와 intended value exact match
- cue `strength`는 v1에서 claim set에 포함하지 않음
- `feature_strength_not_assessed_v1`는 excluded claim으로 기록

---

## 6. Promotion evidence bundle

```ts
type PromotionEvidenceBundleV1 = {
  schemaVersion: "promotion-evidence-bundle-v1";
  promotionKey: string;
  candidate: {
    candidateId: string;
    candidateDigest: string;
    fullProjectionDigest: string;
    canonicalSha256: string;
  };
  generation: {
    purpose: string;
    specDigest: string;
    promptDigest: string;
    providerProfileId: string;
    providerProfileVersion: string;
    exactReproductionAvailable: boolean;
  };
  provenance: {
    operatorAttestationDigest: string;
    operatorHintsDigest: string;
    providerRunDigest: string;
  };
  observation: {
    runId: string;
    observationDigest: string;
    g2RecordDigest: string;
  };
  judgment: {
    consensusDigest: string;
    alignmentDigest: string;
    g3RecordDigest: string;
  };
  claims: {
    purpose: string;
    requiredAxes: string[];
    claimValues: Array<{ axis: string; value: unknown }>;
    claimValuesDigest: string;
    excludedClaims: string[];
  };
  leakageInputs: {
    canonicalSha256: string;
    campaignSeriesId: string | null;
    lineage: unknown;
    exactCanonicalDuplicateOf: string[];
    nearestPerceptualCandidates: unknown[];
  };
  policy: {
    id: "bejewely-promotion-policy-v1";
    version: "1.0.0";
    policyDigest: string;
  };
  assembledAt: string;
  bundleDigest: string;
};
```

규칙:

- `promotionKey = hash(candidateId + purpose + requiredAxesDigest)`
- timestamps는 identity에서 제외
- claim arrays와 IDs는 정렬 후 digest
- bundle은 raw image bytes, prompt prose, free-text note, Provider secret을 포함하지 않음
- canonical image는 기존 T3 object를 read-only로 참조

---

## 7. Promotion operator re-attestation

```ts
type PromotionOperatorReattestationV1 = {
  schemaVersion: "promotion-operator-reattestation-v1";
  candidateId: string;
  fullProjectionDigest: string;
  operatorId: string;
  syntheticOnlyConfirmed: true;
  realPersonReferenceUsedConfirmed: false;
  currentManifestReviewed: true;
  attestedAt: string;
  attestationDigest: string;
};
```

이 artifact는 과거 T3 시점의 비식별 필드가 변하지 않았음을 소급 증명하지 않는다. T6 검토 시점에 reviewer가 확인한 정확한 projection을 봉인한다.

---

## 8. Usage rights review

```ts
type UsageRightsReviewV1 = {
  schemaVersion: "usage-rights-review-v1";
  candidateId: string;
  providerProfileId: string;
  reviewScope: "internal_evaluation_only";
  status: "approved" | "denied" | "uncertain";
  reviewerId: string;
  sourcePolicyRef: string;
  reviewedAt: string;
  reviewDigest: string;
};
```

- `approved`만 G4 가능
- 정확한 Provider model label/version이 null이어도 manual-web provenance와 profile version이 검증되면 internal evaluation G4를 자동 차단하지 않음
- 단, exact reproduction을 주장하지 않음
- external/public/training use는 항상 금지
- raw terms page URL, account ID, email, session token을 저장하지 않음

---

## 9. Leakage review

```ts
type PromotionLeakageReviewV1 = {
  schemaVersion: "promotion-leakage-review-v1";
  candidateId: string;
  exactCanonicalDisposition:
    | "unique"
    | "representative_selected"
    | "alias_retained_non_gold"
    | "conflicting_claims_blocked";
  perceptualDisposition:
    | "no_review_candidates"
    | "distinct_enough_for_internal_evaluation"
    | "leakage_coupled"
    | "uncertain";
  splitCouplingKeys: Array<{
    kind: "canonical" | "campaign_series" | "lineage" | "reviewed_visual_similarity";
    key: string;
  }>;
  reviewerId: string;
  reviewedAt: string;
  reviewDigest: string;
};
```

규칙:

- exact canonical duplicate가 없으면 `unique`
- 같은 canonical image의 active G4 representative는 하나만 허용
- 동일 image에 상충하는 claim set이 존재하면 blocker
- perceptual neighbor가 있으면 `uncertain` 상태로 자동 G4 금지
- calibrated distance threshold가 승인되기 전 자동 distinct/reject 금지
- similarity review는 same-person identity를 주장하지 않음
- `splitCouplingKeys`는 T9가 cross-split leakage를 막는 입력이며 T6가 split을 선택하지 않음

---

## 10. Promotion preflight

```ts
type PromotionPreflightStatusV1 =
  | "eligible_for_promotion_review"
  | "retained_g3_negative_control"
  | "held_policy_review"
  | "blocked";
```

### 10.1 `eligible_for_promotion_review`

모두 만족:

- 모든 source artifact integrity PASS
- supported purpose
- G2와 purpose-scoped G3 유효
- alignment `aligned`
- T5 block reason은 `promotion_policy_pending_t6`만 존재
- visible mark `absent`
- rights review `approved`
- operator re-attestation 유효
- duplicate/leakage review 완료
- exact canonical representative rule 통과
- required claim values가 consensus와 일치

### 10.2 `retained_g3_negative_control`

- G2/G3와 consensus integrity는 유효
- alignment `misaligned`
- unsafe provenance나 artifact corruption은 없음

이 상태는 G4가 아니다. T8 report나 pilot 분석에만 사용할 수 있다.

### 10.3 `held_policy_review`

예:

- external mark `unknown`
- rights `uncertain`
- perceptual disposition `uncertain`
- reviewer role separation 미확인
- newer evidence conflict

### 10.4 `blocked`

예:

- artifact integrity failure
- real-person reference
- rights denied
- visible mark present
- unsupported purpose
- paired/mixed G4 요청
- exact duplicate conflicting claims
- fixture observation
- candidate/observation/alignment source mismatch

---

## 11. Promotion review

Promotion review는 blind일 필요가 없다. reviewer는 intent와 provenance를 보지만 T5 judgment 값을 수정하지 않는다.

```ts
type PromotionReviewSubmissionV1 = {
  schemaVersion: "promotion-review-submission-v1";
  promotionKey: string;
  evidenceBundleDigest: string;
  reviewer: {
    reviewerId: string;
    role: "promotion_reviewer";
    roleSeparationAttested: true;
  };
  decision: "approve_g4" | "hold" | "reject";
  confirmedScope: {
    purpose: string;
    claimValuesDigest: string;
    useScope: "internal_evaluation_only";
    excludedClaimsDigest: string;
  };
  reasonCodes: string[];
  completedAt: string;
  submissionDigest: string;
};
```

정책:

- reviewer ID는 T5 reviewer/adjudicator ID와 달라야 함
- 이는 운영상 역할 분리이며 물리적으로 다른 사람임을 암호학적으로 증명하지 않음
- authoritative free-text note 금지
- `approve_g4`는 exact evidence bundle과 policy version에만 유효
- evidence나 policy가 바뀌면 새 review 필요

---

## 12. Final promotion decision

```ts
type PromotionDecisionV1 = {
  schemaVersion: "promotion-decision-v1";
  promotionKey: string;
  candidateId: string;
  purpose: string;
  policyId: "bejewely-promotion-policy-v1";
  policyVersion: "1.0.0";
  evidenceBundleDigest: string;
  rightsReviewDigest: string;
  leakageReviewDigest: string;
  operatorReattestationDigest: string;
  promotionReviewDigest: string;
  outcome:
    | "promoted_g4"
    | "retained_g3_negative_control"
    | "held"
    | "rejected";
  predecessorDecisionDigest: string | null;
  decidedAt: string;
  decisionDigest: string;
};
```

- 같은 semantic input은 같은 decision identity
- timestamp는 identity에서 제외
- 기존 decision overwrite 금지
- 바뀐 evidence/policy는 predecessor를 참조하는 새 decision 생성

---

## 13. G4 grade record

```ts
type G4GradeRecordV1 = {
  schemaVersion: "g4-grade-record-v1";
  gradeRecordId: string;
  candidateId: string;
  grade: "G4_SYNTHETIC_GOLD";
  scope: {
    purpose: string;
    claimAxes: string[];
    claimValuesDigest: string;
    useScope: "internal_evaluation_only";
    excludedClaims: string[];
  };
  policy: {
    id: "bejewely-promotion-policy-v1";
    version: "1.0.0";
    digest: string;
  };
  sourceDigests: string[];
  splitCouplingKeysDigest: string;
  recordedAt: string;
  gradeRecordDigest: string;
};
```

G4 의미:

- 합성 이미지임
- 특정 purpose의 특정 claim axis/value가 blind human consensus와 일치함
- T6 v1 provenance/rights/leakage policy를 통과함
- internal evaluation에서만 사용 가능함

G4가 의미하지 않는 것:

- 현실 인구 대표성
- 실제 피부·건강 진단 label
- 동일 인물 보존
- feature strength
- archetype/style recommendation truth
- model training license
- public release permission
- locked holdout membership

---

## 14. Revocation

```ts
type PromotionStatusEventV1 = {
  schemaVersion: "promotion-status-event-v1";
  promotionKey: string;
  gradeRecordDigest: string;
  event: "activated" | "revoked" | "superseded";
  reasonCodes: string[];
  predecessorEventDigest: string | null;
  recordedAt: string;
  eventDigest: string;
};
```

revocation trigger:

- rights denied or scope changed
- visible mark/provenance issue discovered
- artifact integrity failure
- duplicate/leakage conflict discovered
- newer consensus conflicts with promoted claim
- policy review explicitly revokes

revocation은 파일 삭제가 아니다. T9는 active, non-revoked G4만 입력으로 허용한다.

---

## 15. Reason code registry v1

### Expected handoff

- `promotion_policy_pending_t6`

### Hold

- `rights_review_uncertain`
- `external_mark_unknown`
- `perceptual_leakage_review_pending`
- `review_role_separation_unconfirmed`
- `newer_evidence_requires_review`
- `candidate_projection_history_unproven`

### Block

- `artifact_integrity_invalid`
- `candidate_observation_mismatch`
- `candidate_alignment_mismatch`
- `real_person_reference_prohibited`
- `rights_review_denied`
- `external_mark_present`
- `unsupported_purpose`
- `paired_identity_unverified`
- `mixed_control_gold_disabled`
- `exact_duplicate_conflicting_claims`
- `fixture_observation_prohibited`
- `required_axis_not_agreed`
- `alignment_not_aligned`
- `promotion_review_rejected`

### Retain non-Gold

- `misaligned_negative_control_retained`
- `exact_duplicate_alias_retained`
- `pilot_only_retained`

---

## 16. 저장 구조 제안

```text
.synthetic-local/
  promotion/
    evidence/
      <candidateId>/<bundleDigest>.json
    reattestations/
      <candidateId>/<attestationDigest>.json
    rights/
      <candidateId>/<reviewDigest>.json
    leakage/
      <candidateId>/<reviewDigest>.json
    reviews/
      <promotionKey>/<submissionDigest>.json
    decisions/
      <promotionKey>/<decisionDigest>.json
    grades/
      <candidateId>/<gradeRecordId>.json
    status-events/
      <promotionKey>/<eventDigest>.json
```

- content-addressed object 먼저 저장
- manifest/event publication 마지막
- immutable existing object와 semantic conflict 시 fail-closed
- global mutable JSONL을 authoritative registry로 사용하지 않음

---

## 17. CLI 제안

```bash
npm run synthetic:promote -- \
  --candidate <candidateId> \
  --alignment <alignmentDigest> \
  --preflight

npm run synthetic:promote -- \
  --candidate <candidateId> \
  --alignment <alignmentDigest> \
  --review requests/promotion-review.json \
  --confirm

npm run synthetic:promote -- \
  --grade-record <gradeRecordDigest> \
  --revoke requests/promotion-revocation.json
```

- `--preflight`: write 0
- `--confirm`: single candidate/purpose only
- batch promotion 없음
- no Provider/network/browser/DB
- G5/split command 없음

---

## 18. 실패와 복구

- partial promotion publication 금지
- claim/evidence write 후 decision publication 전에 crash하면 hidden approval로 간주하지 않음
- 동일 semantic retry는 최초 valid artifact를 반환
- orphan claim은 자동 재승격하지 않음
- changed evidence는 old approval을 재사용하지 않음
- recovery와 GC는 authoritative decision/event를 기준으로 파생 가능

---

## 19. 구현 순서

```text
T6-1 promotion contracts and reason registry
→ T6-2 stored evidence assembler and integrity verifier
→ T6-3 purpose policy matrix and deterministic preflight
→ T6-4 re-attestation / rights / leakage review contracts
→ T6-5 promotion review registrar
→ T6-6 decision and purpose-scoped G4 derivation
→ T6-7 append-only revocation/status projection
→ T6-8 CLI preflight/confirm/revoke
→ T6-9 architecture, tamper, idempotency, and T9-boundary tests
```

---

## 20. 검증 요구

Implementation PR은 최소 다음을 증명해야 한다.

- T3/T4/T5 source digest 재검증
- full candidate projection snapshot binding
- intended spec이 아니라 consensus value로 G4 claim 생성
- A/B/C/D aligned case의 purpose-scoped G4 eligibility
- misaligned candidate의 non-Gold retention
- paired/mixed G4 차단
- mark present/unknown 차단
- rights denied/uncertain 처리
- exact duplicate representative/alias/conflict 처리
- perceptual review 미완료 차단
- role separation enforcement
- recomputed outer digest로 semantic tamper 은폐 불가
- append-only decision/revocation
- timestamp-excluded idempotency
- G5/split API 부재
- production dependency 0
- Provider/browser/DB/network 0

---

## 21. 비대상

- 실제 candidate promotion
- 실제 rights 법률 판단
- 실제 human promotion review 실행
- batch promotion
- public dataset release
- training/fine-tuning
- G5 holdout lock
- train/validation/test split
- regression runner integration
- admin UI
- Supabase/DB/API route
- production runtime
- Provider execution
- archetype scoring
- same-person verification

---

## 22. 설계 완료 조건

- G4의 의미와 scope가 candidate-global이 아님
- T6/T9 grade authority가 분리됨
- T5 `promotion_policy_pending_t6` handoff가 명확함
- full policy evidence projection이 정의됨
- rights/mark/leakage/reviewer gate가 별도임
- exact duplicate와 perceptual similarity 정책이 분리됨
- G4 claim source가 sealed consensus임
- negative control retention이 Gold와 분리됨
- append-only revocation이 정의됨
- production 및 G5 경계가 닫힘
