# Synthetic Evaluation Toolkit #T9

# Leakage-aware Dataset Lock Design v1

## 0. 문서 상태

- Toolkit Track: `#T9`
- 작업 유형: 설계 전용
- 기준 브랜치: `feature/T8-review-export-report`
- 기준 SHA: `9dc45deff9570d7d0a514019a92e00f57e339fb1`
- 구현 상태: 미구현
- 실제 dataset split: 0
- 실제 G5 생성: 0
- 실제 holdout lock: 0
- 실제 regression baseline activation: 0
- 실제 training / model inference / benchmark execution: 0
- production route/UI/DB/Auth/Payment 변경: 0

`#T9`는 Toolkit 내부 작업 식별자이며 GitHub 실제 PR 번호가 아니다.

---

## 1. 목적

#T9는 현재 유효한 T6 G4 근거를 다시 검증하고, 누수 결합 관계를 보존한 채 dataset split과 holdout을 불변 객체로 잠근다.

```text
current active T6 G4 records
+ canonical assets
+ verified leakage coupling inputs
+ prior exposure history
→ immutable dataset source snapshot
→ leakage graph / connected components
→ deterministic component-level split assignment
→ human-reviewed dataset version lock
→ holdout-scoped G5 records
→ optional regression baseline activation
```

#T9가 새 label을 만들거나 upstream 판정을 재작성하는 것은 아니다.

```text
dataset lock
≠ image observation
≠ blind judgment
≠ intent alignment
≠ G4 promotion
≠ model training
≠ model inference
≠ benchmark score generation
≠ public dataset publication
```

권위는 다음과 같이 유지한다.

- 생성 의도와 prompt: T2
- candidate provenance와 canonical asset: T3
- observed image facts: T4
- blind consensus, alignment, G2/G3: T5
- purpose-scoped active G4와 leakage review inputs: T6
- campaign slot, source freeze, checkpoint, closeout: T7
- descriptive report와 internal review export: T8
- current-status 재검증, leakage-aware split, G5, dataset version, baseline lock: T9

---

## 2. 첫 T9 산출물의 질문

첫 T9 dataset lock은 다음 질문에만 답한다.

> 현재 active 상태인 purpose-compatible G4 후보들을 어떤 leakage component로 묶어야 하며, 기존 노출 이력과 고정 split policy를 위반하지 않고 train/development/validation/test/holdout에 배치할 수 있는가?

추가로 holdout이 잠기면 다음을 답할 수 있다.

> 어떤 정확한 dataset version과 leakage component 집합이 holdout으로 잠겼고, 그 잠금이 어떤 현재 G4 상태와 policy에 근거하는가?

이 질문은 다음을 답하지 않는다.

- 어떤 모델이 더 우수한가
- holdout score가 통계적으로 유의한가
- synthetic sample이 실제 인구집단을 대표하는가
- 이미지가 동일 인물인지 여부
- G5가 G4보다 label 품질이 더 높다는 의미
- dataset이 production training에 법적·상업적으로 사용 가능하다는 보증
- split 비율이 자동으로 최적이라는 주장

---

## 3. 설계 전 독립 리뷰

### R-01. T7 closeout 또는 T8 report의 G4 수를 현재 권위로 사용하면 revoke를 놓친다

조치:

- T9는 T7/T8의 `as-of-closeout` 수치를 현재 dataset eligibility로 신뢰하지 않는다.
- 각 G4 grade record와 전체 T6 status event chain을 다시 읽는다.
- current state가 `activated`이고 revoked/superseded되지 않은 record만 source pool에 들어간다.
- T8 report는 audit convenience이며 T9 source authority가 아니다.

### R-02. candidate 단위 split은 exact/perceptual/campaign leakage를 만든다

조치:

- split assignment unit은 candidate가 아니라 leakage graph의 connected component다.
- 하나의 coupling edge라도 공유하면 같은 component가 된다.
- component는 정확히 하나의 split에만 배치된다.

### R-03. exact duplicate만 묶으면 prompt/reference/campaign leakage가 남는다

조치:

필수 coupling input은 다음을 포함한다.

- canonical SHA-256
- T6 campaign-series key
- T6 reference-lineage key
- T6 reviewed-visual-similarity key
- exact paired/edit lineage
- 동일한 active representative/alias 관계

perceptual distance만으로 자동 edge를 만들지 않는다. 수동 reviewed relation 또는 approved calibrated policy가 필요하다.

### R-04. 완벽한 split quota를 맞추기 위해 component를 쪼개면 leakage boundary가 무너진다

조치:

- quota보다 leakage integrity가 우선이다.
- exact target을 만족할 수 없으면 component를 분리하지 않고 `split_infeasible`로 실패한다.
- 허용된 deviation이 있는 policy라도 실제 deviation을 manifest에 명시한다.

### R-05. seed를 반복 변경하면 원하는 sample을 holdout에 넣거나 뺄 수 있다

조치:

- caller가 임의 seed를 제공하지 않는다.
- assignment entropy는 source snapshot digest와 split plan digest에서 결정적으로 유도한다.
- 동일 source와 plan은 byte-identical assignment를 만든다.
- plan 변경은 새 plan identity와 새 human review를 요구한다.

### R-06. 새 dataset version에서 기존 holdout을 train으로 이동하면 holdout이 오염된다

조치:

- split exposure는 append-only claim으로 기록한다.
- 동일 leakage component의 기존 exact split assignment는 dataset lineage 안에서 sticky하다.
- train/development/validation/test에 노출된 component는 더 엄격한 evaluation split으로 승격할 수 없다.
- holdout을 덜 엄격한 split로 이동하려면 기존 baseline과 dataset version을 명시적으로 retire하고 새 lineage를 사용해야 한다.

### R-07. 나중에 train과 holdout 사이에 새 leakage edge가 발견될 수 있다

조치:

- 새 edge가 서로 다른 split의 prior components를 연결하면 `cross_split_leakage_conflict`다.
- 기존 dataset artifact를 수정하지 않는다.
- active dataset status와 연관 baseline을 append-only invalidation event로 비활성화한다.
- optimization-exposed component가 포함된 merged component는 같은 lineage에서 다시 holdout/test가 될 수 없다.

### R-08. G5를 label confidence 등급으로 해석할 수 있다

조치:

- v1 G5는 `G5_LEAKAGE_LOCKED_HOLDOUT`만 허용한다.
- G5는 label quality가 아니라 usage/split lock이다.
- G5 label source는 여전히 참조된 active G4 record다.
- G5가 없어도 G4 label truth가 약해지는 것은 아니다.

### R-09. dataset lock과 regression baseline을 하나의 identity로 묶으면 model 변경이 dataset을 바꾼다

조치:

artifact identity를 분리한다.

```text
DatasetSourceSnapshotV1
→ LeakageGraphV1
→ DatasetSplitAssignmentV1
→ DatasetVersionManifestV1
→ G5HoldoutRecordV1
→ RegressionBaselineV1
```

model artifact, metric engine, execution result는 dataset identity에 포함하지 않는다.

### R-10. holdout 파일을 일반 export에 포함하면 운영상 비밀 경계가 사라진다

조치:

- default dataset export는 holdout member ID, path, image를 포함하지 않는다.
- holdout materialization은 별도 명시적 command와 reviewer authorization을 요구한다.
- v1은 암호학적 비밀 저장소를 제공한다고 주장하지 않는다.
- 제공하는 것은 local access isolation, explicit intent, manifest separation이다.

### R-11. G4 revoke 후에도 잠긴 dataset을 active로 사용하면 source authority가 끊긴다

조치:

- dataset verification은 모든 member의 current T6 status를 재검증한다.
- member 하나라도 inactive면 active dataset verification은 실패한다.
- historical manifest는 읽을 수 있지만 active training/evaluation authority는 정지된다.

### R-12. 작은 dataset에서 자동 비율 split은 허위 안정성을 만든다

조치:

- v1 split plan은 exact target/minimum과 허용 deviation을 명시한다.
- minimum holdout/test component 수를 충족하지 못하면 lock하지 않는다.
- 빈 split을 조용히 허용하거나 sample 하나를 여러 split에 복제하지 않는다.

---

## 4. 절대 불변식

### C-01. Current T6 authority before eligibility

현재 active T6 status chain을 검증하지 않은 G4는 dataset source에 들어갈 수 없다.

### C-02. G4 label immutability

T9는 G4 purpose, claim axes, claim values, excluded claims를 변경하지 않는다.

### C-03. Component-level assignment only

candidate 또는 image를 leakage component와 분리해 개별 배치하지 않는다.

### C-04. One component, one split

하나의 leakage component는 dataset version 안에서 정확히 하나의 split만 가진다.

### C-05. No hidden exclusions

source snapshot의 eligible record는 assignment, explicit quarantine, explicit infeasible outcome 중 하나로 정확히 한 번 나타난다.

### C-06. No automatic perceptual identity

dHash, embedding distance, facial similarity는 same-person 또는 identity label이 아니다.

### C-07. No quota-driven leakage break

quota를 맞추기 위해 coupling edge 또는 component를 무시하지 않는다.

### C-08. Exposure monotonicity

이미 더 느슨한 split에 노출된 component를 더 엄격한 evaluation split로 재배치하지 않는다.

### C-09. Holdout isolation

holdout membership과 asset reference는 기본 train/dev/validation/test export에 포함하지 않는다.

### C-10. G5 is a usage lock

G5는 holdout usage lock이며 품질, 정확도, 대표성, 임상성 등급이 아니다.

### C-11. Immutable dataset versions

잠긴 dataset version의 member, split, labels, source digests는 수정하지 않는다.

### C-12. Append-only status

revocation, supersession, retirement, leakage conflict는 새 status event로 기록한다.

### C-13. Deterministic assignment

동일 source snapshot과 split plan은 동일 component graph와 assignment를 만든다.

### C-14. Read-only upstream

T2–T8 artifact, T6 grade/status, T7 closeout, T8 report를 수정하지 않는다.

### C-15. No model execution

T9 v1 runtime은 training, inference, scoring, threshold tuning을 수행하지 않는다.

### C-16. Production isolation

production application은 T9 runtime 또는 dataset artifact에 의존하지 않는다.

---

## 5. 입력과 readiness

### 5.1 source request

```ts
type DatasetSourceRequestV1 = {
  schemaVersion: "dataset-source-request-v1";
  datasetId: string;
  datasetLineageId: string;
  purpose: string;
  useScope: "internal_evaluation_only";
  sourceSelection: {
    campaignRunIds: string[];
    explicitG4GradeRecordDigests: string[];
  };
  requestedAt: string;
};
```

caller가 candidate 목록이나 label payload를 직접 제공하지 않는다. T9는 저장된 campaign/G4 reference에서 source를 다시 해석한다.

### 5.2 source readiness

각 source G4는 다음을 모두 만족해야 한다.

- T6 grade record integrity valid
- grade = `G4_SYNTHETIC_GOLD`
- complete T6 status chain valid
- current state = active
- promotion source snapshot/evidence/review chain valid
- T3 candidate manifest and canonical SHA valid
- canonical image bytes SHA-256 match
- T4/T5 source relation still valid
- purpose and use scope match source request
- claim schema is compatible with dataset task
- leakage review exists and is complete
- unresolved rights, mark, duplicate, perceptual, or policy hold 없음

### 5.3 fail-closed reason

```text
dataset_source_not_ready
g4_status_inactive
g4_status_chain_invalid
source_evidence_missing
source_evidence_integrity_invalid
canonical_asset_mismatch
purpose_scope_mismatch
label_schema_incompatible
leakage_review_missing
leakage_review_unresolved
```

---

## 6. Dataset source snapshot

```ts
type DatasetSourceSnapshotV1 = {
  schemaVersion: "dataset-source-snapshot-v1";
  datasetId: string;
  datasetLineageId: string;
  purpose: string;
  useScope: "internal_evaluation_only";
  members: Array<{
    candidateId: string;
    candidateDigest: string;
    canonicalSha256: string;
    canonicalObjectRelativePath: string;
    g4GradeRecordDigest: string;
    g4StatusHeadDigest: string;
    promotionSourceSnapshotDigest: string;
    promotionEvidenceBundleDigest: string;
    leakageReviewDigest: string;
    claimValuesDigest: string;
    splitCouplingKeysDigest: string;
  }>;
  labelSchema: {
    purpose: string;
    claimAxes: string[];
    excludedClaims: string[];
    labelSchemaDigest: string;
  };
  priorExposureRegistryDigest: string;
  sourcePolicy: {
    id: "bejewely-dataset-source-policy-v1";
    version: "1.0.0";
    digest: string;
  };
  capturedAt: string;
  sourceSnapshotDigest: string;
};
```

### Source snapshot identity

identity에 포함:

- exact member set와 정렬 순서
- current G4 status heads
- canonical SHA와 source/evidence/leakage digests
- label schema
- prior exposure registry digest
- source policy

identity에서 제외:

- `capturedAt`
- local absolute path
- output directory
- operator workstation identity

### 정렬

members는 다음 순서로 canonicalize한다.

```text
claimValuesDigest
→ canonicalSha256
→ candidateId
→ g4GradeRecordDigest
```

---

## 7. Eligibility pool과 quarantine

T9 v1의 dataset member는 active G4만 허용한다.

다음은 dataset member가 아니다.

- G3 negative control
- promotion held/rejected
- revoked/superseded G4
- valid-ineligible observation
- incomplete consensus/alignment
- unresolved perceptual neighbor
- unresolved rights/mark review
- incompatible purpose/claim schema

이 객체들은 삭제하지 않으며 다음처럼 별도 reason으로 source preflight에 남긴다.

```ts
type DatasetSourceExclusionV1 = {
  candidateId: string;
  sourceArtifactDigest: string;
  disposition: "excluded" | "quarantined";
  reasonCode: string;
};
```

quarantine은 split이 아니다. train/test/holdout denominator에 포함되지 않는다.

---

## 8. Leakage graph

### 8.1 node

```ts
type LeakageNodeV1 = {
  nodeId: string;
  candidateId: string;
  g4GradeRecordDigest: string;
  canonicalSha256: string;
  claimValuesDigest: string;
};
```

### 8.2 edge

```ts
type LeakageEdgeV1 = {
  edgeId: string;
  leftNodeId: string;
  rightNodeId: string;
  couplingKind:
    | "canonical_sha256"
    | "campaign_series"
    | "reference_lineage"
    | "paired_edit_lineage"
    | "reviewed_visual_similarity"
    | "active_representative_alias";
  couplingKeyDigest: string;
  sourceArtifactDigest: string;
};
```

### 8.3 graph

```ts
type LeakageGraphV1 = {
  schemaVersion: "leakage-graph-v1";
  sourceSnapshotDigest: string;
  nodes: LeakageNodeV1[];
  edges: LeakageEdgeV1[];
  components: Array<{
    componentId: string;
    nodeIds: string[];
    candidateIds: string[];
    couplingKinds: string[];
    componentDigest: string;
  }>;
  graphPolicy: {
    id: "bejewely-leakage-graph-policy-v1";
    version: "1.0.0";
    digest: string;
  };
  graphDigest: string;
};
```

### 8.4 component 계산

- undirected graph
- transitive closure 적용
- union-find 또는 동등한 deterministic algorithm 허용
- node/edge/component 정렬 고정
- self-edge 제거
- duplicate edge canonicalization
- unknown coupling kind fail-closed

### 8.5 금지

- unreviewed dHash threshold로 edge 자동 생성
- face identity 추론
- 같은 condition이라는 이유만으로 무조건 coupling
- 같은 Provider라는 이유만으로 무조건 coupling
- graph 결과를 label confidence로 사용

---

## 9. Exposure registry

split leakage는 현재 version 안에서만이 아니라 version 간에도 관리해야 한다.

```ts
type DatasetExposureClaimV1 = {
  schemaVersion: "dataset-exposure-claim-v1";
  datasetLineageId: string;
  componentFingerprint: string;
  datasetVersionDigest: string;
  assignedSplit: "train" | "development" | "validation" | "test" | "holdout";
  exposureClass:
    | "optimization_exposed"
    | "development_exposed"
    | "model_selection_exposed"
    | "release_test_exposed"
    | "sealed_holdout";
  firstExposedAt: string;
  claimDigest: string;
};
```

### Exposure order

엄격도는 다음 순서다.

```text
holdout
> test
> validation
> development
> train
```

이미 낮은 엄격도에 노출된 component를 더 높은 엄격도로 이동할 수 없다.

예:

- train → holdout: 금지
- development → test: 금지
- validation → holdout: 금지
- holdout → train: active lineage에서는 금지

### Sticky split

동일 `componentFingerprint`가 prior active dataset version에 존재하면 exact split을 상속한다.

새 graph edge가 prior component 둘을 합치고 split이 서로 다르면 자동 해결하지 않는다.

```text
cross_split_leakage_conflict
```

으로 실패한다.

---

## 10. Split plan

```ts
type DatasetSplitPlanV1 = {
  schemaVersion: "dataset-split-plan-v1";
  datasetId: string;
  datasetLineageId: string;
  sourceSnapshotDigest: string;
  leakageGraphDigest: string;
  splits: ["train", "development", "validation", "test", "holdout"];
  targets: {
    train: number;
    development: number;
    validation: number;
    test: number;
    holdout: number;
  };
  minimumComponents: {
    validation: number;
    test: number;
    holdout: number;
  };
  balancePolicy: {
    axis: "claim_values_digest";
    hardMinimumPerLabel: number;
    allowedAbsoluteDeviation: number;
  };
  assignmentPolicy: {
    id: "bejewely-component-split-policy-v1";
    version: "1.0.0";
    callerSeedAllowed: false;
    splitOrder: ["holdout", "test", "validation", "development", "train"];
    digest: string;
  };
  authoredBy: string;
  authoredAt: string;
  planDigest: string;
};
```

규칙:

- target 합계는 source member 수와 일치해야 한다.
- split 하나에 동일 member를 중복 집계하지 않는다.
- holdout/test minimum component 수를 충족해야 한다.
- exact quota 또는 허용 deviation 안에서 component-level assignment가 가능해야 한다.
- caller-provided random seed 금지.
- plan은 source snapshot과 graph digest에 고정된다.

---

## 11. Deterministic assignment

### 11.1 assignment entropy

```text
assignmentEntropy = SHA-256(
  "bejewely-t9-assignment-v1"
  + sourceSnapshotDigest
  + leakageGraphDigest
  + splitPlanDigest
)
```

### 11.2 hard constraints

1. component는 하나의 split에만 배치
2. prior sticky split 준수
3. exposure monotonicity 준수
4. holdout/test minimum component 수 준수
5. label hard minimum 준수
6. member 누락/중복 금지
7. component 분리 금지

### 11.3 optimization objective

여러 해가 존재하면 다음 lexicographic objective를 사용한다.

1. hard constraint violation 0
2. target count 총 absolute deviation 최소
3. label별 absolute deviation 최소
4. split별 component count imbalance 최소
5. `SHA-256(assignmentEntropy + componentDigest + split)` 사전순 tie-break

구현은 deterministic exact search 또는 결과가 동일한 검증 가능한 solver를 사용해야 한다.

### 11.4 infeasible

다음 경우 lock하지 않는다.

- component 하나가 허용 가능한 split capacity보다 큼
- sticky split이 target/minimum과 충돌
- prior exposure가 evaluation split을 막음
- label minimum 충족 불가
- cross-split merged component 발생

결과는 `DatasetSplitFeasibilityV1`로만 반환하며 persistent dataset version을 만들지 않는다.

---

## 12. Split semantics

### train

- optimization에 사용 가능
- holdout/test보다 낮은 접근 제한
- 이후 stricter split 승격 금지

### development

- exploratory tuning과 error analysis
- optimization family로 취급
- 이후 validation/test/holdout 승격 금지

### validation

- model selection과 threshold selection
- validation 결과를 본 뒤 holdout로 이동 금지

### test

- controlled release gate 평가
- 반복 tuning 입력으로 사용 금지
- holdout 승격 금지

### holdout

- sealed longitudinal/regression evaluation
- 기본 export에서 숨김
- 명시적 materialization과 review 필요
- holdout member만 G5 대상

---

## 13. Human dataset-lock review

자동 assignment가 성공해도 즉시 lock하지 않는다.

```ts
type DatasetLockReviewSubmissionV1 = {
  schemaVersion: "dataset-lock-review-submission-v1";
  sourceSnapshotDigest: string;
  leakageGraphDigest: string;
  splitPlanDigest: string;
  assignmentDigest: string;
  reviewer: {
    reviewerId: string;
    role: "dataset_lock_reviewer";
    roleSeparationAttested: true;
  };
  confirmations: {
    currentG4StatusReviewed: true;
    leakageComponentsReviewed: true;
    priorExposureReviewed: true;
    splitFeasibilityReviewed: true;
    holdoutIsolationReviewed: true;
    labelSchemaReviewed: true;
  };
  decision: "approve_lock" | "reject_lock";
  reasonCodes: string[];
  completedAt: string;
  submissionDigest: string;
};
```

reviewer는 최소한 다음을 확인한다.

- active G4 pool이 의도한 purpose와 일치
- unresolved coupling이 없음
- component가 split을 가로지르지 않음
- prior exposure conflict 없음
- holdout가 default export에서 제외됨
- exact member/label count가 plan과 일치

T9는 confirmation을 자동으로 `true`로 채우지 않는다.

---

## 14. Dataset split assignment

```ts
type DatasetSplitAssignmentV1 = {
  schemaVersion: "dataset-split-assignment-v1";
  sourceSnapshotDigest: string;
  leakageGraphDigest: string;
  splitPlanDigest: string;
  assignmentEntropyDigest: string;
  componentAssignments: Array<{
    componentId: string;
    componentDigest: string;
    assignedSplit: "train" | "development" | "validation" | "test" | "holdout";
    inheritedFromExposureClaimDigest: string | null;
  }>;
  achievedCounts: {
    train: number;
    development: number;
    validation: number;
    test: number;
    holdout: number;
  };
  deviations: {
    totalAbsoluteDeviation: number;
    perSplit: Record<string, number>;
    perLabel: Record<string, number>;
  };
  assignmentPolicyDigest: string;
  assignedAt: string;
  assignmentDigest: string;
};
```

`assignedAt`은 semantic identity에서 제외한다.

---

## 15. Dataset version manifest

```ts
type DatasetVersionManifestV1 = {
  schemaVersion: "dataset-version-manifest-v1";
  datasetId: string;
  datasetLineageId: string;
  datasetVersionId: string;
  predecessorDatasetVersionDigest: string | null;
  sourceSnapshotDigest: string;
  leakageGraphDigest: string;
  splitPlanDigest: string;
  assignmentDigest: string;
  lockReviewDigest: string;
  labelSchemaDigest: string;
  memberIndexDigest: string;
  exposureRegistryHeadDigest: string;
  g5IndexDigest: string;
  status: "locked";
  lockedAt: string;
  datasetVersionDigest: string;
};
```

### Member index

각 member는 다음을 가진다.

```ts
type DatasetMemberRecordV1 = {
  schemaVersion: "dataset-member-record-v1";
  datasetVersionDigest: string;
  candidateId: string;
  g4GradeRecordDigest: string;
  g4StatusHeadDigest: string;
  componentDigest: string;
  split: "train" | "development" | "validation" | "test" | "holdout";
  claimValuesDigest: string;
  canonicalSha256: string;
  memberDigest: string;
};
```

### Lock semantics

- manifest 발행 후 member/split/label 수정 금지
- 새 source 또는 policy는 새 version
- same source/plan/review는 idempotent existing version 반환
- 동일 predecessor는 동일 lineage에서 successor 하나만 허용
- branch가 필요하면 새 `datasetLineageId` 사용

---

## 16. G5 semantics

v1의 유일한 G5 grade는 다음이다.

```text
G5_LEAKAGE_LOCKED_HOLDOUT
```

```ts
type G5HoldoutRecordV1 = {
  schemaVersion: "g5-holdout-record-v1";
  gradeRecordId: string;
  candidateId: string;
  grade: "G5_LEAKAGE_LOCKED_HOLDOUT";
  sourceG4GradeRecordDigest: string;
  sourceG4StatusHeadDigest: string;
  datasetVersionDigest: string;
  datasetMemberDigest: string;
  leakageComponentDigest: string;
  split: "holdout";
  labelSchemaDigest: string;
  exposureClaimDigest: string;
  policy: {
    id: "bejewely-g5-holdout-policy-v1";
    version: "1.0.0";
    digest: string;
  };
  recordedAt: string;
  gradeRecordDigest: string;
};
```

### G5 생성 조건

- source G4 current active
- dataset version locked
- member split = holdout
- component 전체가 holdout
- prior non-holdout exposure 없음
- lock review approved
- holdout policy valid

### G5가 의미하지 않는 것

- 더 정확한 label
- 실제 사람 대표성
- clinical validity
- production readiness
- model 성능 보장
- public release 승인

---

## 17. Append-only status와 lineage

### Dataset status event

```ts
type DatasetVersionStatusEventV1 = {
  schemaVersion: "dataset-version-status-event-v1";
  datasetVersionDigest: string;
  event: "activated" | "retired" | "invalidated" | "superseded";
  reasonCodes: string[];
  predecessorEventDigest: string | null;
  recordedAt: string;
  eventDigest: string;
};
```

### G5 status event

```ts
type G5StatusEventV1 = {
  schemaVersion: "g5-status-event-v1";
  g5GradeRecordDigest: string;
  event: "activated" | "revoked" | "superseded";
  reasonCodes: string[];
  predecessorEventDigest: string | null;
  recordedAt: string;
  eventDigest: string;
};
```

### invalidation triggers

- source G4 revoked/superseded
- canonical asset integrity failure
- new cross-split leakage edge
- prior exposure conflict 발견
- label schema conflict
- rights/mark/provenance revocation
- dataset manifest/member/index integrity failure

historical artifact는 삭제하지 않는다.

---

## 18. Holdout materialization boundary

### 기본 동작

- dataset manifest에는 holdout count와 digest만 공개 가능
- 일반 member export는 holdout member rows를 제외
- 일반 review package는 holdout asset path를 포함하지 않음

### 명시적 materialization

```ts
type HoldoutMaterializationRequestV1 = {
  schemaVersion: "holdout-materialization-request-v1";
  datasetVersionDigest: string;
  requestedBy: string;
  purpose: "regression_evaluation" | "integrity_review";
  authorizationDigest: string;
  requestedAt: string;
};
```

materialization은 다음만 만든다.

- holdout-scoped member manifest
- existing canonical asset relative references
- no image copy by default
- no base64
- no public URL
- no training export

v1은 암호화된 secret store를 제공하지 않는다. 보안 경계는 local storage, 별도 manifest, explicit authorization이다.

---

## 19. Regression baseline activation

T9는 model을 실행하지 않는다. baseline activation은 외부에서 생성된 검증 가능한 evaluation result package를 잠그는 행위다.

```ts
type RegressionBaselineRequestV1 = {
  schemaVersion: "regression-baseline-request-v1";
  datasetVersionDigest: string;
  holdoutG5IndexDigest: string;
  modelArtifactDigest: string;
  evaluationHarness: {
    id: string;
    version: string;
    digest: string;
  };
  metricContract: {
    id: string;
    version: string;
    digest: string;
  };
  resultPackageDigest: string;
  reviewerId: string;
  reviewedAt: string;
};
```

```ts
type RegressionBaselineV1 = {
  schemaVersion: "regression-baseline-v1";
  datasetVersionDigest: string;
  holdoutG5IndexDigest: string;
  modelArtifactDigest: string;
  evaluationHarnessDigest: string;
  metricContractDigest: string;
  resultPackageDigest: string;
  activatedByReviewDigest: string;
  activatedAt: string;
  baselineDigest: string;
};
```

### baseline activation 조건

- dataset version current active
- 모든 holdout G5 current active
- holdout materialization authorization valid
- result package integrity valid
- exact member count와 result row count 일치
- metric contract에 unsupported aggregate/clinical/identity claim 없음
- reviewer explicit approval

### baseline invalidation

- dataset version invalidated/retired
- holdout G5 revoked
- model artifact/result integrity failure
- evaluation harness/metric contract mismatch
- cross-split leakage conflict

baseline 변경은 새 artifact로 발행한다.

---

## 20. Transaction과 idempotency

### Dataset lock write order

```text
source snapshot object
→ leakage graph object
→ split plan object
→ feasibility object
→ assignment object
→ lock review object
→ member objects
→ exposure claims
→ G5 objects
→ member/G5 indexes
→ dataset version manifest last
→ dataset status activation event last
```

manifest가 commit point다.

### 실패 허용 범위

중간 실패는 orphan immutable object를 남길 수 있다. 다음 retry는 digest를 검증하고 재사용한다.

### hidden retry 금지

- 동일 source/plan/review에서 다른 assignment 생성 금지
- orphan claim이 있으면 새 결과로 덮어쓰지 않음
- existing manifest는 전체 member/index/G5/status를 재검증한 뒤 `existing_dataset_version` 반환

### Baseline write order

```text
verified result package reference
→ baseline review object
→ baseline object
→ baseline activation event last
```

---

## 21. Failure taxonomy

### Source failures

```text
dataset_source_not_ready
g4_inactive
g4_status_drift
source_integrity_invalid
label_schema_incompatible
leakage_review_unresolved
```

### Graph failures

```text
leakage_key_invalid
leakage_edge_source_missing
component_integrity_invalid
cross_split_leakage_conflict
```

### Assignment failures

```text
split_plan_invalid
split_target_mismatch
split_infeasible
sticky_split_conflict
exposure_monotonicity_violation
holdout_minimum_unmet
label_minimum_unmet
```

### Lock failures

```text
lock_review_missing
lock_review_rejected
member_index_conflict
g5_creation_not_allowed
dataset_manifest_conflict
incomplete_dataset_version
```

### Baseline failures

```text
baseline_source_inactive
holdout_authorization_missing
result_package_invalid
result_member_count_mismatch
metric_contract_invalid
baseline_review_missing
```

---

## 22. CLI 설계

### Source preflight

```bash
npm run synthetic:dataset -- \
  --request .synthetic-local/requests/dataset-source-0001.json \
  --source-preflight
```

- writes 0
- current T6 status와 source evidence 검증
- eligible/excluded/quarantined count 반환

### Graph와 feasibility

```bash
npm run synthetic:dataset -- \
  --request .synthetic-local/requests/dataset-lock-0001.json \
  --simulate
```

- persistent dataset writes 0
- graph/component/assignment feasibility 계산
- exact target/deviation/conflict 반환

### Lock

```bash
npm run synthetic:dataset -- \
  --request .synthetic-local/requests/dataset-lock-0001.json \
  --review .synthetic-local/requests/dataset-lock-review-0001.json \
  --lock
```

- explicit human review 필수
- member/exposure/G5 objects 작성
- manifest-last publication

### Verify

```bash
npm run synthetic:dataset -- \
  --dataset <dataset-version-digest> \
  --verify-current
```

- current G4/G5/status 재검증
- writes 0

### Holdout materialization

```bash
npm run synthetic:dataset -- \
  --dataset <dataset-version-digest> \
  --holdout-request .synthetic-local/requests/holdout-materialization-0001.json \
  --materialize-holdout
```

### Baseline

```bash
npm run synthetic:baseline -- \
  --request .synthetic-local/requests/regression-baseline-0001.json \
  --preflight

npm run synthetic:baseline -- \
  --request .synthetic-local/requests/regression-baseline-0001.json \
  --review .synthetic-local/requests/regression-baseline-review-0001.json \
  --activate
```

명령 이름은 구현 단계에서 package script와 충돌 여부를 확인해 확정한다.

---

## 23. Storage layout

```text
.synthetic-local/
├─ objects/
│  ├─ dataset-source-snapshots/sha256/<prefix>/<digest>.json
│  ├─ leakage-graphs/sha256/<prefix>/<digest>.json
│  ├─ split-plans/sha256/<prefix>/<digest>.json
│  ├─ split-assignments/sha256/<prefix>/<digest>.json
│  ├─ dataset-lock-reviews/sha256/<prefix>/<digest>.json
│  ├─ dataset-members/sha256/<prefix>/<digest>.json
│  ├─ exposure-claims/sha256/<prefix>/<digest>.json
│  ├─ g5-holdout-records/sha256/<prefix>/<digest>.json
│  ├─ dataset-version-manifests/sha256/<prefix>/<digest>.json
│  └─ regression-baselines/sha256/<prefix>/<digest>.json
├─ datasets/<datasetLineageId>/<datasetVersionId>/
│  ├─ manifest.json
│  ├─ status-head.json
│  ├─ member-index.json
│  ├─ g5-index.json
│  └─ public-split-summary.json
├─ holdout/<datasetVersionDigest>/
│  └─ materialization-manifest.json
└─ requests/
```

규칙:

- absolute path 금지
- symlink root/nested component 금지
- canonical image copy 기본 금지
- object reference는 safe relative path만 허용
- secret/API key/session/browser state 저장 금지

---

## 24. Privacy와 안전 경계

T9는 다음을 추론하거나 저장하지 않는다.

- 실제 사람 identity
- same-person verification
- race/ethnicity/nationality
- health/clinical diagnosis
- attractiveness/personality/physiognomy
- Provider account/session metadata
- raw model response

leakage component는 평가 누수 방지용 관계다. 생물학적 또는 개인 동일성 주장이 아니다.

---

## 25. 구현 게이트

### Gate 1. Exact contracts

- source request/snapshot
- leakage graph
- exposure claim
- split plan/feasibility/assignment
- lock review
- member/version manifest
- G5/status
- baseline request/object

### Gate 2. Current T6 resolver

- complete grade/status chain 검증
- revoked/superseded detection
- canonical asset/evidence revalidation

### Gate 3. Leakage graph builder

- exact canonical, campaign, lineage, reviewed similarity edge
- deterministic connected components
- no automatic identity inference

### Gate 4. Exposure registry

- sticky exact split
- monotonicity
- cross-version merged-component conflict

### Gate 5. Deterministic split solver

- hard constraints
- exact objective/tie-break
- infeasible reason
- no component break

### Gate 6. Human lock review

- no auto-approved confirmation
- role and artifact binding

### Gate 7. Immutable registrar

- content-addressed objects
- manifest-last
- idempotent retry
- one successor per lineage predecessor

### Gate 8. G5 and status chain

- holdout only
- active G4 only
- append-only revoke/supersede

### Gate 9. Holdout access boundary

- default export omission
- explicit materialization
- no image copy/public URL

### Gate 10. Baseline activation

- no model execution
- external result package verification
- dataset/G5 current-status binding

### Gate 11. Architecture guard and tests

- production import prohibition
- no DB/browser/Provider/shell/model execution
- full Node 20/24 tests
- production build

실제 dataset lock, G5 생성, holdout materialization, baseline activation은 Gate 1–11 통과 후 별도 승인 대상이다.

---

## 26. 필수 테스트 시나리오

1. revoked G4는 source pool에 들어가지 않는다.
2. T8 closeout count가 최신이어도 T6 current status가 inactive면 제외한다.
3. canonical SHA 공유 candidate는 같은 component다.
4. transitive edge A–B, B–C는 하나의 component다.
5. unreviewed perceptual neighbor는 자동 edge가 아니다.
6. 하나의 component를 quota 때문에 분리할 수 없다.
7. 동일 source/plan은 동일 assignment digest를 만든다.
8. caller seed field는 contract에서 거부한다.
9. train exposure component를 holdout로 승격할 수 없다.
10. prior train/holdout component가 새 edge로 연결되면 conflict다.
11. holdout member만 G5를 받을 수 있다.
12. G5는 G4 claim values를 변경하지 않는다.
13. default export에 holdout ID/path/image가 없다.
14. dataset manifest는 member/index/G5 이후 마지막에 발행된다.
15. orphan object retry가 다른 assignment를 만들지 않는다.
16. source G4 revoke 후 `verify-current`가 실패한다.
17. active dataset invalidation은 historical manifest를 삭제하지 않는다.
18. baseline은 inactive dataset/G5에서 활성화되지 않는다.
19. baseline model/result 변경이 dataset version digest를 바꾸지 않는다.
20. production application은 T9 runtime을 import하지 않는다.

---

## 27. 자체 리뷰 후 수정

초기 설계 후 다음을 보강했다.

1. G5를 상위 품질 등급이 아닌 `G5_LEAKAGE_LOCKED_HOLDOUT` usage lock으로 제한했다.
2. T7/T8 closeout G4를 신뢰하지 않고 current T6 status를 재검증하도록 고정했다.
3. 현재 version 내부 component split뿐 아니라 version 간 exposure registry와 sticky split을 추가했다.
4. 새 leakage edge가 train/holdout을 연결하는 retroactive conflict 처리와 dataset/baseline invalidation을 추가했다.
5. exact quota를 맞추기 위해 component를 쪼개는 경로를 금지했다.
6. caller seed를 제거하고 source/graph/plan digest 기반 deterministic entropy를 사용했다.
7. dataset version, G5, regression baseline identity를 분리했다.
8. default export에서 holdout 식별자와 asset reference를 제외했다.
9. baseline activation이 model 실행을 의미하지 않도록 외부 result package lock으로 한정했다.
10. source exclusions와 quarantine을 split denominator에서 분리했다.

---

## 28. 설계 완료 기준

- current active G4 authority 정의
- source snapshot과 label schema freeze 정의
- leakage edge/component 계약 정의
- exposure monotonicity와 sticky split 정의
- deterministic component-level assignment 정의
- infeasible/cross-split conflict 정의
- human lock review 정의
- immutable dataset version과 append-only status 정의
- G5 holdout semantics 정의
- holdout access isolation 정의
- regression baseline activation 경계 정의
- implementation gate와 test matrix 정의
- production/model/network/public-publish 경계 정의

이번 문서는 구현, 실제 split, G5 생성, holdout lock, baseline activation을 수행하지 않는다.
