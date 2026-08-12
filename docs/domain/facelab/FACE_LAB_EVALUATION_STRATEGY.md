# FACE LAB EVALUATION STRATEGY

> 상태: Face Lab 평가 방법론 기준 문서
> 범위: synthetic evaluation, Human annotation, consensus, calibration, promotion, holdout, evidence interpretation
> 제품 아키텍처는 `FACE_LAB_MASTER_SPEC.md`가 담당한다.
> 현재 구현 상태는 `FACE_LAB_CURRENT_STATE.md`가 담당한다.

## 1. 핵심 원칙

Face Lab은 생성, 관찰, 판정, calibration, 승격을 분리해야 한다.

```text
Generation intent
≠ observed visual fact
≠ Archetype decision
≠ Human consensus
≠ dataset promotion
≠ production activation
```

가장 중요한 불변식:

> 프롬프트가 어떤 특징이나 대표 상을 만들라고 요청했다는 이유만으로 생성 결과를 정답 데이터로 취급하지 않는다.

## 2. 평가 근거의 종류

서로 다른 질문은 서로 다른 평가 근거로 검증한다.

### 2.1 Technical fixture

검증 대상:

- parser / schema
- 이미지 검증
- eligibility
- failure state
- storage / reentry
- deterministic replay
- 개인정보 경계
- version drift

이 영역에는 synthetic 또는 수작업 fixture를 사용할 수 있다.

### 2.2 Controlled synthetic evidence

용도:

- 통제된 visual cue test
- coverage / stress test
- observation failure 탐지
- ambiguity / hold 검증
- rubric contradiction 탐지
- generation/provider 비교
- 탐색적 Archetype indicator 검증

Synthetic candidate는 현재 promotion contract 아래에서 특정 평가 목적의 Synthetic Gold가 될 수 있다.

그러나 그 경우에도 **generation intent 자체가 observed truth가 되는 것은 아니다.** 또한 Synthetic Gold가 real-world calibration을 대신하지 않는다.

### 2.3 Human-annotated real evidence

용도:

- 실제 얼굴의 Archetype calibration
- ambiguity distribution
- ranking / hold 검증
- 스타일 언어의 실제 적합성
- production threshold 검증
- 관련 집단·조건별 coverage 검증
- locked real holdout

실제 사용자 얼굴에서 production Archetype 성능을 판단할 때는 이 근거가 더 높은 authority를 갖는다.

## 3. Synthetic campaign 전체 흐름

```text
Campaign Specification
→ GenerationSpec
→ Prompt Compiler
→ Generated Candidate
→ technical / eligibility gate
→ blind observation
→ 필요한 경우 blind Human 또는 독립 judge 검토
→ sealed judgment / consensus
→ intent reveal
→ target alignment
→ purpose-specific promotion
→ report / dataset placement / holdout
```

생성과 평가는 각각 독립적으로 추적 가능해야 한다.

## 4. Generation 책임

Generation 계층의 책임은 다음으로 제한한다.

1. 생성 조건을 구조화한다.
2. Provider별 prompt로 컴파일한다.
3. generation provenance를 기록한다.
4. candidate identity와 파일 무결성을 보존한다.

Generation 계층은 실제 이미지의 정답 라벨을 확정하지 않는다.

`GenerationSpec`에 들어갈 수 있는 예:

- subject / capture variation
- intended Archetype target 또는 mixture
- skin cue target
- exclusion
- Provider profile

이 값들은 **의도 metadata**다.

## 5. Blind observation

Observation이 seal되기 전에는 generation target을 보여주지 않는다.

Observation 계층은 이미지와 observation contract를 보고 판단해야 한다. 생성 prompt나 intended target을 보고 판단하면 안 된다.

막으려는 확인 편향:

```text
prompt에 cat이라고 적혀 있음
→ 관찰자가 cat 근거를 찾기 시작
```

Observation은 field-level, evidence-backed 상태를 유지한다.

## 6. Human 판정과 consensus

Human review는 AI 결과에 도장만 찍는 절차가 아니다. 독립적인 evidence source다.

### 6.1 Archetype annotation

Production calibration용 annotation은 강제 top-1 하나보다 더 많은 정보를 보존해야 한다.

최소 표현 가능해야 하는 개념:

- 1순위 대표 상
- 의미가 있을 경우 2·3순위 후보
- confidence
- visible evidence tag
- `uncertain` / `not assessable`
- 가까운 Archetype 사이의 ambiguity

정확한 schema는 후속 contract에서 확정할 수 있다. 다만 구현 편의를 위해 ambiguity를 삭제하면 안 된다.

### 6.2 Reviewer 수

모든 탐색용 이미지에 같은 수의 reviewer를 붙일 필요는 없다.

권장 원칙:

- 합의가 높은 exploratory sample은 가벼운 검토 가능
- 충돌·경계 사례는 Human 검토 강화
- benchmark와 locked holdout은 복수의 독립 Human 판정 필요
- production calibration을 단일 reviewer 의견 하나에 의존하지 않음

### 6.3 Consensus

Archetype은 모든 사람이 언제나 같은 답을 내는 단일 자연과학 정답으로 취급하지 않는다.

Consensus는 다음을 보존하는 방향이 적합하다.

- top-k agreement
- ranking agreement
- confidence distribution
- disagreement / ambiguity
- evidence-tag agreement

강제 top-1을 만들 수 없는 경우에도 consensus distribution 자체가 유효한 평가 근거가 될 수 있다.

## 7. Archetype Scoring 평가

Bejewely Archetype Engine은 generation prompt가 아니라 observations에서 평가한다.

```text
FaceLabObservationAnalysis
→ deterministic rubric scorer
→ ranking / contribution ledger
→ hold checks
```

평가 질문 예:

- Human consensus top-k와 engine top-k가 얼마나 겹치는가
- controlled synthetic test에서 intended archetype이 관찰 결과상 합리적인 rank에 들어오는가
- 서로 가까운 archetype이 실제로 의도한 evidence axis에서 구분되는가
- required axis가 없을 때 임의 분류 대신 hold되는가
- low margin, contradiction 사례가 hold되는가
- weight가 관련 appearance variation에서도 안정적인가
- 촬영 조건의 작은 변화에서 결과가 불필요하게 뒤집히지 않는가

## 8. Intent Alignment

Intent alignment는 blind observation / judgment가 seal된 뒤에만 수행한다.

평가 목적별로 intended value와 observed value를 각각 비교한다.

예:

```text
capture control      → pass
archetype stress     → pass
redness cue          → pass
blemish cue          → fail
```

하나의 이미지에 `좋음/나쁨` 통합 점수 하나를 붙이는 방식은 피한다.

한 candidate가 어떤 목적에는 적합하고 다른 목적에는 부적합할 수 있기 때문이다.

## 9. 목적별 승격

Dataset eligibility는 평가 목적별로 관리한다.

Candidate가 보유할 수 있는 용도 예:

- technical fixture
- observation evaluation
- archetype evaluation
- skin-cue evaluation
- styling evaluation
- holdout

승격은 그 목적이 요구하는 evidence를 기준으로 해야 한다.

생성 성공이나 alignment 한 개만으로 승격하지 않는다.

Synthetic Gold와 Real Gold는 별도 계열로 유지한다.

## 10. Synthetic과 Real의 authority 차이

### 10.1 Synthetic이 적합한 영역

- controlled perturbation
- 드문 boundary case 생성
- negative control
- observation stress test
- deterministic regression
- pipeline rehearsal
- 탐색적 rubric 분석
- generation-side / observation-side failure 후보 탐지

### 10.2 Synthetic만으로 확정하면 안 되는 영역

- 실제 얼굴의 최종 Archetype truth
- production threshold activation
- population-level 성능 주장
- demographic fairness 주장
- 실제 사용자가 스타일링을 유용하게 느끼는지에 대한 증명

생성 모델은 target의 영향을 받아 이미지를 만든다. 따라서 생성 target은 생성 결과와 독립된 정답 근거가 아니다.

### 10.3 Real calibration

Production calibration은 선택 동의를 받은 실제 사람 평가 데이터와 다음 구조를 사용하는 방향이 적절하다.

- explicit evaluation consent
- independent annotation
- benchmark / holdout 복수 reviewer
- subject-level split
- versioned taxonomy / rubric
- ambiguity 보존
- 필요한 철회·삭제 governance

## 11. AI 순환 평가 금지

다음 구조만으로 검증을 끝내면 안 된다.

```text
AI가 “cat” 이미지를 생성
→ AI가 “cat”이라고 판정
→ system이 cat ground truth로 확정
```

독립 AI judge는 진단용 근거로 활용할 수 있다. 그러나 production calibration을 AI가 AI-generated target을 다시 판정한 결과만으로 확정하면 안 된다.

## 12. Leakage와 Dataset Split

개발 데이터와 holdout 사이의 leakage를 막아야 한다.

최소 원칙:

- exact / near-duplicate family를 보호된 split 사이에 나누지 않음
- 실제 사람의 same-subject 이미지를 같은 그룹으로 묶음
- 같은 source, seed, reference 관계에서 파생된 generated variant를 서로 독립 샘플처럼 취급하지 않음
- 개발에 사용한 taxonomy / rubric version 기록
- locked holdout을 반복 열어 weight tuning에 사용하지 않음

## 13. Version과 provenance

중요한 평가 artifact는 관련 version을 추적할 수 있어야 한다.

- observation contract
- taxonomy / registry
- scoring engine
- synthetic인 경우 generation spec / compiler / Provider profile
- reviewer / consensus contract
- promotion policy
- dataset split / version
- report / calibration run

코드가 바뀐 뒤에도 과거 평가 결과가 어떤 기준으로 만들어졌는지 해석할 수 있어야 한다.

## 14. 개인정보와 권리

Synthetic과 Real은 governance 문제가 다르다.

### Synthetic

- 내부 평가 목적에 대한 Provider 사용 권리 검토
- real-person reference image 사용을 조용히 도입하지 않음
- candidate provenance 보존

### Real

- 평가 활용은 별도의 명시적 선택 동의 필요
- source image와 식별정보는 일반 production report와 분리된 보호 경계 필요
- service-use consent는 evaluation consent가 아님
- 실제 수집 전 withdrawal / deletion 규칙 확정
- raw image가 일반 saved report로 유입되지 않도록 분리

## 15. Diagnostic 해석

평가 실패를 곧바로 하나의 원인으로 단정하지 않는다.

유용한 diagnostic 개념:

- **generation-side signal weak possible**: target cue가 충분히 강하게 생성되지 않았을 가능성
- **observation-side miss possible**: 독립적으로 확인 가능한 cue를 observation layer가 놓쳤을 가능성
- **ambiguous visual cue**: generation weakness와 observer miss를 구분하기 어려움
- **contract limitation**: 현재 schema가 필요한 구분을 표현하지 못함
- **reviewer limitation**: 해당 reviewer가 특정 axis를 신뢰성 있게 판정하기 어려움

이 표시는 원인 확정이 아니라 진단용 evidence flag다.

## 16. 첫 Controlled Skin-Cue Pilot에서 확정한 평가 원칙

첫 diversified skin-cue pilot에서 다음을 확인했다.

1. Human uncertainty는 uncertainty로 남겨야 한다. 성공/실패로 대입하지 않는다.
2. cue별 denominator를 분리해야 한다.
3. Human↔Target, T4↔Target, Human↔T4는 서로 다른 관계다.
4. observation contract가 지원하지 않는 count 등은 `not_available` / `not_comparable`로 남긴다.
5. Human에게 비교적 명확한 cue를 T4가 놓친 사례는 observation-side miss 후보로 표시할 수 있지만 전체 원인을 확정하지 않는다.
6. 평가 파이프라인이 기술적으로 완주했다는 사실만으로 production calibration을 승인하지 않는다.

## 17. Archetype Calibration Program

다음 Archetype 평가 프로그램은 아래 순서가 적절하다.

```text
A. Calibration Protocol
   질문, 평가 축, metric, hold 기준, reviewer contract 정의

B. Human Annotation / Consensus Contract
   label, ranking, evidence tag, uncertainty, reviewer independence 정의

C. Synthetic Archetype Stress Set
   rubric boundary와 observation failure stress test

D. Real Calibration Set
   선택 동의, 독립 annotation, subject grouping

E. Weight / Threshold Calibration
   development data에서 rubric과 hold policy 조정

F. Locked Validation / Holdout
   추가 tuning 없이 평가

G. Production Activation Review
   taxonomy와 threshold가 production에 준비됐는지 별도 판단
```

Synthetic stress 작업과 Real-data 준비는 병행할 수 있다.

그러나 Synthetic 결과만으로 production ArchetypeDecision을 활성화하지 않는다.

## 18. 과거 자료에서 승계한 내용

이 문서는 다음 자료에서 현재도 유효한 평가 원칙을 통합했다.

- `Face_Lab_구현_명세_0716_수정본.md`
- `face_lab_진행상황_0727.txt`
- `bejewely-face-analyze-pipeline-07-30.txt`

특히 07-30에서 정리한 generation / judgment / promotion 분리 구조는 현재도 핵심 원칙이다. 실제 세부 실행 의미는 current repository의 최신 synthetic contract와 코드가 담당한다.
