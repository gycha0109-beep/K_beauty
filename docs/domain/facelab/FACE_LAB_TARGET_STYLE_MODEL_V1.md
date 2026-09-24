# FACE LAB TARGET STYLE MODEL V1

> Track: FACE LAB / Product Architecture  
> Status: V1 product-model authority candidate  
> Scope: Target Style Profile, 추구미 탐색, preference capture, Style Delta input, route generation boundary  
> Production impact: none until implementation contracts and UI wiring are completed  
> Related: `FACE_LAB_MASTER_SPEC.md`, `FACE_LAB_TARGET_STYLE_SURVEY_V1.md`, `FACE_LAB_V2_CANONICAL_RESULT_CONTRACT.md`, `face-lab-face-space-style-compatibility-architecture-v1.md`, `face-lab-archetype-styling-contract-v1.md`

## 1. 목적

Face Lab V2의 핵심 목표는 사용자를 특정 얼굴형·Archetype·성별 스타일로 분류하는 것이 아니다.

Face Lab은 다음 질문에 답해야 한다.

> 지금 내 얼굴과 현재 스타일은 어떤 시각적 특징을 가지고 있는가?  
> 나는 어떤 분위기와 이미지를 원하는가?  
> 현재 상태에서 그 방향으로 가려면 무엇을 어떻게 바꿀 수 있는가?  
> 가능한 여러 경로 중 어떤 경로가 내 취향·시간·비용·관리 의지에 맞는가?

Target Style Model은 이 중 **“사용자가 원하는 추구미를 시스템이 어떻게 구조화할 것인가”**를 정의한다.

목표 구조:

```text
Current Face Profile
+
Target Style Profile
+
Styling Scope / Constraints
↓
Style Delta
↓
Style Route A / B / C
↓
Hair / Makeup / Color / Grooming / Eyewear / Accessories
↓
Concrete examples / Product specification / SKU matching
```

Target Style Model은 Face Representation을 대체하지 않는다.

```text
Face Representation
≠ Target Style Profile
```

둘은 서로 다른 질문에 답한다.

- Face Representation: **현재 얼굴에서 무엇이 관찰되는가**
- Target Style Profile: **사용자가 어떤 스타일 결과를 원하는가**

---

## 2. 상위 불변식

1. 추구미는 외모 우열이나 객관적 정답이 아니다.
2. 추구미는 얼굴에서 자동 추론하지 않는다.
3. 성별은 추구미의 직접 결정 변수가 아니다.
4. Archetype은 추구미의 직접 결정 변수가 아니다.
5. 사용자가 명시한 preference가 자동 추정보다 우선한다.
6. `청순`, `시크`, `섹시`, `귀여움`, `내추럴` 같은 단어는 user-facing label이며 내부 authority는 연속형 Style Vector다.
7. 동일한 Target Style이라도 여러 Style Route가 가능해야 한다.
8. Target Style은 Hair / Makeup / Grooming / Color / Eyewear / Accessories 중 사용자가 허용한 영역에서만 실행한다.
9. “모르겠음”은 실패가 아니라 Target Finder 진입 상태다.
10. 스타일 참고 이미지를 사용할 경우 얼굴 자체의 매력·정체성·인물을 target으로 사용하지 않고 presentation/style cue만 읽는다.
11. Target Style Model은 “가장 예쁜 스타일”을 결정하지 않는다.
12. Target Style Model은 실제 제품명을 직접 선택하지 않는다. 먼저 style/product specification을 만들고 이후 catalog matcher가 SKU 또는 shade를 찾는다.

---

## 3. Target Style Profile

V1 canonical 개념:

```text
Target Style Profile
=
Style Vector
+
User-facing Targets
+
Priority
+
Context
+
Styling Scope
+
Constraints
+
Change Tolerance
+
Preference Evidence
+
Confidence
```

예시:

```json
{
  "schemaVersion": "face-lab-target-style-profile-v1",
  "status": "available",
  "source": "user_preference",
  "targetLabels": ["clean_sophisticated", "chic"],
  "vector": {
    "softSharp": 0.42,
    "naturalPolished": 0.78,
    "playfulMature": 0.66,
    "minimalStatement": 0.38,
    "warmCool": 0.61,
    "classicTrendy": 0.54
  },
  "priority": ["polished", "mature"],
  "contexts": ["daily", "work"],
  "stylingScope": ["hair", "brow_grooming", "makeup", "eyewear"],
  "changeTolerance": "moderate",
  "constraints": {
    "hairLengthChange": "small",
    "bangsAllowed": true,
    "permAllowed": false,
    "dyeAllowed": false,
    "makeupIntensity": "light_to_medium",
    "dailyMinutes": 15
  },
  "preferenceEvidence": [],
  "confidence": 0.78
}
```

위 숫자는 schema 설명용 예시이며 production calibration 값이 아니다.

---

## 4. Style Vector V1

V1은 처음부터 지나치게 많은 감성 라벨을 직접 enum으로 만들지 않는다.

내부 표현은 6개의 연속 축을 기본 후보로 둔다.

모든 축은 `0.0 ~ 1.0` 범위로 정규화할 수 있으며, 정확한 numeric mapping은 versioned configuration이 담당한다.

### 4.1 softSharp

```text
soft ←────────→ sharp
```

의미:

- 곡선적 / 부드러운 / 완화된 표현
- 직선적 / 구조적 / 선명한 표현

연결 가능 영역:

- Hair silhouette
- brow angle
- eyeliner direction
- eyewear angularity
- accessory geometry
- contour definition

이 축은 성격의 “부드러움/날카로움”을 의미하지 않는다. 오직 **스타일 표현의 선과 구조**를 의미한다.

### 4.2 naturalPolished

```text
natural ←────────→ polished
```

의미:

- 힘을 뺀 자연스러운 표현
- 정돈되고 설계된 표현

연결 가능 영역:

- hair finish
- brow precision
- base finish
- lip boundary
- color coordination
- accessory finish

### 4.3 playfulMature

```text
playful / youthful ←────────→ mature
```

의미:

- 가볍고 생기 있는 스타일 표현
- 절제되고 성숙한 스타일 표현

사용자-facing label에서는 상황에 따라:

- 귀여운
- 발랄한
- 성숙한
- 차분한

등으로 번역할 수 있다.

실제 나이, 정신적 성숙도, 성격을 추론하지 않는다.

### 4.4 minimalStatement

```text
minimal ←────────→ statement
```

의미:

- 낮은 시각 강도
- 높은 시각 강도 / 존재감 있는 표현

연결 가능 영역:

- makeup contrast
- lip saturation / boundary
- eye emphasis
- accessory scale
- pattern intensity
- hair volume / silhouette emphasis

사용자-facing에서는 상황에 따라 `미니멀`, `화려함`, `강조감` 등으로 번역할 수 있다.

### 4.5 warmCool

```text
warm ←────────→ cool
```

의미:

- 사용자가 선호하는 스타일 색·무드 방향

주의:

- 퍼스널컬러 계절형 판정이 아니다.
- 얼굴 사진만으로 자동 결정하지 않는다.
- 사용자 preference와 Color Engine의 실제 적용 가능성을 분리한다.

### 4.6 classicTrendy

```text
classic ←────────→ trendy
```

의미:

- 오래 유지되는 정돈된 스타일 언어
- 현재 유행 요소를 적극 반영한 스타일 언어

이 축은 얼굴 구조와 독립적인 preference 축이다.

---

## 5. 축 설계 원칙

V1의 6축은 “스타일을 완벽하게 설명하는 자연 법칙”이 아니다.

목적은 다음 세 가지다.

1. 추구미를 단일 라벨보다 더 세밀하게 표현
2. 설문과 이미지 비교 결과를 동일한 Target Style Profile로 통합
3. Hair / Makeup / Grooming / Color 등 downstream 엔진이 조작 가능한 방향을 제공

축 추가 조건:

- 사용자 preference에서 독립적인 의미가 있어야 한다.
- 최소 하나 이상의 실행 영역에서 실제 parameter로 변환 가능해야 한다.
- 기존 축의 단순 동의어가 아니어야 한다.
- 특정 성별 또는 특정 문화권 표현에만 종속되지 않아야 한다.
- user-facing wording과 internal semantic을 분리할 수 있어야 한다.

V1에서 축을 무한히 늘리지 않는다.

---

## 6. User-facing Target Label

사용자는 Style Vector 숫자를 직접 고를 필요가 없다.

대표 user-facing target 후보:

- 내추럴
- 청순 / 맑은
- 귀여운 / 발랄한
- 세련된
- 시크한
- 성숙한 / 차분한
- 화려한 / 글래머러스
- 미니멀
- 클래식
- 트렌디
- 부드러운
- 또렷한

필요한 경우 남성 스타일 예시에서는 같은 내부 vector를 다른 문구로 표현할 수 있다.

예:

```text
동일 내부 방향:
polished + mature + moderate sharp

여성 예시 label:
Clean Sophisticated / 세련된

남성 예시 label:
Clean Groomed / 정돈된 도시적 스타일

중성 예시 label:
Refined Minimal / 절제된 세련미
```

내부 vector가 성별에 따라 달라지는 것이 아니라 **presentation과 example set이 달라진다.**

---

## 7. Target Label → Vector Mapping

각 user-facing label은 하나의 고정 좌표가 아니라 **권장 범위 또는 prototype distribution**으로 정의한다.

예시:

```text
"내추럴"
naturalPolished      → natural 쪽
minimalStatement     → minimal 쪽
softSharp            → 중립~soft
classicTrendy        → 중립

"시크"
softSharp            → sharp 쪽
naturalPolished      → polished 쪽
playfulMature        → mature 쪽
minimalStatement     → 중간~statement

"귀여움"
softSharp            → soft 쪽
playfulMature        → playful 쪽
minimalStatement     → 중간 이하

"세련"
naturalPolished      → polished 쪽
playfulMature        → mature 쪽
softSharp            → 중립~sharp
minimalStatement     → 상황 의존
```

정확한 수치는 `target-style-registry-v1` 같은 별도 versioned configuration으로 구현한다.

한 label을 하나의 rigid vector로 고정하지 않는다.

---

## 8. 추구미 입력 모드

Face Lab은 세 가지 entry mode를 지원하는 방향으로 설계한다.

### 8.1 Known

```text
"원하는 스타일이 명확해요"
```

사용자가 target label 또는 reference를 직접 선택한다.

예:

- 세련 + 시크
- 청순 + 내추럴
- 성숙 + 미니멀

복수 선택을 허용할 수 있다.

### 8.2 Partial

```text
"대충 원하는 느낌은 있어요"
```

상위 감성 label 1~2개를 고른 뒤:

- 변화 강도
- Hair / Makeup / Grooming scope
- 싫은 방향

으로 세분화한다.

### 8.3 Unknown

```text
"잘 모르겠어요"
```

Target Finder로 이동한다.

Unknown은 `insufficient_evidence`가 아니라 **preference discovery mode**다.

---

## 9. Target Finder / 추구미 월드컵

### 9.1 목적

사용자에게 “당신의 추구미는 이것”을 AI가 강제로 정하는 기능이 아니다.

목적은:

> 사용자가 직접 비교하며 자신의 preference를 발견하게 돕는 것

이다.

### 9.2 기본 UI

```text
A                         B
Clean / Natural           Chic / Sharp

[왼쪽]
[둘 다 좋음]
[둘 다 별로]
[오른쪽]
```

강제 이분법을 피한다.

### 9.3 비교 이미지 원칙

서로 다른 얼굴의 매력도 차이가 preference를 오염시키지 않도록 가능한 한:

- 동일하거나 동일 계열의 base face
- 동일한 pose
- 동일한 expression
- 동일한 lighting
- 유사한 crop
- Hair / Makeup / Color / Styling parameter만 변화

를 사용한다.

AI-generated reference set도 동일한 원칙을 적용한다.

### 9.4 V1 추정 방식

초기 V1은 learned preference model을 필수로 하지 않는다.

각 비교 후보는 이미 Style Vector metadata를 가진다.

```text
Candidate A vector
Candidate B vector
↓
User choice
↓
Preference accumulator
↓
Target Style Vector candidate
```

선택은 다음 신호를 만들 수 있다.

- A 선호
- B 선호
- 둘 다 선호
- 둘 다 비선호

명시적 선택은 추정 모델보다 우선한다.

정확한 aggregation 방식과 stop condition은 별도 implementation contract에서 versioning한다.

### 9.5 종료 결과

Target Finder는 사용자에게 단일 라벨 하나만 반환하지 않는다.

예:

```text
당신이 끌리는 방향

1. 세련된 / Polished
2. 차분하고 성숙한 / Mature
3. 너무 화려하지 않은 / Moderate Minimal

추천 Target:
Clean Sophisticated
```

사용자는 이를 승인하거나 다시 조정할 수 있다.

---

## 10. Reference Image 입력

사용자가 직접 추구미 참고 이미지를 1~3장 제공할 수 있다.

Reference Image에서 추출 가능한 것은 presentation/style cue다.

예:

- hair silhouette
- parting
- fringe
- brow shape
- eye emphasis
- makeup contrast
- lip finish
- color mood
- accessory scale
- overall styling intensity

금지:

- 해당 인물의 정체성을 style target으로 사용
- 해당 인물과 닮게 만드는 것을 목표로 설정
- 얼굴 자체의 매력도를 target으로 사용
- reference face geometry를 사용자 목표 얼굴 구조로 사용

즉:

```text
"이 사람처럼 생기고 싶다"
→ 지원하지 않음

"이 사진의 헤어·메이크업·분위기가 좋다"
→ 지원 가능
```

---

## 11. 성별과 스타일 예시 분기

Face Lab은 얼굴 사진에서 성별을 추정해 설문을 분기하지 않는다.

사용자에게 다음을 직접 묻는 방향을 기본으로 한다.

```text
어떤 스타일 예시가 더 편한가요?

- 남성 스타일 중심
- 여성 스타일 중심
- 중성 / 상관없음
```

이 값은:

- reference example set
- 기본 Styling Scope preset
- user-facing wording

에만 영향을 준다.

Style Vector 자체의 semantic은 동일하다.

### 11.1 남성 스타일 중심 preset

기본:

- Hair ON
- Eyebrow / Grooming ON
- Eyewear ON
- Color ON
- Facial Hair 조건부
- Makeup OPTIONAL
- Accessories OPTIONAL

선택적 grooming makeup:

- concealer
- brow
- light complexion correction
- lip tone grooming
- subtle shading

### 11.2 여성 스타일 중심 preset

기본:

- Hair ON
- Brow ON
- Eye Makeup ON
- Blush ON
- Lip ON
- Color ON
- Accessories ON

### 11.3 중성 / 상관없음

성별 preset 없이 선택된 Styling Scope만 사용한다.

사용자는 언제든 영역을 켜고 끌 수 있어야 한다.

---

## 12. Styling Scope

Target Style이 같아도 사용자가 바꾸고 싶은 영역은 다르다.

지원 후보:

```text
hair
brow_grooming
makeup
color
eyewear
accessories
facial_hair
face_adjacent_style
```

예:

```text
Target = chic / polished
Scope = hair + eyewear
```

인 경우 Makeup Route를 강제로 생성하지 않는다.

---

## 13. Constraint Model

추천은 실제 실행 가능성을 반영해야 한다.

### 13.1 Hair

- current length
- allowed length change
- bangs allowed
- perm allowed
- dye allowed
- hair texture
- styling time

### 13.2 Makeup

- no makeup
- grooming only
- light
- medium
- expressive
- allowed subdomains

### 13.3 Lifestyle

- daily styling minutes
- maintenance tolerance
- budget band
- work / school constraints
- glasses required
- facial hair preference
- excluded styles

Constraint는 Target Style 자체를 바꾸지 않는다.

대신 **어떤 Route를 만들 수 있는지**를 제한한다.

---

## 14. Style Delta

중요:

```text
Style Delta
!= Face Vector - Target Style Vector
```

Face Representation과 Target Style Vector는 서로 다른 semantic space이므로 단순 수치 subtraction을 금지한다.

Style Delta의 실제 의미는 다음이다.

```text
Current Face Profile
+
Current Presentation
+
Target Style Profile
+
Styling Scope
+
Constraints
↓
필요한 Style Parameter의 방향 변화
```

예:

```json
{
  "schemaVersion": "face-lab-style-delta-v1",
  "targetProfileRef": "target-style-profile-v1",
  "priorities": [
    {
      "domain": "hair",
      "parameter": "sideVolume",
      "direction": "decrease",
      "strength": "moderate",
      "reason": "target_polished_sharp"
    },
    {
      "domain": "brow_grooming",
      "parameter": "definition",
      "direction": "increase",
      "strength": "light",
      "reason": "target_polished"
    },
    {
      "domain": "makeup",
      "parameter": "outerEyeEmphasis",
      "direction": "increase",
      "strength": "moderate",
      "reason": "target_sharp"
    }
  ]
}
```

이 예시 역시 contract 설명용이다.

---

## 15. Face Profile과 Target Style의 관계

Target Style은 얼굴 구조를 “고치기 위한 목표”가 아니다.

금지:

```text
jaw width가 넓음
→ jaw width를 작아 보이게 해야 함
```

허용되는 방향:

```text
현재 얼굴 구조
+
사용자가 원하는 표현
↓
특징을 살릴지 / 균형을 조정할지 선택
↓
스타일 parameter 변경
```

같은 얼굴에서도 사용자가 원하는 방향에 따라 서로 다른 Style Delta가 나올 수 있다.

---

## 16. Style Route

Style Delta는 하나의 route만 만들어서는 안 된다.

예:

### Route A — Hair-led

```text
Hair change       high
Makeup change     low
Daily effort      medium
Maintenance       medium
```

### Route B — Makeup-led

```text
Hair change       none
Makeup change     high
Daily effort      medium-high
Maintenance       low
```

### Route C — Balanced

```text
Hair change       low
Makeup change     medium
Eyewear / Color   moderate
Daily effort      low-medium
```

Route는 “1위 추천”이 아니라 **서로 다른 실행 전략**이다.

---

## 17. Route 생성 원칙

각 Route는 최소 다음을 가진다.

```text
target fit
styling domains used
change magnitude
daily effort
maintenance cost
money cost band
reversibility
constraint fit
why this route
```

Route diversity rule:

- A/B/C가 문장만 다르고 실질적으로 같은 조합이면 안 된다.
- 하나의 domain만 가능한 사용자는 억지로 3개를 만들지 않는다.
- constraint를 위반하는 route는 생성하지 않는다.
- target과 충돌하는 route는 제외한다.
- 일부 영역이 unavailable이면 나머지 영역에서만 구성한다.

---

## 18. Hair parameter 연결

Target Style 축은 Hair에서 다음 parameter와 연결될 수 있다.

- forehead exposure
- part location
- part asymmetry
- crown volume
- side volume
- temple coverage
- fringe weight
- fringe direction
- hair length
- silhouette width
- silhouette height
- curvature / straightness
- layer intensity
- texture density

예:

```text
polished ↑
→ finish control ↑
→ silhouette noise ↓
→ part / outline definition ↑

soft ↑
→ curvature ↑
→ hard angle emphasis ↓
```

정확한 mapping은 Hair Engine contract가 담당한다.

---

## 19. Makeup parameter 연결

Target Style 축은 Makeup에서 다음 parameter와 연결될 수 있다.

- brow thickness
- brow angle
- brow definition
- eyeliner length
- eyeliner direction
- eye shadow placement
- eye contrast
- outer eye emphasis
- blush position
- blush spread
- blush intensity
- lip depth
- lip chroma
- lip boundary
- skin finish
- highlight / contour intensity

예:

```text
statement ↑
→ eye/lip/accent contrast를 허용 범위 안에서 증가 가능

natural ↑
→ boundary softness ↑
→ contrast ↓
→ opacity / coverage ↓
```

정확한 mapping은 Makeup Engine contract가 담당한다.

---

## 20. Grooming / Eyewear / Accessories 연결

### Grooming

- brow density
- brow line
- facial hair length
- sideburn weight
- lip tone grooming
- complexion finish

### Eyewear

- frame width
- frame height
- angularity
- curvature
- rim thickness
- brow alignment
- visual weight
- color contrast

### Accessories

- scale
- angularity
- curvature
- length
- visual weight
- color contrast

남성 스타일 중심 사용자에게도 Face Lab의 가치가 Hair 하나로 끝나지 않도록 이 영역을 독립 지원한다.

---

## 21. Color 연결

Target Style의 `warmCool`, `minimalStatement`, `naturalPolished` 등은 Color Engine의 style preference input이 될 수 있다.

그러나 다음을 분리한다.

```text
Target color preference
≠ photo-based color suitability
≠ personal color season
```

Face Lab은 사용자가 원하는 색 분위기와 사진상 가능한 color evidence를 함께 고려할 수 있다.

Skin Match와 연결되는 경우 피부 상태는 **표현 방식의 constraint**로 사용할 수 있다.

---

## 22. Makeup Product와의 경계

Target Style Model은 SKU를 직접 고르지 않는다.

```text
Target Style
↓
Makeup Technique
↓
Makeup Product Specification
↓
Product / Shade Matcher
↓
SKU
```

예:

```text
Target:
soft + polished

Technique:
diffused blush / controlled lip boundary

Product specification:
muted rose
medium-low chroma
soft matte or satin
buildable pigmentation

↓
실제 K-Beauty product / shade
```

Makeup catalog는 Face Lab execution layer다.

---

## 23. Skin Match와의 경계

```text
Skin Match
= skin condition / skincare decision

Face Lab
= target style / styling decision
```

기본 catalog 책임:

```text
Skin Match → Skincare catalog
Face Lab   → Makeup / Grooming / Style catalog
```

교차 활용은 가능하다.

예:

```text
Face Lab:
semi-matte expression preferred

Skin Match:
dryness / flaking risk

Result:
same target 유지
→ softer satin execution으로 조정
```

Skin Match가 Face Lab의 추구미를 결정하거나, Face Lab이 Skin Match의 피부 상태를 재판정하지 않는다.

---

## 24. Archetype과의 관계

Archetype은 Target Style Model의 입력 authority가 아니다.

```text
Archetype Projection
→ 재미 / 설명 / 공유

Target Style Model
→ 사용자 preference / 목표

Style Compatibility
→ Face × Style 관계
```

금지:

```text
cat
→ chic target 자동 지정
```

허용:

```text
사용자 target = chic
Face profile = ...
→ chic 방향 route 생성

별도 UI:
"재미로 보는 이미지 타입: Cat / Deer mix"
```

Archetype은 사용자의 추구미를 대신하지 않는다.

---

## 25. Premium Survey Flow

권장 product flow:

```text
Premium Full Report 구매
↓
Face Lab 자동 해금
↓
최초 Face Lab 진입
↓
Target Style Survey
↓
Known / Partial / Unknown
↓
필요 시 Target Finder
↓
Styling Scope
↓
Constraints
↓
Target Style Profile 저장
↓
Face Lab V2 결과
```

설문은 Skin Match 무료 설문에 합치지 않는다.

다만 이미 알고 있는 공통 사용자 정보를 다시 묻지 않는다.

---

## 26. 사용자 수정 가능성

Target Style Profile은 한 번 판정하고 영구 고정하지 않는다.

사용자는 다음을 할 수 있어야 한다.

- 추구미 변경
- 우선순위 변경
- 변화 강도 변경
- Hair / Makeup / Grooming scope 변경
- constraints 변경
- 새로운 reference image 추가
- Route 재생성

Face Lab은 사용자의 취향 변화에 대응한다.

---

## 27. Canonical Result 연결

향후 canonical Face Lab V2 result는 최소 다음 관계를 지원한다.

```text
analysis / faceProfile
targetStyle
styleDelta
routes
hair
makeup
color
grooming
eyewear
accessories
looks
archetypeFun
```

Target Style Profile은 canonical result의 독립 필드로 보존한다.

Free와 Premium이 같은 Target Style Profile을 읽되, Premium에서만 Target Finder / detailed route / execution을 전체 노출할 수 있다.

---

## 28. Confidence

Target Style confidence는 “시스템이 사용자의 취향을 얼마나 정확히 맞췄는가”라는 절대 진실이 아니다.

다음 입력의 일관성을 나타내는 방향으로 사용한다.

- 사용자가 직접 선택한 label 수
- pairwise comparison consistency
- reference-image cue consistency
- explicit rejection
- 선택 간 contradiction
- profile 승인 여부

사용자가 최종 Target을 직접 승인하면 그 explicit approval이 가장 높은 authority다.

---

## 29. 저장 경계

Target Style Profile은 일반 Face Lab 결과와 함께 저장 가능하다.

다만 reference image를 사용하는 경우 별도 정책이 없는 한:

- 원본 reference image 장기 저장 금지
- image identity embedding 금지
- 인물 identity matching 금지

저장하는 것은 가능한 한:

- extracted style cue
- user choice
- target vector
- provenance-safe reference metadata

로 제한한다.

---

## 30. V1 비목표

V1은 다음을 하지 않는다.

- 사용자의 성별을 얼굴에서 추정
- 얼굴만 보고 추구미 자동 결정
- 사용자의 취향을 하나의 평생 label로 고정
- Archetype으로 추구미를 자동 결정
- “가장 예쁜 스타일” 절대 점수 산출
- reference 이미지 인물과 닮게 만드는 기능
- 퍼스널컬러 계절형 확정
- 전신 체형 추론
- 전신 코디 자동 확정
- SKU를 Target Model에서 직접 선택
- Skin Match와 Face Lab responsibility를 합침

---

## 31. 초기 구현 계약 후보

### 31.1 target-style-registry-v1

담당:

- Style Vector axis metadata
- user-facing label
- label → vector range
- locale wording
- masculine / feminine / neutral example wording
- forbidden inference

### 31.2 face-lab-target-style-survey-v1

담당:

- Known / Partial / Unknown flow
- direct target selection
- styling scope
- constraints
- Target Finder entry

### 31.3 face-lab-target-finder-v1

담당:

- pairwise candidates
- candidate vector
- user choice
- aggregation
- stop / continue
- final target approval

### 31.4 face-lab-style-delta-v1

담당:

- Face Profile
- Target Style Profile
- domain parameter direction
- evidence / reason
- constraints

### 31.5 face-lab-style-route-v1

담당:

- route diversity
- route cost / effort
- domain allocation
- target-fit explanation
- constraint compliance

---

## 32. 구현 순서

V1 권장 순서:

```text
1. Target Style axis / registry
2. Target Style Profile schema
3. Premium Target Style Survey
4. Target Finder fixture
5. Target Style mapper
6. Style Delta schema / rule adapter
7. Route schema / generator
8. Hair minimal engine
9. Makeup minimal engine
10. Premium result vertical slice
11. Makeup product specification
12. Product / Shade catalog integration
13. Grooming / Eyewear / Accessories expansion
14. user feedback / route selection telemetry
```

가장 중요한 초기 완주 목표:

```text
실제 사진
→ Current Face Profile
→ Premium 설문
→ Target Style Profile
→ Style Delta
→ Route A / B / C
→ Hair / Makeup 방향
→ 실제 Face Lab Premium 결과 화면
```

SKU catalog 완성을 기다리지 않고 이 vertical slice를 먼저 완주한다.

---

## 33. 성공 조건

Target Style Model V1은 다음을 만족하면 1차 제품 구조로 성공한 것으로 본다.

1. 추구미를 모르는 사용자도 강제 답 없이 탐색할 수 있다.
2. 남성/여성/중성 사용자 모두 동일 Style Vector 체계를 사용할 수 있다.
3. 사용자가 Makeup을 원하지 않아도 Face Lab이 Hair / Grooming / Eyewear로 유효한 Route를 만들 수 있다.
4. 동일 Target에 서로 다른 Route를 만들 수 있다.
5. Route가 사용자 constraint를 위반하지 않는다.
6. Archetype 없이도 전체 styling flow가 동작한다.
7. Target Profile이 SKU catalog 없이도 Hair / Makeup parameter 수준까지 내려간다.
8. 사용자가 Target을 수정하면 Route가 재생성된다.
9. 결과가 “정답 스타일” 하나를 강요하지 않는다.
10. 향후 Makeup catalog / Shade matcher를 연결할 수 있는 output boundary가 존재한다.

---

## 34. 후속 작업

이 문서 이후 바로 필요한 문서는 다음이다.

```text
FACE_LAB_TARGET_STYLE_SURVEY_V1.md
```

여기서 실제 화면 단위 질문, 분기, answer schema, Target Finder 진입 조건, 저장 payload를 확정한다.

그 다음:

```text
FACE_LAB_V2_CANONICAL_RESULT_CONTRACT.md
```

에서 Current Face Profile → Target Style → Style Delta → Routes → execution result 전체 payload를 고정한다.

마지막으로 이 계약을 실제 Face Lab Premium vertical slice에 연결한다.
