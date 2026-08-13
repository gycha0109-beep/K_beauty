# Face Lab Archetype Calibration Protocol v1

## 0. 상태

| 항목 | 값 |
| --- | --- |
| 단계 | `FACE-EVAL-A` |
| 목적 | Archetype calibration protocol |
| 제품 영향 | 없음 |
| Production activation | 금지 |
| Weight 변경 | 없음 |
| Threshold 확정 | 없음 |
| Provider call | 없음 |

이 문서는 현재 shadow Archetype scorer를 production 판정기로 활성화하기 위한 수치나 구현을 정하지 않는다. 어떤 근거를 어떤 분리 원칙, metric, dataset role, calibration 절차, hold 검증, provenance, activation gate로 검토해야 하는지를 고정한다.

현재 authority는 다음 순서를 따른다.

```text
제품 아키텍처
→ FACE_LAB_MASTER_SPEC.md

현재 구현 상태
→ current main code
  + FACE_LAB_CURRENT_STATE.md

평가 철학
→ FACE_LAB_EVALUATION_STRATEGY.md

현재 Archetype 동작
→ face-lab-archetype-scoring-contract-v1.md
  + Registry / scorer / decision code

Calibration 실행 방법론
→ 이 문서
```

## 1. 목적

현재 deterministic shadow scorer가 production-ready 후보가 되려면 다음 질문에 답할 수 있어야 한다.

- Human consensus와 engine ranking은 어느 정도, 어떤 형태로 일치하는가?
- 가까운 Archetype 사이의 Human ambiguity를 engine ranking과 top margin이 보존하는가?
- required observation axis가 부족할 때 engine이 강제 분류하지 않고 hold하는가?
- opposing evidence와 contradiction이 많을 때 hold 정책이 이를 적절히 차단하는가?
- 같은 subject의 허용 가능한 capture variation에서 결과가 불필요하게 뒤집히지 않는가?
- presentation 및 capture strata에서 observation, ranking, hold의 systematic failure가 나타나는가?

이 단계에서는 PASS 수치, sample 수, reviewer 수, 최종 taxonomy, weight 또는 threshold를 결정하지 않는다. 이 문서는 그러한 값을 선택하고 검증하는 절차만 정의한다.

## 2. Evaluation Authority Hierarchy

평가 근거는 다음 순서로 구분한다. 높은 단계의 질문을 낮은 단계 근거만으로 확정하지 않는다.

### 2.1 Technical Fixture

Can establish:

- schema, parser, enum, fail-closed 동작
- deterministic scoring과 contribution ledger 재현성
- threshold 및 hold 로직의 기계적 회귀
- version, digest, storage, privacy boundary 검증

Cannot establish:

- 실제 사람의 Archetype truth
- Human ambiguity 분포
- production accuracy 또는 fairness
- production threshold activation

### 2.2 Controlled Synthetic Evidence

Can establish:

- controlled cue와 boundary stress
- contradiction 및 missing-axis stress
- observation failure 후보 탐지
- deterministic regression
- ambiguity와 hold 동작 탐색
- rubric-overlap 후보 분석
- generation/provider 비교

Cannot establish:

- 실제 세계의 최종 Archetype truth
- production accuracy 증명
- population fairness 증명
- 실제 사용자에 대한 production threshold 활성화

Synthetic Gold는 목적이 제한된 synthetic evidence일 뿐 Real Gold가 아니다.

### 2.3 Human-Annotated Real Development Evidence

Can establish:

- rubric 및 weight 후보의 개발 단계 비교
- threshold 후보 탐색
- Human ranking, ambiguity, evidence tag 분포
- error cluster 및 close-pair 후보 분석

Cannot establish:

- 독립 validation 결과
- locked holdout 성능
- production activation 단독 승인

### 2.4 Real Validation Evidence

Can establish:

- development에서 선택한 bounded calibration 후보의 독립 검증
- iteration을 계속할지 보류할지 판단할 근거
- strata별 일반화와 stability 진단

Cannot establish:

- validation 결과를 본 뒤 반복 tuning한 정책의 독립 성능
- locked holdout을 대체하는 최종 production 근거

### 2.5 Locked Real Holdout

Can establish:

- freeze된 taxonomy, rubric, weight, threshold, code에 대한 최종 독립 평가
- 명시된 metric과 activation gate 검토 근거

Cannot establish:

- 새로운 weight 또는 threshold 탐색
- 반복 열람을 통한 calibration
- 근거 범위를 넘는 population 또는 인과 주장

## 3. Evaluation Unit

평가 단위는 다음 identity를 분리해 추적한다.

- `subject`: 실제 한 사람 또는 synthetic lineage의 독립 subject 단위
- `image`: 한 capture 또는 생성 결과
- `observation analysis`: 특정 observation contract와 prompt version으로 정규화된 관찰
- `taxonomy version`: 평가 대상 분류군 정의
- `registry version`: indicator와 weight를 포함한 registry snapshot
- `engine version`: scoring 및 decision 구현 version
- `Human annotation set`: blind Human observation 및 ranking 묶음
- `consensus artifact`: 독립 reviewer 입력을 결합한 versioned 결과

동일 subject의 여러 이미지를 서로 독립인 사람처럼 계산하지 않는다. 기본 denominator와 split은 subject-level grouping을 보존한다. Image-level metric이 필요하면 subject-level metric과 별도로 표시하고, 한 subject의 image 수가 결과를 과도하게 가중하지 않도록 한다.

Generated subject도 같은 seed, reference, edit, parent 또는 명시된 lineage family를 공유하면 독립 subject로 가정하지 않는다.

## 4. Human Annotation Requirements

정확한 JSON schema와 storage contract는 `FACE-EVAL-B`가 담당한다. 이 단계에서는 다음 요구사항을 고정한다.

- reviewer는 서로 독립적으로 판단한다.
- generation target과 prompt를 숨긴다.
- engine ranking, top candidate, score, margin, hold 결과를 숨긴다.
- top-1을 기록할 수 있어야 한다.
- 의미가 있는 경우 ranked alternatives를 보존할 수 있어야 한다.
- confidence를 보존한다.
- visible evidence tag를 보존한다.
- `uncertain`과 `not assessable`을 표현할 수 있어야 한다.
- 가까운 후보 사이 ambiguity를 강제 top-1로 제거하지 않는다.
- reviewer identity는 개인정보를 최소화한 pseudonymous provenance와 contract version으로 추적한다.
- screening, reveal, annotation, adjudication 단계의 순서와 봉인을 검증할 수 있어야 한다.

Production calibration은 single reviewer 하나의 의견에 의존하지 않는다. 다만 reviewer 수는 이번 문서에서 숫자로 정하지 않으며, dataset role과 ambiguity 위험에 따라 후속 계약에서 결정한다.

민감 속성은 Archetype 정답이나 scorer 입력이 아니다. Coverage 진단을 위한 최소한의 strata 정보가 필요하면 선택 동의, 최소 수집, 접근 통제, 보존·삭제 규칙을 별도 계약으로 정한다.

## 5. Consensus Requirements

Consensus는 강제 단일 top-1 truth 생성기가 아니다. 다음을 가능한 한 보존한다.

- top-k distribution
- ranking agreement
- confidence distribution
- reviewer disagreement
- ambiguity
- evidence-tag agreement
- `uncertain` 및 `not assessable` 비율

명확한 consensus가 없는 sample은 제거하거나 임의 adjudication으로 단일 truth를 만들지 않고 `ambiguous / hold calibration evidence`로 사용할 수 있다.

Consensus 계산은 generation intent와 engine 결과를 보지 않은 sealed Human annotation을 입력으로 해야 한다. Exact aggregation algorithm, reviewer 수, adjudication 조건은 `FACE-EVAL-B`에서 정한다.

## 6. Dataset Roles

### 6.1 Development Set

허용:

- rubric 구조 분석
- bounded weight tuning
- threshold candidate tuning
- contribution-ledger 기반 error analysis
- diagnostic taxonomy 개선

Development 결과는 독립 성능 증명이 아니다.

### 6.2 Validation Set

역할:

- development에서 선택한 calibration 후보 확인
- overfit 및 systematic failure 탐지
- 제한된 iteration 지속 여부 판단

Validation 결과를 보고 weight나 threshold를 수정하면 해당 validation version은 더 이상 최종 독립 평가 근거가 아니다. 재사용 여부와 역할 변경을 version으로 기록한다.

### 6.3 Locked Holdout

역할:

- freeze된 calibration 후보의 최종 독립 평가
- production activation review의 근거 제공

금지:

- holdout 결과를 보고 weight 수정
- holdout 결과를 보고 threshold 재선택
- 반복 열람 후 사실상 development set처럼 사용
- 실패 sample별 예외 추가

### 6.4 Synthetic Stress Set

역할:

- controlled boundary와 contradiction stress
- missing-axis 및 observation failure stress
- deterministic regression
- ambiguity와 hold behavior 탐색

Synthetic Stress Set과 Real dataset을 하나의 interchangeable pool로 합치지 않는다. 지표를 함께 보고할 때도 근거 class와 denominator를 분리한다.

## 7. Leakage Prevention

최소 불변식:

- 동일 subject를 보호된 split 사이에 나누지 않는다.
- exact 및 near-duplicate family를 보호된 split 사이에 분산하지 않는다.
- 같은 generated seed, reference, parent, edit 또는 lineage family를 독립 sample로 계산하지 않는다.
- source와 derivative 관계를 보존한다.
- taxonomy, rubric, observation, engine version을 보존한다.
- locked holdout을 반복 열어 tuning하지 않는다.
- split 생성 규칙과 split version을 immutable provenance에 남긴다.
- 제거·철회가 발생하면 subject family 전체와 파생 관계에 미치는 영향을 추적한다.

Split 전에 exact duplicate, perceptual neighbor, subject identity, generated lineage를 검토한다. 하나라도 같은 family일 가능성이 있으면 fail-open으로 나누지 않고 같은 leakage component로 묶는다.

## 8. Evaluation Metrics

이 절은 metric 정의만 고정한다. PASS 수치는 정하지 않는다. 모든 rate와 percentage는 numerator, denominator, 제외 사유를 함께 보고한다. Denominator 없는 percentage는 금지한다.

### 8.1 Ranking

- **Top-1 agreement**: Human consensus top-1이 assessable한 sample 중 engine top-1과 일치한 비율
- **Top-k overlap**: Human과 engine의 상위 후보 집합이 겹치는 정도
- **Ranking agreement / rank correlation**: 비교 가능한 ranked list 사이의 순서 일치도

Human이 uncertain이거나 consensus top-1이 없는 sample을 임의 정답으로 바꾸지 않는다. 각 metric의 evaluable denominator에서 어떻게 처리했는지 명시한다.

### 8.2 Ambiguity

- Human ambiguity와 engine top margin의 관계
- close-rank behavior
- Human distribution과 engine ranking structure의 관계
- Human disagreement가 큰 sample에서 forced-decision이 발생하는 빈도

### 8.3 Hold

- **Hold precision**: engine hold 중 Human/evidence 기준으로 hold가 적절했던 비율
- **Hold recall**: Human/evidence 기준으로 hold가 필요했던 sample 중 실제 hold된 비율
- **Inappropriate forced-decision rate**: hold 필요 sample에서 decision이 강제된 비율
- **Appropriate decision coverage**: decision 가능한 sample 중 적절히 decision된 비율

Hold metric은 `not assessable`, Human ambiguity, evidence 부족, contradiction, technical failure를 같은 denominator로 뭉개지 않는다.

### 8.4 Evidence

- evidence coverage
- missing required-axis rate
- contradiction rate
- evidence availability와 score contribution의 분리 진단

### 8.5 Stability

- same-subject capture variation consistency
- eligibility를 깨지 않는 작은 pose, lighting, crop, expression variation에서의 ranking 안정성
- top candidate뿐 아니라 top-k, margin, hold 상태 변화

### 8.6 Per-class diagnostics

- confusion matrix
- per-archetype evaluable coverage
- per-archetype error
- close-pair confusion
- class별 hold와 insufficient-evidence 분포

### 8.7 Variation diagnostics

Presentation 및 capture strata별로 observation availability, ranking, ambiguity, hold, error를 분리해 본다. Strata는 scorer 입력이나 사람의 Archetype을 결정하는 label이 아니다.

## 9. Archetype Pair / Boundary Evaluation

전체 7-class accuracy만으로 calibration을 판단하지 않는다. 현재 registry의 shared field와 overlapping expected value를 기반으로 `candidate close pair` 또는 `rubric-overlap candidate`를 추적한다.

평가 질문:

- 어떤 observation axis가 pair를 분리하는가?
- Human이 실제로 해당 pair에서 ambiguity를 보이는가?
- engine top margin이 Human ambiguity와 일관된 방향으로 움직이는가?
- required axis가 pair separation에 실질적으로 기여하는가?
- negative indicator가 명시적 opposing evidence가 있을 때만 작동하는가?
- 한 shared field가 여러 후보 점수를 함께 올려 margin을 왜곡하는가?

현재 rubric overlap은 taxonomy truth나 확정된 label 관계가 아니다. 실제 Human evidence로 확인해야 할 가설이다.

## 10. Hold Policy Calibration

현재 decision threshold는 모두 `null`이며 production numerical value가 아니다.

### 10.1 `minimumEvidenceCoverage`

목적:

```text
보이는 근거가 부족한 상태에서 강제 분류 방지
```

Required-axis 부재, field availability, image quality와의 관계를 함께 분석한다.

### 10.2 `minimumTopScore`

목적:

```text
어느 Archetype에도 충분한 supporting evidence가 없는 경우 강제 label 방지
```

Raw score scale은 weight version에 종속되므로 다른 registry version 사이에서 수치를 직접 비교하지 않는다.

### 10.3 `minimumTopMargin`

목적:

```text
top candidates가 Human ambiguity와 유사하게 가까운 경우 강제 top-1 방지
```

Human ranking distribution과 close-pair strata를 사용해 candidate policy를 평가한다.

### 10.4 `maximumContradictions`

목적:

```text
top candidate에 명시적 opposing evidence가 과도한 경우 decision 방지
```

Unmatched positive indicator를 contradiction으로 간주하지 않는다. 현재 scorer처럼 evidence가 있는 negative indicator의 명시적 match를 기준으로 한다.

어떤 threshold도 이 문서에서 숫자로 정하지 않는다.

## 11. Weight Calibration Procedure

현재 registry weight는 calibration hypothesis다.

```text
input / taxonomy / registry / engine version freeze
→ Human development evidence 준비
→ baseline scorer 평가
→ error 및 close-pair 분석
→ contribution-ledger 분석
→ bounded weight adjustment
→ development 재평가
→ 선택한 후보 validation
```

규칙:

- 한 iteration에서 변경한 indicator, 방향, 근거를 audit trail에 기록한다.
- weight 변경 전후 metric과 affected strata를 같은 source version에서 비교한다.
- required/optional/negative 의미 변경은 단순 수치 조정과 구분한다.
- registry version을 변경하고 과거 결과를 rewrite하지 않는다.
- 개선과 악화, coverage 변화, hold 변화를 함께 보고한다.

금지:

- locked holdout을 보고 weight 수정
- 개별 sample마다 임시 indicator 추가
- sample-specific exception
- evidence text regex hack
- 성별, 연령, 인종, 피부색 등 demographic attribute를 scorer weight 입력으로 사용
- generation target에 맞추기 위한 weight 수정

## 12. Threshold Calibration Procedure

Weight와 threshold를 구분 없이 동시에 tuning하면 원인 추적과 overfit 통제가 어려워진다. Calibration run은 어떤 weight version에서 어떤 threshold 후보를 평가했는지 명시한다.

```text
Development
→ candidate threshold selection

Validation
→ candidate policy evaluation

Locked Holdout
→ final independent evaluation
```

Threshold candidate는 ranking, ambiguity, hold precision/recall, forced-decision, decision coverage, per-class 및 strata 진단을 함께 평가한다. 하나의 전체 accuracy만 최적화하지 않는다.

Exact numerical optimizer, 후보 검색 방법, tie-break, 최종 threshold 값은 `not-yet-determined`이며 후속 calibration 작업에서 versioned procedure로 정한다.

## 13. Stability Protocol

같은 subject의 정상적인 capture variation에서 observation, ranking, margin, hold가 과도하게 뒤집히는지 평가한다.

허용 가능한 variation 후보:

- small pose shift
- ordinary lighting variation
- reasonable crop
- minor expression variation
- structural assessment가 유지되는 범위의 makeup coverage variation

다음을 구분한다.

- **normal stability perturbation**: 여전히 동일 평가 질문에 답할 수 있는 variation
- **eligibility-breaking perturbation**: face count, pose, occlusion, blur, crop 등으로 평가 자체가 부적절해진 변화

결과 변화는 원인을 단정하지 않고 다음 축으로 진단한다.

- observation changed
- quality or eligibility changed
- ambiguity boundary crossed
- scorer instability possible

Eligibility-breaking case를 scorer stability 실패로 계산하지 않으며 별도 denominator로 보고한다.

## 14. Coverage / Bias Review

Archetype Engine의 입력에 민감 속성을 넣지 않는다. Evaluation stratification은 서로 다른 presentation과 capture 조건에서 같은 구조적 visual evidence를 안정적으로 관찰·판정하는지 확인하기 위한 진단이다.

현재 source와 동의·governance contract가 허용하는 범위에서 검토할 수 있는 축:

- gender presentation
- age presentation
- skin tone / complexion presentation
- makeup coverage
- capture condition

검토 질문은 “민감 속성으로 사람의 Archetype을 결정하는가?”가 아니라 다음이다.

```text
해당 presentation 및 capture 조건에서도
같은 종류의 구조적 visual evidence를 안정적으로 관찰하고 판정하는가?
```

Strata별 sample coverage가 부족하면 성능이나 fairness를 추론하지 않고 `insufficient coverage`로 남긴다. Synthetic evidence만으로 population fairness를 증명하지 않는다. MASTER SPEC의 민감 속성 추론 금지와 scorer input 경계를 위반하지 않는다.

## 15. Diagnostic Taxonomy

다음 diagnostic flag는 가능한 원인 후보를 정리하기 위한 evidence다. causal proof가 아니다.

- `observation-side miss possible`: 독립적으로 확인 가능한 cue를 observation layer가 놓쳤을 가능성
- `rubric-side mismatch possible`: Human evidence와 현재 indicator/expected-value 구조가 맞지 않을 가능성
- `threshold-side issue possible`: ranking evidence는 있으나 hold/decision 경계가 부적절할 가능성
- `generation-side signal weak possible`: synthetic intended cue가 충분히 생성되지 않았을 가능성
- `ambiguous visual cue`: generation, observation 또는 Human 판정 사이를 현재 근거로 분리하기 어려움
- `contract limitation`: schema나 enum이 필요한 구분을 표현하지 못함
- `reviewer limitation`: reviewer가 특정 axis를 신뢰성 있게 판정하기 어려움
- `insufficient coverage`: sample 또는 strata 근거가 부족함

한 failure를 곧바로 단일 원인으로 확정하지 않는다. 동일 row에 복수 diagnostic flag가 존재할 수 있으며, 후속 evidence가 생기면 새로운 artifact/version에서 해석한다.

## 16. Calibration Artifact / Provenance

각 calibration run은 최소 다음을 추적한다.

- observation schema version
- observation prompt version
- registry version
- taxonomy version
- scoring schema 및 engine version
- decision schema 및 policy version
- Human annotation contract version
- consensus contract version
- dataset version
- split version
- weight version
- threshold version
- calibration code version 또는 commit SHA
- run ID
- timestamp
- metric definitions와 denominator policy
- result digest

또한 source subject/image identity, lineage component, annotation set, consensus source, exclusion 사유를 연결할 수 있어야 한다. Artifact는 immutable 또는 append-only로 보존하고, code가 변경된 뒤에도 과거 run을 당시 기준으로 재해석할 수 있어야 한다.

## 17. Production Activation Gate

Production ArchetypeDecision을 활성화하려면 최소 다음 gate가 충족되어야 한다.

- taxonomy reviewed 및 validated
- Human-annotated real evaluation evidence 존재
- Human annotation contract 완료
- consensus contract 완료
- development calibration 완료
- independent validation 완료
- hold policy 검증
- stability 검증
- coverage / bias review
- locked holdout 완료
- versioned regression fixture 존재
- rollback path 정의
- user-facing language와 수용성 검토
- 별도 explicit activation PR 및 승인

```text
Calibration complete
≠ Production activated
```

Calibration artifact가 존재하더라도 activation review, wiring, rollback, 사용자 카피 검토가 별도로 완료되지 않으면 production authority가 아니다.

## 18. Relationship to Synthetic Toolkit

현재 synthetic toolkit은 다음 목적으로 사용한다.

- controlled stress
- deterministic regression
- ambiguity exploration
- observation failure detection
- rubric contradiction 탐색
- generation/provider comparison
- provenance, split, leakage, report pipeline rehearsal

Controlled skin-cue pilot에서 확정한 다음 원칙을 Archetype calibration에도 승계한다.

- uncertainty 보존
- cue 또는 평가 축별 denominator 분리
- Human↔Target, T4↔Target, Human↔T4 관계 분리
- unsupported value는 `not_available` / `not_comparable`로 보존
- diagnostic flag는 causal proof가 아님

다만 skin-cue contract를 Archetype annotation schema로 그대로 재사용하지 않는다. Archetype은 top-k, ranking, ambiguity, evidence tag가 필요한 별도 Human contract를 가져야 한다.

Synthetic campaign이 기술적으로 완료되거나 Synthetic Gold로 승격됐다는 사실만으로 Real calibration, Real Gold 또는 production activation을 주장하지 않는다.

## 19. `FACE-EVAL-B` Boundary

다음 단계는 다음과 같다.

```text
FACE-EVAL-B
Human Annotation / Consensus Dataset Contract
```

`FACE-EVAL-B`에서 구체화할 항목:

- annotation JSON schema
- reviewer 및 session artifact
- blind / reveal state
- ranked label representation
- confidence representation
- evidence tag registry
- `uncertain` / `not assessable`
- consensus derivation
- adjudication
- integrity 및 digest
- storage 및 privacy

이 문서는 위 schema나 runtime을 구현하지 않는다.

## 20. Explicit Non-Goals

- Archetype weight 수정
- taxonomy 수정
- threshold 숫자 확정
- Registry lifecycle 승격
- `calibrationStatus = ready` 전환
- `productionEligible = true` 전환
- canonical archetype wiring
- API wiring
- Free/Premium UI 변경
- Style Identity 구현
- Core/Alternative 구현
- Color/Hair/Makeup/FaceStyle 구현
- Look Composer 구현
- Synthetic image generation
- Provider/T4 call
- DB migration
- Hosted write
- user photo collection
- 실제 Human dataset 구축
- FACE-EVAL-B schema 구현
- FACE-ENGINE-2 calibration 구현

## 21. Open Decisions

다음은 의도적으로 unresolved 상태다.

- exact sample size: `TBD`
- reviewer count: `TBD`
- consensus algorithm: `not-yet-determined`
- metric PASS threshold: `calibration-required`
- weight optimization strategy: `not-yet-determined`
- threshold numerical values: `calibration-required`
- exact close-pair acceptance: `TBD`
- confidence calibration method: `not-yet-determined`
- locked holdout size: `TBD`
- production display cutoff: `calibration-required`

근거가 확정되기 전에는 예시 숫자를 기본값이나 권장값으로 승격하지 않는다.

## 22. Next Gate

```text
FACE-EVAL-A
Calibration Protocol

→

FACE-EVAL-B
Human Annotation / Consensus Dataset Contract

→

FACE-EVAL-C
Synthetic Archetype Stress Campaign

+

Real calibration dataset preparation

→

FACE-ENGINE-2
Weight + Threshold Calibration
```

Synthetic stress campaign과 Real dataset 준비는 병행할 수 있지만 authority와 dataset role은 합치지 않는다.

## Appendix A. Current Rubric Baseline

이 appendix는 `face-lab-archetype-rubric-20260727` registry source를 요약한다. 현재 weight와 indicator는 **current rubric hypothesis structure**다.

```text
Current rubric baseline
≠ validated taxonomy
≠ Human truth
≠ production decision rule
```

아래 required는 `required: true`인 positive indicator, optional은 나머지 positive indicator, negative는 `polarity: -1` indicator다.

### A.1 Archetype별 indicator 구조

| Archetype | Required positive indicators | Optional positive indicators | Negative indicators |
| --- | --- | --- | --- |
| `wolf` | `eyes.eyeLength = long` (1), `visualLanguage.straightCurveBalance = straight` (1) | `eyes.eyeDirection = upturned/level` (0.75), `visualLanguage.contourDefinition = defined` (0.75), `vertical.faceLengthBalance = long` (0.75) | `visualLanguage.straightCurveBalance = curved` (-0.75) |
| `cat` | `eyes.eyeDirection = upturned` (1), `featureLayout.featureConcentration = centered` (1) | `eyes.eyeLength = long` (0.75), `visualLanguage.featureContrast = medium/high` (0.75), `visualLanguage.straightCurveBalance = balanced/straight` (0.5) | `featureLayout.featureConcentration = spread` (-0.75) |
| `puppy` | `eyes.eyeOpenness = medium/wide` (0.75), `visualLanguage.straightCurveBalance = curved` (1) | `eyes.eyeDirection = level/downturned` (0.75), `visualLanguage.contourDefinition = soft` (1), `visualLanguage.featureContrast = low/medium` (0.5) | `outline.jawlineAngularity = angular` (-0.75) |
| `deer` | `vertical.faceLengthBalance = long` (1), `eyes.eyeOpenness = wide` (1) | `outline.jawTaper = tapered` (0.75), `visualLanguage.contourDefinition = soft/moderate` (0.5), `visualLanguage.featureContrast = low/medium` (0.5) | `outline.jawlineAngularity = angular` (-0.75) |
| `tofu` | `visualLanguage.featureContrast = low` (1), `visualLanguage.contourDefinition = soft` (1) | `visualLanguage.straightCurveBalance = curved/balanced` (0.75), `outline.jawlineAngularity = soft` (0.75), `featureLayout.featureConcentration = balanced` (0.5) | `visualLanguage.featureContrast = high` (-1) |
| `potato` | `vertical.faceLengthBalance = short` (1), `outline.faceShape = round/mixed` (1) | `visualLanguage.straightCurveBalance = curved` (0.75), `featureLayout.featureConcentration = centered` (0.75), `outline.jawTaper = balanced/broad` (0.5) | `vertical.faceLengthBalance = long` (-1) |
| `dino` | `featureLayout.featureScale = large/mixed` (1), `outline.jawlineAngularity = angular` (1) | `outline.cheekboneProminence = prominent` (0.75), `visualLanguage.straightCurveBalance = straight` (0.75), `visualLanguage.contourDefinition = defined` (0.75) | `featureLayout.featureScale = small` (-1) |

괄호 안 숫자는 현재 registry weight이며 production truth가 아니다. 모든 indicator는 available field와 비어 있지 않은 evidence를 요구한다.

### A.2 Shared fields와 overlapping expected values

| Shared field | Archetype overlap | Overlapping expected values | Calibration 질문 |
| --- | --- | --- | --- |
| `eyes.eyeLength` | `wolf`, `cat` | `long` | eye direction, concentration, straightness가 pair를 충분히 분리하는가? |
| `eyes.eyeDirection` | `wolf`, `cat`, `puppy` | `wolf/cat: upturned`, `wolf/puppy: level` | shared eye direction이 독립적 구조 축 없이 margin을 과도하게 좁히는가? |
| `eyes.eyeOpenness` | `puppy`, `deer` | `wide` | face length와 taper가 Human close-pair ambiguity를 설명하는가? |
| `vertical.faceLengthBalance` | `wolf`, `deer`, `potato` | `wolf/deer: long`; `potato`에는 long이 negative | long-face 후보 분리와 potato contradiction이 안정적인가? |
| `straightCurveBalance` | `wolf`, `cat`, `puppy`, `tofu`, `potato`, `dino` | straight, curved, balanced가 여러 후보에 공유됨 | 가장 넓게 공유되는 축이 다른 required axis를 압도하지 않는가? |
| `contourDefinition` | `wolf`, `puppy`, `deer`, `tofu`, `dino` | `wolf/dino: defined`; `puppy/deer/tofu: soft` | defined cluster와 soft cluster 내부를 다른 축이 충분히 분리하는가? |
| `featureContrast` | `cat`, `puppy`, `deer`, `tofu` | `cat/puppy/deer: medium`; `puppy/deer/tofu: low` | low/medium boundary와 tofu의 high negative가 Human 판정과 일치하는가? |
| `featureConcentration` | `cat`, `tofu`, `potato` | `cat/potato: centered`; `tofu: balanced` | centered contribution이 cat-potato를 불필요하게 가깝게 만드는가? |
| `jawlineAngularity` | `puppy`, `deer`, `tofu`, `dino` | angular는 puppy/deer negative이자 dino required; soft는 tofu positive | angular/soft 관찰의 availability와 confidence가 cluster 분리에 충분한가? |
| `jawTaper` | `deer`, `potato` | 직접 overlap 없음 (`tapered` 대 `balanced/broad`) | 값 경계가 pair separation에 안정적으로 기여하는가? |
| `featureScale` | `dino` | `large/mixed` positive, `small` negative | 단일 archetype 전용 축의 관찰 안정성과 bias를 검증할 수 있는가? |

### A.3 Candidate close pairs / clusters

현재 source overlap에서 우선 검토할 수 있는 후보는 다음과 같다. 이는 확정 label 관계가 아니다.

- `wolf` ↔ `cat`: long eye, upturned direction, straight 계열 overlap
- `wolf` ↔ `dino`: straight balance와 defined contour overlap
- `puppy` ↔ `deer`: wide eye, soft contour, low/medium contrast overlap
- `puppy` ↔ `tofu`: curved balance, soft contour, low contrast overlap
- `tofu` ↔ `potato`: curved/balanced visual language와 부드러운 형태 cluster
- `cat` ↔ `potato`: centered feature concentration overlap
- `wolf` ↔ `deer`: long face balance overlap
- `puppy` / `deer` / `tofu` cluster: soft·low-contrast 계열의 다중 overlap
- `wolf` / `dino` cluster: straight·defined 구조의 overlap

이 후보는 development evaluation의 stratification과 error analysis 시작점이다. Human annotation과 real evidence 없이 taxonomy merge, split 또는 weight 변경의 근거로 사용하지 않는다.
