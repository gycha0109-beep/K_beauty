# Face Lab Archetype Calibration Contract v1

## 0. 상태

| 항목 | 값 |
| --- | --- |
| 단계 | `FACE-EVAL-1` |
| 구현 모드 | Offline calibration comparison |
| 입력 | Human label + sanitized scoring snapshot |
| 임계값 확정 | 금지 |
| Registry 수정 | 금지 |
| 제품 노출 | 금지 |
| 실제 사진 Git 저장 | 금지 |

이 계약은 `FACE-ENGINE-1` scoring snapshot과 익명화된 human adjudication label을 결합해 여러 decision policy 후보를 비교하는 오프라인 평가 경계다. 이번 단계는 임계값을 자동 선택하거나 대표 상을 제품 결과로 활성화하는 단계가 아니다.

## 1. 목적

```text
Consented local image
  → canonical observation
  → FACE-ENGINE-1 scoring snapshot
  → human adjudication label
  → subject-safe dataset split
  → explicit policy candidates
  → offline comparison report
```

목표:

1. top-1 일치도, 오분류 release, 과도한 hold를 함께 측정한다.
2. ambiguous·indeterminate case의 forced assignment를 측정한다.
3. 고양이/늑대 등 인접 분류군 혼동을 별도로 측정한다.
4. sex, age band, skin tone band, makeup condition별 aggregate 차이를 확인한다.
5. 동일 인물의 development/validation/holdout leakage를 차단한다.
6. 사진, evidence 문장, Provider 원문 없이 재현 가능한 report를 만든다.

## 2. 설계 리뷰 결과

초기 구상은 hosted evaluation record의 projected analysis를 재사용하는 방식이었다. 그러나 record는 privacy를 위해 evidence 문장을 제거하므로 `FACE-ENGINE-1`의 evidence-required 계산을 재현할 수 없다.

최종 설계는 분석값을 다시 계산하지 않고 engine이 이미 만든 sanitized scoring snapshot을 calibration 입력으로 사용한다.

추가 제거 위험:

- 자동 “최적 정책” 선택 → 정책별 비교만 수행
- label과 사진 경로 혼합 → dataset과 source image 분리
- 동일 subject split leakage → `subjectId` 단일 split 강제
- holdout 반복 조회 → 기본 차단, CLI 이중 확인
- 소수 slice 재식별 → minimum slice size 미달 suppression
- 임의 개인정보 metadata → 고정 allowlist schema
- sample 단위 output 저장 → aggregate report만 저장

## 3. 비범위

- archetype weight 수정
- decision threshold 확정
- Registry lifecycle 변경
- `decisionPolicy` 수정
- API/UI/Premium/canonical bundle 연결
- 사용자 유사도 숫자 노출
- Provider prompt·호출 변경
- 실제 사용자 사진·label commit
- automatic hyperparameter optimisation

## 4. Dataset 계약

```js
{
  schemaVersion: "face-lab-archetype-calibration-dataset-v1",
  datasetId: string,
  registryVersion: string,
  labelProtocolVersion: string,
  datasetStage: "synthetic" | "pilot" | "calibration",
  minimumSliceSize: integer,
  privacy: {
    sourceImagesCommitted: false,
    directIdentifiersExcluded: true,
    minorSubjectsExcluded: true,
    labelsSeparatedFromImages: true
  },
  samples: CalibrationSample[]
}
```

### 4.1 Sample

```js
{
  sampleId: string,
  subjectId: string,
  split: "development" | "validation" | "holdout",
  consentConfirmed: true,
  conditionTags: string[],
  auditSlices: {
    sexGroup: "female" | "male" | "intersex" | "unknown",
    ageBand: "18_29" | "30_44" | "45_59" | "60_plus" | "unknown",
    skinToneBand: "light" | "medium" | "deep" | "unknown",
    makeupCondition: "none_or_light" | "moderate" | "heavy" | "unknown"
  },
  label: HumanLabel,
  scoring: ScoringSnapshot
}
```

`sampleId`와 `subjectId`는 익명 logical ID다. 이름, 계정 ID, 연락처 또는 이미지 파일명을 사용하지 않는다.

### 4.2 Subject split

동일한 `subjectId`의 모든 sample은 정확히 하나의 split에만 존재해야 한다. 둘 이상의 split에 존재하면 dataset 전체를 invalid로 처리한다.

### 4.3 Privacy

금지:

- name, email, phone, address
- account/user ID
- image path, URL, base64, crop, buffer
- evidence sentence
- raw/provider response
- secret, cookie, authorization
- 미성년자 sample

실제 source image는 local private storage에만 존재한다. calibration dataset에는 image reference를 넣지 않는다.

`pilot`과 `calibration` dataset의 `minimumSliceSize`는 최소 5다. synthetic verifier만 최소 2를 허용한다.

## 5. Human label 계약

```js
{
  disposition: "archetype" | "ambiguous" | "hold",
  acceptableTopCandidates: string[],
  reviewerCount: integer,
  agreement: number,
  adjacentPair: string[]
}
```

- `archetype`: 인정 가능한 key 1~3개. top-1 하나만 강제하지 않는다.
- `ambiguous`: 후보 2~3개. policy가 release하면 forced assignment로 집계한다.
- `hold`: 대표 상을 만들지 않아야 하는 경우. 후보 배열은 비어 있어야 한다.
- 최소 reviewer 수는 2명이다.
- `agreement`는 0~1 내부 진단값이며 사용자 정확도 숫자가 아니다.

## 6. Scoring snapshot 계약

```js
{
  schemaVersion: "face-lab-archetype-scoring-v1",
  registryVersion: string,
  analysisUsable: boolean,
  qualityMultiplier: number,
  candidates: [
    {
      key,
      rawScore,
      evidenceCoverage,
      missingRequiredPaths,
      contradictionCount
    }
  ]
}
```

규칙:

- 현재 Registry 전체 taxonomy가 정확히 한 번씩 존재한다.
- Registry version이 dataset과 일치한다.
- 순서는 `rawScore desc → key asc`다.
- `analysisUsable === false`이면 모든 raw score는 0이다.
- contribution ledger와 evidence 문장은 dataset에 복사하지 않는다.

## 7. Policy 후보 계약

```js
{
  schemaVersion: "face-lab-archetype-calibration-policy-set-v1",
  policySetId: string,
  registryVersion: string,
  policies: [
    {
      policyId,
      minimumEvidenceCoverage,
      minimumTopScore,
      minimumTopMargin,
      maximumContradictions
    }
  ]
}
```

모든 threshold 후보는 사람이 명시적으로 입력한다. evaluator는 grid 생성, best policy 선택 또는 Registry mutation을 수행하지 않는다.

## 8. 평가 판정

각 policy는 다음 순서로 hold 여부를 계산한다.

1. analysis unusable
2. non-positive top score
3. required axis missing
4. evidence coverage 미달
5. top score 미달
6. top-1/top-2 margin 미달
7. contradiction 상한 초과

hold reason은 내부 비교용이며 제품 판정이 아니다.

## 9. Metrics

전체:

- release rate
- release precision
- archetype recall
- expected-hold recall
- hold precision
- ambiguous force rate
- raw top agreement
- adjacent-pair wrong release rate

인접 유형은 `adjacentPair`별 sample, correct release, wrong adjacent release, held, wrong release rate를 집계한다. ambiguous sample은 pair separation denominator에 포함하지 않는다.

Bias slice:

- sex group
- age band
- skin tone band
- makeup condition

minimum slice size 미달은 `suppressed: true`로 두고 metric을 계산하지 않는다. 두 개 이상의 유효 slice가 있을 때 metric별 최대-최소 disparity를 계산한다.

## 10. Holdout gate

library 기본값은 holdout 평가를 거부한다. CLI는 아래 두 옵션이 모두 있어야 한다.

```bash
--allow-holdout --confirm HOLDOUT
```

기존 report를 덮어쓰지 않는다.

## 11. Report 계약

```js
{
  schemaVersion: "face-lab-archetype-calibration-report-v1",
  mode: "offline_calibration_comparison",
  datasetId,
  datasetStage,
  labelProtocolVersion,
  registryVersion,
  policySetId,
  evaluatedSplit,
  holdoutAccessed,
  sampleCount,
  subjectCount,
  labelSummary,
  automaticPolicySelection: false,
  registryMutationPerformed: false,
  productionActivationEligible: false,
  userFacingPercentagesAllowed: false,
  policyResults
}
```

Report에는 sample ID, subject ID, per-sample prediction, image reference, evidence text를 저장하지 않는다.

## 12. CLI

```bash
npm run face-lab:archetype:calibrate -- \
  --dataset private/face-lab-calibration/dataset.local.json \
  --policies private/face-lab-calibration/policies.local.json \
  --split validation \
  --output tmp/face-lab-archetype-calibration/validation-report.json
```

입력은 `private/face-lab-calibration/` 하위 regular file만 허용하며 realpath escape를 차단한다. 출력은 `tmp/face-lab-archetype-calibration/` 바로 아래 신규 `.json` 파일만 허용한다.

## 13. Activation gate

이 단계의 report만으로 Registry를 활성화할 수 없다. 후속 단계에는 실제 consented dataset, label protocol 검토, validation 비교, sealed holdout, bias/regression 검토, threshold 승인, 별도 activation PR이 필요하다.

## 14. 후속 단계

```text
FACE-EVAL-1 Calibration Harness
→ 실제 pilot dataset 수집·label adjudication
→ FACE-EVAL-2 Bias / Regression Evaluation
→ Threshold approval
→ FACE-ACTIVATE-1 Production Activation
```
