# Synthetic Evaluation Toolkit #T8

# Review / Export / Report Design v1

## 0. 문서 상태

- Toolkit Track: `#T8`
- 작업 유형: 설계 전용
- 기준 브랜치: `feature/T7-pilot-campaign-runner`
- 기준 SHA: `408a7da1c4d155f239d566d6ba45c47a98f0efed`
- 구현 상태: 미구현
- 실제 campaign 실행: 0
- 실제 이미지 생성: 0
- 실제 Provider observation: 0
- 실제 human judgment / promotion review: 0
- 실제 G4/G5 생성: 0
- dataset split / holdout lock: 제외
- production route/UI/DB/Auth/Payment 변경: 0

`#T8`는 Toolkit 내부 작업 식별자이며 GitHub 실제 PR 번호가 아니다.

---

## 1. 목적

#T8는 종료된 T7 pilot campaign의 근거를 검증하고, 동일 근거에서 다음 산출물을 재현 가능하게 만든다.

```text
verified T7 closeout
+ T2–T6 referenced evidence
→ immutable report source snapshot
→ exact slot table
→ fixed-denominator summaries
→ review package / contact sheets
→ deterministic JSON / CSV export
→ human-readable report
```

#T8가 새로 관찰하거나 판정하는 것은 없다.

```text
report
≠ image observation
≠ blind judgment
≠ intent alignment
≠ promotion decision
≠ current G4 authority
≠ dataset split
≠ provider winner
```

권위는 다음과 같이 유지한다.

- 생성 의도와 prompt: T2
- candidate provenance와 canonical asset: T3
- observed image facts: T4
- blind consensus, alignment, G2/G3: T5
- purpose-scoped G4와 non-Gold disposition: T6
- campaign slot, budget, checkpoint, closeout: T7
- 검증된 표현, export, descriptive interpretation: T8
- leakage-aware split, G5, holdout, regression baseline: T9

---

## 2. 첫 T8 산출물의 질문

첫 T8 report는 다음 질문에만 답한다.

> 고정된 20-slot A/B/C/D pilot에서 각 slot이 어느 단계까지 도달했고, 어떤 terminal outcome으로 종료되었으며, 그 결과를 뒷받침하는 근거가 무엇인가?

추가로 별도 campaign run이 같은 comparison group에 속하고 엄격한 비교 가능성 검사를 통과하면 다음을 기술적으로 나란히 보여줄 수 있다.

> 두 generation provider run에서 단계별 도달 수와 terminal outcome 분포가 어떻게 달랐는가?

이 질문은 다음을 답하지 않는다.

- 어떤 Provider가 본질적으로 더 우수한가
- 20개 pilot이 모집단을 대표하는가
- 조건 간 차이가 통계적으로 유의한가
- 피부 cue가 건강, 질환, 민감성, 인종 또는 실제 신원을 의미하는가
- G4 수가 제품 품질이나 상용 정확도를 증명하는가
- 어떤 sample을 train/test/holdout에 넣어야 하는가

---

## 3. 설계 전 독립 리뷰

### R-01. T7 count를 그대로 신뢰하면 closeout 외부 변조를 놓칠 수 있다

조치:

- T8는 plan, run, slot, event ledger, projection, closeout을 모두 재검증한다.
- closeout의 `finalProjectionDigest`, event heads, checkpoint digests, G4/non-Gold/hold refs가 실제 저장 객체와 일치해야 한다.
- 보고용 count는 T7의 summary field를 복사하지 않고 검증된 slot evidence row에서 다시 계산한다.

### R-02. 성공한 후보만 export하면 denominator가 바뀐다

조치:

- primary denominator는 항상 plan의 20 slots다.
- no-asset, import failure, valid-ineligible, observation failure, judgment incomplete, hold, rejection, non-Gold를 모두 row로 보존한다.
- 필터링된 view는 허용하지만 primary denominator를 대체할 수 없다.

### R-03. report renderer가 upstream 판정을 재분류할 수 있다

조치:

- T8 outcome은 T7 terminal outcome을 그대로 사용한다.
- observation, consensus, alignment, promotion result를 재해석한 새 status를 만들지 않는다.
- T8가 추가할 수 있는 것은 report readiness, source integrity, display grouping, descriptive metric뿐이다.

### R-04. contact sheet가 evidence image를 변형할 수 있다

조치:

- canonical image는 읽기 전용이다.
- thumbnail은 별도 derived display object다.
- resize만 허용하며 crop, retouch, color correction, mark removal, face edit를 금지한다.
- thumbnail digest와 transform policy를 export manifest에 기록한다.

### R-05. generation intent와 outcome을 한 화면에 처음부터 노출하면 review bias가 커진다

조치:

- review package는 blind contact sheet와 annotated analytical sheet를 분리한다.
- blind sheet에는 slot/candidate identity와 image만 포함한다.
- annotated sheet에는 condition, stage, terminal outcome, warnings를 추가한다.
- blind sheet는 T5 판정을 대체하지 않으며 audit convenience만 제공한다.

### R-06. Provider 비교가 winner ranking으로 변질될 수 있다

조치:

- 비교 전 exact comparability gate를 통과해야 한다.
- side-by-side exact counts, fractions, percentage-point deltas만 허용한다.
- ranking, composite score, significance test, causal statement를 금지한다.

### R-07. closeout 당시 G4가 이후 revoke될 수 있다

조치:

- closeout G4는 항상 `as-of-closeout`으로 표시한다.
- 선택적 current-status appendix는 T6 status chain을 다시 읽어 별도 timestamp와 함께 제공한다.
- current-status appendix도 T9 권위가 아니며 T9는 다시 검증해야 한다.

### R-08. 자유 서술 report가 근거 없는 주장을 포함할 수 있다

조치:

- authoritative report narrative는 typed interpretation claim으로만 구성한다.
- 각 claim은 source metric ID 또는 slot ID를 참조해야 한다.
- causal, clinical, identity, population-generalization, provider-superiority claim type은 v1에서 존재하지 않는다.

### R-09. report 수정이 과거 report를 덮어쓰면 audit trail이 사라진다

조치:

- report와 export는 content-addressed immutable artifact다.
- 수정은 predecessor report digest를 가진 새 revision으로 발행한다.
- source snapshot이 달라지면 revision이 아니라 새 report lineage다.

---

## 4. 절대 불변식

### C-01. Source integrity before rendering

검증되지 않은 T7/T2–T6 artifact로 authoritative export/report를 만들지 않는다.

### C-02. Exact primary denominator

`plannedPrimarySlots = 20`을 primary denominator로 고정한다.

### C-03. No outcome rewriting

T8는 terminal outcome, observed value, consensus value, alignment verdict, promotion outcome을 변경하지 않는다.

### C-04. No hidden exclusions

모든 20 slots는 slot export에 정확히 한 번 나타난다.

### C-05. No aggregate quality score

단계별 실패를 상쇄하는 total score, quality index, provider score를 만들지 않는다.

### C-06. Descriptive only

v1 report는 기술통계와 직접 관찰 가능한 운영 패턴만 표현한다.

### C-07. Synthetic-only boundary

실제 사람 identity, demographic inference, clinical inference, same-person verification을 수행하지 않는다.

### C-08. Read-only upstream

T2–T7 object, manifest, event, decision, grade, status를 수정하지 않는다.

### C-09. No split fields

train, development, validation, test, holdout, fold, shard assignment 필드를 만들지 않는다.

### C-10. Deterministic export

동일 source snapshot, exporter version, rendering policy는 byte-identical JSON/CSV semantic output을 만든다.

### C-11. Internal review only

v1 export audience는 `internal_review`만 허용한다. 공개 배포 권한을 만들지 않는다.

### C-12. Production isolation

production application은 T8 runtime 또는 report artifact에 의존하지 않는다.

---

## 5. 입력 및 readiness

### 5.1 필수 입력

단일 run report는 다음 저장 객체를 요구한다.

```ts
type T8SingleRunInputV1 = {
  campaignPlanDigest: string;
  campaignRunId: string;
  finalProjectionDigest: string;
  closeoutDigest: string;
};
```

실제 값은 caller payload가 아니라 local content-addressed store에서 다시 읽는다.

### 5.2 authoritative report readiness

다음을 모두 만족해야 한다.

- T7 plan integrity valid
- T7 run integrity valid
- 정확히 20개의 valid immutable slot
- linear event ledger valid
- final projection integrity valid
- `runStatus = closed`
- `terminalSlots = 20`
- closeout integrity valid
- closeout와 projection/event heads 일치
- 참조된 T3–T6 artifact가 존재하고 자체 integrity valid
- canonical asset이 필요한 slot은 SHA-256 일치

실패 시:

```text
report_not_ready
source_artifact_missing
source_artifact_integrity_invalid
closeout_projection_mismatch
upstream_reference_conflict
```

중 하나로 fail-closed한다.

### 5.3 preview 금지

T8 v1은 active, paused, stopped-but-not-closed run의 authoritative report를 만들지 않는다.

중간 진행률은 T7 projection의 책임이다. T8 preview가 checkpoint 판단 또는 campaign 운영 권위로 사용되는 것을 방지한다.

---

## 6. Report source snapshot

```ts
type CampaignReportSourceSnapshotV1 = {
  schemaVersion: "campaign-report-source-snapshot-v1";
  reportScope: "single_run" | "provider_comparison";
  sourceRuns: Array<{
    campaignRunId: string;
    campaignPlanDigest: string;
    finalProjectionDigest: string;
    closeoutDigest: string;
    comparisonGroupId: string | null;
    providerProfileId: string;
    closedAt: string;
  }>;
  sourceIntegrity: {
    t7PlanRunSlotLedgerVerified: true;
    t7CloseoutVerified: true;
    referencedT3ArtifactsVerified: true;
    referencedT4ArtifactsVerified: true;
    referencedT5ArtifactsVerified: true;
    referencedT6ArtifactsVerified: true;
    canonicalAssetsVerified: true;
  };
  artifactIndexDigest: string;
  slotEvidenceDigest: string;
  comparisonKeyDigest: string | null;
  reportPolicy: {
    id: "bejewely-campaign-report-policy-v1";
    version: "1.0.0";
    digest: string;
  };
  exporterVersion: string;
  capturedAt: string;
  sourceSnapshotDigest: string;
};
```

### Snapshot identity

identity에 포함:

- source run identities와 closeout/projection digests
- verified artifact index
- exact slot evidence rows
- comparison key
- report policy와 exporter version

identity에서 제외:

- `capturedAt`
- renderer execution timestamp
- output path
- operator workstation path

### Snapshot 역할

- upstream evidence를 복제하지 않는다.
- authoritative object digest와 검증 결과를 고정한다.
- 이후 CSV/HTML/report가 동일 근거에서 생성되었는지 증명한다.

---

## 7. Artifact index

```ts
type CampaignReportArtifactIndexEntryV1 = {
  track: "T2" | "T3" | "T4" | "T5" | "T6" | "T7";
  artifactType: string;
  artifactDigest: string;
  campaignRunId: string;
  slotId: string | null;
  candidateId: string | null;
  integrityStatus: "verified";
  relativeObjectPath: string | null;
};
```

규칙:

- deterministic sort: track → campaignRunId → slotId → artifactType → digest
- absolute path 금지
- secret, Provider account/session, raw response, browser state 금지
- 하나의 digest가 여러 slot에서 참조되면 entry는 한 번만 저장하고 relation table로 연결 가능
- artifact index는 source existence와 linkage를 증명하지만 upstream payload의 새 authority가 아니다

---

## 8. Slot evidence row

모든 primary slot은 정확히 하나의 row를 가진다.

```ts
type CampaignSlotEvidenceRowV1 = {
  schemaVersion: "campaign-slot-evidence-row-v1";
  campaignRunId: string;
  campaignPlanDigest: string;
  providerProfileId: string;
  comparisonGroupId: string | null;
  slotId: string;
  conditionId: "A" | "B" | "C" | "D";
  conditionOrdinal: 1 | 2 | 3 | 4 | 5;
  waveOrdinal: 1 | 2 | 3;
  generation: {
    attempts: 0 | 1 | 2;
    retries: 0 | 1;
    assetReady: boolean;
  };
  candidate: {
    candidateId: string | null;
    candidateDigest: string | null;
    canonicalSha256: string | null;
    visibleExternalMarkHint: "present" | "absent" | "unknown" | null;
  };
  observation: {
    runCount: number;
    recoveryRunCount: number;
    authoritative: boolean;
    validIneligible: boolean;
    observationObjectDigest: string | null;
  };
  judgment: {
    consensusSealed: boolean;
    consensusDigest: string | null;
    alignmentDigest: string | null;
  };
  promotion: {
    decisionDigest: string | null;
    terminalOutcome:
      | "promoted_g4"
      | "retained_g3_negative_control"
      | "promotion_held"
      | "promotion_rejected"
      | "generation_failed_no_asset"
      | "candidate_import_failed"
      | "observation_valid_ineligible"
      | "observation_failed"
      | "judgment_incomplete"
      | "cancelled_budget_exhausted"
      | "cancelled_campaign_stop"
      | "cancelled_operator";
    g4GradeRecordDigest: string | null;
    g4StatusAsOfCloseout: "active" | null;
    splitCouplingKeysDigest: string | null;
  };
  warnings: string[];
  sourceRefDigests: string[];
  rowDigest: string;
};
```

### Row derivation rules

- condition, wave, slot identity: T7 slot
- attempts/retries/stage refs: validated T7 ledger projection
- mark hint: T3 provenance warning only
- valid-ineligible: T4 normalized eligibility
- consensus/alignment: T5 stored artifacts
- promotion outcome/G4: T6 decision/status as recorded by T7
- warning은 source-backed code만 허용
- label 또는 outcome을 filename, prompt text, operator note에서 추론하지 않음

### Row completeness

- 20 rows exactly
- unique `(campaignRunId, slotId)`
- A/B/C/D 각 5 rows
- terminal outcome non-null
- row digest self-consistent

---

## 9. Fixed-denominator metrics

### 9.1 Stage funnel

다음을 exact count와 fraction으로 제공한다.

| metric | numerator | denominator |
|---|---:|---:|
| issued primary slots | generation attempt ≥ 1 | 20 |
| asset-ready handoffs | assetReady | 20 |
| registered candidates | candidateId present | 20 |
| authoritative observations | authoritative = true | 20 |
| valid ineligible | validIneligible = true | 20 |
| sealed consensus | consensusSealed = true | 20 |
| alignment records | alignmentDigest present | 20 |
| promotion decisions | decisionDigest present | 20 |
| promoted G4 as-of-closeout | terminalOutcome = promoted_g4 | 20 |

`valid ineligible`은 authoritative observation count에 포함될 수 있으므로 mutually exclusive funnel로 표현하지 않는다. 각 metric 정의를 명시한다.

### 9.2 Terminal outcomes

12개 terminal outcome을 모두 exact count로 제공한다. 0인 항목도 생략하지 않는다.

### 9.3 Condition summary

A/B/C/D 각각 denominator 5를 고정한다.

- terminal outcome counts
- candidate registration count
- authoritative observation count
- valid-ineligible count
- G4 as-of-closeout count
- generation/observation technical retry count

### 9.4 Rate representation

각 rate는 다음 세 값을 함께 가진다.

```ts
{
  numerator: number;
  denominator: number;
  fractionLabel: "3/5";
  percent: 60.0;
}
```

- percent는 소수점 한 자리
- denominator를 숨기지 않음
- denominator 0이면 rate를 만들지 않음
- 조건별 denominator는 항상 5

### 9.5 금지 metric

- overall quality score
- weighted success score
- average face/skin score
- pass rate에서 technical failure 제외
- Gold yield에서 held/rejected 제외
- stage 실패를 보정한 adjusted yield
- significance/p-value/confidence interval

---

## 10. Failure-pattern analysis

v1은 cause inference가 아니라 source-backed pattern classification만 제공한다.

허용 group:

```text
generation_technical
candidate_import_technical
observation_valid_ineligible
observation_technical
judgment_incomplete
promotion_non_gold
promotion_hold
promotion_reject
campaign_cancelled
```

각 group은 exact terminal outcome 또는 allowlisted reason code mapping으로만 생성한다.

허용 표현:

- `B condition에서 observation_valid_ineligible이 2/5였다.`
- `run 전체에서 generation technical retry가 3회 사용되었다.`
- `promotion_held slot이 1/20 존재한다.`

금지 표현:

- `Provider가 redness를 이해하지 못했다.`
- `B 조건이 더 어렵다.`
- `이미지 품질이 낮아서 실패했다.`
- `이 Provider가 다른 Provider보다 열등하다.`

후자는 별도 근거와 실험 설계 없이는 causal/generalized claim이다.

---

## 11. Provider comparison gate

### 11.1 입력 조건

두 run 모두:

- closed T7 run
- verified closeout
- non-null identical `comparisonGroupId`
- exact 20-slot A/B/C/D matrix
- same objective question ID and purpose
- same T2 fixture object/finalized spec digests
- same compiled-prompt schema/compiler version
- same T3 import policy
- same T4 observation contract and adapter profile/version
- same T5 judgment policy
- same T6 promotion policy
- same budget, retry, checkpoint, stop, output policies

의도적으로 달라도 되는 필드:

- generation provider profile ID/version/digest/template
- campaign run ID
- run nonce
- operator/timestamps

### 11.2 Comparison key

```ts
type ProviderComparisonKeyV1 = {
  comparisonGroupId: string;
  objectiveDigest: string;
  matrixDigest: string;
  nonProviderSourceFreezeDigest: string;
  campaignPolicyDigest: string;
  comparisonKeyDigest: string;
};
```

provider field를 제거한 나머지 freeze가 정확히 동일해야 한다.

### 11.3 출력

- provider별 exact counts/fractions
- condition별 exact counts/fractions
- count delta
- percentage-point delta
- source run IDs와 closeout time boundary

### 11.4 금지

- winner/loser
- ranking
- composite score
- causal attribution
- statistical significance
- paired-sample claim
- cost/latency 비교: T7 v1에 authoritative source가 없으므로 제외

---

## 12. Review package

```ts
type CampaignReviewPackageV1 = {
  schemaVersion: "campaign-review-package-v1";
  sourceSnapshotDigest: string;
  artifactIndexDigest: string;
  slotTableDigest: string;
  blindContactSheetDigest: string;
  annotatedContactSheetDigest: string;
  unresolvedHoldSlotIds: string[];
  warningSlotIds: string[];
  reviewChecklist: {
    allSlotsPresent: true;
    denominatorsExact: true;
    sourceRefsVerified: true;
    externalMarksNotHidden: true;
    unresolvedHoldsVisible: true;
    noSplitFields: true;
  };
  packageDigest: string;
};
```

### 12.1 Blind contact sheet

표시:

- canonical-derived thumbnail
- campaignRunId short token
- slotId
- candidateId 또는 `no_candidate`

숨김:

- condition
- generation prompt/intent
- observed values
- consensus/alignment
- promotion outcome

목적:

- 누락, 중복, 렌더링 오류, mark visibility 확인
- T5/T6 판정 대체 금지

### 12.2 Annotated analytical sheet

추가 표시:

- condition ID
- wave
- stage reached
- terminal outcome
- T3 visible mark hint
- unresolved hold indicator
- source row digest short token

표시 금지:

- actual person identity
- demographic labels
- clinical labels
- split assignment
- unsupported quality score

### 12.3 Thumbnail policy

```ts
type T8ThumbnailPolicyV1 = {
  id: "t8-thumbnail-display-v1";
  maxWidth: 512;
  maxHeight: 512;
  fit: "inside";
  withoutEnlargement: true;
  format: "png";
  crop: false;
  retouch: false;
  colorCorrection: false;
  metadataRetention: false;
};
```

canonical object SHA와 thumbnail SHA를 모두 기록한다.

---

## 13. Export package

### 13.1 v1 파일 세트

```text
manifest.json
source-snapshot.json
artifact-index.json
slots.json
slots.csv
stage-summary.json
stage-summary.csv
condition-summary.json
condition-summary.csv
terminal-outcomes.csv
reason-codes.csv
review/blind-contact-sheet.html
review/annotated-contact-sheet.html
review/thumbnails/*.png
report/report.json
report/report.html
```

provider comparison이면 추가:

```text
comparison/provider-summary.json
comparison/provider-summary.csv
comparison/provider-report.html
```

### 13.2 CSV canonicalization

- UTF-8, BOM 없음
- LF line ending
- 고정 column order
- header 필수
- RFC 4180 escaping
- boolean: `true` / `false`
- null: 빈 field
- array/object: canonical JSON string
- row ordering: campaignRunId → conditionId → conditionOrdinal → slotId
- locale-dependent number/date formatting 금지
- ISO 8601 UTC timestamps

### 13.3 Export manifest

```ts
type CampaignExportManifestV1 = {
  schemaVersion: "campaign-export-manifest-v1";
  sourceSnapshotDigest: string;
  reportDigest: string;
  audience: "internal_review";
  files: Array<{
    relativePath: string;
    mediaType: string;
    sha256: string;
    byteLength: number;
    role: "source" | "table" | "thumbnail" | "review" | "report";
  }>;
  generatedBy: {
    exporterId: "bejewely-t8-exporter";
    exporterVersion: string;
    rendererVersion: string;
  };
  generatedAt: string;
  exportDigest: string;
};
```

### 13.4 Export 안전 경계

- output root는 `.synthetic-local/reports/` 하위
- absolute path, traversal, symlink write 금지
- existing immutable file conflict 시 fail-closed
- temp staging 후 manifest-last publish
- raw Provider response, secret, account/session, browser data 금지
- canonical image 원본을 export package에 복사하지 않음; thumbnail만 포함
- public upload, email, cloud sync, web publish 기능 없음

---

## 14. Human-readable report

```ts
type CampaignReportV1 = {
  schemaVersion: "campaign-report-v1";
  sourceSnapshotDigest: string;
  reportMode: "single_run" | "provider_comparison";
  title: string;
  scope: {
    campaignRunIds: string[];
    comparisonGroupId: string | null;
    primaryDenominatorPerRun: 20;
    closedAtByRun: Record<string, string>;
  };
  metricSetDigest: string;
  interpretationClaims: InterpretationClaimV1[];
  limitations: string[];
  g4TimeBoundary: {
    mode: "as_of_closeout";
    currentStatusAppendixIncluded: boolean;
    statusVerifiedAt: string | null;
  };
  reviewer: {
    reviewerId: string;
    reviewedAt: string;
    sourceIntegrityReviewed: true;
    denominatorReviewed: true;
    claimsReviewed: true;
  };
  predecessorReportDigest: string | null;
  reportPolicyDigest: string;
  reportDigest: string;
};
```

### 14.1 고정 report 섹션

1. Scope and source boundary
2. Run identity and source freeze
3. Exact 20-slot disposition
4. Stage funnel
5. Terminal outcomes
6. A/B/C/D condition summaries
7. Technical retry and failure patterns
8. G4/non-Gold/hold status as-of-closeout
9. Provider comparison, when eligible
10. Limitations
11. Artifact and export provenance

### 14.2 G4 wording

허용:

- `closeout 시점 active G4 reference는 4/20이다.`
- `이 값은 2026-... closeout snapshot 기준이다.`

금지:

- `현재 Gold는 4개다.` — current T6 status 재검증 없이는 금지
- `4개는 학습 데이터로 사용 가능하다.` — T9 authority 침범

---

## 15. Interpretation claim contract

```ts
type InterpretationClaimV1 = {
  claimId: string;
  claimType:
    | "direct_count"
    | "direct_rate"
    | "descriptive_difference"
    | "operational_pattern"
    | "limitation";
  subject: string;
  statement: string;
  sourceMetricIds: string[];
  sourceSlotIds: string[];
  comparisonDirection: "none" | "provider_a_minus_b" | "provider_b_minus_a";
  authority: "descriptive_only";
  claimDigest: string;
};
```

### Claim requirements

- source metric 또는 slot reference 최소 1개
- statement의 숫자가 source metric과 byte-level canonical representation에서 일치
- unsupported adjective 금지: `better`, `worse`, `accurate`, `inaccurate`, `safe`, `unsafe`, `representative`
- causal connector 금지: `because`, `caused`, `led to`에 해당하는 의미
- clinical/identity/demographic claim 금지
- claim list deterministic sort

### Supplementary commentary

operator 자유 메모가 필요하면 authoritative report 밖의 `supplementary-commentary.md`로만 저장한다.

- report digest에 포함 가능
- `non_authoritative_commentary` 표기 필수
- metric 또는 upstream decision을 변경하지 않음
- 공개 export v1에서는 제외

---

## 16. Current G4 status appendix

선택 기능이다.

### 입력

closeout의 모든 `activeG4Refs`에 대해 T6 status chain을 다시 읽는다.

### 출력

```ts
type CurrentG4StatusAppendixV1 = {
  verifiedAt: string;
  rows: Array<{
    campaignRunId: string;
    slotId: string;
    gradeRecordDigest: string;
    closeoutStatus: "active";
    currentStatus: "active" | "revoked";
    latestStatusEventDigest: string;
  }>;
  activeCountCurrent: number;
  revokedSinceCloseoutCount: number;
  appendixDigest: string;
};
```

규칙:

- closeout metric은 수정하지 않는다.
- appendix 생성 실패가 source report 전체를 변조하지 않는다.
- `currentStatus` 표현은 verified timestamp와 함께만 사용한다.
- T9는 appendix를 신뢰하지 않고 T6를 다시 읽는다.

---

## 17. Report review와 revision

### 17.1 Review role

T8 reviewer는 pseudonymous `reviewerId`를 사용한다.

검토 대상:

- 20 rows completeness
- denominator와 metric mapping
- unresolved hold visibility
- contact sheet omission/duplicate
- claim-source linkage
- limitation inclusion

T8 reviewer는 T5/T6 역할을 대행하지 않는다. 기존 역할과 동일인이어도 report authority가 증가하지 않으며 role overlap을 metadata로 공개할 수 있다.

### 17.2 Revision

다음은 새 revision 허용:

- renderer bug
- CSV ordering bug
- typo
- limitation 문구 보완
- source metric에 맞춘 descriptive statement 수정

다음은 revision이 아니라 upstream block:

- T7 event/closeout conflict
- T3–T6 artifact tampering/missing
- terminal outcome 변경 요구
- promotion decision 변경 요구

### 17.3 Revision chain

```text
report-v1 digest A
→ report-v1 revision digest B (predecessor=A)
→ report-v1 revision digest C (predecessor=B)
```

branch, cycle, predecessor mismatch 금지.

source snapshot digest가 달라지면 새 report root를 만든다.

---

## 18. Storage layout proposal

```text
.synthetic-local/
  reports/
    objects/
      source-snapshots/<sha256>.json
      artifact-indexes/<sha256>.json
      slot-tables/<sha256>.json
      metric-sets/<sha256>.json
      review-packages/<sha256>.json
      reports/<sha256>.json
      export-manifests/<sha256>.json
    runs/
      <campaignRunId>/
        report-roots/<reportDigest>.json
        latest.json
    comparisons/
      <comparisonGroupId>/
        <comparisonKeyDigest>/
          report-roots/<reportDigest>.json
    exports/
      <exportDigest>/
        ... manifest file set ...
    staging/
      <operationId>/
```

`latest.json`은 mutable authority가 아니다. immutable report root를 가리키는 convenience pointer이며, pointer conflict 시 explicit repair가 필요하다.

---

## 19. CLI proposal

구현 단계의 예상 CLI이며 이번 설계 PR에서는 만들지 않는다.

```bash
npm run synthetic:report -- \
  --campaign-run <campaignRunId> \
  --source-preflight

npm run synthetic:report -- \
  --campaign-run <campaignRunId> \
  --build-review-package

npm run synthetic:report -- \
  --campaign-run <campaignRunId> \
  --review report-review.json \
  --confirm

npm run synthetic:export -- \
  --report <reportDigest> \
  --internal-review

npm run synthetic:report -- \
  --compare <campaignRunIdA>,<campaignRunIdB> \
  --source-preflight
```

### CLI 경계

- `--source-preflight`: zero persistent writes
- `--build-review-package`: immutable package 생성, report 승인 아님
- `--confirm`: reviewed report manifest-last publish
- `--internal-review`: local export only
- network, browser, production DB, public upload 없음

---

## 20. Atomicity와 idempotency

### Source preflight

- zero write
- 모든 source object와 link 재검증
- exact expected digests 반환

### Build/confirm

```text
validate request
→ acquire single-writer claim
→ load verified source snapshot
→ derive 20 slot rows
→ derive metrics
→ build thumbnails/review package
→ build reviewed report
→ stage export files
→ verify staged digests
→ publish immutable objects
→ publish report root
→ publish export manifest last
```

- 동일 semantic input은 기존 artifact를 반환
- partial staging은 authority가 아님
- manifest 없는 export directory는 incomplete
- immutable path conflict는 overwrite하지 않고 fail-closed

---

## 21. Verification plan

### Source integrity

- tampered T7 closeout rejected
- projection/closeout digest mismatch rejected
- wrong event head rejected
- missing T3–T6 artifact rejected
- canonical image SHA mismatch rejected
- stale or redirected relative object path rejected

### Denominator

- exactly 20 rows
- A/B/C/D each exactly 5
- every terminal outcome retained
- zero-count outcomes still exported
- filtered view cannot change primary denominator

### Metrics

- counts recomputed from rows
- stage numerator definitions exact
- valid-ineligible not collapsed into technical failure
- held/rejected/non-Gold not removed from yield
- no aggregate score field accepted

### Comparison

- mismatched comparisonGroupId rejected
- non-provider source drift rejected
- matrix/policy mismatch rejected
- provider-only variation accepted
- no winner/ranking field in contract

### Review package

- blind sheet contains no condition/intent/outcome token
- annotated sheet retains external marks and warnings
- no crop/retouch/color correction
- thumbnail digest and canonical source digest linked

### Export

- deterministic JSON/CSV ordering
- stable LF/UTF-8/no-BOM bytes
- path traversal/symlink rejected
- staging not authoritative
- manifest-last publication
- raw Provider/secret/account/session fields absent

### Report claims

- unsupported claim type rejected
- number/source metric mismatch rejected
- claim without source ref rejected
- causal/clinical/identity/provider-superiority statement rejected
- revision branch/cycle rejected

### Boundaries

- no Provider call
- no browser automation
- no production DB/API/UI integration
- no T5/T6 artifact mutation
- no G4/G5 creation
- no split/holdout field
- no public upload

---

## 22. 구현 순서 제안

```text
T8-1 report policy/constants/contracts
→ T8-2 T7 closeout and upstream source resolver
→ T8-3 canonical artifact index
→ T8-4 20-row slot evidence table
→ T8-5 fixed-denominator metric engine
→ T8-6 strict provider comparison gate
→ T8-7 blind/annotated thumbnail review package
→ T8-8 typed interpretation claims and report review
→ T8-9 deterministic JSON/CSV/HTML renderer
→ T8-10 immutable storage, revision chain, CLI
→ T8-11 security/boundary/full-pipeline tests
```

---

## 23. 구현 전 확정할 세부 항목

- HTML sanitizer와 renderer dependency를 신규 추가할지 순수 template으로 제한할지
- thumbnail generation에 기존 `sharp`를 그대로 재사용할지
- authoritative report에서 supplementary commentary를 완전히 제외할지 digest-linked appendix로 둘지
- current G4 status appendix를 default-on 또는 explicit opt-in으로 할지
- CSV schema column naming을 dotted path 또는 flattened snake_case로 할지
- report HTML의 접근성 기준과 print stylesheet 범위

이 항목들은 T8 구현 설계 리뷰에서 확정한다.

---

## 24. 완료 기준

#T8 설계 완료 조건:

- T7 closeout부터 report/export까지 source trust chain 정의
- exact 20-slot denominator와 A/B/C/D 각 5 고정
- non-Gold/hold/failure 보존
- provider comparison strict gate와 non-causal boundary 정의
- blind/annotated contact sheet 분리
- deterministic JSON/CSV/HTML export 정의
- typed claim과 report revision lineage 정의
- closeout G4 time boundary와 optional current-status appendix 정의
- T9 split/G5 권위 분리
- production/network/public-publish 경계 정의

이번 문서는 구현을 수행하지 않는다.
