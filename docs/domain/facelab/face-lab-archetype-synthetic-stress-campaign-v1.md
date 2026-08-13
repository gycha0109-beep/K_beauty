# Face Lab Archetype Synthetic Stress Campaign Contract v1

## 0. 상태

| 항목 | 값 |
| --- | --- |
| 단계 | `FACE-EVAL-C` |
| 계약 | `face-lab-archetype-synthetic-stress-campaign-v1` |
| 기준 registry | `face-lab-archetype-rubric-20260727` |
| Synthetic campaign execution | **아직 차단** |
| 차단 이유 | required rubric axis 일부가 generation cue registry에 없고 Archetype taxonomy metadata registry가 비활성 |
| Provider call | 없음 |
| Synthetic asset write | 없음 |
| Production 연결 | 없음 |
| Weight / threshold 변경 | 없음 |
| Production activation | 없음 |

이 문서는 FACE-EVAL-A와 FACE-EVAL-B 이후의 Synthetic Archetype Stress Campaign 경계를 고정한다. 이번 단계는 실제 이미지를 생성하는 작업이 아니라, **무엇을 어떤 authority로 stress할지, 현재 generator가 어디까지 표현 가능한지, 어떤 상태에서 campaign execution을 허용할지**를 명시한다.

현재 `campaignExecutionReady = false`다. 이 상태를 숨기거나 generation prompt에 Archetype 이름을 직접 넣어 우회하면 안 된다.

---

## 1. 목적

Synthetic Archetype Stress Campaign의 목적은 다음을 탐색·진단하는 것이다.

- rubric required axis가 관찰 결과에서 실제로 확보되는지
- explicit negative indicator가 contradiction으로 기록되는지
- required axis가 보이지 않을 때 scorer가 임의 분류하지 않는지
- 가까운 후보 사이에서 ranking / margin / ambiguity가 어떻게 움직이는지
- 낮은 evidence coverage가 어떻게 나타나는지
- 작은 capture variation에서 ranking이 불필요하게 뒤집히는지
- generation-side signal weakness와 observation-side miss 후보를 분리해 기록할 수 있는지

이 campaign은 실제 사람의 최종 Archetype truth를 확정하지 않는다.

---

## 2. Authority Boundary

항상 다음을 분리한다.

```text
Generation intent
!= Generated image
!= Observed visual fact
!= Shadow scorer output
!= Human annotation
!= Human consensus
!= Synthetic promotion
!= Real calibration authority
!= Production activation
```

특히:

```text
"cat을 만들려고 했다"
!=
"이미지가 cat이다"
```

Generation target은 의도 metadata다. Observed visual facts와 독립적으로 추적한다.

Synthetic evidence는 controlled boundary / observation failure / deterministic regression을 stress할 수 있지만 Real Human calibration authority를 대신하지 않는다.

---

## 3. Current Archetype Hypothesis Set

현재 registry의 후보는 다음 7개다.

```text
wolf
cat
puppy
deer
tofu
potato
dino
```

현재 상태:

```text
registry.lifecycle = rubric_ready
registry.calibrationStatus = not_ready
archetype calibration = unvalidated
productionEligible = false
status = held
decision = null
```

이 목록은 validated production taxonomy가 아니다.

---

## 4. Current Generation Authority

현재 공용 `generation-spec-v1`에는 `archetypeIntent` 구조가 존재하지만 taxonomy registry는 비어 있다.

```text
ENABLED_ARCHETYPE_TAXONOMIES = {}
```

또한 `archetypeIntent.compilationMode`는 `metadata_only`만 허용한다.

Prompt compiler는 `archetypeIntent`를 읽지 않는다. 이는 의도된 안전 경계다.

따라서 향후 Archetype metadata를 활성화하더라도 다음은 금지한다.

```text
primary = cat
→ prompt에 "cat face" 직접 삽입
```

허용 방향은 다음이다.

```text
Archetype metadata
+ versioned rubric-derived visible cue plan
→ featureIntent
→ neutral feature prompt
```

Archetype token 자체는 generation prompt로 컴파일하지 않는다.

---

## 5. Current Generation Cue Coverage

현재 generator가 직접 제어할 수 있는 visible axis:

- `eyeDirection`
- `eyeOpenness`
- `faceLengthBalance`
- `jawlineAngularity`
- `straightCurveBalance`
- `featureContrast`

현재 Archetype rubric에서 사용하지만 generation cue registry에 없는 axis:

- `eyeLength`
- `featureConcentration`
- `contourDefinition`
- `faceShape`
- `featureScale`
- `cheekboneProminence`
- `jawTaper`

이 중 **required indicator를 구성하는데도 빠진 axis**:

- `eyeLength`
- `featureConcentration`
- `contourDefinition`
- `faceShape`
- `featureScale`

따라서 현재 generator로는 7개 후보의 required-axis stress를 완전하게 구성할 수 없다.

### 후보별 required-axis readiness

| Archetype | Required indicator | Current generation cue |
| --- | --- | --- |
| wolf | `eyeLength=long` | BLOCKED |
| wolf | `straightCurveBalance=straight` | supported |
| cat | `eyeDirection=upturned` | supported |
| cat | `featureConcentration=centered` | BLOCKED |
| puppy | `eyeOpenness=medium|wide` | supported |
| puppy | `straightCurveBalance=curved` | supported |
| deer | `faceLengthBalance=long` | supported |
| deer | `eyeOpenness=wide` | supported |
| tofu | `featureContrast=low` | supported |
| tofu | `contourDefinition=soft` | BLOCKED |
| potato | `faceLengthBalance=short` | supported |
| potato | `faceShape=round|mixed` | BLOCKED |
| dino | `featureScale=large|mixed` | BLOCKED |
| dino | `jawlineAngularity=angular` | supported |

Campaign execution을 시작하기 전에 위 BLOCKED axis를 observation enum과 정확히 일치하는 versioned cue로 지원해야 한다.

---

## 6. Stress Kinds

FACE-EVAL-C v1은 최소 다음 stress kind를 구분한다.

### 6.1 `required_axis_positive`

한 후보의 required indicator를 의도적으로 visible cue로 구성한다.

질문:
- blind observation에서 해당 axis가 관찰되는가
- required evidence가 실제로 생기는가
- scorer ledger가 해당 positive contribution을 기록하는가

Generation intent가 성공을 의미하지 않는다.

### 6.2 `negative_contradiction`

해당 후보의 explicit negative indicator 값을 의도적으로 구성한다.

질문:
- observer가 실제 opposite cue를 관찰하는가
- scorer가 absence가 아니라 **explicit observed opposite value**에서만 contradiction을 기록하는가

### 6.3 `missing_required_axis`

required axis를 가리거나 모호하게 만드는 controlled condition을 사용한다.

질문:
- unavailable / insufficient evidence가 0 contribution으로 남는가
- 임의 negative contribution이 생기지 않는가
- hold path가 강제 분류보다 우선하는가

### 6.4 `close_pair_boundary`

rubric overlap이 큰 후보를 경계 사례로 다룬다.

이것은 taxonomy truth 선언이 아니라 **현재 rubric overlap에서 파생된 stress hypothesis**다.

후보 pair:

- wolf / cat
- puppy / deer
- puppy / tofu
- deer / tofu
- cat / potato
- wolf / dino

### 6.5 `low_evidence`

관찰 가능한 positive-weight axis 일부만 남긴다.

질문:
- `score`와 `evidenceCoverage`가 분리되는가
- 높은 단일 cue 때문에 근거 부족이 숨겨지지 않는가

### 6.6 `observation_failure`

Human 또는 독립 검토에서 비교적 명확한 visible cue가 있는데 observation layer가 이를 available evidence로 만들지 못하는 사례를 진단한다.

표현:

`observation-side miss possible`

원인 확정은 금지한다.

### 6.7 `capture_stability`

동일 synthetic subject lineage에서 작은 capture variation을 준다.

예:
- ordinary lighting variation
- reasonable crop variation
- minor expression variation
- small pose variation within eligibility

질문:
- 같은 구조 signal에서 ranking이 불필요하게 뒤집히는가
- variation이 observation quality 문제인지 ambiguity인지 scorer sensitivity인지 분리 가능한가

Eligibility를 깨는 강한 perturbation은 stability test와 섞지 않는다.

---

## 7. Close-Pair Evaluation

7-class accuracy 하나만 보지 않는다.

각 close pair에서 다음을 기록한다.

- separating visible axes
- shared axes
- required axis availability
- Human ambiguity가 있는 경우 그 분포
- engine top-1 / top-k
- top margin
- contradiction count
- evidence coverage
- hold state

현재 close pair는 **rubric-overlap candidate**일 뿐 최종 taxonomy 관계가 아니다.

---

## 8. Blind Flow

Synthetic stress candidate는 다음 순서를 따른다.

```text
Stress scenario sealed
→ GenerationSpec finalized
→ prompt compiled
→ candidate generated/imported
→ technical + eligibility gate
→ generation target hidden
→ blind observation
→ 필요한 Human/independent judgment sealed
→ scorer shadow evaluation
→ intent reveal
→ target alignment / diagnostics
→ purpose-scoped promotion review
→ report
```

다음 순서는 금지한다.

```text
generation target 공개
→ observer가 target을 참고해 evidence 작성
```

또한 engine output을 Human reviewer에게 먼저 보여주지 않는다.

---

## 9. Stress Scenario Identity

향후 executable scenario artifact는 최소 다음 identity를 추적해야 한다.

- stress contract version
- scenario id
- stress kind
- taxonomy version
- registry version
- target archetype metadata
- optional secondary archetype metadata
- intended visible cue set
- generation spec id / digest
- provider profile version
- candidate id / asset digest
- observation schema / prompt version
- scorer version
- Human annotation / consensus version if used
- reveal/alignment artifact
- run id / timestamp

Scenario target는 generated truth가 아니다.

---

## 10. Cue Construction Rules

1. cue는 observation enum과 정확히 대응해야 한다.
2. Archetype 이름을 visual cue처럼 사용하지 않는다.
3. 한 scenario에 너무 많은 cue를 몰아넣어 causal diagnosis를 어렵게 하지 않는다.
4. required-axis test와 optional-axis test를 분리할 수 있어야 한다.
5. contradiction은 명시적 negative expected value로 구성한다.
6. missing axis는 absence를 negative label로 바꾸지 않는다.
7. 생성 강도는 realistic boundary를 유지한다.
8. exaggerated caricature를 금지한다.

---

## 11. Scorer Capture

Stress report에는 최소 다음을 보존한다.

- ranking
- raw score
- evidence coverage
- contradiction count
- required-axis availability
- contribution ledger summary
- top candidate if shadow contract상 존재
- hold reason

Ledger의 raw evidence sentence를 장기 report로 복제하지 않는다. Path / polarity / weight / field status / evidence availability / matched / confidence / quality multiplier / contribution 같은 구조 정보만 사용한다.

---

## 12. Diagnostics

허용 diagnostic flags:

- `generation-side signal weak possible`
- `observation-side miss possible`
- `rubric-side mismatch possible`
- `ambiguous visual cue`
- `contract limitation`
- `reviewer limitation`
- `insufficient coverage`

Diagnostic flag는 causal proof가 아니다.

예:

```text
Human-visible cue present
+ observation unavailable
→ observation-side miss possible
```

가능성 표시는 허용하지만 Provider 또는 observer의 원인으로 단정하지 않는다.

---

## 13. Metrics

FACE-EVAL-A의 metric 정의를 사용한다. 이번 단계에서 pass threshold 숫자를 만들지 않는다.

### Ranking
- Top-1 agreement
- Top-k overlap
- rank agreement / correlation

### Ambiguity
- close-rank behavior
- Human ambiguity vs engine margin
- pairwise confusion

### Hold
- inappropriate forced-decision rate
- appropriate hold behavior
- decision coverage

### Evidence
- evidence coverage
- missing-required-axis rate
- contradiction rate

### Stability
- same-lineage capture variation

모든 percentage에는 denominator가 있어야 한다.

---

## 14. Variation Strata

Synthetic stress에서 조건 분포를 다양화할 수 있다.

- feminine / masculine / androgynous presentation
- adult age presentation bands
- complexion / skin-tone presentation
- makeup coverage condition
- ordinary lighting/capture condition

이 항목들은 scorer input이 아니다. Failure stratification 용도다.

Synthetic distribution으로 population fairness를 증명하지 않는다.

---

## 15. Provider Boundary

Provider 비교는 허용되지만 Provider output 자체를 truth로 취급하지 않는다.

Provider call 전 필수:

- campaign execution readiness PASS
- generation cue coverage PASS
- taxonomy metadata boundary PASS
- prompt archetype-token leakage test PASS
- provider profile enabled/approved
- synthetic-only attestation
- source freeze
- budget freeze

현재는 readiness가 FAIL이므로 Provider call을 하지 않는다.

---

## 16. Synthetic Promotion

기존 promotion contract의 `face_feature_control`은 internal synthetic evaluation Gold 용도를 지원한다.

그러나 FACE-EVAL-C candidate가 다음 단계를 자동으로 얻는 것은 아니다.

```text
generated
!= G4
!= holdout
!= Real Gold
```

Purpose-specific promotion, usage rights, leakage review, observation/alignment evidence가 별도로 필요하다.

Archetype stress target alignment가 좋다는 사실만으로 Real calibration authority로 승격하지 않는다.

---

## 17. Real Human Calibration과의 관계

Synthetic stress와 Real calibration 준비는 병행 가능하다.

Synthetic이 제공하는 것:
- controlled boundary evidence
- observation failure candidates
- contradiction rehearsal
- pipeline regression fixtures
- prompt/provider generation diagnostics

Real Human calibration이 제공해야 하는 것:
- 실제 얼굴의 Human consensus
- 실제 ambiguity distribution
- production threshold validation
- real capture variation
- protected validation / locked holdout

Synthetic 결과만으로 FACE-ENGINE-2 weight/threshold를 production 값으로 확정하지 않는다.

---

## 18. Privacy / Storage

- real-person reference를 조용히 도입하지 않는다.
- synthetic-only provenance를 보존한다.
- normal Face Lab saved report에 synthetic workspace raw asset을 넣지 않는다.
- Provider raw payload를 production DB에 저장하지 않는다.
- campaign asset/report는 production application storage와 분리한다.

---

## 19. Explicit Non-Goals

이번 contract 단계에서는 하지 않는다.

- 실제 image generation
- Provider call
- Synthetic workspace write
- Human review execution
- Real user photo collection
- DB migration
- Hosted write
- registry weight 변경
- threshold 값 선택
- taxonomy lifecycle 승격
- `calibrationStatus=ready`
- `productionEligible=true`
- canonical Archetype wiring
- API/UI 변경
- Style Identity / Hair / Makeup / Look Composer 구현

---

## 20. Execution Readiness Gate

FACE-EVAL-C campaign 실행 전 최소 다음이 필요하다.

### Gate C-GEN-1 — Rubric Cue Coverage

모든 current rubric indicator axis, 특히 모든 required axis가 neutral observation-backed generation cue로 표현 가능해야 한다.

현재 FAIL:

```text
missing required axes:
contourDefinition
eyeLength
faceShape
featureConcentration
featureScale
```

### Gate C-GEN-2 — Archetype Metadata Registry

현재 7-key taxonomy version을 generation contract에 metadata-only로 등록해야 한다.

조건:
- prompt compiler는 Archetype token을 읽지 않음
- taxonomy/version mismatch fail closed
- primary/secondary metadata는 intent일 뿐 truth가 아님

현재 FAIL: taxonomy registry disabled.

### Gate C-GEN-3 — Prompt Leakage

컴파일된 prompt에 raw Archetype token이 들어가지 않아야 한다.

### Gate C-GEN-4 — Deterministic Scenario Contract

Stress scenario → GenerationSpec mapping이 versioned/deterministic해야 한다.

### Gate C-GEN-5 — Campaign Freeze

Provider 실행 전 scenario matrix, budget, provider profile, source versions를 freeze한다.

---

## 21. Immediate Next Work

이 contract 승인 후 바로 다음 sub-gate:

```text
FACE-EVAL-CG — Archetype Generation Cue Coverage Enablement
```

해야 할 일:

1. observation enum을 authority로 missing generation cue axes 추가
2. current 7-key taxonomy를 generation metadata-only registry에 등록
3. `archetype_stress` 또는 동등한 purpose compatibility 고정
4. compiler에 neutral visible-feature phrase 추가
5. raw Archetype token prompt leakage negative test
6. current skin-cue snapshots byte-invariant 검증
7. all current rubric indicator axes coverage verifier PASS

그 후:

```text
FACE-EVAL-CS — Stress Scenario Freeze
→ controlled synthetic generation
→ blind observation / scoring
→ reveal / alignment
→ stress report
```

---

## 22. Production Activation Separation

FACE-EVAL-C 완료는 production activation이 아니다.

```text
Synthetic stress complete
!= Real calibration complete
!= Weight calibration complete
!= Threshold calibration complete
!= Locked holdout passed
!= Production activated
```

최종 production activation은 Real calibration, validation, locked holdout, rollback 및 explicit activation review 이후 별도 PR/approval로만 가능하다.
