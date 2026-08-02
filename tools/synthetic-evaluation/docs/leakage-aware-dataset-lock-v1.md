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
- 실제 training / inference / benchmark execution: 0
- production route/UI/DB/Auth/Payment 변경: 0

`#T9`는 Toolkit 내부 작업 식별자이며 GitHub 실제 PR 번호가 아니다.

Normative ADR:

- ADR 0023: current G4 authority
- ADR 0024: leakage components and exposure monotonicity
- ADR 0025: deterministic split and immutable versions
- ADR 0026: G5/holdout/baseline boundary
- ADR 0027: source universe, lock basis, two-stage activation

ADR 0027은 초기 자체 리뷰에서 발견한 candidate-level source cherry-picking과 content-addressed identity cycle을 해결한 최종 publication ordering이다.

---

## 1. 목적

#T9는 현재 유효한 T6 G4 근거를 다시 검증하고, leakage coupling과 prior exposure를 보존한 채 dataset split과 holdout을 불변 객체로 잠근다.

```text
current active T6 G4 records
+ canonical assets
+ verified leakage coupling inputs
+ prior exposure history
→ dataset source snapshot
→ leakage graph / connected components
→ deterministic component-level split assignment
→ explicit human lock review
→ immutable locked dataset version
→ exposure claims / holdout G5
→ activation manifest
→ optional regression baseline activation
```

#T9는 다음을 새로 수행하지 않는다.

```text
image observation
blind judgment
intent alignment
G4 promotion
model training
model inference
benchmark score generation
public dataset publication
```

권위는 다음과 같이 유지한다.

- T2: generation intent / prompt
- T3: candidate provenance / canonical asset
- T4: observed image facts
- T5: blind consensus / alignment / G2 / G3
- T6: active G4 / leakage review / promotion status
- T7: campaign slots / source freeze / closeout
- T8: descriptive report / internal export
- T9: current-status revalidation / split / G5 / dataset lock / baseline lock

---

## 2. T9가 답하는 질문

첫 T9 dataset lock은 다음 질문에만 답한다.

> 현재 active 상태인 purpose-compatible G4 후보들을 어떤 leakage component로 묶어야 하며, prior exposure와 고정 split policy를 위반하지 않고 train/development/validation/test/holdout에 배치할 수 있는가?

holdout이 잠기면 다음을 답할 수 있다.

> 어떤 정확한 dataset version과 leakage component 집합이 holdout으로 잠겼고, 그 잠금은 어떤 current G4 status와 policy에 근거하는가?

다음은 답하지 않는다.

- 어떤 모델이 더 우수한가
- holdout 차이가 통계적으로 유의한가
- synthetic sample이 실제 인구집단을 대표하는가
- 이미지가 동일 인물인지 여부
- G5가 G4보다 label 품질이 더 높다는 의미
- dataset의 production/legal readiness

---

## 3. 독립 리뷰에서 고정한 핵심 위험

### R-01. T7/T8의 G4는 historical snapshot이다

T7 closeout과 T8 report의 G4는 `as-of-closeout`이다. T9는 각 T6 G4 status chain을 다시 읽고 current `activated` 상태만 허용한다.

### R-02. candidate-level split은 leakage를 만든다

split unit은 candidate가 아니라 leakage graph connected component다.

### R-03. exact duplicate만으로는 부족하다

canonical SHA, campaign series, reference/edit lineage, reviewed visual similarity, representative/alias 관계를 함께 묶는다.

### R-04. quota를 위해 component를 쪼갤 수 없다

split target이 infeasible하면 lock하지 않는다.

### R-05. caller seed는 holdout grinding을 허용한다

assignment entropy는 source/graph/plan digest에서 결정적으로 유도한다.

### R-06. prior exposure는 되돌릴 수 없다

train/development/validation/test에 노출된 component를 더 엄격한 split로 이동하지 않는다.

### R-07. retroactive edge는 기존 dataset을 무효화할 수 있다

서로 다른 prior split을 새 edge가 연결하면 `cross_split_leakage_conflict`다. 자동 재배치하지 않는다.

### R-08. G5를 품질 승급으로 오해할 수 있다

v1 G5는 `G5_LEAKAGE_LOCKED_HOLDOUT` usage lock만 허용한다.

### R-09. source allowlist는 cherry-picking을 허용한다

v1 source request는 arbitrary candidate/G4 allowlist를 받지 않는다. closed-run universe 전체의 current active G4를 검토한다.

### R-10. pre-manifest object가 future dataset digest를 참조하면 identity cycle이 생긴다

member/index → lock basis → locked version → exposure/G5 → activation manifest 순서로 분리한다.

---

## 4. 절대 불변식

1. current T6 status 검증 전에는 source eligibility가 없다.
2. T9는 G4 purpose, claim axes, claim values, excluded claims를 변경하지 않는다.
3. one component는 one split만 가진다.
4. quota를 위해 component를 분리하지 않는다.
5. unreviewed dHash/embedding distance는 authoritative edge가 아니다.
6. prior exposure는 append-only다.
7. 더 느슨한 split에 노출된 component를 더 엄격한 split로 승격하지 않는다.
8. holdout identity/path/image는 default export에 포함하지 않는다.
9. G5는 usage lock이며 label quality가 아니다.
10. dataset version은 immutable하다.
11. status change는 append-only event다.
12. 동일 source/graph/plan/review는 동일 lock identity를 만든다.
13. T2–T8 artifact를 수정하지 않는다.
14. T9 v1은 model execution을 수행하지 않는다.
15. production application은 T9 runtime에 의존하지 않는다.

---

## 5. Source universe

```ts
type DatasetSourceRequestV1 = {
  schemaVersion: "dataset-source-request-v1";
  datasetId: string;
  datasetLineageId: string;
  purpose: string;
  useScope: "internal_evaluation_only";
  sourceUniverse:
    | {
        selectionMode: "single_closed_run";
        campaignRunId: string;
        includeAllCurrentActiveG4: true;
      }
    | {
        selectionMode: "all_closed_runs_in_comparison_group_as_of_cutoff";
        comparisonGroupId: string;
        cutoffAt: string;
        includeAllCurrentActiveG4: true;
      };
  requestedAt: string;
};
```

### Source selection 규칙

- arbitrary candidate/G4 digest list 금지
- single-run mode는 해당 closed run의 모든 current active purpose-compatible G4를 검토
- comparison-group mode는 cutoff 이전 locally stored closed run 전체 포함 여부 검증
- invalid/inactive/incompatible record는 explicit exclusion/quarantine으로 기록
- caller가 성공 sample만 고르는 경로 금지

---

## 6. Current G4 readiness

각 source G4는 다음을 모두 만족해야 한다.

- T6 grade record integrity valid
- `grade = G4_SYNTHETIC_GOLD`
- complete T6 status chain valid
- current state = active
- promotion source/evidence/review chain valid
- T3 candidate manifest and canonical SHA valid
- canonical image bytes SHA-256 match
- referenced T4/T5 relation valid
- purpose/use scope match
- label schema compatible
- leakage review complete
- unresolved rights/mark/duplicate/perceptual/policy hold 없음

Fail-closed reasons:

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

## 7. Dataset source snapshot

```ts
type DatasetSourceSnapshotV1 = {
  schemaVersion: "dataset-source-snapshot-v1";
  datasetId: string;
  datasetLineageId: string;
  purpose: string;
  useScope: "internal_evaluation_only";
  sourceUniverseDigest: string;
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
  exclusions: Array<{
    candidateId: string;
    sourceArtifactDigest: string;
    disposition: "excluded" | "quarantined";
    reasonCode: string;
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

Identity includes exact member/exclusion sets, current G4 heads, source/evidence/leakage digests, label schema, prior exposure head, policy.

`capturedAt`, absolute path, output directory, workstation identity는 identity에서 제외한다.

---

## 8. Leakage graph

### Node

```ts
type LeakageNodeV1 = {
  nodeId: string;
  candidateId: string;
  g4GradeRecordDigest: string;
  canonicalSha256: string;
  claimValuesDigest: string;
};
```

### Edge

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

### Graph

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
  graphPolicyDigest: string;
  graphDigest: string;
};
```

규칙:

- undirected transitive closure
- deterministic node/edge/component sort
- duplicate/self edge canonicalization
- unknown coupling kind fail-closed
- unreviewed similarity는 diagnostic only
- coupling은 identity claim이 아님

---

## 9. Exposure registry

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

엄격도:

```text
holdout > test > validation > development > train
```

동일 component fingerprint는 동일 lineage에서 exact split을 상속한다.

새 edge가 prior split이 다른 component를 합치면:

```text
cross_split_leakage_conflict
```

자동 해결하지 않는다.

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

- target 합계는 eligible member 수와 일치
- split 중복 없음
- evaluation split minimum component 수 명시
- plan은 exact source/graph에 고정
- caller seed 금지

---

## 11. Deterministic component assignment

```text
assignmentEntropy = SHA-256(
  "bejewely-t9-assignment-v1"
  + sourceSnapshotDigest
  + leakageGraphDigest
  + splitPlanDigest
)
```

Hard constraints:

1. one component, one split
2. sticky prior split
3. exposure monotonicity
4. validation/test/holdout minimum component 수
5. label hard minimum
6. member 누락/중복 0
7. component 분리 0

여러 feasible assignment가 있으면 다음 lexicographic objective를 사용한다.

1. target total absolute deviation 최소
2. per-label deviation 최소
3. split component-count imbalance 최소
4. hash-based canonical tie-break

infeasible하면 persistent dataset version을 만들지 않는다.

---

## 12. Split semantics

- `train`: optimization
- `development`: exploratory tuning/error analysis
- `validation`: model/threshold selection
- `test`: controlled release-gate evaluation
- `holdout`: sealed longitudinal/regression evaluation

train/development/validation/test에 노출된 component는 더 엄격한 split로 이동할 수 없다.

holdout은 default export에서 식별자와 asset reference를 숨긴다.

---

## 13. Split assignment artifact

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
  achievedCounts: Record<string, number>;
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

`assignedAt`은 semantic assignment identity에서 제외한다.

---

## 14. Human dataset-lock review

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
  reviewDecisionDigest: string;
  completedAt: string;
  submissionDigest: string;
};
```

- confirmations 자동 승인 금지
- `reviewDecisionDigest`는 semantic decision
- `submissionDigest`는 completedAt을 포함한 full immutable object

---

## 15. Member projection과 lock basis

Pre-manifest member object는 future dataset digest를 참조하지 않는다.

```ts
type DatasetMemberRecordV1 = {
  schemaVersion: "dataset-member-record-v1";
  sourceSnapshotDigest: string;
  assignmentDigest: string;
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

```ts
type DatasetLockBasisV1 = {
  schemaVersion: "dataset-lock-basis-v1";
  datasetId: string;
  datasetLineageId: string;
  predecessorDatasetVersionDigest: string | null;
  sourceSnapshotDigest: string;
  leakageGraphDigest: string;
  splitPlanDigest: string;
  assignmentDigest: string;
  lockReviewDecisionDigest: string;
  lockReviewSubmissionDigest: string;
  labelSchemaDigest: string;
  memberIndexDigest: string;
  lockPolicy: {
    id: "bejewely-dataset-lock-policy-v1";
    version: "1.0.0";
    digest: string;
  };
  lockBasisDigest: string;
};
```

`datasetVersionId`는 `lockBasisDigest`에서 결정적으로 유도한다.

---

## 16. Locked dataset version

```ts
type DatasetVersionManifestV1 = {
  schemaVersion: "dataset-version-manifest-v1";
  datasetId: string;
  datasetLineageId: string;
  datasetVersionId: string;
  predecessorDatasetVersionDigest: string | null;
  lockBasisDigest: string;
  sourceSnapshotDigest: string;
  leakageGraphDigest: string;
  splitPlanDigest: string;
  assignmentDigest: string;
  lockReviewDecisionDigest: string;
  lockReviewSubmissionDigest: string;
  labelSchemaDigest: string;
  memberIndexDigest: string;
  lockedAt: string;
  datasetVersionDigest: string;
};
```

이 manifest는 exact version이 locked되었다는 뜻이다. 아직 active dataset authority는 아니다.

동일 lineage에서 predecessor 하나는 immutable successor 하나만 허용한다. branch는 새 lineage ID를 요구한다.

---

## 17. Exposure와 G5

Locked version이 존재한 뒤 exposure claim과 G5가 final `datasetVersionDigest`를 참조한다.

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

G5 조건:

- source G4 current active
- member split = holdout
- component 전체 holdout
- prior non-holdout exposure 없음
- lock review approved
- G5 policy valid

G5는 더 높은 label quality를 의미하지 않는다.

---

## 18. Status events와 activation manifest

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

```ts
type DatasetActivationManifestV1 = {
  schemaVersion: "dataset-activation-manifest-v1";
  datasetVersionDigest: string;
  datasetStatusHeadDigest: string;
  exposureClaimIndexDigest: string;
  g5IndexDigest: string;
  g5StatusHeadIndexDigest: string;
  activationPolicyDigest: string;
  activatedAt: string;
  activationDigest: string;
};
```

Active authority 조건:

- locked version valid
- exposure/G5 objects valid
- initial status chains valid
- activation manifest valid and published last

locked version만 있고 activation manifest가 없으면:

```text
locked_incomplete
```

이다.

---

## 19. Invalidation

다음은 dataset/G5/baseline current authority를 append-only로 비활성화한다.

- source G4 revoked/superseded
- canonical asset integrity failure
- new cross-split leakage edge
- prior exposure conflict
- label schema conflict
- rights/mark/provenance revocation
- manifest/member/index integrity failure

historical objects는 삭제하지 않는다.

---

## 20. Holdout materialization

Default behavior:

- 일반 export에 holdout member ID/path/image 없음
- public split summary는 holdout count/digest만 포함 가능

명시적 request:

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

materialization은 existing canonical asset relative reference만 제공한다.

- image copy 기본 금지
- base64 금지
- public URL 금지
- training export 금지

v1은 cryptographic secret store를 제공한다고 주장하지 않는다.

---

## 21. Regression baseline

T9는 model을 실행하지 않는다. 외부 result package를 exact dataset/G5/model/harness/metric contract에 잠근다.

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

Activation 조건:

- dataset current active
- holdout G5 전부 current active
- holdout authorization valid
- result package integrity valid
- exact member/result row count 일치
- metric contract valid
- reviewer explicit approval

Dataset/G5 invalidation, cross-split conflict, model/result/harness/metric integrity failure는 baseline current authority를 비활성화한다.

---

## 22. Correct write order

```text
source snapshot
→ leakage graph
→ split plan / feasibility / assignment
→ full lock-review submission
→ member objects and member index
→ dataset lock basis
→ dataset version manifest
→ exposure claims and exposure index
→ G5 records and G5 index
→ dataset/G5 initial status events and status indexes
→ dataset activation manifest last
```

- dataset version manifest: locked version commit point
- activation manifest: active dataset authority commit point
- orphan immutable objects는 digest 검증 후 재사용 가능
- conflicting orphan claim은 alternate assignment/activation을 차단
- 같은 lock basis는 서로 다른 activation manifest를 만들 수 없음

---

## 23. CLI 설계

### Source preflight

```bash
npm run synthetic:dataset -- \
  --request .synthetic-local/requests/dataset-source-0001.json \
  --source-preflight
```

- writes 0
- current T6/source universe 검증

### Simulate

```bash
npm run synthetic:dataset -- \
  --request .synthetic-local/requests/dataset-lock-0001.json \
  --simulate
```

- persistent dataset writes 0
- graph/component/feasibility/assignment preview

### Lock and activate

```bash
npm run synthetic:dataset -- \
  --request .synthetic-local/requests/dataset-lock-0001.json \
  --review .synthetic-local/requests/dataset-lock-review-0001.json \
  --lock
```

- explicit human review
- two-stage locked version + activation manifest publication

### Verify current

```bash
npm run synthetic:dataset -- \
  --dataset <dataset-version-digest> \
  --verify-current
```

- writes 0
- T6/G5/dataset current status 재검증

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

Command names are finalized during implementation after package-script collision review.

---

## 24. Storage layout

```text
.synthetic-local/
├─ objects/
│  ├─ dataset-source-snapshots/sha256/<prefix>/<digest>.json
│  ├─ leakage-graphs/sha256/<prefix>/<digest>.json
│  ├─ split-plans/sha256/<prefix>/<digest>.json
│  ├─ split-assignments/sha256/<prefix>/<digest>.json
│  ├─ dataset-lock-reviews/sha256/<prefix>/<digest>.json
│  ├─ dataset-members/sha256/<prefix>/<digest>.json
│  ├─ dataset-lock-bases/sha256/<prefix>/<digest>.json
│  ├─ dataset-version-manifests/sha256/<prefix>/<digest>.json
│  ├─ exposure-claims/sha256/<prefix>/<digest>.json
│  ├─ g5-holdout-records/sha256/<prefix>/<digest>.json
│  ├─ dataset-activation-manifests/sha256/<prefix>/<digest>.json
│  └─ regression-baselines/sha256/<prefix>/<digest>.json
├─ datasets/<datasetLineageId>/<datasetVersionId>/
│  ├─ locked-manifest.json
│  ├─ activation-manifest.json
│  ├─ member-index.json
│  ├─ exposure-index.json
│  ├─ g5-index.json
│  └─ public-split-summary.json
├─ holdout/<datasetVersionDigest>/
│  └─ materialization-manifest.json
└─ requests/
```

- absolute path 금지
- symlink root/nested component 금지
- canonical image copy 기본 금지
- secret/API key/session/browser state 저장 금지

---

## 25. Failure taxonomy

Source:

```text
dataset_source_not_ready
g4_inactive
g4_status_drift
source_integrity_invalid
label_schema_incompatible
leakage_review_unresolved
source_universe_incomplete
```

Graph:

```text
leakage_key_invalid
leakage_edge_source_missing
component_integrity_invalid
cross_split_leakage_conflict
```

Assignment:

```text
split_plan_invalid
split_target_mismatch
split_infeasible
sticky_split_conflict
exposure_monotonicity_violation
holdout_minimum_unmet
label_minimum_unmet
```

Lock/activation:

```text
lock_review_missing
lock_review_rejected
member_index_conflict
dataset_manifest_conflict
locked_incomplete
g5_creation_not_allowed
activation_manifest_conflict
```

Baseline:

```text
baseline_source_inactive
holdout_authorization_missing
result_package_invalid
result_member_count_mismatch
metric_contract_invalid
baseline_review_missing
```

---

## 26. Privacy와 안전

T9는 다음을 추론하거나 저장하지 않는다.

- 실제 사람 identity
- same-person verification
- race/ethnicity/nationality
- health/clinical diagnosis
- attractiveness/personality/physiognomy
- Provider account/session metadata
- raw model response

leakage component는 split leakage 방지 관계이며 개인 동일성 주장이 아니다.

---

## 27. 구현 게이트

1. exact contracts
2. current T6 resolver
3. source-universe completeness verifier
4. deterministic leakage graph builder
5. exposure registry/sticky split resolver
6. deterministic constrained split solver
7. explicit human lock review
8. lock basis + two-stage registrar
9. G5/status/activation manifest
10. holdout access boundary
11. baseline activation boundary
12. architecture guard + Node 20/24 tests + production build

실제 split, dataset lock, G5, holdout materialization, baseline activation은 구현 검증 이후 별도 승인 대상이다.

---

## 28. 필수 테스트

1. revoked/superseded G4 제외
2. stale T7/T8 reference가 current T6를 override하지 못함
3. arbitrary candidate/G4 allowlist 거부
4. comparison-group cutoff 이전 closed run 누락 거부
5. canonical SHA 공유 candidate는 같은 component
6. transitive edge closure
7. unreviewed perceptual neighbor는 authoritative edge가 아님
8. quota를 위한 component split 금지
9. same source/graph/plan은 same assignment
10. caller seed field 거부
11. train exposure → holdout 승격 거부
12. prior cross-split components의 new edge conflict
13. pre-manifest member record가 future dataset digest를 참조하지 않음
14. lock basis/version identity cycle 없음
15. holdout member만 G5 가능
16. G5가 G4 label scope/value를 변경하지 않음
17. default export에 holdout identity/path/image 없음
18. locked manifest만으로 active authority가 생기지 않음
19. activation manifest가 최종 commit point
20. crash before activation은 `locked_incomplete`
21. source G4 revoke 후 current verification 실패
22. historical artifacts는 삭제되지 않음
23. inactive dataset/G5에서 baseline activation 거부
24. model/result change가 dataset version identity를 변경하지 않음
25. production application이 T9 runtime을 import하지 않음

---

## 29. 설계 완료 판정

- current G4 authority 정의 완료
- source-universe anti-cherry-picking 정의 완료
- leakage graph/component 계약 완료
- sticky split/exposure monotonicity 완료
- deterministic assignment/infeasible boundary 완료
- human lock review 완료
- acyclic lock basis와 two-stage activation 완료
- G5 holdout semantics 완료
- holdout isolation 완료
- regression baseline boundary 완료
- implementation gates/tests 완료

Status:

```text
READY_FOR_IMPLEMENTATION_REVIEW
```

이번 문서는 구현, 실제 split, G5 생성, holdout lock, baseline activation을 수행하지 않는다.
