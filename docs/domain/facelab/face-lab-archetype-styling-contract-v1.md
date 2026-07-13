# Face Lab Archetype Styling Contract v1

## 0. 문서 상태

| 구분 | 내용 |
| --- | --- |
| 문서 유형 | Face Lab 도메인 계약 초안 v1 |
| 상태 | 제품 철학과 목표 데이터 경계는 확정, 분류 가중치와 임계값은 검증 전 미확정 |
| 적용 대상 | 무료 Face Lab 결과, 프리미엄 Face Lab 리포트, 분석·변환·표시 어댑터 |
| 비적용 대상 | Skin Match 진단·추천, 제품 랭킹, 피부 점수, 전신 체형 분석 |
| 구현 여부 | 이 문서에서는 코드, API, 저장 구조, UI를 변경하지 않음 |

이 문서에서 사용하는 표시는 다음과 같다.

- **확정**: 다음 구현과 후속 계약이 따라야 하는 원칙이다.
- **v1 권장**: 구현 전 검증을 전제로 한 기본 설계안이다.
- **미결정**: 평가 자료나 제품 판단이 부족해 임의로 확정하지 않는다.

## 1. 목적과 적용 범위

**확정:** 이 문서는 Face Lab의 제품 정의와 분석 책임, 사용자 결과 흐름, 대표 상 분류, 스타일링 출력, 실패 정책을 고정하는 도메인 계약이다. API 프롬프트나 UI 카피만을 위한 문서가 아니다.

무료 결과와 프리미엄 리포트는 하나의 Face Lab 분석 결과를 공유한다. 두 화면은 분석 철학이나 판정 결과를 달리 만들지 않고, 동일한 결과를 서로 다른 깊이로 보여준다.

이 계약은 실제 분석값과 fallback/default 값을 분리한 기존 전체 envelope 및 `mood/color/style` 항목별 상태 계약 위에 이어지는 후속 도메인 명세다. 기존 계약과 충돌하거나 추가 전환이 필요한 부분은 18장에서 별도로 기록한다.

## 2. Face Lab 한 문장 정의

**확정:** Face Lab은 얼굴의 구조적 특징을 직관적이고 재미있는 대표 상으로 번역하고, 그 인상을 살리거나 변주할 수 있는 컬러·헤어·메이크업·얼굴 주변 스타일링 방향을 제시하는 사진 기반 뷰티 스타일 가이드다.

Face Lab은 얼굴 특징 수치 자체를 전시하는 진단기, 외모 평가기, 관상 서비스가 아니다.

## 3. 제품 철학과 사용자 가치

### 3.1 사용자 가치 흐름

1. **재미:** 나는 어떤 상인가
2. **이해:** 왜 그런 상으로 보이는가
3. **활용:** 이 인상을 살리거나 다른 방향으로 변주하려면 어떻게 해야 하는가
4. **실행:** 어떤 컬러, 헤어, 메이크업, 얼굴 주변 스타일을 선택해야 하는가

대표 상은 재미를 위한 별도 장식이 아니라 이해와 스타일링 실행을 연결하는 사용자 언어다. 실제 추천은 대표 상 하나만으로 만들지 않고, 대표 상을 만든 세부 관찰값과 선택한 스타일링 전략을 함께 사용한다.

### 3.2 핵심 사용자 결과 플로우

1. 대표 상 발견
2. 대표 상의 간결한 설명
3. 본래 인상을 살리는 스타일링 전략
4. 다른 분위기로 변주하는 스타일링 전략
5. 컬러 방향
6. 헤어 방향과 이유
7. 메이크업 방향
8. 얼굴 주변 스타일
9. 영역별 추천을 조합한 완성 스타일 룩

## 4. 내부 판별값과 사용자 노출값의 분리

### 4.1 내부 관찰값

Vision 관찰 단계는 가능한 경우 다음 값을 구조화한다.

- 얼굴형
- 얼굴 세로·가로 비율
- 이마·광대·턱 폭 관계
- 턱선의 각진 정도와 곡선 정도
- 눈매 방향과 길이감
- 이목구비 크기와 집중도
- 직선감과 곡선감
- 윤곽 선명도
- 이목구비 대비감
- 얼굴 중심 특징
- 사진의 조명, 화이트밸런스, 가림, 해상도 및 색 분석 적합성
- 각 관찰값의 `confidence`, `evidence`, `status`, 측정 또는 관찰 경로

이 값들은 대표 상 판정과 스타일링 결과 생성의 근거다. 얼굴 수치와 세부 특징을 별도의 장황한 사용자 결과 섹션으로 나열하지 않는다.

### 4.2 사용자 노출값

- 대표 상
- 대표 상 유사도와 상위 분포
- 간결한 대표 상 설명
- 본래 인상을 살리는 전략
- 인상을 변주하는 전략
- 컬러 방향
- 헤어 방향
- 메이크업 방향
- 얼굴 주변 스타일
- Core Look과 Alternative Look

사용자 설명에는 실제 근거가 있는 특징만 짧게 포함할 수 있다. 내부 수치, 모델 원문, 원시 landmark, 디버그 evidence 경로는 기본 사용자 화면에 노출하지 않는다.

## 5. 대표 상과 유사도 계약

### 5.1 대표 상 중심 원칙

**확정:** 결과의 중심에는 대표 상 하나만 둔다. 별도의 두 번째 상을 독립 결과 개념으로 만들지 않는다. 다른 유형은 지원 분류군 안에서 계산한 상위 유사도 분포로만 제공한다.

대표 상은 유효한 유형 중 가장 높은 원시 점수를 얻고, 최소 근거·점수·격차 조건을 모두 통과한 유형이다. 조건을 통과하지 못하면 임의의 대표 상을 만들지 않는다.

### 5.2 유사도의 의미

**확정:** 유사도는 통계적 확률, 생물학적 분류 확률, 의학적 정확도 또는 외모 점수가 아니다. 지원하는 전체 대표 상 분류군에 대해 구조화 얼굴 특징이 얼마나 가까운지를 규칙 기반으로 계산한 **정규화된 특징 유사도**다.

사용자 화면과 카피에서 `확률`, `정확도`, `일치 확률`, `외모 점수`라고 부르지 않는다. `유사도` 또는 `특징 유사도`만 사용한다.

### 5.3 계산 및 표시 정책

| 항목 | 정책 |
| --- | --- |
| 점수 생성 | Vision은 유사도 숫자를 직접 생성하지 않는다. 구조화 관찰값을 입력으로 결정론적·추적 가능한 판정기가 유형별 원시 점수를 계산한다. |
| 정규화 | 유효한 전체 v1 분류군의 원시 점수를 합계 100으로 정규화한다. |
| 대표 상 | 최소 근거 조건을 충족한 유형 중 원시 점수가 가장 높은 유형이다. |
| 사용자 노출 | 상위 3개까지만 노출한다. 독립된 추가 상 결과는 만들지 않는다. |
| 작은 값 | **v1 권장:** 정규화 유사도 5% 미만은 화면에서 숨긴다. 정확한 기준은 평가 세트로 검증한다. |
| 반올림 | **v1 권장:** 정수 단위로 반올림한다. 5% 단위 반올림은 정보 손실이 커 기본안으로 채택하지 않는다. |
| 합계 표시 | 내부 전체 분포는 100이다. 상위 3개 또는 5% 미만 항목을 숨긴 화면의 합계는 100이 아닐 수 있으며, 보이는 항목만 다시 100으로 정규화하지 않는다. |
| 최소 점수 | 최소 기준은 반드시 존재해야 하지만 정확한 수치는 평가 전 미결정이다. 임계값이 검증되기 전에는 임의의 대표 상을 확정하지 않는다. |
| 1·2위 근접 | 최소 격차 기준 미달이면 대표 상을 억지로 고르지 않고 `insufficient_evidence`로 처리한다. 정확한 격차는 평가 전 미결정이다. |
| 근거 부족 | 필수 관찰 축의 수 또는 confidence가 부족하면 분포와 대표 상 모두 사용자 분석값으로 만들지 않는다. |

반올림으로 전체 내부 분포 합계가 99 또는 101이 되는 경우에는 표시용 최대 잔여 보정 1을 가장 큰 항목에 적용할 수 있다. 다만 화면에 숨긴 항목이 있다면 노출된 항목의 합계를 억지로 100으로 맞추지 않는다.

### 5.4 현재 기술 구조의 구현 가능성 판단

현재 구조에는 전체 Face Lab envelope, 항목별 `status/source/confidence/evidence`, 얼굴형·landmark 설명·인상 텍스트·색 방향·헤어 문구가 존재한다. 그러나 다음 이유로 신뢰 가능한 상 분포를 즉시 계산할 수는 없다.

- 현재 Vision 응답은 대표 상 판정에 필요한 관찰 축을 고정된 수치·범주로 모두 제공하지 않는다.
- 현재 `animalType` 도출은 evidence 문자열의 단서와 정규식 기반 helper를 사용하며, 전체 분류군에 대한 독립 점수와 근거 기여도를 계산하지 않는다.
- 현재 항목 confidence는 일부 고정 규칙 값이며 대표 상 affinity의 교정된 신뢰도를 의미하지 않는다.
- 유형별 지표, 가중치, 상호 배타 조건, 결측 처리, 사진 품질 하한이 확정되지 않았다.
- 실제 사진 fixture와 합의된 평가 기준이 없다.

따라서 **현재 코드만으로 생성한 75/15/10 같은 숫자를 신뢰 가능한 개인 유사도로 노출하면 안 된다.** 먼저 observations 계약, 유형별 점수표, 평가 세트, 임계값 교정을 완료해야 한다.

## 6. 대표 상 분류군 초안

아래 7개 유형은 제품 요구를 구조화한 **v1 검토 초안**이다. 판별 지표는 구현 확정값이 아니라 검수해야 할 가설이다. 성별, 연령, 인종, 피부색, 화장 여부를 직접 점수 요인으로 사용하지 않는다.

| key | 표시명 | 핵심 인상 | 강한 판별 지표 후보 | 보조 판별 지표 후보 | 겹치는 특징 | 구별에 중요한 특징 | 대표 스타일 키워드 후보 | 단순 고정 매핑 금지 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `wolf` | 늑대상 | 선명하고 길게 흐르는 긴장감, 구조적인 인상 | 길고 선명한 눈매, 직선 우세 윤곽, 턱선·중심선의 구조감 | 중상 이상의 특징 대비, 세로 방향성 | 고양이상의 선명한 눈매, 공룡상의 골격감 | 고양이상보다 얼굴 전체의 직선·세로 구조 비중이 큰지, 공룡상보다 눈매 방향성이 중심인지 | 선명함, 절제, 길이감, 구조감 | 강한 컬러, 올백, 윗볼륨, 날카로운 메이크업을 자동 부여하지 않음 |
| `cat` | 고양이상 | 또렷한 시선과 민첩한 곡선·직선의 조합 | 올라가거나 길게 빠지는 눈매, 눈 주변 집중도, 또렷한 특징 경계 | 중간 이상의 대비, 비교적 압축된 중심 특징 | 늑대상의 긴 눈매, 여우상 후보의 길고 가는 선 | 얼굴 전체 골격보다 눈매와 중심부 집중이 더 강한지 | 또렷함, 집중, 매끈함, 리듬감 | 아이라인 상승, 블랙 컬러, 짧은 단발을 자동 부여하지 않음 |
| `puppy` | 강아지상 | 둥글고 열린 선이 만드는 편안한 인상 | 둥글거나 완만한 눈매, 곡선 우세 윤곽, 부드러운 특징 경계 | 낮거나 중간 대비, 볼 중심의 완만함 | 사슴상의 큰 눈, 두부상의 부드러운 윤곽 | 사슴상보다 세로 길이감이 약하고 얼굴 전체 곡선 비중이 큰지 | 부드러움, 열린 인상, 자연스러움, 가벼움 | 성격을 친근하다고 단정하거나 파스텔·웨이브를 자동 부여하지 않음 |
| `deer` | 사슴상 | 맑은 시선과 세로로 이어지는 섬세한 인상 | 길이감 있는 얼굴 비율, 크거나 열린 눈의 존재감, 가벼운 턱선 | 낮거나 중간 대비, 세로 중심의 여백 | 강아지상의 열린 눈, 늑대상의 세로 방향성 | 강아지상보다 세로 비율과 섬세한 윤곽이 두드러지는지, 늑대상보다 각진 정도가 낮은지 | 맑음, 섬세함, 여백, 길이감 | 청순함·여성성·연약함을 자동 연결하지 않음 |
| `tofu` | 두부상 | 낮은 대비와 매끈한 면이 만드는 담백한 인상 | 각이 약한 넓은 면, 부드러운 윤곽 전환, 낮은 특징 대비 | 단순한 중심 구성, 완만한 턱선 | 강아지상의 곡선, 감자상의 둥근 비율 | 감자상보다 세로·가로 압축감과 볼륨감이 낮고 면 전환이 매끈한지 | 담백함, 매끈함, 낮은 대비, 정돈 | 피부색, 체형, 순한 성격과 연결하거나 무채색을 자동 부여하지 않음 |
| `potato` | 감자상 | 압축된 비율과 둥근 볼륨이 만드는 생동감 있는 인상 | 비교적 짧은 세로 비율, 볼·하안부의 둥근 볼륨, 곡선 윤곽 | 중간 특징 대비, 중심부 응집 | 두부상의 부드러운 면, 강아지상의 곡선 | 두부상보다 압축감과 국소 볼륨이 큰지, 강아지상보다 얼굴 비율 특징이 중심인지 | 생동감, 응집감, 둥근 리듬, 균형 | 체중, 얼굴 크기, 귀여움, 특정 성별과 연결하거나 짧은 헤어를 자동 부여하지 않음 |
| `dino` | 공룡상 | 큰 구조 축과 분명한 골격 전환이 만드는 존재감 | 이마·광대·턱의 구조적 관계, 눈썹뼈·코·턱 중심의 큰 스케일, 직선 윤곽 | 중상 대비, 넓은 면과 강한 전환 | 늑대상의 구조감, 감자상의 응집감 | 눈매보다 골격 축과 큰 면의 전환이 주된 판별 근거인지 | 구조감, 스케일, 안정감, 분명한 선 | 남성성·거친 성격과 연결하거나 짧은 머리·강한 음영을 자동 부여하지 않음 |

### 6.1 분류군 검토 사항

- 현재 helper는 `fox`, `rabbit` 관련 단서도 처리하지만 요구된 7개 분류군에는 포함되지 않는다. 여우상과 토끼상은 문화적 인지도가 높고 고양이상·사슴상·강아지상 사이의 구별 축을 보완할 가능성이 있어 **추가 후보**로 검토한다.
- 고양이상과 늑대상, 강아지상과 사슴상, 두부상과 감자상은 관찰 축이 겹친다. 눈매만으로 분류하지 않고 얼굴 비율·윤곽·특징 집중도 조합으로 구별 가능한지 평가해야 한다.
- 두부상·감자상은 음식 비유가 피부색, 체형, 얼굴 크기 평가로 오해될 위험이 있다. 사용자 조사에서 수용성과 모욕 가능성을 검증하고 필요하면 중립적 표시명 또는 설명 체계를 검토한다.
- 공룡상·늑대상이 특정 성별에, 사슴상·고양이상이 다른 성별에 편향되지 않는지 성별 블라인드 평가가 필요하다.
- 7개 유형만으로 낮은 대비·높은 대비, 짧은 비율·긴 비율, 직선·곡선 스펙트럼을 충분히 덮는지 실제 데이터로 확인하기 전에는 전체 목록을 확정하지 않는다.

## 7. 대표 상 설명 계약

대표 상 설명은 1~2문장으로 제한한다.

```text
대표 상: 늑대상

길고 선명한 눈매와 또렷한 윤곽이 어우러져 차분하면서도 강한 분위기가 중심입니다.
```

설명 규칙은 다음과 같다.

- 해당 결과의 실제 `evidence`가 있는 특징만 사용한다.
- 얼굴 수치와 관찰 축을 목록처럼 나열하지 않는다.
- 과도한 미사여구와 근거 없는 칭찬을 사용하지 않는다.
- 외모 우열, 점수, 결함을 평가하지 않는다.
- 성격, 인간관계, 능력, 운명, 건강을 단정하지 않는다.
- 관상·운세 표현을 사용하지 않는다.
- 대표 상의 전형 설명을 실제 관찰 근거처럼 복사하지 않는다.
- 생성 문장에 evidence에 없는 특징이 추가되면 해당 문장을 폐기하거나 재생성한다.

## 8. 스타일링 전략 계약

모든 결과는 가능한 경우 두 전략을 제공한다.

### 8.1 Core 전략: 본래 인상을 살리기

- 대표 상의 핵심 분위기를 강화한다.
- 실제 얼굴 특징의 강점을 선, 색, 질감, 대비로 명확하게 표현한다.
- 대표 상 전형이 아니라 사용자 관찰값을 우선한다.

### 8.2 Alternative 전략: 다른 분위기로 변주하기

- 대표 상의 기본 특징을 존중하면서 강한 축을 완화하거나 다른 인상 축을 추가한다.
- 변주 목표는 `부드럽게`로 고정하지 않는다.
- 실제 관찰값에 따라 친근함, 생동감, 정돈감, 가벼움, 선명함, 여유, 구조감 등 가장 유효한 대안 축을 선택한다.
- Core와 반대되는 요소를 무작정 적용하지 않고 얼굴 특징과 충돌하지 않는 범위에서 조합한다.

### 8.3 전략 데이터

```js
{
  key: "core" | "alternative",
  label: string,
  summary: string,
  styleKeywords: string[],
  emphasizeFeatures: string[],
  balanceFeatures: string[],
  principles: {
    line: string[],
    color: string[],
    texture: string[],
    contrast: string[]
  },
  evidence: string[]
}
```

두 전략 모두 대표 상과 실제 관찰 evidence에 연결되어야 한다. evidence가 없는 고정 전략 문구는 허용하지 않는다.

## 9. 영역별 스타일링 계약

### 9.1 컬러

Face Lab 컬러는 사진에서 관찰 가능한 색 대비와 스타일 무드를 연결하는 방향 정보다. 퍼스널컬러 계절형을 확정하는 기능이 아니다.

입력 고려값:

- 사진의 색 분석 적합성
- 피부·머리·눈의 사진상 대비
- 명도, 채도, 온도 방향
- 화이트밸런스, 필터, 카메라 보정, 조명 편향
- 대표 상의 핵심 무드
- Core 또는 Alternative 전략

출력:

- 본래 인상을 살리는 컬러
- 변주 방향 컬러
- 피하거나 사용 강도를 조절할 컬러
- 간결한 이유
- 촬영 환경에 따른 오차 안내

색 분석 근거가 부족하면 `피치`, `코랄` 등 기본 팔레트를 대신 출력하지 않는다. 컬러만 `insufficient_evidence` 또는 `unavailable`이어도 다른 Face Lab 영역은 제공할 수 있다.

### 9.2 헤어

헤어 결과는 다음을 포함한다.

- 가르마
- 앞머리
- 볼륨 위치
- 옆선 처리
- 권장 길이 범위
- 직선·곡선 텍스처
- 추천 방향
- 피하거나 강도를 조절할 방향
- 추천 이유

헤어 추천 입력은 `대표 상 무드 + 얼굴형 + 세로·가로 비율 + 이마·광대·턱 관계 + 윤곽 선명도 + 직선·곡선감 + 전략`이다. 같은 대표 상이어도 얼굴 비율과 윤곽이 다르면 다른 헤어 결과가 나와야 한다.

### 9.3 메이크업

Face Lab 메이크업은 다음 범위만 다룬다.

- 눈썹 형태와 강도
- 아이라인 길이와 방향
- 아이 음영 위치와 강도
- 블러셔 위치와 확산 방향
- 립의 명도·채도·경계·질감
- 피부 표현의 광택 정도
- 강조할 부위
- 힘을 뺄 부위

입력은 `대표 상 + 눈매와 얼굴 윤곽 + 이미 강한 특징 + 균형을 맞출 특징 + 컬러 방향 + 전략`이다. 성형적 평가, 결함 표현, 외모 우열 표현을 금지하며, 무엇을 고쳐야 하는지가 아니라 어떤 특징을 살리거나 균형 있게 표현할지에 집중한다.

### 9.4 얼굴 주변 스타일

사진 한 장만으로 전신 체형, 취향, 직업, 생활환경을 단정하지 않는다. v1은 얼굴과 직접 연결되는 다음 영역을 우선한다.

- 넥라인
- 안경테
- 귀걸이와 액세서리 형태
- 얼굴 주변 패턴 강도
- 상의 컬러
- 얼굴 주변 소재의 부드러움·구조감
- 얼굴 근처 실루엣

추후 체형, 취향, TPO 데이터가 명시적으로 추가되면 별도 입력 계약과 사용자 동의를 전제로 전신 스타일링으로 확장할 수 있다. 해당 데이터 없이 전신 코디를 단정하지 않는다.

## 10. 완성 스타일 룩

영역별 추천을 독립 목록으로 끝내지 않고 최소 두 개의 일관된 룩으로 조합한다.

- **Core Look:** 본래 인상을 살리는 조합
- **Alternative Look:** 다른 분위기로 변주하는 조합

```js
{
  key: "core-look" | "alternative-look",
  title: string,
  strategy: "core" | "alternative",
  summary: string,
  colors: string[],
  hair: string[],
  makeup: string[],
  neckline: string[],
  eyewear: string[],
  accessories: string[],
  materialOrPattern: string[],
  whyItWorks: string,
  evidence: string[]
}
```

룩 조합기는 영역별 결과의 선·색·대비·질감 충돌을 확인한다. `Urban Sharp`, `Soft Chic` 같은 룩 이름을 모든 사용자에게 재사용하지 않는다. 이름과 설명은 실제 대표 상, 전략, available 영역을 기반으로 만들고 근거 없는 과장 표현을 사용하지 않는다.

## 11. 무료 결과와 프리미엄 리포트 경계

**확정:** 무료와 프리미엄은 동일한 Face Lab 분석 객체를 공유한다. 프리미엄을 위해 대표 상이나 스타일 결과를 다시 판정하지 않는다. 차이는 표시 깊이뿐이다.

### 11.1 v1 권장 무료 범위

- 대표 상
- 상위 유사도 분포
- 1~2문장 설명
- 핵심 컬러 일부
- 헤어 방향 한 줄
- Core·Alternative 전략 미리보기

### 11.2 v1 권장 프리미엄 범위

- 전체 유사도 해석
- Core·Alternative 전략 상세
- 컬러 추천과 주의 색
- 헤어 세부 가이드와 이유
- 메이크업 부위별 방향
- 얼굴 주변 스타일
- Core Look·Alternative Look
- 각 결과의 설명과 근거

무료·프리미엄의 정확한 정보량과 게이트 위치는 제품 정책으로 미결정이다. 다만 하나의 분석 계약을 공유한다는 원칙은 변경할 수 없다.

## 12. 목표 데이터 계약 초안

### 12.1 공통 타입 원칙

- 모든 분석 영역은 `status`, `source`, `confidence`, `evidence`, `unavailableReason`을 유지한다.
- `status !== "available"`인 영역은 개인 분석값을 기본값으로 채우지 않는다.
- `source`는 실제 Vision 관찰 또는 그 관찰에서 추적 가능하게 도출된 경우에만 설정한다.
- `confidence`는 모델의 자의적 자신감 문구가 아니라 품질·관찰 coverage·규칙 판정 안정성을 반영해야 한다.
- `evidence`는 내부 추적용이며 사용자 카피와 분리한다.

### 12.2 문서용 객체 예시

```js
const faceLab = {
  status: "available" | "insufficient_evidence" | "unavailable",
  source: "vision" | null,
  failureReason: string | null,
  analyzedAt: string | null,

  quality: {
    status: "available" | "insufficient_evidence" | "unavailable",
    faceVisibility: number | null,
    lightingSuitability: number | null,
    colorSuitability: number | null,
    occlusion: string[],
    warnings: string[],
    evidence: string[]
  },

  observations: {
    status: "available" | "insufficient_evidence" | "unavailable",
    source: "vision" | null,
    confidence: number | null,
    evidence: string[],
    unavailableReason: string | null,
    values: {
      faceShape: string | null,
      verticalHorizontalRatio: number | null,
      foreheadCheekJawRelation: object | null,
      jawAngularCurve: number | null,
      eyeDirection: string | null,
      eyeLength: number | null,
      featureScale: object | null,
      featureConcentration: number | null,
      straightCurveBalance: number | null,
      contourDefinition: number | null,
      featureContrast: number | null,
      focalFeatures: string[]
    }
  },

  archetype: {
    status: "available" | "insufficient_evidence" | "unavailable",
    source: "derived_from_vision" | null,
    confidence: number | null,
    evidence: string[],
    unavailableReason: string | null,
    primary: {
      key: "wolf",
      label: "늑대상",
      affinity: 75
    } | null,
    distribution: [
      { key: "wolf", label: "늑대상", affinity: 75, rank: 1 },
      { key: "cat", label: "고양이상", affinity: 15, rank: 2 },
      { key: "dino", label: "공룡상", affinity: 10, rank: 3 }
    ],
    explanation: string | null
  },

  strategies: {
    status: "available" | "insufficient_evidence" | "unavailable",
    source: "derived_from_vision" | null,
    confidence: number | null,
    evidence: string[],
    unavailableReason: string | null,
    core: {
      key: "core",
      label: string,
      summary: string,
      styleKeywords: string[],
      emphasizeFeatures: string[],
      balanceFeatures: string[],
      principles: object
    } | null,
    alternative: {
      key: "alternative",
      label: string,
      summary: string,
      styleKeywords: string[],
      emphasizeFeatures: string[],
      balanceFeatures: string[],
      principles: object
    } | null
  },

  color: createStylingField({
    enhance: { palette: [], directions: [] },
    alternative: { palette: [], directions: [] },
    avoid: [],
    reason: ""
  }),

  hair: createStylingField({
    enhance: { part: [], bangs: [], volume: [], sideLine: [], length: [], texture: [] },
    alternative: { part: [], bangs: [], volume: [], sideLine: [], length: [], texture: [] },
    avoid: [],
    reason: ""
  }),

  makeup: createStylingField({
    enhance: { brows: [], eyeliner: [], eyeshadow: [], blush: [], lips: [], skinFinish: [] },
    alternative: { brows: [], eyeliner: [], eyeshadow: [], blush: [], lips: [], skinFinish: [] },
    avoid: [],
    reason: ""
  }),

  faceStyle: createStylingField({
    enhance: { neckline: [], eyewear: [], accessories: [], materialOrPattern: [], silhouette: [] },
    alternative: { neckline: [], eyewear: [], accessories: [], materialOrPattern: [], silhouette: [] },
    avoid: [],
    reason: ""
  }),

  looks: {
    status: "available" | "insufficient_evidence" | "unavailable",
    source: "derived_from_vision" | null,
    confidence: number | null,
    evidence: string[],
    unavailableReason: string | null,
    core: null,
    alternative: null
  }
};

function createStylingField(value) {
  return {
    status: "available" | "insufficient_evidence" | "unavailable",
    source: "vision" | "derived_from_vision" | null,
    confidence: number | null,
    evidence: string[],
    unavailableReason: string | null,
    value
  };
}
```

위 예시는 문서 설명용이며 실행 가능한 타입 선언이 아니다. `affinity: 75`도 계산 규칙 검증 후에만 생성할 수 있는 예시값이다.

### 12.3 기존 structured 계약과의 전환

| 기존 필드 | 목표 필드 | 전환 원칙 |
| --- | --- | --- |
| `structured.mood` | `archetype` | `mood.primary/animalType`을 그대로 승격하지 않는다. 실제 observations로 새 판정기를 통과한 경우에만 대표 상과 distribution을 생성한다. 기존 mood 설명 일부는 evidence가 검증될 때만 archetype 설명 입력으로 사용할 수 있다. |
| `structured.color` | 확장된 `color` | 기존 palette/directions와 status/evidence를 보존하되, Core·Alternative·avoid·품질 경고 구조로 확장한다. 기본 팔레트는 승격하지 않는다. |
| `structured.style` | `hair`, `makeup`, `faceStyle`, `looks` | 기존 hairDirections는 evidence가 유효할 때 `hair` 입력 후보로만 사용한다. 기존 stylingDirections 한 묶음을 네 영역으로 자동 복제하지 않는다. |
| 기존 launch `paid` | 무료·프리미엄 표시 어댑터 | 새 분석의 원천이 아니라 표시 전용 파생물로 유지한다. |
| 구형 flat payload | legacy read boundary | 런타임 크래시는 방지하되 출처를 증명할 수 없는 값은 새 계약의 `available`로 승격하지 않는다. |

## 13. 생성·판정 책임 분리

| 단계 | 입력 | 출력 | 결정론적 규칙 책임 | LLM 권장 책임 |
| --- | --- | --- | --- | --- |
| A. Vision 관찰 | 사진, locale | quality, observations | 허용 범위·스키마 검증, 값 범위 정규화, 결측·품질 판정 | 보이는 얼굴 특징과 촬영 품질을 제한된 스키마로 추출. 대표 상·최종 스타일 문구·유사도 숫자는 생성하지 않음 |
| B. Archetype 판정 | valid observations | 유형별 원시 점수, distribution, primary | 유형별 지표·가중치·결측 처리·정규화·임계값·근접 판정 전부 | 담당하지 않음 |
| C. 설명 생성 | primary, distribution, evidence | 1~2문장 설명 | 허용 evidence 선택, 금지 표현 검사, 문장 길이 검증 | 선택된 evidence만 사용해 자연어 설명 |
| D. 전략 판정 | archetype, observations | Core·Alternative 전략 | 가능한 전략 후보, 충돌 규칙, 대안 선택 기준 | 선택된 전략의 간결한 이름과 요약 표현 |
| E. 영역별 스타일링 | 전략, observations, color quality | color, hair, makeup, faceStyle | 영역별 규칙, 금지 조합, 결측·품질 처리, available 판정 | 근거가 정해진 추천을 읽기 쉬운 문장으로 표현 |
| F. 룩 조합 | available 영역 결과 | Core Look, Alternative Look | 선·색·질감·대비 충돌 검사, 누락 영역 처리 | 과장되지 않은 룩 이름, 요약, `whyItWorks` 문장 |

LLM은 판정 규칙의 대체재가 아니다. 특히 대표 상, affinity, 임계값 통과 여부는 결정론적 판정 결과를 그대로 사용해야 한다.

## 14. 실패 및 부분 결과 정책

| 상황 | 전체 상태 | 영역 상태 및 처리 |
| --- | --- | --- |
| 얼굴 자체 분석 불가 | `unavailable` | observations와 모든 파생 영역 `unavailable`, 값 `null` |
| 얼굴은 관찰됐지만 대표 상 근거 부족 | `insufficient_evidence` 또는 부분 결과 | archetype `insufficient_evidence`, 임의 대표 상 없음. 대표 상에 의존하지 않는 안전한 영역만 실제 근거가 있을 때 제공 |
| 컬러만 분석 불가 | 전체는 부분 `available` 가능 | color만 `insufficient_evidence` 또는 `unavailable`; archetype, hair 등 가능한 결과 유지 |
| 헤어 가능, 메이크업 일부 근거 부족 | 전체는 부분 `available` 가능 | hair `available`; makeup은 가능한 하위 결과만 제공하거나 영역 status를 낮춤. 기본 메이크업으로 채우지 않음 |
| 일부 스타일링 영역만 가능 | 부분 `available` | 각 영역 status를 독립 유지. 룩은 필요한 구성요소가 충분한 경우에만 생성 |
| 전체 결과 불가 | `unavailable` | 모든 분석값 `null`, failureReason 명시, fallback 결과 없음 |

전체 `status`는 모든 하위 영역이 available이라는 뜻으로 사용하지 않는다. 최소한 하나의 핵심 분석 영역이 실제 근거로 available이고 전체 요청이 유효하게 처리됐음을 뜻한다. 소비자는 반드시 하위 영역 status를 확인한다.

## 15. 금지 사항

- fallback/default 값을 개인 분석 결과로 노출하거나 새 계약의 `available`로 승격
- 대표 상을 무작위로 선택
- Vision 또는 LLM이 근거 없이 유사도 숫자를 직접 생성
- 대표 상 하나에 컬러·헤어·메이크업을 단순 고정 매핑
- 사진 한 장으로 성격, 운세, 건강, 인종, 능력, 생활방식을 단정
- 외모 점수, 외모 등급, 매력도, 우열 비교
- 퍼스널컬러 계절형 확정
- 전신 체형을 모르는 상태에서 전신 코디 단정
- 모든 사용자에게 동일한 Core Look 또는 Alternative Look 출력
- 근거 부족 시 피치·코랄, 윗볼륨, 정돈된 사이드 등 기본 추천 삽입
- 성별 표시나 추정값을 대표 상 점수의 직접 가중치로 사용
- 내부 관찰값을 장황한 사용자 진단 목록으로 노출

## 16. 후속 구현 권장 순서

1. Archetype 분류군과 판별 지표 검수
2. Vision observations 계약 확정
3. Archetype affinity 계산 규칙 구현
4. 대표 상 설명 생성
5. 살리기·변주 전략 엔진
6. 컬러 엔진
7. 헤어 엔진
8. 메이크업 엔진
9. 얼굴 주변 스타일 엔진
10. 완성 룩 조합기
11. Premium 리포트 연결
12. 무료 결과 미리보기 연결
13. 실제 사진 fixture와 평가 세트 검증
14. fallback 및 구형 데이터 회귀 검증

각 단계는 이전 단계의 status/evidence 계약을 보존하고, fixture 검증 없이 다음 표시 단계로 넘기지 않는다.

## 17. 미결정 사항

| 항목 | 필요한 결정·검증 |
| --- | --- |
| v1 대표 상 전체 목록 | 요구된 7개로 충분한지, 여우상·토끼상 등을 추가할지, 겹치는 유형을 통합할지 결정 |
| 각 상의 판별 지표와 가중치 | 관찰 축 정의, 가중치, 음의 지표, 결측 처리, 유형 간 상호 배타 규칙 |
| 유사도 표시 방식 | 5% 숨김과 정수 반올림 권장안을 사용자 이해도 테스트로 확정 |
| 대표 상 최소 확정 기준 | 원시 점수, evidence coverage, quality, confidence 하한의 정확한 수치 |
| 1·2위 근접 처리 | 대표 상 보류를 만드는 최소 점수 격차의 정확한 수치 |
| 성별에 따른 체계 차이 | 기본안은 공통 체계다. 별도 체계가 정말 필요한지와 편향 위험을 검증 |
| 컬러 분석 품질 기준 | 화이트밸런스, 조명 균일성, 필터, 노출, 피부 가림의 허용 하한 |
| 변주 유형 수 | 사용자별 최적 대안 하나만 제공할지, 제한된 후보 중 선택하게 할지 결정 |
| 평가 데이터 | 동의받은 실제 사진, 다양한 성별·연령·피부색·촬영환경, 다수 평가자의 기준 마련 |
| 정답 기준 | 동물상에 객관적 정답이 없으므로 전문가 합의, 사용자 자기 인식, 판정 일관성을 어떻게 조합할지 결정 |
| 문화·성별 편향 검수 | 표시명 수용성, 유형별 성별 분포, 피부색·화장·촬영기기 영향, 모욕 가능성 검수 절차 |
| 부분 결과의 전체 status | 일부 영역 available일 때 전체 status와 무료·프리미엄 표시 정책의 정확한 규칙 |
| 룩 최소 구성요소 | 어떤 영역이 없으면 완성 룩을 만들지 않을지 결정 |

## 18. 현재 계약과 후속 전환 필요 사항

현재 구현에서 확인한 사실과 목표 계약의 차이는 다음과 같다.

| 현재 상태 | 목표와의 차이 | 후속 전환 필요 사항 |
| --- | --- | --- |
| `/api/face-reading`은 `status/source/failureReason/analyzedAt/data` envelope을 반환한다. | 전체 상태 경계는 목표와 호환된다. | envelope을 유지하고 `data` 내부를 새 계약으로 확장한다. |
| `data.structured`는 `mood/color/style`별 상태와 evidence를 보존한다. | 대표 상 분포, observations, 전략, makeup, faceStyle, looks가 없다. | `mood`를 새 archetype 판정의 입력 후보로만 보고 새 구조로 대체·흡수한다. |
| 현재 `animalType`은 evidence 텍스트 단서와 helper를 통해 도출된다. | 전체 분류군 점수, 기여 근거, 최소 점수, 근접 판정이 없다. | 문자열 단서 판정을 대표 상 결과로 사용하지 않고 observations 기반 판정기로 교체한다. |
| 현재 mood/color/style confidence는 제한된 규칙 상수다. | 교정된 신뢰도나 affinity가 아니다. | quality, evidence coverage, 판정 안정성 기반 confidence 정의가 필요하다. |
| 현재 Vision 프롬프트가 인상 문구, 헤어 추천, 컬러 추천까지 직접 요청한다. | 관찰 단계와 설명·스타일링 단계가 섞여 있다. | Vision은 observations 중심으로 제한하고 후속 단계가 판정·설명을 담당하도록 분리한다. |
| 현재 prompt에 `physiognomy`, `real_tendency`, `presentation_hint`가 남아 있다. | 관상·성격 단정 금지 및 성별 비편향 원칙과 긴장 관계가 있다. | 관찰 목적이 아닌 필드를 제거·재정의하고 `presentation_hint`가 점수에 사용되지 않도록 한다. |
| 현재 전체 evidence 성공 기준은 인상·헤어·컬러 근거를 함께 요구한다. | 목표 계약은 컬러 실패 등 부분 결과를 허용한다. | 전체 상태와 하위 영역 상태 판정을 분리한다. |
| 현재 style은 hair와 일반 stylingDirections를 묶는다. | makeup, faceStyle, looks를 표현할 수 없다. | style을 hair/makeup/faceStyle/looks로 분해하고 각각 독립 상태를 둔다. |
| 현재 premium-safe summary는 표시용 `available/unavailable`로 축약된다. | 하위 영역 부분 상태와 전략·룩 깊이를 잃는다. | 동일 분석 객체를 읽는 새 프리미엄 어댑터가 필요하다. 저장 변경은 별도 승인·마이그레이션 검토 대상이다. |
| 현재 무료 preview는 primary와 keywords 중심이다. | 대표 상 distribution과 전략 미리보기 계약이 없다. | 새 분석 객체의 제한된 projection으로 교체한다. |
| 현재 normalize 경로에는 legacy fallback 생성 코드가 존재하지만 structured는 raw parsed evidence에서 먼저 생성된다. | 구형 flat/normalized 값이 다른 경로에서 실제 분석처럼 재해석될 위험은 계속 관리해야 한다. | fallback과 legacy adapter를 명시적 경계에 격리하고 신규 계약으로 승격하지 않는 회귀 검증을 유지한다. |

이 문서는 기존 `docs/architecture/premium-face-lab-contract-v1.md`를 자동 대체하지 않는다. 기존 문서는 현재 premium-safe 표시·저장 경계를 설명하고, 이 문서는 향후 단일 분석 철학과 도메인 구조를 정의한다. 구현 시 두 문서의 충돌 항목을 먼저 전환 계획으로 승인해야 한다.

## 19. 구현 전 승인 체크

다음 조건을 충족하기 전에는 대표 상 affinity와 스타일링 결과를 사용자에게 실제 개인 분석값으로 노출하지 않는다.

- v1 분류군과 표시명의 사용자 수용성 검수
- observations 스키마와 사진 품질 기준 확정
- 유형별 판별 지표와 가중치의 리뷰 가능 문서화
- 최소 점수·근접 격차·결측 처리 임계값 검증
- 다양한 사진 fixture에서 동일인 촬영 조건 변화에 대한 안정성 확인
- 성별·피부색·화장·촬영 환경별 편향 점검
- 대표 상 설명의 evidence 제한 검증
- 영역별 fallback 미삽입 회귀 테스트
- 무료와 프리미엄 projection이 동일 분석 객체를 사용하는지 검증
- 구형 flat payload가 신규 `available` 결과로 승격되지 않는지 검증

