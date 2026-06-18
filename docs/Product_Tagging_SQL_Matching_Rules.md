# Product Tagging & SQL Matching Rules

Reviewed SQL-ready: `products` schema aligned / `concerns = text[] + CHECK constraint` / `exfoliation`, `brightening`, `sebum` supported.

---

## 0. Review / Re-review Operating Rule

이 프로젝트에서 `검토`와 `재검토`는 단순 점검이 아니다.

`검토` 또는 `재검토` 요청을 받으면 아래를 수행한다.

1. 기존 문서, SQL, 태그 결과물을 실제 기준과 대조한다.
2. 잘못된 규칙, 과대 태그, DB 스키마 불일치, SQL 오류 가능성을 찾는다.
3. 문제가 있으면 반드시 수정본을 생성한다.
4. 문제가 없으면 “수정 없음”이라고 명시한다.
5. 사용자가 요청한 산출물 형식을 따른다.

산출물 규칙:

- 사용자가 `md`, `markdown`, `소스에 넣게 텍스트`라고 요청하면 `.md` 파일로 제공한다.
- 사용자가 명시하지 않았는데 프로젝트 소스 문서 용도라면 기본값은 `.md`다.
- `.docx`, `.pdf`는 사용자가 명시적으로 요청할 때만 생성한다.
- SQL 검토 중 태그 기준이 바뀌면 SQL도 다시 생성한다.

---

## 1. Purpose

이 문서는 화장품 원본 데이터, 즉 공식 상세페이지, 판매처 설명, 유저 리뷰, 성분/주의 문구를 기반으로 `products` 테이블의 추천용 컬럼을 채우는 규칙을 정의한다.

목표는 제품 홍보 문구를 그대로 저장하는 것이 아니라, 추천 로직에서 안전하게 사용할 수 있도록 원문 데이터를 역도출하고, 현재 DB 스키마와 허용값에 맞게 매칭하는 것이다.

방지해야 할 오류는 아래와 같다.

- 마케팅 문구만 보고 `sensitive`를 과하게 부여하지 않는다.
- “저자극”, “무자극”, “모든 피부” 문구만 보고 `sensitivity_safe = true`로 처리하지 않는다.
- AHA / BHA / PHA / LHA 계열 각질 성분 제품의 자극 리스크를 과소평가하지 않는다.
- DB에 없는 `texture` / `finish` enum 값을 임의 생성하지 않는다.
- `concerns`와 `skin_types`는 `text[]`지만 CHECK constraint 허용값만 사용한다.
- 직접 근거 없는 concern 태그를 과하게 추가하지 않는다.
- 제품명만 보고 `texture` / `finish`를 추정하지 않는다.

---

## 2. Current DB Schema Snapshot

현재 `products` 테이블 기준 스키마는 아래와 같이 해석한다.
이 문서의 SQL 작성 규칙은 이 구조를 기준으로 한다.

| Column | DB Type | Rule |
|---|---|---|
| `category` | `product_category` enum | 실제 DB enum 값만 사용 |
| `product_form` | `product_form` enum | 실제 DB enum 값만 사용 |
| `skin_types` | `text[]` | CHECK constraint 허용값만 사용 |
| `concerns` | `text[]` | CHECK constraint 허용값만 사용 |
| `texture` | `product_texture` enum | 실제 DB enum 값만 사용 |
| `finish` | `product_finish` enum | 실제 DB enum 값만 사용 |
| `irritation_risk` | `text` | `low` / `medium` / `high`만 사용 |
| `sensitivity_safe` | `boolean` | `true` / `false`만 사용 |
| `review_signals` | `jsonb` | 리뷰/사용감 판단 근거 저장 |
| `market_signals` | `jsonb` | 수집 출처, 랭킹, 가격, 외부 ID 등 시장 신호 저장 |
| `ingredient_signals` | `jsonb` | 산 성분, 장벽/진정/수분 성분, 주의 문구 등 성분 근거 저장 |
| `source_url` / `hwahae_url` | `text` | 확인 가능한 출처 URL 저장 |

중요:

- `concerns`는 enum이 아니다.
- 새 concern 값을 추가할 때 `ALTER TYPE`을 사용하지 않는다.
- `concerns`는 `text[]` 컬럼이며, 허용값 제한은 `products_concerns_allowed_check` 같은 CHECK constraint로 관리한다.
- `category`, `product_form`, `texture`, `finish`는 실제 enum 타입이다.
- 이 네 필드에 새 값을 추가하려면 별도 enum migration이 필요하며, 제품 태깅 작업 중 임의 생성하지 않는다.
- SQL 생성 전 `product_category`, `product_form`, `product_texture`, `product_finish`의 실제 enum 값을 조회한다.

---

## 3. Allowed Values Only

| Field | Allowed values |
|---|---|
| `category` | 실제 `product_category` enum 조회 결과만 사용 |
| `product_form` | 실제 `product_form` enum 조회 결과만 사용 |
| `skin_types` | `dry`, `oily`, `combination`, `sensitive` |
| `concerns` | `barrier`, `dehydration`, `oiliness`, `redness`, `acne`, `pores`, `uneven_tone`, `exfoliation`, `brightening`, `sebum` |
| `texture` | `watery`, `gel`, `lotion`, `cream` |
| `finish` | `fresh`, `natural`, `dewy`, `soft_matte` |
| `irritation_risk` | `low`, `medium`, `high` |
| `sensitivity_safe` | `true`, `false` |

### 3.1 Concern Value Meaning

| Concern | Meaning |
|---|---|
| `barrier` | 장벽, 보호, 세라마이드, 판테놀, 손상 피부 케어 |
| `dehydration` | 속건조, 수분 부족, 당김, 보습 지속 |
| `oiliness` | 사용자 상태로서의 유분/번들거림 고민 |
| `sebum` | 제품 기능으로서의 피지 케어, sebum control, 과잉 피지 조절 |
| `redness` | 붉은기, 진정, 자극받은 피부 완화 |
| `acne` | 여드름성 피부, 트러블, 논코메도제닉, 트러블 포지션 BHA |
| `pores` | 모공, 블랙헤드, 화이트헤드, 모공 케어 직접 문구 |
| `exfoliation` | 각질, 피부결 정돈, 턴오버, AHA/BHA/PHA/LHA, 필링 |
| `brightening` | 브라이트닝, 광채, 맑은 피부, 칙칙함, 피부 밝기 |
| `uneven_tone` | 톤 불균일, 색소/흔적, 얼룩덜룩함, 톤 불균형 |

---

## 4. Forbidden Generated Values

원문에 아래 표현이 있어도 DB 값으로 새로 만들지 않는다.
허용값에 이미 포함된 `exfoliation`, `brightening`, `sebum`은 금지값이 아니다.

```txt
texture_care
glow
anti_aging
all_skin
hypoallergenic
mild
soothing
hydrating
calming
whitening
firming
pore_care
skin_glow
moisture
trouble
blackhead
whitehead
```

| Raw expression | Allowed mapping |
|---|---|
| 각질 케어 / 결 케어 | `exfoliation` |
| 브라이트닝 / 광채 / 칙칙함 / whitening / 미백 | `brightening` |
| 피지 케어 / sebum control | `sebum` |
| 사용자 유분/번들거림 고민 | `oiliness` |
| 수분 케어 / 속건조 | `dehydration` |
| 장벽 케어 | `barrier` |
| 붉은기 진정 | `redness` |
| 모공 케어 / blackhead / whitehead | `pores` |
| 톤 불균일 / 흔적 / 색소 불균형 | `uneven_tone` |

---

## 5. Source Priority

| Priority | Source | Usage |
|---:|---|---|
| 1 | 브랜드 공식몰 / 제조사 공식몰 | 제품명, 용량, 핵심 성분, 사용법, 주의 문구, 공식 포지션 |
| 2 | 올리브영 / 화해 / 글로우픽 / 다이소몰 등 대형 판매처 | 제형, 리뷰 키워드, 피부타입 신호 |
| 3 | 전성분 / 성분 분석 페이지 | 산 성분, 진정 성분, 장벽 성분, 자극 가능성 |
| 4 | 일반 블로그 / 인스타 / 랜덤 쇼핑몰 | 보조 참고만. 태그 결정 근거로는 약하게 사용 |

공식몰과 리뷰가 충돌하면 다음 순서로 판단한다.

```txt
성분/사용법/주의문구 > 반복 리뷰 신호 > 공식 마케팅 문구
```

---

## 6. Marketing Claim Filter

아래 문구는 단독으로 태그 확정 근거로 사용하지 않는다.

```txt
모든 피부 사용 가능
저자극
무자극
순한
순둥한
민감 피부 가능
피부 자극 테스트 완료
하이포알러제닉
더마
클린뷰티
비건
착한 성분
```

금지 처리:

```txt
“모든 피부 사용 가능” -> dry, oily, combination, sensitive 전부 부여 금지
“저자극 테스트 완료” -> irritation_risk = low 단정 금지
“민감 피부 가능” -> sensitivity_safe = true 단정 금지
“무자극” -> sensitive 자동 부여 금지
```

---

## 7. Acid / Exfoliating Product Rule

AHA / BHA / PHA / LHA / mandelic acid / glycolic acid / lactic acid / salicylic acid 계열 제품은 기본적으로 자극 리스크를 보수적으로 판단한다.

기본값:

```txt
irritation_risk = 'medium'
sensitivity_safe = false
```

`concerns`에는 근거가 있으면 `exfoliation`을 우선 부여한다.

### 7.1 `irritation_risk = low` 가능 조건

아래 조건이 복수로 충족될 때만 `low`를 고려한다.

- PHA 중심 또는 매우 순한 산 성분
- 필링/박피/강한 각질 제거 포지션이 아님
- 사용 빈도 제한이 강하지 않음
- 민감성/장벽 피부 타깃이 명확함
- 자극 후기보다 순하다는 후기가 압도적
- 주의 문구가 강하지 않음

### 7.2 `irritation_risk = medium` 유지 조건

아래 중 하나라도 해당하면 기본적으로 `medium`을 유지한다.

- AHA / BHA / PHA / LHA가 핵심 성분
- 각질 / 피부결 / 톤 정돈 제품
- 저자극 테스트는 있으나 산 성분 제품
- 사용 빈도 조절 안내 있음
- 민감 피부 패치 테스트 또는 주의 문구 있음

### 7.3 `irritation_risk = high` 조건

아래 신호가 반복되면 `high`를 고려한다.

- 고함량 필링 솔루션
- 따가움 / 화끈거림 / 건조 / 벗겨짐 리뷰가 반복됨
- 민감 피부 사용 금지 또는 손상 피부 사용 금지
- 강한 박피 / 필링 포지션
- 레티놀 / 고함량 비타민C / 강산 조합

---

## 8. `sensitivity_safe` Rule

`sensitivity_safe`는 “민감 피부도 쓸 수 있다는 마케팅 문구”가 아니라, 추천 로직에서 민감성 사용자에게 기본 후보로 올려도 되는지를 뜻한다.

산 성분 제품 기본값:

```txt
sensitivity_safe = false
```

### 8.1 `sensitivity_safe = true` 가능 조건

아래 조건이 복수로 충족될 때만 `true`를 허용한다.

- 민감성 피부용 제품이라는 포지션이 명확함
- 장벽 / 진정 / 붉은기 완화가 제품 핵심임
- 자극 가능 성분군이 강하지 않음
- 산 성분 제품이라도 강한 필링 포지션이 아님
- 사용 빈도 제한이 강하지 않음
- 리뷰에서 따가움 / 화끈거림 / 뒤집어짐 신호가 약함
- 공식 문구가 단순 저자극 테스트 수준을 넘음

### 8.2 `sensitivity_safe = false` 유지 조건

아래 중 하나라도 강하면 `false`로 둔다.

- AHA / BHA / LHA / mandelic / glycolic / lactic acid가 핵심
- 필링 / 각질 제거 / 피부결 리뉴얼 포지션
- 사용 빈도 제한 있음
- 민감 / 손상 피부 주의 문구 있음
- 자극 리뷰가 반복됨

---

## 9. `skin_types` Matching Rule

| skin_type | Signals |
|---|---|
| `dry` | 속건조, 당김 완화, 수분 부족, 보습 지속, 건조 피부 추천, 히알루론산/판테놀/보습 성분 중심 |
| `oily` | 유분, 번들거림, 지성 피부 추천. 단, 제품 기능의 피지 케어는 `concerns.sebum`으로 분리 |
| `combination` | 특정 피부타입 타깃이 강하지 않거나 일반적인 피부결/각질/톤 정돈 중심 |
| `sensitive` | 민감성 타깃이 명확하고 자극 리스크가 낮게 관리되며 리뷰 자극 신호가 약할 때만 부여 |

주의:

- “모든 피부 사용 가능”이라고 해서 `skin_types` 전체를 넣지 않는다.
- “저자극 테스트 완료”만으로 `sensitive`를 넣지 않는다.
- 피지 케어 제품이라고 `oily`를 자동 부여하지 않는다.
- `oily`는 피부타입 신호, `sebum`은 제품 기능 신호다.
- “여드름성 피부 사용 적합”은 기본적으로 `acne` concern 신호이며, 지성/유분 신호가 별도로 있을 때만 `oily` 후보로 본다.

---

## 9.1 `product_form` Matching Rule

`product_form`은 제품명보다 원본 데이터의 제품 형태와 상세페이지 포지션을 우선한다. 실제 값은 `product_form` enum 조회 결과 안에서만 사용한다.

| product_form signal | Mapping rule |
|---|---|
| 에센스 / essence | 실제 enum에 `essence`가 있을 때만 `essence` |
| 앰플 / ampoule | 실제 enum에 `ampoule`이 있을 때만 `ampoule` |
| 세럼 / serum | 실제 enum에 `serum`이 있을 때만 `serum` |
| 필링 솔루션 / peeling solution | 실제 enum에 `peeling_solution`이 있을 때만 `peeling_solution` |

주의:

- 제품명에 앰플/세럼이 섞여 있으면 공식 상세페이지의 제품군 표기와 원본 수집값을 우선한다.
- 실제 enum에 없는 `product_form` 값은 새로 만들지 않는다.
- `product_form` 판단이 불확실하면 SQL 생성 전에 enum 조회 결과와 제품 상세페이지를 다시 대조한다.

---

## 10. `concerns` Matching Rule

| Concern | Positive signals | Do not infer from |
|---|---|---|
| `barrier` | 피부 장벽, 장벽 강화/회복, 세라마이드, 판테놀, 마데카소사이드, 손상 피부 케어 | 단순 보습, 순함 |
| `dehydration` | 속건조, 수분, 당김 완화, 보습 지속, 히알루론산, 촉촉함 | 광채, 장벽 문구 없는 보습감 |
| `oiliness` | 사용자 상태로서 유분/번들거림 고민 | 피지 케어 기능만 있는 제품 설명 |
| `sebum` | 피지, sebum, 과잉 피지, 유분 조절, 피지 케어 | 산뜻하다, 가볍다 |
| `redness` | 붉은기, 진정, 아줄렌, 시카, 마데카소사이드, 카모마일 | 순하다, 저자극 |
| `acne` | 여드름성 피부 사용 적합, 트러블, 논코메도제닉, 트러블 포지션 BHA | 피지 케어만 있음 |
| `pores` | 모공, 블랙헤드, 화이트헤드, 모공 케어 직접 문구 | 각질 케어, 피지 케어만 있음 |
| `exfoliation` | 각질, 피부결 정돈, 결 케어, 턴오버, AHA/BHA/PHA/LHA, peeling, exfoliating | 광채, 산뜻함 |
| `brightening` | 브라이트닝, 광채, 맑은 피부, 칙칙함, 피부 밝기 | 메이크업 톤업, 단순 윤기, 성분명 단독 |
| `uneven_tone` | 톤 불균일, 흔적, 색소 불균형, 얼룩덜룩함, 톤 불균형 | 브라이트닝 마케팅 문구만 있음 |

추가 원칙:

- 성분명만으로 concern을 확정하지 않는다.
- 성분 + 제품 포지션 + 리뷰/상세페이지 신호가 같이 있을 때 부여한다.
- 갈락토미세스 / 나이아신아마이드 / 비타민C는 `brightening` 후보 성분이지만, 공식 포지션이나 리뷰 신호가 없으면 `brightening`을 자동 부여하지 않는다.

---

## 11. `texture` Matching Rule

`texture`는 제품명보다 상세페이지의 제형 설명과 리뷰를 우선한다.

| texture | Signals |
|---|---|
| `watery` | 물처럼 흐름, 묽음, 가벼운 앰플, 빠르게 흡수, 워터리, 산뜻한 수분감 |
| `gel` | 쫀쫀함, 점성, 탱글함, 젤리, 농축 세럼, 앰플감, 묽지 않은 세럼 |
| `lotion` | 유액, 밀키함, 로션감, 부드럽게 밀림, 에멀전 타입 |
| `cream` | 크림처럼 리치함, 꾸덕함, 밤 타입, 무거운 보습감 |

주의:

- 제품명이 세럼/앰플이라고 무조건 `gel`로 하지 않는다.
- 제형 근거가 약하면 상세페이지 표현 또는 리뷰 반복 신호를 우선한다.
- `texture`는 `product_texture` enum이므로 위 4개 외 값을 쓰지 않는다.

---

## 12. `finish` Matching Rule

`finish`는 실제 사용 후 마무리감을 기준으로 한다.

| finish | Signals |
|---|---|
| `fresh` | 산뜻함, 끈적임 없음, 빠르게 흡수, 가벼움, 번들거림 적음 |
| `natural` | 무난함, 과하게 광나지 않음, 과하게 보송하지 않음, 일반적인 세럼 마무리 |
| `dewy` | 광이 남, 윤기, 촉촉광, 물광, 피부가 빛남, 쫀쫀하게 광남 |
| `soft_matte` | 보송함, 유분 잡힘, 매트하게 마무리, 번들거림 감소 |

주의:

- 상세페이지의 “광채” 마케팅 문구만으로 `dewy`를 넣지 않는다.
- 리뷰에서 실제 사용감으로 광 / 윤기 / 촉촉광이 반복될 때 `dewy`를 넣는다.
- `finish`는 `product_finish` enum이므로 위 4개 외 값을 쓰지 않는다.

---

## 13. Review Signal Interpretation

| Review signal | Mapping |
|---|---|
| 속건조가 잡힌다 | `concerns`에 `dehydration` 추가. `barrier`는 자동 추가하지 않음 |
| 바르고 나면 피부가 쫀쫀하게 광이 난다 | `texture = gel`, `finish = dewy` 후보 |
| 따갑다 / 화끈거린다 / 뒤집어졌다 | `irritation_risk` 상승 검토, `sensitivity_safe = false` 유지 |
| 순하다 / 자극 없다 | 단독으로 `sensitivity_safe = true` 처리 금지. 산 성분/사용 빈도/주의 문구와 함께 판단 |
| 피지가 덜 올라온다 / 번들거림이 줄었다 | 제품 기능이면 `sebum`, 사용자 고민 매칭이면 `oiliness` |
| 피부가 맑아 보인다 / 칙칙함이 줄었다 | `brightening` 후보. 색소/흔적/톤 불균일이면 `uneven_tone` 후보 |
| 블랙헤드/화이트헤드가 줄었다 | `pores` 후보. 단, 단순 피지 케어 리뷰만으로 `pores` 자동 부여 금지 |

---

## 14. Example: AHA/PHA Exfoliating Serum

상세페이지에 다음 문구가 있는 제품을 가정한다.

```txt
모든 피부 사용 가능
무자극 케어
AHA/PHA 각질 세럼
피부결 정돈
매끈한 광채
```

잘못된 매칭:

```sql
skin_types = ARRAY['dry','oily','combination','sensitive']::text[]
concerns = ARRAY['pores','uneven_tone','oiliness']::text[]
irritation_risk = 'low'
sensitivity_safe = true
```

올바른 기본 매칭:

```sql
skin_types = ARRAY['combination']::text[]
concerns = ARRAY['exfoliation']::text[]
irritation_risk = 'medium'
sensitivity_safe = false
```

추가 근거가 있을 때만 확장한다.

```txt
속건조 리뷰 반복 -> dehydration 추가 가능
피지 케어 직접 문구 반복 -> sebum 추가 가능
브라이트닝/칙칙함 개선 직접 문구 반복 -> brightening 추가 가능
색소/흔적/톤 불균일 직접 문구 -> uneven_tone 추가 가능
민감성 타깃 + 자극 후기 약함 + 약한 산 성분 -> sensitive / sensitivity_safe 재검토 가능
```

---

## 15. SQL Generation Rule

- `id = DEFAULT`
- `created_at = NOW()`
- `updated_at = NOW()`
- `buy_link` / `image_url` 없으면 `NULL`
- `category` / `product_form` / `texture` / `finish`는 실제 enum 값만 사용
- `skin_types` / `concerns`는 `text[]`이지만 CHECK constraint 허용값만 사용
- `irritation_risk`는 `low` / `medium` / `high`만 사용
- `sensitivity_safe`는 boolean `true` / `false`만 사용
- 중복 가능성이 있으면 UPSERT 사용
- 중복 기준은 `normalized_brand + normalized_name`

### 15.1 Enum Verification Query

제품 SQL 생성 전 `category`, `product_form`, `texture`, `finish` enum 값을 먼저 확인한다.

```sql
SELECT
  t.typname AS enum_type,
  e.enumlabel AS enum_value
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
WHERE t.typname IN (
  'product_category',
  'product_form',
  'product_texture',
  'product_finish'
)
ORDER BY t.typname, e.enumsortorder;
```

### 15.2 Constraint Verification Query

제품 태그 작업 전 CHECK constraint 상태가 의심되면 아래 쿼리로 먼저 확인한다.

```sql
SELECT
  conname,
  pg_get_constraintdef(c.oid) AS definition
FROM pg_constraint c
JOIN pg_class t ON c.conrelid = t.oid
WHERE t.relname = 'products'
  AND (
    pg_get_constraintdef(c.oid) ILIKE '%concerns%'
    OR pg_get_constraintdef(c.oid) ILIKE '%skin_types%'
  );
```

### 15.3 Current Data Invalid Value Preflight

CHECK constraint를 새로 걸기 전에 기존 데이터에 허용값 밖 값이 있으면 `ADD CONSTRAINT`가 실패한다. 먼저 아래 쿼리로 확인한다.

```sql
SELECT id, brand, name, concerns
FROM products
WHERE NOT (
  concerns <@ ARRAY[
    'oiliness',
    'dehydration',
    'acne',
    'uneven_tone',
    'pores',
    'redness',
    'barrier',
    'exfoliation',
    'brightening',
    'sebum'
  ]::text[]
);

SELECT id, brand, name, skin_types
FROM products
WHERE NOT (
  skin_types <@ ARRAY[
    'dry',
    'oily',
    'combination',
    'sensitive'
  ]::text[]
);
```

### 15.4 Concern CHECK Constraint Update Rule

`concerns`는 enum이 아니므로 새 concern 추가 시 `ALTER TYPE`을 쓰지 않는다.
CHECK constraint를 수정한다.
현재 `exfoliation` / `brightening` / `sebum`은 이미 허용값에 포함된 상태로 본다.
이 SQL은 새 concern 허용값을 바꿀 때만 실행한다.

```sql
ALTER TABLE products
DROP CONSTRAINT IF EXISTS products_concerns_allowed_check;

ALTER TABLE products
ADD CONSTRAINT products_concerns_allowed_check
CHECK (
  concerns <@ ARRAY[
    'oiliness',
    'dehydration',
    'acne',
    'uneven_tone',
    'pores',
    'redness',
    'barrier',
    'exfoliation',
    'brightening',
    'sebum'
  ]::text[]
);
```

### 15.5 UPSERT Conflict Target Verification

`ON CONFLICT (normalized_brand, normalized_name)`를 쓰려면 해당 조합에 unique index 또는 unique constraint가 있어야 한다. 없으면 UPSERT가 실패한다.

```sql
SELECT
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'products'
  AND indexdef ILIKE '%normalized_brand%'
  AND indexdef ILIKE '%normalized_name%';
```

없을 때만 아래를 별도로 실행한다.

```sql
CREATE UNIQUE INDEX IF NOT EXISTS products_normalized_brand_name_unique
ON products (normalized_brand, normalized_name);
```

### 15.6 INSERT / UPSERT Pattern

제품 SQL은 현재 `products` 스키마 기준으로 아래 패턴을 기본으로 한다. 카테고리별로 불필요한 전용 컬럼은 `NULL`로 둔다.

```sql
INSERT INTO products (
  id,
  name,
  brand,
  category,
  product_form,
  price_min,
  price_max,
  buy_link,
  image_url,
  created_at,
  skin_types,
  concerns,
  texture,
  finish,
  irritation_risk,
  sensitivity_safe,
  normalized_name,
  normalized_brand,
  updated_at,
  is_mens,
  recommendation_tier,
  size_ml,
  unit_price_per_10ml,
  cleansing_profile,
  uv_filter_type,
  spf_value,
  uva_label,
  water_resistant_minutes,
  white_cast,
  eye_sting,
  pilling_risk,
  tone_up,
  review_signals,
  hwahae_url,
  market_signals,
  ingredient_signals,
  external_source,
  external_type,
  external_id,
  source_url,
  balm_functional_tags,
  balm_usage_scope,
  balm_type,
  is_primary_moisturizer,
  balm_caution_tags,
  balm_research_confidence
) VALUES (
  DEFAULT,
  ...,
  ...,
  'treatment'::product_category,
  'serum'::product_form,
  ...,
  ...,
  ...,
  ...,
  NOW(),
  ARRAY[...]::text[],
  ARRAY[...]::text[],
  'watery'::product_texture,
  'natural'::product_finish,
  'medium',
  false,
  ...,
  ...,
  NOW(),
  false,
  ...,
  ...,
  ...,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  '{...}'::jsonb,
  ...,
  '{...}'::jsonb,
  '{...}'::jsonb,
  ...,
  ...,
  ...,
  ...,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL
)
ON CONFLICT (normalized_brand, normalized_name)
DO UPDATE SET
  name = EXCLUDED.name,
  brand = EXCLUDED.brand,
  category = EXCLUDED.category,
  product_form = EXCLUDED.product_form,
  price_min = EXCLUDED.price_min,
  price_max = EXCLUDED.price_max,
  buy_link = EXCLUDED.buy_link,
  image_url = EXCLUDED.image_url,
  skin_types = EXCLUDED.skin_types,
  concerns = EXCLUDED.concerns,
  texture = EXCLUDED.texture,
  finish = EXCLUDED.finish,
  irritation_risk = EXCLUDED.irritation_risk,
  sensitivity_safe = EXCLUDED.sensitivity_safe,
  is_mens = EXCLUDED.is_mens,
  recommendation_tier = EXCLUDED.recommendation_tier,
  size_ml = EXCLUDED.size_ml,
  unit_price_per_10ml = EXCLUDED.unit_price_per_10ml,
  cleansing_profile = EXCLUDED.cleansing_profile,
  uv_filter_type = EXCLUDED.uv_filter_type,
  spf_value = EXCLUDED.spf_value,
  uva_label = EXCLUDED.uva_label,
  water_resistant_minutes = EXCLUDED.water_resistant_minutes,
  white_cast = EXCLUDED.white_cast,
  eye_sting = EXCLUDED.eye_sting,
  pilling_risk = EXCLUDED.pilling_risk,
  tone_up = EXCLUDED.tone_up,
  review_signals = EXCLUDED.review_signals,
  hwahae_url = EXCLUDED.hwahae_url,
  market_signals = EXCLUDED.market_signals,
  ingredient_signals = EXCLUDED.ingredient_signals,
  external_source = EXCLUDED.external_source,
  external_type = EXCLUDED.external_type,
  external_id = EXCLUDED.external_id,
  source_url = EXCLUDED.source_url,
  balm_functional_tags = EXCLUDED.balm_functional_tags,
  balm_usage_scope = EXCLUDED.balm_usage_scope,
  balm_type = EXCLUDED.balm_type,
  is_primary_moisturizer = EXCLUDED.is_primary_moisturizer,
  balm_caution_tags = EXCLUDED.balm_caution_tags,
  balm_research_confidence = EXCLUDED.balm_research_confidence,
  updated_at = NOW();
```

주의:

- `category`, `product_form`, `texture`, `finish`는 실제 enum 값으로 cast한다.
- `review_signals`, `market_signals`, `ingredient_signals`에는 웹 근거와 판단 사유를 남긴다.
- 태그 규칙이 바뀌어 SQL을 다시 만들 때는 JSONB 근거도 함께 갱신한다.
- `created_at`은 최초 생성값이므로 `DO UPDATE SET`에서 덮어쓰지 않는다.
- `normalized_brand`, `normalized_name`은 conflict key이므로 일반적으로 업데이트하지 않는다.

---

## 16. Final Checklist Before SQL Output

1. `category` / `product_form` / `texture` / `finish`에 enum에 없는 값이 있는가? 있으면 제거 또는 실제 enum 값으로 치환한다.
2. `concerns` / `skin_types`에 CHECK constraint 허용값이 아닌 문자열이 있는가? 있으면 제거한다.
3. “저자극 / 무자극 / 모든 피부”만 보고 `sensitive`를 줬는가? 줬으면 제거한다.
4. “저자극 / 무자극 / 모든 피부”만 보고 `sensitivity_safe = true`를 줬는가? 줬으면 `false`로 되돌린다.
5. 산 성분 제품인데 `irritation_risk = low`인가? 강한 근거 없으면 `medium`으로 변경한다.
6. 산 성분 제품인데 `sensitivity_safe = true`인가? 민감성 타깃 + 낮은 자극 근거 + 리뷰 안정성 없으면 `false`로 되돌린다.
7. 각질 케어 제품인데 `exfoliation` 대신 `pores` / `uneven_tone` / `oiliness`로 우겨 넣었는가? `exfoliation`으로 수정한다.
8. 브라이트닝 제품인데 `uneven_tone`과 혼동했는가? 광채/칙칙함은 `brightening`, 색소/흔적/톤 불균일은 `uneven_tone`으로 분리한다.
9. 피지 케어 제품인데 `oiliness`와 혼동했는가? 제품 기능은 `sebum`, 사용자 상태는 `oiliness`로 분리한다.
10. 여드름성 피부 사용 적합만 보고 `oily`를 넣었는가? 별도 유분/지성 신호가 없으면 `oily`를 넣지 않는다.
11. `texture` / `finish`가 제품명 추정만으로 들어갔는가? 상세페이지/리뷰 근거를 확인한다.
12. `normalized_name`에 용량, 기획, 세트 문구가 남았는가? 제거한다.
13. 동일 제품인데 INSERT만 하고 있는가? UPSERT를 사용한다.
14. `ON CONFLICT (normalized_brand, normalized_name)`에 필요한 unique index/constraint가 있는가? 없으면 먼저 생성한다.
15. SQL row별 값 개수가 컬럼 개수와 일치하는가? 실행 전 확인한다.
16. `review_signals` / `market_signals` / `ingredient_signals`의 JSONB가 실제 태그 판단과 일치하는가? 불일치하면 함께 수정한다.

---

## 17. Required Review Order

사용자가 “검토” 또는 “재검토”라고 요청하면 반드시 아래 순서로 검토한다.
SQL 문법 검사는 마지막이다.
문제가 발견되면 보고에서 끝내지 않고 수정본을 생성한다.

1. 웹 근거와 태그 대조
2. 마케팅 문구 필터링
3. `concerns` / `skin_types` CHECK constraint 허용값 검사
4. `category` / `product_form` / `texture` / `finish` enum 위반 검사
5. 산 성분 자극 리스크 검사
6. `sensitivity_safe` 과대 부여 검사
7. `concerns` 과대 부여 검사
8. `exfoliation` / `brightening` / `sebum` 분리 여부 검사
9. `skin_types` 중 `oily` / `sensitive` 과대 부여 검사
10. `texture` / `finish` 근거 검사
11. SQL 문법 / 컬럼 수 / UPSERT unique index 검사
12. JSONB 근거 필드와 태그 결과 일치 여부 검사
13. 요청 산출물 형식 검사 (`md` 요청이면 `.md`만 생성)

---

## 18. Core Principle

상세페이지는 주장이고, 리뷰는 사용감이며, 성분/사용법/주의문구가 리스크 판정의 핵심이다.

SQL에는 “좋아 보이는 문구”가 아니라, 추천 로직에 안전하게 쓸 수 있는 현재 DB 허용값만 넣는다.

각질은 `exfoliation`, 브라이트닝은 `brightening`, 제품 기능으로서의 피지는 `sebum`, 사용자 상태로서의 유분 고민은 `oiliness`로 분리한다.

`sensitive`와 `sensitivity_safe`는 홍보 문구가 아니라 추천 후보 안전성 판단이다.
