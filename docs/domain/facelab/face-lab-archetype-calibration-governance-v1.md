# Face Lab Archetype Calibration Governance v1

## 0. 적용 관계

이 문서는 `face-lab-archetype-calibration-contract-v1.md`의 계산 계약 위에 적용되는 필수 governance 계약이다.

다음 항목은 이 문서가 우선한다.

- 실제 dataset 입력 schema
- 실제 policy-set 입력 schema
- audit slice 동의
- label 및 policy 동결
- 인접 유형 오분류 집계
- 운영 CLI 진입점

순수 계산 core를 직접 운영 진입점으로 사용하지 않는다. 모든 실제 실행은 `face-lab-archetype-calibration-governance.js`를 통과해야 한다.

## 1. 목적

Calibration 결과가 다음 오염 없이 생성되도록 강제한다.

- reviewer가 model score를 본 뒤 label을 정하는 순환 검증
- 결과를 본 뒤 policy 후보를 변경하는 validation overfitting
- 일반 이미지 동의를 민감 audit slice 동의로 간주
- sample에 이미지 경로나 임의 metadata를 삽입
- 인접 pair case의 제3유형 오분류 누락
- ungated CLI를 통한 holdout 반복 조회

## 2. Dataset governance extension

Core dataset 필드에 다음 항목을 추가한다.

```js
{
  labelingMode: "blind_to_model_scores",
  labelsFrozenBeforePolicyEvaluation: true,
  samples: [
    {
      auditSliceConsentConfirmed: boolean
    }
  ]
}
```

### 2.1 Blind labeling

- reviewer는 model raw score, ranking, policy threshold를 보지 않고 label을 작성한다.
- label은 policy 비교 전에 동결한다.
- 위 조건을 충족하지 않으면 evaluator가 dataset을 거부한다.

### 2.2 Audit slice consent

`sexGroup`, `ageBand`, `skinToneBand`, `makeupCondition` 중 하나라도 `unknown`이 아니면 다음이 필요하다.

```js
auditSliceConsentConfirmed: true
```

모든 slice가 `unknown`이면 `false`를 허용한다.

이 값은 aggregate report에 sample 단위로 저장하지 않는다.

### 2.3 Allowlist

Governance facade는 dataset과 sample의 key를 고정 allowlist로 검사한 뒤 core validator에 전달한다. 따라서 `imagePath`, 계정 식별자, evidence, raw response 등 임의 필드를 strip하여 묵인하지 않고 입력 전체를 거부한다.

## 3. Policy governance extension

Core policy set 필드에 다음 항목을 추가한다.

```js
{
  selectionProtocol: "manual_predeclared",
  candidatesFrozenBeforeEvaluation: true
}
```

- policy 후보는 사람이 사전에 명시한다.
- validation 또는 holdout 결과를 확인한 후 같은 policy-set ID의 후보를 바꾸지 않는다.
- evaluator는 후보 생성, ranking, best-policy 선택을 수행하지 않는다.

## 4. Core와 facade 분리

```text
Calibration core
  - schema normalization
  - policy 적용
  - aggregate metric 계산

Governance facade
  - blind/freeze 선언 검증
  - audit slice 별도 동의 검증
  - allowlist envelope 검증
  - core 호출
  - corrected adjacent-pair aggregate 생성
```

Core는 테스트 가능한 순수 계산 모듈이다. 제품 또는 운영 CLI가 core를 직접 호출하는 것은 승인된 경로가 아니다.

## 5. Corrected adjacent-pair metric

대표 상 label이며 `adjacentPair`가 지정된 sample만 denominator에 포함한다.

각 pair는 다음을 집계한다.

```js
{
  sampleCount,
  correctReleases,
  adjacentWrongReleases,
  otherWrongReleases,
  totalWrongReleases,
  held,
  adjacentWrongReleaseRate,
  totalWrongReleaseRate
}
```

- `adjacentWrongReleases`: pair의 다른 key로 잘못 release
- `otherWrongReleases`: pair 밖 제3유형으로 잘못 release
- ambiguous label은 pair separation denominator에 넣지 않는다.

## 6. Report governance marker

Governed report는 다음 고정값을 포함한다.

```js
{
  governanceSchemaVersion: "face-lab-archetype-calibration-governance-v1",
  labelingMode: "blind_to_model_scores",
  labelsFrozenBeforePolicyEvaluation: true,
  auditSliceConsentEnforced: true,
  policySelectionProtocol: "manual_predeclared",
  policyCandidatesFrozenBeforeEvaluation: true,
  automaticPolicySelection: false,
  registryMutationPerformed: false,
  productionActivationEligible: false,
  userFacingPercentagesAllowed: false
}
```

## 7. CLI

승인된 실행 명령은 다음 하나다.

```bash
npm run face-lab:archetype:calibrate -- \
  --dataset private/face-lab-calibration/dataset.local.json \
  --policies private/face-lab-calibration/policies.local.json \
  --split validation \
  --output tmp/face-lab-archetype-calibration/validation-report.json
```

이 npm script는 governed CLI만 실행한다.

Holdout은 다음 이중 확인이 필요하다.

```bash
--allow-holdout --confirm HOLDOUT
```

## 8. 비범위

- 실제 threshold 승인
- Registry lifecycle 또는 decisionPolicy 변경
- actual user/Provider data commit
- UI/API/DB 연결
- user-facing percentage
- demographic fairness 승인
- production activation

## 9. 후속 gate

실제 pilot dataset을 사용하기 전 다음이 추가로 필요하다.

1. audit slice 수집 동의 문구 검토
2. reviewer blind-label 운영 절차
3. label protocol 및 disagreement adjudication
4. immutable dataset/policy versioning
5. validation 결과 검토
6. sealed holdout 실행 승인
7. bias/regression review
8. threshold approval PR
