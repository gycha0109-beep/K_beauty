# FACE LAB TARGET STYLE SURVEY V1

> Track: FACE LAB / Product Architecture  
> Status: V1 survey authority candidate  
> Scope: Premium Face Lab 최초 진입 설문, Target Finder 진입, Styling Scope, constraints, 저장 payload, 수정/재진입  
> Production impact: none until implementation and canonical result wiring are completed  
> Related: `FACE_LAB_TARGET_STYLE_MODEL_V1.md`, `FACE_LAB_V2_CANONICAL_RESULT_CONTRACT.md`, `FACE_LAB_MASTER_SPEC.md`, `face-lab-face-space-style-compatibility-architecture-v1.md`

---

## 1. 목적

이 문서는 Face Lab V2에서 **사용자의 추구미와 실제 실행 제약을 어떻게 입력받을 것인가**를 화면 단위로 정의한다.

설문의 목적은 사용자를 특정 취향 라벨로 분류하는 것이 아니다.

Face Lab은 다음 정보를 얻어야 한다.

```text
Target
+
Interest
+
Constraint
```

즉:

1. 사용자가 어떤 분위기와 이미지를 원하는가
2. 어떤 스타일 영역을 바꿀 의향이 있는가
3. 실제 생활에서 무엇을 할 수 있고 무엇을 하기 싫은가

를 구조화한다.

최종 산출물은 다음이다.

```text
Face Lab Target Style Survey
↓
Target Style Profile
↓
Style Delta
↓
Style Route A / B / C
↓
Hair / Makeup / Grooming / Color / Eyewear / Accessories
```

---

## 2. 상위 제품 원칙

1. Face Lab 전용 설문은 무료 Skin Match 설문에 합치지 않는다.
2. Premium Full Report 구매 후 Face Lab이 해금되면 최초 진입 시 별도 설문을 받는다.
3. 이미 알고 있는 공통 정보는 다시 묻지 않는다.
4. 추구미를 모르는 사용자는 실패 상태가 아니라 Target Finder 진입 상태다.
5. 얼굴 사진에서 성별을 추정해 설문을 분기하지 않는다.
6. 남성/여성/중성 분기는 **스타일 예시와 기본 preset**에만 사용한다.
7. 사용자가 Makeup을 선택하지 않아도 유효한 Face Lab 결과가 나와야 한다.
8. 사용자가 Hair만 선택해도 가능한 범위의 Style Route를 만든다.
9. 사용자가 선택한 preference가 자동 추정보다 높은 authority를 가진다.
10. 설문은 가능한 한 짧은 기본 흐름과, 필요할 때만 열리는 조건부 질문으로 구성한다.
11. Target Style Profile은 사용자가 나중에 수정할 수 있다.
12. 설문은 추구미를 “정답”으로 확정하는 시험이 아니다.
13. 설문 결과는 Style Vector와 실행 제약을 만든다. Archetype을 만들지 않는다.
14. Archetype은 설문 분기나 Target Style 판정의 입력이 아니다.
15. 제품 추천은 설문에서 직접 하지 않는다. 설문은 style/product specification을 만드는 입력까지만 담당한다.

---

## 3. 전체 진입 흐름

### 3.1 Premium 구매 전

무료 분석과 Skin Match는 기존 흐름을 유지한다.

```text
무료 분석
↓
Skin Match
↓
Premium Full Report 구매
```

무료 설문에 Face Lab의 추구미·헤어·메이크업 질문을 대량 추가하지 않는다.

### 3.2 Premium 구매 후

```text
Premium Full Report 구매
↓
Face Lab 섹터 자동 해금
↓
Face Lab 최초 진입
↓
"내 스타일 방향을 알려주세요"
↓
Target Style Survey
↓
필요 시 Target Finder
↓
Target Style Profile 생성
↓
Face Lab V2 결과
```

### 3.3 재진입

이미 Target Style Profile이 존재하면 전체 설문을 다시 요구하지 않는다.

```text
Face Lab 재진입
↓
기존 Target Style Profile 로드
↓
[그대로 보기]
[추구미 수정]
[스타일 범위 수정]
[제약 수정]
[처음부터 다시]
```

---

## 4. 설문 길이 전략

기본 설문은 **5~7개의 화면** 안에 끝나는 것을 목표로 한다.

단, 사용자의 선택에 따라 Hair / Makeup / Grooming 세부 질문이 추가된다.

권장 구조:

```text
STEP 0. Intro
STEP 1. 추구미 인지 수준
STEP 2. Target 선택 또는 Target Finder
STEP 3. 스타일 예시 프리셋
STEP 4. Styling Scope
STEP 5. 변화 강도 / 상황
STEP 6. 조건부 제약
STEP 7. Target 확인
```

Target Finder를 사용하는 경우 비교 화면이 추가된다.

---

# 5. STEP 0 — Intro

## 5.1 목적

사용자가 왜 또 설문을 해야 하는지 이해시키는 화면이다.

## 5.2 권장 카피

### 제목

**어떤 모습으로 가고 싶은지 알려주세요**

### 설명

> Face Lab은 얼굴을 분석하는 데서 끝나지 않습니다.  
> 지금의 얼굴에서 원하는 분위기로 가는 방법을 찾기 위해, 스타일 취향과 가능한 변화 범위를 간단히 확인합니다.

### 보조

> 보통 1~2분 정도 걸립니다.  
> 추구미가 아직 없어도 괜찮습니다.

### CTA

```text
[시작하기]
```

---

# 6. STEP 1 — 추구미 인지 수준

## 6.1 질문

**원하는 스타일이 이미 있으신가요?**

## 6.2 선택지

```text
A. 명확해요
B. 대충 있어요
C. 잘 모르겠어요
```

내부 값:

```text
known
partial
unknown
```

---

## 6.3 분기

### known

```text
STEP 2A — 직접 Target 선택
```

### partial

```text
STEP 2A — 직접 Target 선택
+
선택 수를 줄이고 추가 확인 질문 사용
```

### unknown

```text
STEP 2B — Target Finder
```

Unknown은 `insufficient_evidence`가 아니다.

---

# 7. STEP 2A — 직접 Target 선택

## 7.1 질문

**어떤 분위기에 가장 끌리시나요?**

### 설명

> 최대 2개까지 골라주세요.  
> 정확한 단어가 없어도 가장 가까운 느낌을 선택하면 됩니다.

---

## 7.2 V1 user-facing target 후보

초기 후보:

- 내추럴
- 맑고 청순한
- 부드러운
- 귀엽고 발랄한
- 세련된
- 시크한
- 성숙하고 차분한
- 또렷한
- 미니멀
- 화려한
- 클래식
- 트렌디

내부 key 예:

```text
natural
clear_soft
soft
cute_playful
sophisticated
chic
mature_calm
defined
minimal
statement_glam
classic
trendy
```

정확한 label → vector mapping은 `target-style-registry-v1`에서 관리한다.

---

## 7.3 선택 규칙

- 최소 1개
- 최대 2개
- `잘 모르겠어요`는 별도 버튼으로 유지
- 2개 선택 시 priority를 묻지 않고 다음 화면에서 자동 순서 또는 drag reorder를 받을 수 있음
- 상충 label 선택을 강제로 막지 않는다

예:

```text
내추럴 + 화려한
```

은 모순이 아니라:

> 자연스러운 바탕에 포인트가 강한 스타일

일 수 있으므로 후속 Style Vector가 조정한다.

---

## 7.4 partial 모드 보조 질문

사용자가 `partial`을 선택한 경우:

**조금 더 가까운 쪽은 어느 쪽인가요?**

예:

```text
부드러운 ↔ 또렷한
힘 뺀 느낌 ↔ 정돈된 느낌
가벼운 느낌 ↔ 성숙한 느낌
미니멀 ↔ 존재감 있는 스타일
```

모든 축을 반드시 묻지 않는다.

선택한 label에서 uncertainty가 큰 축만 1~2개 추가 질문한다.

---

# 8. STEP 2B — Target Finder / 추구미 월드컵

## 8.1 진입 카피

### 제목

**내 추구미를 찾아볼까요?**

### 설명

> 두 스타일 중 더 끌리는 쪽을 골라주세요.  
> 둘 다 좋거나 둘 다 별로여도 괜찮습니다.

---

## 8.2 비교 UI

각 round:

```text
┌────────────────┐   ┌────────────────┐
│   STYLE A      │   │   STYLE B      │
│                │   │                │
└────────────────┘   └────────────────┘

[왼쪽이 더 좋아요]
[둘 다 좋아요]
[둘 다 별로예요]
[오른쪽이 더 좋아요]
```

추가:

```text
[건너뛰기]
```

---

## 8.3 비교 candidate 원칙

각 candidate는 최소 다음 metadata를 가진다.

```json
{
  "candidateId": "target-finder-v1-001",
  "presentationPreset": "neutral",
  "vector": {
    "softSharp": 0.30,
    "naturalPolished": 0.65,
    "playfulMature": 0.55,
    "minimalStatement": 0.25,
    "warmCool": 0.45,
    "classicTrendy": 0.50
  },
  "domains": ["hair", "makeup", "color"],
  "referenceAssetVersion": "v1"
}
```

---

## 8.4 이미지 제작 원칙

Target Finder에서 가장 중요한 문제는 **얼굴 자체의 선호가 스타일 선호를 오염시키는 것**이다.

따라서 가능한 한:

- 동일 base face
- 동일 pose
- 동일 expression
- 동일 lighting
- 동일 crop
- 동일 배경
- style parameter만 변경

을 유지한다.

남성 / 여성 / 중성 preset마다 별도 reference set을 운영할 수 있다.

AI-generated image를 사용하는 경우도 같은 원칙을 유지한다.

---

## 8.5 비교 round 구성

V1 목표:

```text
최소 5 rounds
일반적으로 6~8 rounds
최대 10 rounds
```

단, 고정 숫자는 제품 실험에 따라 변경 가능하다.

초기 round는 큰 차이를 비교한다.

예:

```text
soft vs sharp
natural vs polished
playful vs mature
minimal vs statement
classic vs trendy
```

후반 round는 사용자의 선택이 모인 영역 안에서 더 가까운 candidate를 비교한다.

---

## 8.6 결과 수렴

Target Finder는 label 하나를 강제 선택하지 않는다.

내부적으로:

```text
pairwise choice history
↓
preference evidence
↓
vector estimate
↓
candidate target labels
```

을 만든다.

---

## 8.7 종료 화면

예:

### 제목

**이런 방향에 가장 끌리시는 것 같아요**

### 결과

```text
세련된
차분하고 성숙한
과하게 화려하지 않은
```

### 대표 이름

**Clean Sophisticated**

### CTA

```text
[이 방향으로 할게요]
[조금 바꿔볼래요]
[다시 찾아볼래요]
```

사용자의 `이 방향으로 할게요`가 Target Finder 결과보다 높은 최종 authority다.

---

# 9. STEP 3 — 스타일 예시 프리셋

## 9.1 목적

성별을 얼굴에서 추정하지 않고, 사용자가 보고 싶은 예시와 기본 Styling Scope를 정한다.

## 9.2 질문

**어떤 스타일 예시가 더 편한가요?**

## 9.3 선택지

```text
남성 스타일 중심
여성 스타일 중심
중성 / 상관없음
```

내부 값:

```text
masculine_examples
feminine_examples
neutral_examples
```

이 값은 다음에만 영향을 준다.

- reference image set
- default Styling Scope preset
- user-facing wording

이 값이 Style Vector semantic을 바꾸면 안 된다.

---

# 10. STEP 4 — Styling Scope

## 10.1 질문

**어디까지 바꿔보고 싶으세요?**

### 설명

> 관심 있는 영역만 선택해도 됩니다.

---

## 10.2 공통 선택지

```text
Hair
눈썹 / Grooming
Makeup
Color
Eyewear
Accessories
Facial Hair
얼굴 주변 스타일
잘 모르겠음
```

내부 key:

```text
hair
brow_grooming
makeup
color
eyewear
accessories
facial_hair
face_adjacent_style
auto_scope
```

---

## 10.3 기본 preset

### masculine_examples

기본 selected 제안:

- hair
- brow_grooming
- eyewear
- color

조건부 제안:

- facial_hair
- makeup
- accessories

### feminine_examples

기본 selected 제안:

- hair
- brow_grooming
- makeup
- color
- accessories

조건부:

- eyewear

### neutral_examples

자동 선택 없음.

사용자가 직접 고른다.

---

## 10.4 Auto scope

`잘 모르겠음` 선택 시:

Face Lab은 가능한 영역을 자동으로 폭넓게 고려하되, 결과에서 변화량과 부담을 비교 가능한 Route로 제시한다.

예:

```text
Route A — Hair 중심
Route B — Grooming / Makeup 중심
Route C — 낮은 변화량
```

---

# 11. STEP 5 — 변화 강도

## 11.1 질문

**지금 모습에서 어느 정도까지 바꿔도 괜찮나요?**

## 11.2 선택지

```text
1. 거의 유지하고 싶어요
2. 조금 바꾸고 싶어요
3. 꽤 달라져도 괜찮아요
4. 완전히 새로운 느낌도 좋아요
```

내부 값:

```text
minimal
light
moderate
high
```

---

## 11.3 의미

이 값은 추구미 자체를 바꾸지 않는다.

대신 Route의:

- parameter change magnitude
- number of domains changed
- reversibility
- maintenance

를 제한한다.

---

# 12. STEP 6 — 사용 상황

## 12.1 질문

**어떤 상황에서 가장 쓰고 싶으세요?**

복수 선택:

- 데일리
- 출근 / 학교
- 데이트
- 사진 / SNS
- 중요한 자리
- 이벤트 / 특별한 날

내부 key:

```text
daily
work_school
date
photo_social
formal
event
```

---

## 12.2 역할

Context는 Target Style을 바꾸기보다 **강도와 실행 경로**를 조정한다.

예:

```text
Target = chic
Context = work_school
→ restrained polished route

Target = chic
Context = event
→ stronger statement route
```

---

# 13. STEP 7 — 조건부 제약 질문

Styling Scope에서 선택한 영역에 대해서만 묻는다.

---

# 14. Hair constraints

Hair 선택 시.

## 14.1 현재 길이

```text
아주 짧음
짧음
중간
김
매우 김
잘 모르겠음
```

정확한 length threshold는 Hair Engine에서 별도 정의한다.

---

## 14.2 길이 변화 허용

**길이는 어느 정도까지 바꿀 수 있나요?**

```text
거의 유지
조금 자르거나 기르는 건 가능
큰 변화도 가능
```

---

## 14.3 앞머리

```text
가능
가벼운 앞머리만 가능
싫음
상관없음
```

---

## 14.4 펌

```text
가능
가벼운 변화만
불가
상관없음
```

---

## 14.5 염색

```text
가능
현재 색 유지
자연색 범위만
불가
```

---

## 14.6 모발 질감

사용자 self-report:

```text
직모
약한 웨이브
웨이브 / 곱슬
강한 곱슬
잘 모르겠음
```

선택적 추가:

```text
가는 편
보통
굵은 편
잘 모르겠음
```

---

## 14.7 손질 시간

```text
거의 안 하고 싶음
5분 내
10~15분
20분 이상도 가능
```

---

# 15. Makeup constraints

Makeup 선택 시.

## 15.1 평소 메이크업 정도

```text
거의 하지 않음
Grooming 정도만
가볍게
보통
적극적으로 함
```

내부:

```text
none
grooming_only
light
medium
expressive
```

---

## 15.2 가능한 영역

복수 선택:

- 피부 표현
- 눈썹
- 아이
- 블러셔
- 립
- 쉐딩 / 하이라이트
- 잘 모르겠음

---

## 15.3 원치 않는 강도

**이런 건 피하고 싶어요**

복수 선택:

- 진한 베이스
- 강한 아이라인
- 진한 음영
- 진한 블러셔
- 강한 립
- 강한 쉐딩
- 글리터
- 특별히 없음

이 값은 hard/soft constraint로 분리할 수 있다.

V1에서는 사용자가 명시한 “싫음”은 우선 hard exclusion 후보로 취급한다.

---

# 16. Grooming constraints

Brow / Grooming 선택 시.

질문:

**어디까지 관리해도 괜찮나요?**

복수 선택:

- 눈썹 모양 정리
- 눈썹 컬러 / 제품 사용
- 피부 톤 보정
- 립 톤 정돈
- 약한 쉐딩
- 수염 관리
- 헤어라인 / 잔머리 정리
- 최소 관리만

---

# 17. Facial Hair constraints

Facial Hair 선택 시.

## 17.1 현재 수염

```text
없음 / 면도
짧게 유지
부분적으로 유지
전체 수염
```

## 17.2 변화 허용

```text
유지
조금 변경 가능
큰 변화 가능
면도 가능
```

Facial Hair recommendation은 사용자 선택 없이 강제하지 않는다.

---

# 18. Eyewear constraints

Eyewear 선택 시.

```text
안경을 항상 씀
가끔 씀
안 씀
렌즈와 병행
```

선택적으로:

- 현재 프레임 유지
- 새 프레임 탐색 가능

Face Lab은 시력·의학 판단을 하지 않는다.

---

# 19. Accessories constraints

Accessories 선택 시.

복수 선택:

- 귀걸이
- 피어싱
- 목걸이
- 헤어 액세서리
- 얼굴 주변 액세서리
- 잘 모르겠음

사용하지 않는 액세서리 영역은 추천하지 않는다.

---

# 20. Color preference

Color 선택 시.

## 20.1 질문

**평소 끌리는 색감이 있나요?**

```text
따뜻한 쪽
차가운 쪽
뉴트럴
상관없음
잘 모르겠음
```

이 값은 퍼스널컬러 진단이 아니다.

## 20.2 강도

```text
차분하고 뮤트한 색
적당한 색감
선명한 색
상관없음
```

---

# 21. 현실 제약 공통 질문

## 21.1 하루 스타일링 시간

```text
5분 미만
5~10분
10~20분
20분 이상
상관없음
```

## 21.2 관리 부담

```text
최소한으로
어느 정도 가능
관리 많이 해도 괜찮음
```

## 21.3 예산

V1 선택 후보:

```text
최소 비용
보통
조금 투자 가능
예산보다 결과 우선
응답하지 않음
```

정확한 금액대는 지역/통화 정책과 catalog 설계 이후 정한다.

---

# 22. 싫은 스타일 / 금지 조건

## 22.1 질문

**절대 하고 싶지 않은 게 있나요?**

선택적 입력.

예:

- 짧은 머리
- 앞머리
- 염색
- 펌
- 진한 화장
- 강한 눈썹
- 진한 립
- 강한 쉐딩
- 큰 액세서리
- 눈에 띄는 스타일

이 값은 Route generator가 지켜야 하는 exclusion이다.

---

# 23. Reference Image 선택 입력

사용자가 원할 경우:

### 제목

**좋아하는 스타일 사진이 있다면 추가해보세요**

설명:

> 얼굴을 닮게 만드는 용도가 아니라, 헤어·메이크업·색감·분위기 같은 스타일 요소만 참고합니다.

권장:

- 0~3장
- 선택 사항
- skip 가능

원본 이미지 장기 저장은 별도 계약 없이는 하지 않는다.

---

# 24. Target Style Profile 확인

설문 종료 직전 사용자가 결과를 확인하고 승인한다.

## 24.1 예시 UI

### 제목

**이런 방향을 원하시는 게 맞나요?**

### 요약

```text
Target
Clean Sophisticated

핵심 방향
• 세련된
• 차분하고 성숙한
• 과하게 화려하지 않은

변화 강도
보통

중점 영역
Hair / Grooming / Makeup

주요 제약
• 큰 길이 변화 X
• 염색 X
• Makeup light~medium
• 하루 15분 내
```

### CTA

```text
[이대로 분석하기]
[조금 수정하기]
```

이 승인 이벤트를 Target Style Profile의 highest-authority preference evidence로 기록한다.

---

# 25. Survey answer schema

V1 survey answer raw payload 예시:

```json
{
  "schemaVersion": "face-lab-target-style-survey-v1",
  "surveyVersion": "v1",
  "entryMode": "partial",
  "targetSelections": [
    "sophisticated",
    "chic"
  ],
  "targetFinder": {
    "used": false,
    "sessionId": null,
    "candidateResultRef": null
  },
  "presentationPreference": "feminine_examples",
  "stylingScope": [
    "hair",
    "brow_grooming",
    "makeup",
    "color"
  ],
  "changeTolerance": "moderate",
  "contexts": [
    "daily",
    "work_school"
  ],
  "constraints": {
    "hair": {
      "currentLength": "medium",
      "lengthChange": "small",
      "bangs": "light_only",
      "perm": "light_only",
      "dye": "no",
      "texture": "slight_wave",
      "strandThickness": "unknown",
      "dailyMinutes": 10
    },
    "makeup": {
      "intensity": "light",
      "domains": [
        "brow",
        "eye",
        "lip"
      ],
      "avoid": [
        "heavy_base",
        "strong_contour"
      ]
    },
    "grooming": {
      "allowed": [
        "brow_shape",
        "lip_tone"
      ]
    },
    "eyewear": null,
    "facialHair": null,
    "accessories": null,
    "color": {
      "temperaturePreference": "neutral",
      "intensityPreference": "muted"
    },
    "lifestyle": {
      "dailyMinutes": 15,
      "maintenanceTolerance": "medium",
      "budgetBand": "standard"
    },
    "hardExclusions": [
      "major_haircut",
      "hair_dye"
    ]
  },
  "referenceStyle": {
    "used": false,
    "styleCueRefs": []
  },
  "approvedAt": "ISO-8601"
}
```

이 값은 raw survey answer다.

Target Style Profile은 별도 mapper가 생성한다.

---

# 26. Survey → Target Style Profile mapping

권장 구조:

```text
Raw Survey Answers
+
Target Finder Result
+
Target Style Registry
↓
Target Style Mapper
↓
Target Style Profile
```

Mapper가 할 수 있는 것:

- label → vector range
- pairwise preference → vector evidence
- user priority 보존
- Styling Scope 보존
- constraints normalize
- contradiction flag
- confidence 계산

Mapper가 하면 안 되는 것:

- 얼굴 사진으로 추구미 보정
- Archetype으로 target 보정
- 사용자가 고른 영역을 임의 추가
- 싫다고 한 영역을 자동 재활성화
- 특정 성별 preset을 최종 취향으로 간주

---

# 27. Target Finder session schema

예시:

```json
{
  "schemaVersion": "face-lab-target-finder-session-v1",
  "sessionId": "tf_xxx",
  "presentationPreference": "neutral_examples",
  "rounds": [
    {
      "round": 1,
      "candidateA": "candidate_001",
      "candidateB": "candidate_014",
      "choice": "a"
    },
    {
      "round": 2,
      "candidateA": "candidate_009",
      "candidateB": "candidate_021",
      "choice": "both"
    }
  ],
  "status": "completed",
  "estimatedVector": {},
  "candidateLabels": [],
  "userApproved": true
}
```

---

# 28. 상태 모델

Survey 상태:

```text
not_started
in_progress
target_finder
review
completed
abandoned
```

Target Style Profile 상태:

```text
available
partial
needs_confirmation
```

사용자가 Target을 승인하지 않은 경우:

```text
needs_confirmation
```

로 남길 수 있다.

---

# 29. 중단 / 재개

설문은 중간 저장을 지원하는 방향이 적절하다.

저장 가능한 것:

- 현재 step
- 이미 선택한 answers
- Target Finder round history
- 임시 constraints

재진입 시:

> 이어서 할까요?

를 제공한다.

---

# 30. 수정 정책

사용자는 결과 화면에서도 다음을 수정할 수 있다.

```text
[추구미 바꾸기]
[변화 강도 바꾸기]
[스타일 영역 바꾸기]
[제약 바꾸기]
```

수정 후:

```text
Target Style Profile version increment
↓
Style Delta recompute
↓
Route regenerate
```

얼굴 사진 자체를 다시 분석할 필요가 없는 경우 재분석하지 않는다.

---

# 31. Versioning

최소 version을 분리한다.

```text
survey schema version
target-style registry version
target-finder candidate set version
target-style mapper version
target profile version
```

예:

```json
{
  "surveySchemaVersion": "face-lab-target-style-survey-v1",
  "registryVersion": "target-style-registry-v1",
  "targetFinderSetVersion": "target-finder-candidates-v1",
  "mapperVersion": "target-style-mapper-v1"
}
```

---

# 32. Analytics / telemetry

개인 취향 자체를 마케팅 label로 과도하게 사용하지 않는다.

제품 개선용 최소 이벤트 후보:

```text
face_lab_survey_started
face_lab_target_mode_selected
face_lab_target_finder_started
face_lab_target_finder_completed
face_lab_target_confirmed
face_lab_scope_selected
face_lab_constraints_completed
face_lab_survey_completed
face_lab_target_edited
face_lab_route_regenerated
```

유용한 제품 지표:

- survey completion rate
- Unknown → Target Finder 진입률
- Target Finder completion rate
- Target 승인률
- Target 수정률
- Styling Scope 분포
- Makeup opt-in 비율
- Hair-only / Grooming-only 비율
- route 선택률
- route 변경률

이 지표는 실제 사용자 수요에 따라 남성/여성 preset과 영역 우선순위를 조정하는 데 사용할 수 있다.

---

# 33. 남성 사용자에 대한 제품 원칙

남성 사용자는 축소형 Face Lab을 받는 것이 아니다.

다만 기본 실행 영역이 다를 수 있다.

가능한 주요 가치:

- Hair
- Brow / Grooming
- Eyewear
- Facial Hair
- face-adjacent color
- Accessories
- 선택적 grooming makeup

Makeup을 선택하지 않아도 Target Style과 Style Route가 완주되어야 한다.

예:

```text
Target:
clean + mature + polished

Route A:
Hair + Brow

Route B:
Hair + Eyewear

Route C:
Grooming + Facial Hair + Color
```

---

# 34. 여성 사용자에 대한 제품 원칙

여성 스타일 중심 preset에서는 다음 실행 영역이 기본적으로 풍부하다.

- Hair
- Brow
- Eye Makeup
- Blush
- Lip
- Color
- Accessories
- Eyewear

그러나 사용자가 Makeup을 원하지 않으면 강제로 포함하지 않는다.

---

# 35. 중성 / 비정형 preference 원칙

중성 / 상관없음을 선택한 사용자는 남성/여성 preset의 중간값으로 취급하지 않는다.

```text
neutral_examples
→ user-selected scope only
```

필요하면 남성/여성 example set을 혼합해서 보여줄 수 있지만 내부 Style Vector는 동일하다.

---

# 36. Makeup catalog와의 survey 연결

설문은 SKU나 브랜드를 고르지 않는다.

다만 Makeup Engine이 사용할 실행 preference는 확보한다.

예:

```text
makeup intensity
allowed domains
avoid list
daily minutes
budget band
color preference
```

이후:

```text
Target Style
+
Face Profile
+
Survey constraints
↓
Makeup Technique
↓
Product Specification
↓
Makeup Product / Shade Matcher
```

로 연결한다.

---

# 37. Skin Match와의 교차 경계

설문 단계에서 Skin Match 결과를 사용해 Target Style을 바꾸지 않는다.

가능한 교차 사용:

- 피부 상태 때문에 특정 finish 적용 강도를 조절
- 민감하거나 건조한 상태에서 execution option을 완화
- 사용자가 이미 가진 스킨케어·베이스 환경을 실행 제약으로 활용

금지:

```text
Skin Match 피부 타입
→ 추구미 자동 선택
```

---

# 38. Result screen handoff

Survey 완료 후 다음 데이터를 Result layer로 넘긴다.

```text
Target Style Profile
+
Styling Scope
+
Constraints
+
Context
+
Change Tolerance
```

Result는 다음 순서로 보여주는 방향이 적절하다.

```text
지금의 나
↓
내 추구미
↓
현재와 목표의 차이
↓
가장 영향 큰 변화
↓
Route A / B / C
↓
Hair / Makeup / Grooming / Color
↓
실제 제품 / shade
↓
Archetype 재미 카드
```

---

# 39. 접근성 / UX 원칙

1. 이미지 비교만으로 설문을 완주하도록 강제하지 않는다.
2. 텍스트 label을 항상 함께 제공한다.
3. 색상만으로 선택 상태를 전달하지 않는다.
4. 긴 설명은 펼침으로 숨긴다.
5. 한 화면에 질문 하나를 기본으로 한다.
6. 뒤로 가기를 지원한다.
7. 선택 변경 시 이전 답을 조용히 폐기하지 않는다.
8. Target Finder의 progress를 표시한다.
9. skip 가능한 질문은 명확히 표시한다.
10. “모르겠음”을 부정적인 실패 표현으로 쓰지 않는다.

---

# 40. 사용자-facing 금지 표현

금지:

- 당신에게 정답인 스타일
- 가장 예뻐 보이는 스타일
- 반드시 해야 하는 스타일
- 남자는 이걸 선택해야 합니다
- 여자는 이걸 선택해야 합니다
- 얼굴형 때문에 이건 하면 안 됩니다
- 결점을 가리기 위해
- 못생겨 보이지 않으려면
- 얼굴을 작아 보이게 해야 합니다

권장:

- 이 방향을 선택하면 이런 인상이 더 강조됩니다
- 현재 특징을 살리려면
- 다른 분위기로 변주하려면
- 이 경로는 Hair 변화가 크고 Makeup 변화가 적습니다
- 이 옵션은 관리 시간이 더 적게 듭니다

---

# 41. V1 화면 목록

최소 화면:

```text
FL-SURVEY-00 Intro
FL-SURVEY-01 Target Awareness
FL-SURVEY-02A Direct Target Select
FL-SURVEY-02B Target Finder
FL-SURVEY-03 Presentation Preference
FL-SURVEY-04 Styling Scope
FL-SURVEY-05 Change Tolerance
FL-SURVEY-06 Context
FL-SURVEY-07A Hair Constraints
FL-SURVEY-07B Makeup Constraints
FL-SURVEY-07C Grooming Constraints
FL-SURVEY-07D Eyewear / Facial Hair / Accessories Constraints
FL-SURVEY-08 Lifestyle Constraints
FL-SURVEY-09 Target Review
```

모든 사용자가 모든 화면을 보지는 않는다.

---

# 42. V1 branching summary

```text
START
↓
Target Awareness
├─ Known
│  └─ Direct Target
├─ Partial
│  └─ Direct Target + 1~2 clarification
└─ Unknown
   └─ Target Finder
↓
Presentation Preference
↓
Styling Scope
↓
Change Tolerance
↓
Context
↓
Domain-specific constraints
↓
Lifestyle constraints
↓
Target Review
↓
CONFIRM
↓
Target Style Profile
```

---

# 43. 구현 성공 조건

Survey V1은 다음을 만족하면 1차 성공으로 본다.

1. Premium Face Lab 최초 진입에서 설문이 시작된다.
2. Known / Partial / Unknown 세 경로가 모두 완주된다.
3. Unknown 사용자는 Target Finder를 통해 Target 후보를 얻는다.
4. Makeup을 선택하지 않은 사용자가 정상 완료된다.
5. 남성 스타일 중심 preset에서도 Hair / Grooming / Eyewear 중심 결과가 가능하다.
6. 여성 스타일 중심 preset에서도 Makeup을 강제하지 않는다.
7. 중성 preset이 독립적으로 작동한다.
8. hard exclusion이 저장된다.
9. Hair / Makeup constraints가 선택한 domain에서만 나타난다.
10. 설문 완료 후 canonical Target Style Profile이 생성된다.
11. 사용자가 Target을 승인하거나 수정할 수 있다.
12. 수정 후 Style Delta / Route를 재생성할 수 있다.
13. 설문을 중단하고 이어서 할 수 있다.
14. Archetype 없이 완주된다.
15. Skin Match 무료 설문을 비대하게 만들지 않는다.

---

# 44. 다음 구현 계약

이 문서 이후 바로 필요한 계약은:

```text
FACE_LAB_V2_CANONICAL_RESULT_CONTRACT.md
```

이 문서에서 다음 전체 payload를 고정한다.

```text
Current Face Profile
Target Style Profile
Style Delta
Routes
Hair
Makeup
Color
Grooming
Eyewear
Accessories
Looks
Archetype Fun
```

그 다음 최소 vertical slice:

```text
실제 사진
→ Current Face Profile
→ Premium Survey
→ Target Style Profile
→ Style Delta
→ Route A / B / C
→ Hair / Makeup 최소 실행안
→ Premium Result UI
```

를 실제 코드로 연결한다.
