# Face Lab Face Space & Style Compatibility Architecture v1

> Track: FACE LAB / Core Architecture  
> Status: Architecture authority candidate  
> Scope: normalized face representation, Face Space, Archetype projection, Style Space, compatibility research, controlled 3D experimentation  
> Production impact: none until separate implementation and activation contracts are approved

## 1. Purpose

Face Lab의 내부 모델을 특정 동물상 taxonomy에 종속시키지 않고, 사진에서 관찰 가능한 얼굴 구조를 재사용 가능한 연속 표현으로 정규화한 뒤 그 위에 여러 해석과 스타일 추천을 올리는 구조를 정의한다.

핵심 관계는 다음이다.

```text
Photo
→ Eligibility / Quality
→ FaceLabObservationAnalysis
→ Normalized Face Representation
→ Face Space
   ├─ Archetype Projection
   └─ Style Compatibility
```

사용자 화면에서는 늑대상, 고양이상, 강아지상, 사슴상, 두부상, 감자상, 공룡상 같은 직관적인 언어를 계속 사용할 수 있다.

그러나 내부 추천 엔진의 기본 단위는 Archetype label이 아니라 구조화된 얼굴 표현과 스타일 표현이다.

## 2. Product invariant

다음 원칙은 상위 불변식이다.

1. Archetype은 Face Space를 설명하는 해석 레이어다.
2. Archetype은 Style recommendation lookup key가 아니다.
3. Face Space는 현재 7개 Archetype보다 넓고 확장 가능해야 한다.
4. 현재 7개 Archetype은 empirical validation 대상 가설이며 고정 자연 분류가 아니다.
5. 새로운 Archetype을 추가하거나 기존 Archetype을 병합·분할·폐기해도 Face Representation 계약이 깨지면 안 된다.
6. Style recommendation은 `Face Representation × Style Representation × Compatibility Evidence`를 기준으로 한다.
7. 특정 헤어스타일명, 안경 상품명, 메이크업 룩명은 엔진의 기본 표현이 아니라 사용자·카탈로그 번역 레이어다.
8. 검색 결과에서 자주 함께 등장했다는 사실만으로 "잘 어울린다"를 확정하지 않는다.
9. Synthetic/3D/VLM 실험은 compatibility evidence를 만들 수 있지만 실제 사용자 선호의 절대적 truth를 자동 증명하지 않는다.
10. 불확실성이 충분히 줄지 않으면 추천을 강제하지 않고 hold 또는 넓은 범위 추천으로 남긴다.

## 3. Normalized Face Representation

`Normalized Face Representation`은 현재 `FaceLabObservationAnalysis`를 대체하는 것이 아니라 그 위에 구축되는 재사용 표현 계층이다.

목표 예시는 다음과 같다.

```text
geometry
- face aspect ratio
- upper / mid / lower-face proportions
- forehead width / height relations
- cheekbone width / position
- jaw width
- jaw angle
- chin width / projection proxy

eyes
- eye width
- aperture
- inter-eye spacing
- eye tilt
- eye prominence proxy
- eye-to-face scale

feature relations
- brow-eye relation
- nose-to-face proportions
- mouth-to-lower-face proportions
- central feature concentration
- horizontal / vertical placement relations

visual structure
- line / curve tendency
- contour angularity
- feature contrast
- visual weight distribution
- structural prominence

quality / uncertainty
- status
- confidence
- evidence
- missingness
- capture limitations
```

정확한 field set, scale, normalization, units는 별도 contract에서 versioning한다.

### 3.1 구조와 presentation 분리

Face Representation에는 가능한 한 얼굴 구조 자체를 표현하는 축과 촬영·스타일 presentation 축을 구분한다.

구조 축 예:

- 얼굴 비율
- 윤곽과 턱 구조
- 광대 관계
- 눈 배치와 방향
- 특징 간 상대 비율

Presentation 축 예:

- 헤어 커버
- 메이크업
- 눈썹 styling
- 표정
- 조명
- 카메라 각도
- 포즈
- 이미지 처리

Presentation은 중요한 관찰 정보이지만 얼굴 구조 truth로 조용히 승격하지 않는다.

## 4. Face Space

Face Space는 Normalized Face Representation을 이용해 얼굴을 연속적인 다차원 공간에 배치하는 개념적·계산적 계층이다.

Face Space는 처음부터 특정 수의 Archetype cluster를 가정하지 않는다.

```text
Face Representation F
→ normalization / versioned transform
→ point or distribution in Face Space
```

한 사용자는 하나의 고정 class가 아니라 여러 연속 축의 조합으로 표현된다.

Face Space 구현은 초기에는 명시적 feature vector 기반일 수 있고, 충분한 근거가 생기면 별도 검증을 전제로 learned representation을 병행할 수 있다.

## 5. Archetype Projection Layer

Archetype은 Face Space에 대한 문화적·사용자 친화적 projection이다.

```text
Face Space
→ Archetype distributions / regions
→ User-facing interpretation
```

현재 seed taxonomy:

- wolf / 늑대상
- cat / 고양이상
- puppy / 강아지상
- deer / 사슴상
- tofu / 두부상
- potato / 감자상
- dino / 공룡상

각 Archetype은 단일 prototype 얼굴이 아니라 다음을 표현할 수 있어야 한다.

- center / centroid candidate
- feature distribution
- uncertainty
- within-label variation
- boundary region
- overlap with other labels
- unsupported or weakly separated dimensions

따라서 다음과 같은 결과가 가능하다.

```text
Face vector
→ wolf region affinity
→ cat region affinity
→ deer region affinity
...
```

이 값은 Face Lab 내부 표현 전체가 아니라 사용자 해석 projection이다.

## 6. Archetype empirical seed research

현재 Reverse Archetype 검색 연구는 폐기하지 않는다.

검색어 예:

- 늑대상
- 늑대상 얼굴
- 늑대상 연예인
- 늑대상 남자
- 늑대상 여자
- 늑대상 남자 연예인
- 늑대상 여자 연예인
- 늑대상 특징

다른 Archetype에도 동일한 구조를 사용한다.

그러나 목적은 더 이상 "늑대상의 정답 얼굴을 찾기"가 아니다.

목적은:

```text
Web cultural label context
→ blind structural observation
→ normalized face samples
→ Face Space placement
→ context rejoin
→ empirical distribution analysis
```

이다.

Search label은 ground truth가 아니라 "이 검색 맥락에서 노출된 결과"라는 provenance다.

## 7. General Face Corpus

Archetype seed corpus만으로 Face Space 전체를 만들면 공간 자체가 7개 label의 검색 편향에 종속될 수 있다.

따라서 장기적으로 별도의 unlabeled/general face corpus가 필요하다.

역할:

- 현재 7개 Archetype 밖의 얼굴 영역 확인
- label 간 빈 공간과 경계 확인
- taxonomy가 놓치는 구조 확인
- Face Space normalization 안정화
- Archetype 비의존 representation 검증

이 corpus는 current R-A2 pilot과 별도 acquisition/governance contract를 가져야 한다.

## 8. Style Representation

Style도 이름이 아니라 관찰·조작 가능한 속성으로 표현한다.

### 8.1 Hair Space 예

- forehead exposure
- part location / asymmetry
- crown volume
- side volume
- temple coverage
- fringe weight
- fringe direction
- hair length
- silhouette width / height
- curvature / straightness
- layer intensity
- texture density

### 8.2 Eyewear Space 예

- frame width
- frame height
- angularity
- curvature
- rim thickness
- bridge position
- lens aspect ratio
- visual weight
- brow alignment
- color contrast

### 8.3 Makeup Space 예

- brow thickness / angle
- eyeliner length / direction
- eye-shadow placement
- blush position / spread
- lip boundary / contrast
- skin finish
- feature emphasis distribution

### 8.4 Apparel / face-adjacent style 예

- neckline openness
- neckline geometry
- collar structure
- accessory scale
- accessory angularity
- material softness / structure
- face-near color contrast
- pattern intensity

정확한 Style Representation schema는 영역별 후속 contract에서 versioning한다.

## 9. Style name translation

실제 사용자에게는 애즈펌, 리프컷, 리젠트컷, 보스턴형 안경 등 현실의 이름이 필요할 수 있다.

그러나 추천 엔진은 다음 순서를 따른다.

```text
Face Representation
→ compatible Style Parameter region
→ catalog / style-name mapper
→ user-facing concrete examples
```

금지:

```text
wolf
→ 애즈펌
```

허용되는 방향:

```text
Face vector
→ forehead exposure 0.35~0.55
→ moderate side volume
→ moderate curvature
→ style catalog search
→ 애즈펌 / 가르마 스타일 중 조건이 맞는 예시
```

## 10. Compatibility model

목표 관계:

```text
Compatibility = f(
  Face Representation,
  Style Representation,
  strategy / target,
  evidence,
  uncertainty
)
```

Compatibility는 "예쁘다" 하나의 절대 점수로 시작하지 않는다.

초기에는 다음과 같은 bounded dimensions를 별도로 다룰 수 있다.

- proportional harmony
- silhouette balance
- feature emphasis
- feature moderation
- structural coherence
- visual-weight balance
- requested style direction compatibility

Core와 Alternative 전략은 compatibility surface의 서로 다른 목표점을 탐색할 수 있다.

## 11. Association is not compatibility

웹 이미지에서 특정 얼굴 구조와 특정 헤어 또는 메이크업이 자주 함께 나타나는 현상은 `association evidence`다.

다음은 금지한다.

```text
자주 같이 등장
→ 잘 어울린다
```

가능한 사용:

```text
association
→ style hypothesis
→ controlled test candidate
→ compatibility validation
```

검색 이미지의 헤어·메이크업·안경 등 presentation 정보는 별도 observation layer로 보존할 수 있지만 compatibility truth가 아니다.

## 12. Parametric 3D experimentation

Blender 또는 동등한 3D 도구는 production Face Representation authority가 아니라 controlled experiment generator로 사용한다.

목표는 7개의 고정 "동물상 얼굴"을 만드는 것이 아니다.

하나의 versioned parametric head 또는 호환되는 head family에서 Face Space의 좌표를 재현한다.

예:

```text
Base Head
├─ face length
├─ cheekbone width
├─ jaw width
├─ jaw angle
├─ eye width
├─ eye tilt
├─ eye spacing
├─ forehead ratio
└─ ...
```

Archetype마다 다음과 같은 experiment points를 만들 수 있다.

- center prototype
- high-density variants
- boundary variants
- overlap variants
- out-of-distribution controls

각 3D 얼굴은 해당 Archetype의 "정답 얼굴"이 아니라 특정 Face Space 좌표의 시뮬레이션이다.

## 13. Counterfactual experiment

3D의 핵심 사용 목적은 한 번에 하나 또는 소수 변수만 바꾸는 controlled counterfactual이다.

예:

```text
same face
same pose
same lighting
same camera
same expression

A: forehead exposure 0.30
B: forehead exposure 0.60
```

또는:

```text
same style

A: face length 0.40
B: face length 0.50
```

이를 통해 다음 질문을 검증한다.

- 특정 Face dimension이 특정 Style parameter preference를 실제로 움직이는가?
- 효과가 연속적으로 변화하는가?
- 특정 label에서만 나타나는 것처럼 보이지만 사실 더 일반적인 structural relation인가?
- 결과가 특정 rendering nuisance에만 의존하는가?

## 14. Automated hypothesis generation

AI/VLM은 초기 style rule의 authority가 아니라 hypothesis generator로 사용할 수 있다.

예:

```text
Face vector
→ 여러 독립 모델이 style parameter 후보 제안
→ 공통 또는 경쟁 가설 추출
→ controlled experiment generation
```

AI가 제안했다는 사실만으로 compatibility rule에 저장하지 않는다.

## 15. Automated blind judging

사람 참여를 최소화하기 위해 여러 독립 VLM judge를 blind pairwise evaluator로 사용할 수 있다.

Judge에게 숨길 정보:

- Archetype label
- search query
- target hypothesis
- current recommendation
- current scorer output
- 다른 judge의 answer

Judge는 가능한 한 구조화된 비교 항목만 평가한다.

예:

- proportional harmony
- silhouette balance
- structural coherence
- over-emphasis
- under-emphasis
- requested direction fit

## 16. Pairwise preference

초기 compatibility 학습은 절대 1~10 점수보다 pairwise 비교를 우선할 수 있다.

```text
A vs B
B vs A
A vs C
...
```

Pairwise 결과는 versioned aggregation model로 상대적 preference surface를 만들 수 있다.

Aggregation algorithm, judge count, threshold는 별도 evaluation contract에서 고정한다.

## 17. Self-validation safeguards

"AI가 만든 답을 같은 AI가 다시 승인"하는 구조는 금지한다.

자동 자체검증은 독립 근거의 교차일치를 요구한다.

최소 후보:

1. multi-model judge agreement
2. A/B order reversal consistency
3. crop / lighting / camera nuisance stability
4. counterfactual feature perturbation consistency
5. local monotonicity 또는 expected continuity 진단
6. unseen Face Space region holdout
7. unseen Style parameter combination holdout
8. hypothesis generator와 judge 분리
9. current recommendation 결과 blind
10. uncertainty-driven HOLD

## 18. Active experimentation

Judge disagreement 또는 model uncertainty가 큰 영역을 자동으로 다음 실험 대상으로 선택할 수 있다.

```text
uncertain region
→ generate nearby face/style variants
→ blind evaluation
→ update evidence
→ convergence?
   ├─ yes → retain bounded relation
   └─ no  → hold
```

이 방식은 모든 Face × Style 조합을 brute-force로 생성하는 대신 정보 가치가 높은 영역을 우선한다.

## 19. Evidence classes

Compatibility 연구에서 최소 다음 evidence를 구분한다.

### 19.1 Web association evidence

실제 웹 presentation에서 무엇이 같이 나타나는지 보여준다.

증명하지 못하는 것:

- causality
- best style
- user preference
- structural compatibility

### 19.2 Geometric / parametric evidence

Face와 Style parameter가 형태적으로 어떤 관계를 만드는지 통제된 조건에서 본다.

### 19.3 Synthetic counterfactual evidence

동일한 base condition에서 특정 변수 변경 효과를 격리한다.

### 19.4 VLM preference evidence

독립 judge들이 어떤 controlled pair를 선호하는지 보여준다.

### 19.5 Human audit evidence

필요한 경우 최종 benchmark, 문화적 수용성, AI judge bias 감사를 위해 제한적으로 사용한다.

## 20. Human-minimized policy

목표는 Human을 대량 annotation labor로 사용하는 것이 아니다.

권장 방향:

```text
automated empirical collection
+ controlled 3D experiments
+ multi-VLM blind judging
+ counterfactual verification
+ holdout / stability
→ compatibility candidate

only high-risk / high-uncertainty / benchmark subset
→ Human audit
```

Human audit가 0인 단계에서는 결과를 "실제 사용자 선호가 검증된 truth"라고 부르지 않는다.

## 21. Archetype validation relationship

Archetype validation과 Style compatibility validation은 별개다.

```text
Archetype validity
≠ Face Space validity
≠ Style association
≠ Style compatibility
```

예:

- wolf label이 문화적으로 안정적으로 사용될 수 있음
- 그러나 wolf label 전체에 하나의 hairstyle rule이 존재하지 않을 수 있음

또는:

- wolf/cat boundary가 불안정할 수 있음
- 그러나 특정 Face dimensions와 Style parameters의 compatibility relation은 안정적일 수 있음

따라서 Style Engine은 Archetype calibration 완료 여부에만 종속되지 않는다. 단, Production activation은 각각의 owning contract와 evidence gate를 통과해야 한다.

## 22. Research program

권장 연구 프로그램:

```text
R-A — Archetype Seed Corpus
     cultural labels → blind face observations → Face Space distributions

R-F — General Face Corpus
     archetype-independent representation coverage

R-S — Style Observation Corpus
     presentation attributes and style parameter distributions

R-3D — Parametric Counterfactual Lab
     controlled face/style perturbation renders

R-J — Automated Judge Program
     blind multi-model pairwise evaluation

R-C — Compatibility Modeling
     Face × Style evidence aggregation and generalization

R-H — Human Audit
     bounded final audit / cultural acceptance / bias check
```

각 track은 독립 provenance와 lifecycle을 가진다.

## 23. Production recommendation target

장기적으로 추천은 다음 흐름을 따른다.

```text
User photo
→ FaceLabObservationAnalysis
→ Normalized Face Representation
→ Face Space

Face Space
├─ Archetype Projection
│  → 늑대상 47% / 고양이상 34% / ...
│
└─ Style Compatibility
   → compatible Style Parameter region
   → strategy selection
   → catalog/style-name translation
   → Hair / Makeup / Eyewear / Face Style recommendations
```

Archetype 표시는 사용자 이해와 재미를 담당하고, 실제 추천은 Face Space 근거를 사용한다.

## 24. Current implementation boundary

이 문서는 목표 아키텍처를 정의한다.

현재 Production 코드에 다음이 구현됐다고 주장하지 않는다.

- Normalized Face Representation 별도 객체
- Face Space
- learned embedding
- Archetype projection from Face Space
- Style Representation
- Style Space
- Compatibility Model
- Blender/3D pipeline
- automated VLM judge council
- active experimentation
- compatibility database

현재 구현 authority는 `FACE_LAB_CURRENT_STATE.md`와 current main code다.

## 25. Activation boundary

다음 항목은 각각 별도 activation이 필요하다.

- Face Representation schema
- Face Space transform/model
- Archetype projection
- Style Representation schemas
- Compatibility evidence store
- compatibility model
- recommendation thresholds / hold
- user-facing style-name mapper
- automated judge governance
- 3D experiment provenance
- Human audit policy

문서 존재만으로 Production authority가 되지 않는다.

## 26. Final authority statement

Face Lab의 내부 핵심은 특정 Archetype classifier가 아니다.

```text
observable face structure
→ reusable normalized representation
→ extensible Face Space
→ multiple interpretation and recommendation layers
```

늑대상·고양이상·사슴상 등은 사용자가 이해하기 쉬운 중요한 제품 언어로 유지한다.

그러나 향후 Face Lab의 스타일 추천은 해당 label을 직접 lookup하는 것이 아니라, 얼굴 구조와 스타일 구조 사이에서 검증된 compatibility evidence를 사용해야 한다.
