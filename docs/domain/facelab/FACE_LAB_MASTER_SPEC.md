# FACE LAB MASTER SPEC

> 상태: Face Lab 제품·아키텍처 상위 기준 문서
> 범위: Bejewely Face Lab
> 현재 구현 상태는 이 문서에 기록하지 않는다. `FACE_LAB_CURRENT_STATE.md`를 본다.
> 평가 방법론은 이 문서와 분리한다. `FACE_LAB_EVALUATION_STRATEGY.md`를 본다.
> Face Space와 Style Compatibility의 상세 목표 구조는 `face-lab-face-space-style-compatibility-architecture-v1.md`를 본다.

## 1. 제품 정의

Face Lab은 단순 동물상 테스트, 외모 점수, 관상 서비스, 또는 LLM이 한 번에 스타일 답변을 만들어 주는 기능이 아니다.

Face Lab은 사진에서 확인 가능한 얼굴 특징을 구조화한 뒤, 그 결과를 실제 스타일링에 연결하는 사진 기반 뷰티·스타일 가이드다.

사용자에게 제공하려는 흐름은 다음과 같다.

1. 얼굴의 구조적 특징과 사진 품질을 관찰한다.
2. 관찰 결과를 재사용 가능한 Normalized Face Representation으로 정리한다.
3. Face Representation을 확장 가능한 Face Space에 배치한다.
4. Face Space의 구조를 사용자가 이해하기 쉬운 대표 상 언어로 투영한다.
5. 같은 Face Representation에서 사용자의 기본 Style Identity와 스타일 목표를 정한다.
6. Face Representation과 Style Representation의 compatibility evidence를 이용해 Core / Alternative 전략을 만든다.
7. 같은 근거에서 컬러·헤어·메이크업·안경·얼굴 주변 스타일 방향을 만든다.
8. 영역별 결과를 Core Look과 Alternative Look으로 조합한다.
9. 하나의 canonical 결과를 Free와 Premium에서 깊이만 다르게 보여준다.

대표 상은 사용자가 결과를 이해하고 기억하기 위한 입구다. Face Lab의 최종 목적은 대표 상 자체가 아니라 스타일 발견과 실행이다.

내부 authority는 대표 상 label이 아니라 구조화 관찰에서 파생된 Face Representation이다. 대표 상은 Face Space 위의 사용자 해석 projection이며, 스타일 추천 엔진의 직접 lookup key가 아니다.

## 2. 목표 아키텍처

```text
사진
→ Eligibility / Quality
→ FaceLabObservationAnalysis
→ Normalized Face Representation
→ Face Space
   ├─ Archetype Projection / hold
   └─ Style Compatibility
      → Style Identity
      → Core / Alternative Strategy
      → Color / Hair / Makeup / Eyewear / Face Style
      → Look Composer
→ Canonical Face Lab Result
→ Free projection / Premium projection / Storage
```

평가와 calibration은 이 흐름을 검증하는 별도 계층이며, 제품 판정 계층을 대신하지 않는다.

## 3. 책임 분리

### 3.1 Vision

Vision은 **관찰 계층**이다.

근거가 있을 때 다음과 같은 보이는 사실을 구조화할 수 있다.

- 얼굴형과 폭 관계
- 얼굴의 세로 균형
- 턱선과 광대 구조
- 눈매 방향·길이·개방감
- 이목구비 크기와 집중도
- 직선감과 곡선감
- 윤곽 선명도와 특징 대비
- 사진 품질, 자세, 가림, 조명, 화이트밸런스, 색 분석 적합성

Vision이 직접 생성하거나 확정하면 안 되는 값:

- 최종 대표 상
- 대표 상 affinity 또는 유사도 점수
- 성격·능력·건강·운세·관상·인종 등 사람의 내적 특성
- 최종 헤어·메이크업·컬러 팔레트·코디·완성 룩
- 판단 엔진을 우회하는 임의의 사용자 스타일링 문장

### 3.2 Normalized Face Representation / Face Space

FaceLabObservationAnalysis는 최종 분류값이 아니라 재사용 가능한 구조 표현의 근거다.

목표 구조는 다음과 같다.

```text
FaceLabObservationAnalysis
→ versioned normalization
→ Normalized Face Representation
→ Face Space
```

Face Space는 특정 수의 대표 상을 전제로 하지 않는다. 현재 7개 대표 상이 바뀌거나 추가·병합·분할·폐기돼도 얼굴 구조 표현 계약 자체는 유지될 수 있어야 한다.

Face Space는 특정 3D backend의 native parameter space도 아니다. FLAME coefficient, MPFB/MakeHuman target, Blender Shape Key는 Face Space를 재현하거나 검증하기 위한 adapter parameter일 수 있지만 내부 얼굴 표현 authority가 아니다. 3D backend mapping은 versioned adapter로 격리하고, 생성 mesh를 다시 구조 측정해 requested Face Space vector와 round-trip 검증한다.

구조적 얼굴 축과 헤어·메이크업·표정·조명·카메라 같은 presentation 축은 가능한 한 분리해 보존한다. Presentation에서 반복되는 패턴을 얼굴 구조 truth로 조용히 승격하지 않는다.

정확한 representation schema와 normalization은 별도 versioned contract가 담당한다.

### 3.3 Archetype Projection Engine

대표 상 판정은 결정론적이고 추적 가능해야 한다.

```text
observations
→ indicator matching
→ positive / negative contribution
→ evidence coverage
→ raw score
→ ranking
→ ambiguity / contradiction checks
→ decision 또는 hold
```

어떤 관찰값이 어떤 점수에 기여했는지 추적할 수 있어야 한다.

Taxonomy, 근거량, 점수, 1·2위 격차, 모순, calibration 조건을 만족하지 못하면 임의로 대표 상을 확정하지 않고 보류한다.

대표 상 유사도는 지원하는 분류군 안에서 계산한 **특징 유사도**다. 확률, 생물학적 분류 확률, 외모 점수, 객관적 우열을 의미하지 않는다.

### 3.4 Style Identity와 전략

대표 상 하나를 스타일 추천 lookup key로 사용하면 안 된다.

Style Identity는 대표 상보다 우선해서 Normalized Face Representation, Face Space 위치, 실제 observation evidence와 사용자가 원하는 전략 방향을 사용한다. 대표 상은 설명과 해석을 돕는 projection으로 사용할 수 있다.

장기 Style Compatibility의 목표 관계는 다음이다.

```text
Face Representation
× Style Representation
× Compatibility Evidence
→ bounded style recommendation
```

Style Identity는 대표 상뿐 아니라 더 넓은 관찰 패턴과 근거를 사용한다.

Core와 Alternative는 서로 다른 전략 객체다.

- **Core**: 사용자의 기본 시각 언어를 살리고 강화한다.
- **Alternative**: 현재 근거가 허용하는 범위에서 시각적 방향을 의미 있게 바꾼다.

Alternative는 Core 문장을 조금 바꾼 수준이어서는 안 된다.

### 3.5 영역별 스타일 엔진

Color, Hair, Makeup, Face Style은 각각 독립된 영역이다.

각 영역은 자체적으로 다음을 가져야 한다.

- 근거
- 상태
- confidence
- 실패·보류 처리

입력은 canonical observations, Normalized Face Representation, 선택된 전략과 해당 영역의 compatibility evidence다. 대표 상 하나만 보고 고정 추천을 반환하면 안 된다.

헤어스타일명, 안경 형태명, 메이크업 룩명은 가능한 경우 내부 Style Representation을 사용자나 카탈로그 언어로 번역하는 마지막 단계에서 사용한다.

금지 예시:

- 고양이상 → 항상 강한 아이라인
- 강아지상 → 항상 코랄
- 늑대상 → 항상 올백
- 특정 상 → 항상 같은 넥라인·액세서리

### 3.6 Look Composer

Look Composer는 영역별 결과를 Core Look과 Alternative Look으로 조합한다.

반드시 다음을 처리해야 한다.

- 컬러·헤어·메이크업·얼굴 주변 스타일 간 충돌 검사
- 선택한 전략과의 일관성
- 일부 영역 unavailable일 때 허위 대체값 생성 금지
- Core와 Alternative의 실질적 차이 유지
- 과장된 이름·설명 금지

## 4. Canonical 결과와 Free / Premium

Free와 Premium은 같은 canonical Face Lab 결과를 읽어야 한다.

```text
한 번의 분석
→ 하나의 canonical result
   ├─ Free projection
   ├─ Premium projection
   └─ 허용된 storage snapshot
```

같은 분석 실행에 대해 Free와 Premium이 사진을 따로 재분석하거나 서로 다른 대표 상·전략·스타일링 결론을 만들면 안 된다.

표시 깊이는 달라도 된다. 분석 authority는 같아야 한다.

## 5. Evidence와 상태 계약

근거 없는 `available`은 금지한다.

분석 전체와 영역별 결과는 owning contract가 지원하는 범위에서 최소 다음 상태를 구분한다.

- `available`
- `partial`
- `insufficient_evidence`
- `unavailable`

근거가 필요한 필드는 계약상 다음 개념을 보존한다.

```text
status
source
confidence
evidence
unavailableReason
value
```

근거가 없거나 부족한 값을 default, mock, placeholder, fallback, 일반론 스타일링으로 채워 정상 결과처럼 만들면 안 된다.

## 6. Eligibility와 실패 처리

정상 Face Lab 결과는 현재 eligibility 계약이 지원하는 실제 사람 얼굴 사진을 요구한다.

다음 상태를 서로 구분한다.

- 이미지 자체가 분석 대상이 아님
- 시각 근거 부족
- Provider 또는 시스템 실패
- 후속 판정 보류

이 상태들을 정상 결과 카드로 합치면 안 된다.

과거 저장 snapshot은 당시 계약으로 직접 재열람할 수 있다. 그러나 legacy fallback/raw payload를 현재 canonical `available` 결과로 조용히 승격하면 안 된다.

## 7. 개인정보와 저장

일반 Face Lab 분석과 연구·평가용 데이터 활용은 서로 다른 목적이다.

기본 서비스 경계:

```text
원본 사진
→ 요청 처리 중 일시 분석
→ 구조화 결과 생성
→ 원본 사진 비저장
```

현재 경계를 변경하는 별도 계약이 없는 한 canonical result와 saved report에 다음을 저장하지 않는다.

- 원본 얼굴 이미지
- base64 image payload
- 얼굴 crop
- raw Provider response

평가 데이터셋 활용에는 별도 선택 동의와 운영 경계가 필요하다. 서비스 이용 동의를 연구·평가 동의로 확대 해석하지 않는다.

## 8. 제품 금지 사항

Face Lab은 다음을 해서는 안 된다.

- 외모 점수·외모 등급·우열 비교
- 성격·건강·능력·운세·관상·인종 등 민감하거나 내적인 특성 추론
- 통제되지 않은 사진 한 장으로 퍼스널컬러 계절형 확정
- 얼굴 사진만으로 전신 체형이나 전체 코디 단정
- 근거 없는 셀럽 동일인·정체성 유사성 주장
- 근거가 없는 값을 정상 추천으로 변환
- 모델이 생성한 문장을 곧 정책으로 사용
- 생성 프롬프트 의도를 ground truth로 사용
- 모든 사용자에게 같은 Core / Alternative 출력
- Free와 Premium에서 서로 다른 분석 생성

## 9. Taxonomy와 calibration authority

다음은 calibration에 따라 바뀔 수 있는 값이다.

- taxonomy key
- rubric weight
- minimum evidence coverage
- minimum top score
- minimum top margin
- contradiction threshold
- 사용자 화면 표시 cutoff
- production activation 여부

이 값들은 불변 제품 철학이 아니다.

Taxonomy나 weight table이 `proposed`, `rubric_ready`, `pilot` 등 비활성 상태로 존재할 수 있다. 존재한다는 이유만으로 사용자 판정 authority가 되지 않는다.

Production ArchetypeDecision은 명시적인 calibration과 activation gate를 통과해야 한다.

Archetype taxonomy는 Face Space 자체의 schema가 아니다. Taxonomy가 변경돼도 Normalized Face Representation과 Style Compatibility의 기초 표현은 가능하면 독립적으로 유지한다.

## 10. 평가와의 관계

생성과 평가는 서로 다른 책임이다.

또한 다음 네 질문을 같은 평가로 합치지 않는다.

```text
Archetype validity
≠ Face Space validity
≠ Style association
≠ Style compatibility
```

웹에서 특정 얼굴 구조와 특정 스타일이 자주 함께 나타나는 것은 association evidence일 뿐, 그 스타일이 더 잘 어울린다는 compatibility truth가 아니다.

Synthetic data는 다음 용도에 사용할 수 있다.

- technical fixture
- 통제된 cue test
- stress test
- ambiguity / hold 검증
- 관찰 실패 탐지
- 탐색적 rubric 검증

그러나 합성 이미지의 생성 의도는 그 이미지의 정답 라벨이 아니다.

실제 사용자 얼굴에서의 대표 상 성능을 주장하거나 production threshold를 확정하려면 Human annotation, consensus, ambiguity를 포함한 실제 평가 근거가 필요하다. 자세한 원칙은 `FACE_LAB_EVALUATION_STRATEGY.md`가 담당한다.

## 11. 문서 authority 순서

이 문서는 Face Lab의 상위 제품·아키텍처 기준이다.

세부 동작은 최신 component contract와 코드가 담당한다.

현재 component 예시:

- Unified Vision / Face Lab observation contract
- Archetype scoring contract와 registry
- Archetype styling contract
- Synthetic evaluation contracts

충돌 시 원칙:

```text
제품 방향
→ FACE_LAB_MASTER_SPEC.md

현재 구현 여부
→ current main code + FACE_LAB_CURRENT_STATE.md

세부 계약
→ 해당 최신 component contract

평가 방법
→ FACE_LAB_EVALUATION_STRATEGY.md

과거 판단 근거
→ 날짜가 붙은 historical document
```

과거 문서의 구현 상태와 현재 코드가 충돌하면 현재 코드가 우선한다.

## 12. 과거 자료에서 승계한 내용

이 문서는 다음 7월 Face Lab 자료에서 현재도 유효한 제품 원칙을 통합했다.

- `face lab은 무엇인가 0716.txt`
- `Face_Lab_구현_명세_0716_수정본.md`
- `face_lab_진행상황_0727.txt`
- `bejewely-face-analyze-pipeline-07-30.txt`

날짜가 붙은 자료는 당시 판단과 작업 이력을 추적하는 근거로 남긴다. 그 안의 “현재 구현 상태” 문장은 현재 authority로 사용하지 않는다.
