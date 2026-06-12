# Balm Recommendation Rules — Bridge Mode v1.2

> 목적: Balm/밤/멀티밤/시카밤/장벽밤 계열을 현재 `products` 추천 체계에 임시 연결하되, 향후 Balm 기능을 축소하거나 별도 카테고리로 분리해도 전체 추천식을 갈아엎지 않도록 설계한다.

---

## 0. 자체 검토 결과

이 문서는 이전 초안의 오류를 바로잡은 수정본이다.

### 0.1 이전 초안의 문제

1. DB enum 확인 없이 `category === 'balm'`을 코드 예시에 사용했다.
2. JS/TS 배열 포함 여부 판정에 `user.skinType in product.skin_types`를 사용했다.
3. Balm 전용값이 없을 때 계산식이 깨질 수 있었다.
4. `night_repair`, `회복` 같은 치료/개선 단정 뉘앙스가 강한 표현을 사용했다.
5. `comedogenic_risk`를 지나치게 확정적인 값처럼 다뤘다.
6. Balm이 나중에 빠질 수 있다는 전제를 반영했지만, 제거 단위가 충분히 분리되어 있지 않았다.

### 0.2 수정 원칙

- DB category에 새 enum을 임의로 넣지 않는다.
- Balm 여부는 Bridge 모드에서 DB category가 아니라 별도 매핑/profile로 식별한다.
- Balm 전용 변수는 전부 optional로 둔다.
- 알 수 없는 값은 `unknown`으로 처리한다.
- `unknown`은 즉시 탈락시키지 않고, 리스크가 큰 조건에서만 약하게 감점한다.
- 추천 문구는 치료/회복/개선 보장 표현을 피하고, 사용감·리스크·사용 방식 중심으로 쓴다.

---

## 1. 전제

Balm은 단순 보습제가 아니라 아래 기능이 섞인 제품군이다.

- 보습 마무리
- 장벽 보호막 형성
- 국소 진정
- 건조 부위 덧바름
- 야간 집중 보습
- 마찰 자극 부위 보호
- 민감/붉은기 피부의 완충
- 메이크업 전 사용 가능/불가능
- 유분감·답답함·좁쌀 리스크

따라서 Balm 추천은 `좋은 제품 1개`를 고르는 방식이 아니라, **사용 상황과 피부 리스크에 맞지 않는 제품을 먼저 제외한 뒤 점수화**한다.

---

## 2. Bridge Mode 설계 원칙

### 2.1 현재 DB 기본 태그만 우선 사용

현재 추천 로직과 직접 연결 가능한 기본값은 아래 범위로 제한한다.

```txt
skin_types: dry | oily | combination | sensitive
concerns: barrier | dehydration | oiliness | redness | acne | pores | uneven_tone
texture: watery | gel | lotion | cream
finish: fresh | natural | dewy | soft_matte
irritation_risk: low | medium | high
sensitivity_safe: boolean
```

### 2.2 category 운영 원칙

Bridge 모드에서는 Balm을 별도 category로 박지 않는다.

```ts
// 권장: DB category는 기존 허용값만 사용한다.
// Balm 여부는 별도 매핑 또는 metadata/profile에서 판정한다.
const isBalmProduct = getBalmProfile(product) !== null

// 금지: DB enum 추가 전에는 사용하지 않는다.
product.category === 'balm'
```

현재 DB에 `moisturizer` category가 이미 있으면 Balm 후보를 `category === 'moisturizer'` 안에서만 찾는다. 만약 현 DB category가 `cream`, `lotion`, `moisturizer` 등으로 갈려 있다면, 실제 허용 enum 확인 후 아래처럼 별도 상수로 관리한다.

```ts
const MOISTURIZER_CATEGORIES = ['moisturizer'] as const

function isMoisturizerCategory(category) {
  return MOISTURIZER_CATEGORIES.includes(category)
}
```

`MOISTURIZER_CATEGORIES`에는 DB에 실제 존재하는 category 값만 넣는다.

### 2.3 Balm 식별은 코드 매핑으로 시작한다

처음부터 DB 컬럼을 늘리지 않고, 제품 고유키 기준으로 내부 매핑을 둔다.

```ts
type ProductKey = `${string}::${string}`

type BalmProfile =
  | 'light_moisture'
  | 'barrier_seal'
  | 'spot_soothing'
  | 'night_moisture'
  | 'rescue_balm'

type BalmExtra = {
  balm_profile: BalmProfile
  occlusiveness?: 'low' | 'medium' | 'high' | 'unknown'
  comedogenic_risk?: 'low' | 'medium' | 'high' | 'unknown'
  makeup_compatibility?: 'good' | 'neutral' | 'poor' | 'unknown'
  season_fit?: 'summer' | 'all_season' | 'winter' | 'unknown'
  use_zone?: 'full_face' | 'dry_patch' | 'spot' | 'night_only' | 'unknown'
}

const BALM_PRODUCT_PROFILES: Record<ProductKey, BalmExtra> = {
  // 'normalized_brand::normalized_name': { balm_profile: 'barrier_seal', ... }
}

function getProductKey(product) {
  return `${product.normalized_brand}::${product.normalized_name}`
}

function getBalmExtra(product): BalmExtra | null {
  return BALM_PRODUCT_PROFILES[getProductKey(product)] ?? null
}
```

이 구조를 쓰면 Balm 기능을 나중에 빼도 DB 스키마를 건드리지 않고 `BALM_PRODUCT_PROFILES`와 관련 계산식만 제거하면 된다.

---

## 3. Balm 역할 분리

Balm은 최소 5개 역할로 나눈다.

| balm_profile | 역할 | 추천되는 상황 | 주의할 상황 |
|---|---|---|---|
| `light_moisture` | 가벼운 보습 마무리 | 복합성, 가벼운 보습, 아침 사용 | 극건성, 장벽 건조감 심함 |
| `barrier_seal` | 장벽 보호막 | 건성, 속건조, 세안 후 당김 | 지성, 여드름, 답답함 싫음 |
| `spot_soothing` | 국소 진정 | 붉은기, 민감 부위, 트러블 주변 | 전체 얼굴 두껍게 사용 |
| `night_moisture` | 야간 집중 보습 | 밤 루틴, 건조/장벽 보습 | 아침 메이크업 전 |
| `rescue_balm` | 응급 보호막 | 각질 들뜸, 마찰 자극, 극건조 | 지성/모공/여드름 피부 전체 사용 |

`night_repair`, `recovery`, `healing` 같은 표현은 사용하지 않는다. 기능성 화장품처럼 보이거나 치료 뉘앙스가 강해질 수 있다.

---

## 4. 기본값 처리

Balm 전용값이 없는 제품도 추천 계산에서 터지면 안 된다.

```ts
function withBalmDefaults(product) {
  const extra = getBalmExtra(product)

  if (!extra) return null

  return {
    ...product,
    balm_profile: extra.balm_profile,
    occlusiveness: extra.occlusiveness ?? 'unknown',
    comedogenic_risk: extra.comedogenic_risk ?? 'unknown',
    makeup_compatibility: extra.makeup_compatibility ?? 'unknown',
    season_fit: extra.season_fit ?? 'unknown',
    use_zone: extra.use_zone ?? 'unknown',
  }
}
```

운영 원칙:

- `unknown`은 즉시 탈락시키지 않는다.
- 여드름/모공/민감성처럼 리스크가 큰 사용자에게는 `unknown`을 소폭 감점한다.
- 제품 설명이나 리뷰 근거가 약하면 `low`/`high`로 단정하지 않는다.
- `comedogenic_risk`는 성분/후기/제형 근거가 명확할 때만 `high`로 둔다.

---

## 5. 하드 필터

Balm은 점수보다 탈락 조건이 먼저다.

```ts
function getBalmCandidates(products, user) {
  return products
    .filter(p => isMoisturizerCategory(p.category))
    .map(withBalmDefaults)
    .filter(Boolean)
    .filter(p => !(user.isSensitive && p.irritation_risk === 'high'))
    .filter(p => !(user.skinType === 'oily' && p.occlusiveness === 'high' && user.primaryConcern !== 'barrier'))
    .filter(p => !(user.primaryConcern === 'acne' && p.comedogenic_risk === 'high'))
    .filter(p => !(user.primaryConcern === 'pores' && p.occlusiveness === 'high' && p.use_zone === 'full_face'))
    .filter(p => !(user.makeupUse && p.makeup_compatibility === 'poor'))
    .filter(p => !(user.prefersFresh && p.finish === 'dewy' && p.occlusiveness === 'high'))
}
```

### 하드 필터 해석

- 민감성 사용자는 `irritation_risk = high` 제외
- 지성/모공 사용자는 고밀폐 Balm을 전체 얼굴 추천에서 제외
- 여드름 주고민 사용자는 `comedogenic_risk = high`가 명확한 제품 제외
- 메이크업 사용자는 밀림 위험 높은 Balm 제외
- 산뜻함 선호 사용자는 `dewy + high occlusiveness` 조합을 제외 후보로 둔다

---

## 6. 점수식

하드 필터 통과 제품만 점수화한다.

```ts
score =
  skinTypeScore +
  concernScore +
  barrierScore +
  hydrationScore +
  sensitivityScore +
  occlusiveFitScore +
  acnePoreRiskScore +
  finishScore +
  timeUseScore +
  makeupScore +
  seasonScore +
  priceScore
```

---

## 7. 권장 가중치

### 7.1 피부타입 적합도

```ts
skinTypeScore = product.skin_types?.includes(user.skinType) ? 20 : 0
```

### 7.2 고민 적합도

```ts
concernScore =
  (product.concerns?.includes(user.primaryConcern) ? 22 : 0) +
  (product.concerns?.includes(user.secondaryConcern) ? 10 : 0)
```

### 7.3 장벽 점수

```ts
barrierScore =
  user.primaryConcern === 'barrier' && product.concerns?.includes('barrier') ? 18 :
  user.secondaryConcern === 'barrier' && product.concerns?.includes('barrier') ? 10 :
  0
```

### 7.4 속건조/보습 점수

```ts
hydrationScore =
  user.primaryConcern === 'dehydration' && product.concerns?.includes('dehydration') ? 16 :
  user.skinType === 'dry' && product.finish === 'dewy' ? 8 :
  user.skinType === 'oily' && product.finish === 'dewy' ? -6 :
  0
```

### 7.5 민감성 안전 점수

```ts
sensitivityScore =
  user.isSensitive && product.sensitivity_safe ? 16 :
  user.isSensitive && !product.sensitivity_safe ? -16 :
  0
```

### 7.6 밀폐감 적합도

```ts
occlusiveFitScore =
  user.skinType === 'dry' && product.occlusiveness === 'high' ? 12 :
  user.primaryConcern === 'barrier' && product.occlusiveness === 'medium' ? 10 :
  user.primaryConcern === 'barrier' && product.occlusiveness === 'high' ? 8 :
  user.skinType === 'oily' && product.occlusiveness === 'high' ? -18 :
  user.prefersFresh && product.occlusiveness === 'high' ? -14 :
  user.primaryConcern === 'acne' && product.occlusiveness === 'unknown' ? -4 :
  0
```

장벽 고민이어도 `high` 밀폐감을 무조건 최고점으로 주지 않는다. 답답함/좁쌀 리스크가 있기 때문에 `medium`을 가장 무난한 기본값으로 본다.

### 7.7 여드름/모공 리스크

```ts
acnePoreRiskScore =
  user.primaryConcern === 'acne' && product.comedogenic_risk === 'low' ? 10 :
  user.primaryConcern === 'acne' && product.comedogenic_risk === 'medium' ? -8 :
  user.primaryConcern === 'acne' && product.comedogenic_risk === 'unknown' ? -4 :
  user.primaryConcern === 'acne' && product.comedogenic_risk === 'high' ? -24 :
  user.primaryConcern === 'pores' && product.occlusiveness === 'high' ? -14 :
  user.primaryConcern === 'pores' && product.occlusiveness === 'unknown' ? -4 :
  0
```

### 7.8 마무리감 점수

```ts
finishScore =
  user.prefersFresh && product.finish === 'fresh' ? 10 :
  user.prefersNatural && product.finish === 'natural' ? 10 :
  user.prefersDewy && product.finish === 'dewy' ? 10 :
  user.prefersFresh && product.finish === 'dewy' ? -10 :
  0
```

### 7.9 사용 시간대 점수

```ts
timeUseScore =
  user.useTime === 'morning' && product.use_zone === 'night_only' ? -16 :
  user.useTime === 'night' && product.balm_profile === 'night_moisture' ? 10 :
  user.useTime === 'both' && product.use_zone === 'full_face' ? 6 :
  0
```

### 7.10 메이크업 호환성

```ts
makeupScore =
  user.makeupUse && product.makeup_compatibility === 'good' ? 8 :
  user.makeupUse && product.makeup_compatibility === 'neutral' ? 0 :
  user.makeupUse && product.makeup_compatibility === 'unknown' ? -3 :
  user.makeupUse && product.makeup_compatibility === 'poor' ? -16 :
  0
```

### 7.11 계절/환경 점수

```ts
seasonScore =
  user.season === 'winter' && product.season_fit === 'winter' ? 6 :
  user.season === 'summer' && product.occlusiveness === 'high' ? -8 :
  0
```

### 7.12 가격 점수

```ts
priceScore =
  user.budget === 'low' && product.unit_price_per_10ml <= 3000 ? 6 :
  user.budget === 'mid' && product.unit_price_per_10ml <= 5000 ? 4 :
  0
```

가격 점수는 동점자 보조용이다. Balm 적합도를 뒤집는 핵심 점수로 쓰지 않는다.

---

## 8. 타입별 기본 분기

### A. 건성 / 속건조

우선순위:
1. `concerns`에 `dehydration`
2. `finish = dewy or natural`
3. `occlusiveness = medium or high`
4. `irritation_risk = low or medium`

피해야 할 후보:
- `finish = fresh`만 강한 제품
- `occlusiveness = low`인 가벼운 젤/로션형

---

### B. 장벽 약함 / 세안 후 당김

우선순위:
1. `concerns`에 `barrier`
2. `sensitivity_safe = true`
3. `occlusiveness = medium or high`
4. `balm_profile = barrier_seal or night_moisture`

피해야 할 후보:
- 자극 리스크 높은 기능성 Balm
- 산뜻함만 강조된 가벼운 수분젤

---

### C. 민감 / 붉은기

우선순위:
1. `sensitivity_safe = true`
2. `irritation_risk = low`
3. `concerns`에 `redness` 또는 `barrier`
4. `balm_profile = spot_soothing or barrier_seal`

피해야 할 후보:
- 고자극 기능성
- 향/쿨링/각질 케어 성격이 강한 제품

---

### D. 지성 / 번들거림

우선순위:
1. `finish = fresh or natural`
2. `occlusiveness = low or medium`
3. `texture = gel or lotion`
4. `comedogenic_risk = low`

피해야 할 후보:
- `occlusiveness = high`
- `finish = dewy`가 강한 제품
- 전체 얼굴용 리치 Balm

---

### E. 여드름 / 모공

우선순위:
1. `comedogenic_risk = low`
2. `irritation_risk = low`
3. `finish = fresh or natural`
4. `use_zone = spot or dry_patch`이면 전체 얼굴 추천 금지

피해야 할 후보:
- `comedogenic_risk = high`
- `occlusiveness = high + full_face`
- 리치한 구조의 야간 집중 Balm

---

## 9. Top Pick / Alt Pick / Usage Pick

Balm은 Top Pick 하나만 뽑으면 오해가 생긴다.

```ts
return {
  topPick: bestFitProduct,
  altPick: differentProfileAlternative,
  usagePick: limitedUseProduct,
}
```

### 9.1 Top Pick

현재 사용자 조건에서 가장 무난하게 맞는 제품.

### 9.2 Alt Pick

Top Pick과 점수 차가 6점 이하이면서 `balm_profile`이 다른 제품.

```ts
const useAltPick =
  top2 &&
  top1.score - top2.score <= 6 &&
  top1.balm_profile !== top2.balm_profile
```

### 9.3 Usage Pick

전체 얼굴 추천은 어렵지만 특정 상황에서 쓸 수 있는 제품.

예:
- 코 옆 각질
- 입가 건조
- 밤에만 사용
- 붉어진 부위 국소 사용

```ts
const usagePick = scored.find(p =>
  p.use_zone === 'dry_patch' ||
  p.use_zone === 'spot' ||
  p.use_zone === 'night_only'
)
```

Usage Pick은 Top Pick보다 위에 노출하지 않는다. 사용 제한이 있는 제품이므로 `이 제품은 전체 얼굴용 추천이 아니라 특정 상황용입니다`라는 문구를 붙인다.

---

## 10. Balm 결과 문구 생성 규칙

Balm 추천 이유는 아래 5개 중 최소 3개를 포함한다.

1. 피부타입
2. 주고민
3. 사용 부위/시간대
4. 답답함/유분감 리스크
5. 피해야 할 사용 방식

### 기본 템플릿

```txt
지금은 {피부상태}에서 {주고민}을 먼저 안정시키는 쪽이 중요합니다.
이 제품은 {보습/장벽/진정 포지션}에 맞고, {사용 시간대/부위}에 쓰기 좋습니다.
다만 {유분감/답답함/트러블 리스크}가 있을 수 있어 {피해야 할 사용 방식}은 피하는 편이 좋습니다.
```

### 예시 — 건성/장벽

```txt
지금은 세안 후 당김과 건조감이 같이 보이는 상태라 보습막을 안정적으로 남기는 쪽이 중요합니다.
이 제품은 장벽 보호막과 야간 보습 마무리에 맞고, 밤 루틴 마지막 단계에 쓰기 좋습니다.
다만 아침에 두껍게 바르면 답답할 수 있어 메이크업 전에는 양을 줄이는 편이 좋습니다.
```

### 예시 — 지성/모공

```txt
지금은 유분과 모공 부담이 같이 있는 상태라 리치한 Balm을 전체 얼굴에 쓰는 것은 맞지 않습니다.
이 제품은 가벼운 보습 마무리에는 맞지만, 코 주변이나 T존에는 양을 줄여 쓰는 편이 안정적입니다.
```

### 예시 — 민감/붉은기

```txt
지금은 붉은기와 예민함을 먼저 낮추는 쪽이 중요합니다.
이 제품은 저자극 진정 포지션에 가깝고, 건조하거나 붉어진 부위에 국소적으로 쓰기 좋습니다.
다만 전체 얼굴에 두껍게 바르기보다는 필요한 부위 위주로 쓰는 편이 좋습니다.
```

금지 표현:
- 치료합니다
- 회복시킵니다
- 피부장벽을 복구합니다
- 트러블을 없앱니다
- 붉은기를 해결합니다

권장 표현:
- 보습막을 남깁니다
- 자극 부담을 낮추는 쪽입니다
- 진정 포지션에 가깝습니다
- 건조 부위에 덧바르기 좋습니다
- 전체 얼굴보다는 국소 사용이 안정적입니다

---

## 11. 설문/사용자 입력에서 있으면 좋은 Balm 전용 질문

Balm 정확도를 높이려면 아래 질문이 있으면 좋다.

- 답답한 제형을 싫어하나요?
- 여드름/좁쌀이 쉽게 올라오나요?
- 메이크업 전에 사용할 제품이 필요한가요?
- 주로 아침/저녁 중 언제 쓰나요?
- 얼굴 전체에 바를 제품이 필요한가요, 특정 건조 부위용이 필요한가요?
- 겨울/환절기 건조가 심한 편인가요?

Bridge 모드에서는 이 질문들을 필수로 넣지 말고, 값이 없으면 기본값으로 처리한다.

```ts
const userDefaults = {
  dislikesHeavyTexture: false,
  acneProne: user.primaryConcern === 'acne',
  makeupUse: false,
  useTime: 'night',
  useScope: 'full_face',
  season: 'all_season',
}
```

---

## 12. 나중에 기능을 뺄 때의 분리 기준

Balm 기능을 줄일 경우 아래 순서로 제거한다.

### 12.1 1순위 제거 가능

- `seasonScore`
- `priceScore`
- `makeupScore`

추천 정확도에는 도움 되지만 핵심은 아니다.

### 12.2 2순위 선택 제거

- `usagePick`
- `altPick`
- `balm_profile` 세분화

화면이 복잡하면 Top Pick 하나와 사용 주의만 남긴다.

### 12.3 3순위 유지 권장

- `skinTypeScore`
- `concernScore`
- `sensitivityScore`
- `occlusiveFitScore`
- `acnePoreRiskScore`

이 5개는 Balm 추천의 핵심이므로 유지한다.

### 12.4 완전 제거 시

Balm 기능을 완전히 빼는 경우 아래만 제거하면 된다.

1. `BALM_PRODUCT_PROFILES`
2. `getBalmExtra`
3. `withBalmDefaults`
4. Balm 전용 하드 필터
5. Balm 전용 점수식
6. Balm 전용 UI 카드

DB 기본 제품 데이터는 남겨도 된다. 다만 Balm 전용 추천 카드만 비활성화한다.

---

## 13. 최소 구현 버전

복잡도를 줄인 최소 점수식은 아래만 사용한다.

```ts
score =
  skinTypeScore +
  concernScore +
  sensitivityScore +
  occlusiveFitScore +
  acnePoreRiskScore +
  finishScore
```

최소 하드 필터는 아래만 둔다.

```ts
.filter(p => !(user.isSensitive && p.irritation_risk === 'high'))
.filter(p => !(user.primaryConcern === 'acne' && p.comedogenic_risk === 'high'))
.filter(p => !(user.skinType === 'oily' && p.occlusiveness === 'high'))
```

최소 구현에서도 `category === 'balm'`은 쓰지 않는다.

---

## 14. 최종 운영 원칙

Balm은 기능이 많기 때문에 처음부터 정교한 DB 카테고리로 고정하지 않는다.

1. 현재 products 태그 체계에 연결한다.
2. DB enum을 임의로 추가하지 않는다.
3. Balm 여부는 별도 매핑/profile로 식별한다.
4. Balm 전용 변수는 optional로 둔다.
5. 추천은 하드 필터 → 점수식 → 사용 주의 문구 순서로 처리한다.
6. Top Pick 하나만 강요하지 않고, 필요하면 Alt Pick 또는 Usage Pick을 분리한다.
7. 나중에 복잡하면 `season`, `makeup`, `usagePick`부터 제거한다.
8. 끝까지 유지해야 할 핵심은 피부타입, 고민, 민감성, 밀폐감, 여드름/모공 리스크다.
