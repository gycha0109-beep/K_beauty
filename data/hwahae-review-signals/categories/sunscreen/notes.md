# Hwahae Sunscreen Review Signal Batch Notes

## 1. 파일 목적

이 문서는 화해 상품 페이지에서 콘솔 추출기로 수집한 선크림 리뷰 신호 JSON 묶음의 사용 규칙과 유의사항을 정리한다.

배치 파일:

```txt
hwahae-sunscreen-review-signals.batch.json
```

JSONL 파일:

```txt
hwahae-sunscreen-review-signals.batch.jsonl
```

대상 카테고리:

```txt
sunscreen
```

포함 범위:

```txt
선크림 / 선젤 / 선세럼 / 선밀크 / 톤업 선스크린
```

총 제품 수:

```txt
11개
```

## 2. 포함 제품 요약

| 제품 | 리뷰 수 | 평점 | confidence | 임시 sunscreen_profile | 백탁 | 톤업 | 눈시림 | 밀림 | 주요 positive | 주요 negative |
|---|---:|---:|---|---|---|---|---|---|---|---|
| 자작나무선크림 | 28,799 | 4.6 | very_high | light_no_whitecast_sunscreen | unknown | likely_false | low | low | 끈적하지않은, 흡수잘되는, 가벼운 | 유분있는, 따가운, 알러지반응오는 |
| 맑은쌀 선크림 | 482 | 4.63 | medium | hydrating_daily_sunscreen | none_or_low | likely_false | low | low | 수분있는, 잘발리는, 백탁없는 | 유분있는, 따가운, 톤업안되는 |
| 더마UV365 장벽수분 무기자차 선크림 | 1,535 | 4.47 | high | mineral_matte_sunscreen | unknown | unknown | low | watch | 잘발리는, 수분있는, 자극없는 | 알러지반응오는, 가려운, 매트한 |
| 히아루론산 워터리 선젤 | 41 | 4.39 | low | light_no_whitecast_sunscreen | none_or_low | likely_false | unknown | low | 수분있는, 가벼운, 백탁없는 | 유분있는, 톤보정안되는, 뽀송하지않은 |
| 다이브인 워터리 모이스처 선크림 | 1,712 | 4.53 | high | hydrating_daily_sunscreen | none_or_low | likely_false | low | unknown | 수분있는, 잘발리는, 백탁없는 | 유분있는, 따가운, 알러지반응오는 |
| 맑은쌀 선크림 아쿠아프레쉬 | 88 | 4.32 | low | light_no_whitecast_sunscreen | none_or_low | likely_false | unknown | watch | 수분있는, 흡수잘되는, 가벼운 | 밀림있는, 때처럼나오는, 톤업안되는 |
| 안뗄리오스 UVMune 400 인비저블 플루이드 | 32 | 4.16 | low | outdoor_high_protection | none_or_low | unknown | watch | low | 가벼운, 잘발리는, 백탁없는 | 유분있는, 흘러내리는, 자극있는 |
| 퍼펙트 UV 선스크린 스킨케어 밀크 NA | 89 | 4.12 | low | tone_up_sunscreen | none_or_low | likely_true | watch | unknown | 잘발리는, 흡수잘되는, 뽀송한 | 유분있는, 눈통증있는, 보습안되는 |
| 그린 마일드 업 선 플러스 | 17,809 | 4.25 | very_high | mineral_matte_sunscreen | unknown | unknown | low | unknown | 자극없는, 트러블안생기는, 유분없는 | 보습안되는, 알러지반응오는, 뻑뻑한 |
| 더마 UV365 레드 카밍 톤업 선스크린 | 346 | 5 | medium | tone_up_sunscreen | unknown | likely_true | unknown | watch | 톤업되는, 잘발리는, 자연스러운 | 유분있는, 알러지반응오는, 지속력안좋은 |
| 히알루-시카 워터핏 선세럼 UV | 3,740 | 4.73 | high | light_no_whitecast_sunscreen | unknown | likely_false | low | low | 흡수잘되는, 가벼운, 보습잘되는 | 톤업안되는, 알러지반응오는, 톤보정안되는 |

## 3. 가장 중요한 운영 원칙

선크림 리뷰 신호는 **제품의 절대 우열 점수**가 아니다.

선크림은 피부타입보다도 실제 사용 실패 조건이 중요하다. 따라서 리뷰 키워드는 아래 용도로만 사용한다.

```txt
1. sunscreen_profile 추정
2. 백탁/톤업/눈시림/밀림/유분감 신호 분리
3. 메이크업 전 사용 적합성 판단
4. 민감성/따가움/알러지 리스크 감지
5. 결과 설명 문구 보강
6. 동점자 판별 또는 confidence 표시
```

금지:

```txt
review_count를 Top Pick 점수에 직접 크게 반영하지 말 것
rating 5.0 또는 고평점을 고품질 확정 신호로 쓰지 말 것
ingredient_raw.functional.uv protection 개수로 자외선 차단력 우열을 판단하지 말 것
ingredient_raw.risk.low 비율만 보고 민감성 안전 제품으로 확정하지 말 것
톤업안되는을 모든 사용자에게 단점으로 처리하지 말 것
유분있는을 모든 사용자에게 단점으로 처리하지 말 것
백탁없는을 모든 사용자에게 장점으로 처리하지 말 것
```

## 4. review_count / rating 사용 규칙

리뷰 수와 평점은 추천 본체가 아니라 **검증도와 confidence**로만 사용한다.

```txt
review_count < 100     -> low confidence
100 ~ 999              -> medium confidence
1,000 ~ 9,999          -> high confidence
10,000+                -> very_high confidence
```

## 5. ingredient_raw 사용 규칙

선크림에서 `ingredient_raw`는 특히 조심해서 사용한다.

화해 JSON의 `ingredient_raw.functional`은 성분명, UV 필터 종류, 함량, 필터 안정성, 실제 SPF/PA 성능을 직접 알려주는 값이 아니다. 따라서 아래처럼 보조 신호로만 사용한다.

사용 가능:

```txt
risk.high > 0
→ 민감성 추천에서 보수적으로 본다.

risk.medium 또는 unknown이 많음
→ 민감성/눈시림 사용자에게 보수적으로 본다.

functional.skin hydration 높음
→ 수분형 사용감 보조 근거.

functional.skin protection 높음
→ 장벽/보호 컨셉 보조 근거.

functional.uv protection 존재
→ 선크림 카테고리 확인 보조 근거.
```

사용 금지:

```txt
uv protection 개수가 많다고 더 좋은 선크림으로 점수화 금지
low risk 성분이 많다고 sensitivity_safe = true 확정 금지
성분 기능 개수로 차단력/지속력/방수성 판단 금지
성분을 하나하나 모르면 ingredient score를 Top Pick 핵심 점수로 사용 금지
```

## 6. 화해에 없는 제품 처리 규칙

화해에 제품이 없거나 콘솔 추출이 불가능한 제품은 화해 리뷰 기반 제품과 같은 축에서 비교하지 않는다.

예시:

```txt
UV 애슬리즘 프로텍트 에센스
```

권장 저장 형태:

```json
{
  "source_status": "hwahae_missing",
  "review_signal_available": false,
  "confidence_level": "external_only",
  "review_raw": null,
  "market_raw": null,
  "ingredient_raw": null,
  "external_evidence_needed": true
}
```

운영 원칙:

```txt
1. products 테이블에는 유지 가능
2. 화해 review_signal 점수는 제외
3. 공식몰/올리브영/브랜드 설명/외부 리뷰 등으로 별도 보강
4. Top Pick에서는 confidence를 낮게 처리
5. 화해 데이터가 있는 제품과 review_count/rating 기준으로 경쟁시키지 않음
6. 성분/필터/사용감 필드는 공식 설명 기반으로 별도 수동 태깅
```

추천 문구 예시:

```txt
이 제품은 화해 리뷰 신호가 없어 대중 리뷰 검증도는 낮게 표시합니다.
다만 공식 제품 포지션과 사용감 정보 기준으로 후보에 포함했습니다.
```

## 7. 선크림 sunscreen_profile 기준

### hydrating_daily_sunscreen

수분감, 보습감, 잘 발림, 백탁 적음 신호가 강한 데일리 선크림.

주요 키워드:

```txt
수분있는
보습잘되는
잘발리는
백탁없는
흡수잘되는
뻑뻑하지않은
```

추천 적합:

```txt
건성
속건조
데일리 사용
백탁 싫어함
촉촉한 마무리 선호
```

추천 주의:

```txt
유분감 싫어함
매트한 마무리 선호
피지/번들거림 고민
```

### light_no_whitecast_sunscreen

가벼움, 산뜻함, 백탁 없음, 흡수, 밀림 없음이 강한 타입.

주요 키워드:

```txt
가벼운
산뜻한
백탁없는
흡수잘되는
끈적하지않은
밀림없는
답답하지않은
```

추천 적합:

```txt
지성/복합성
백탁 싫어함
답답함 싫어함
데일리 선크림
메이크업 전 사용
```

추천 주의:

```txt
톤업 원함
커버/보정 원함
보습 지속력 중요
```

### mineral_matte_sunscreen

무기자차/마일드/뽀송/유분 없음 신호가 강한 타입.

주요 키워드:

```txt
자극없는
트러블안생기는
유분없는
끈적하지않은
뽀송한
눈통증없는
산뜻한
```

추천 적합:

```txt
지성
피지/번들거림
뽀송한 마무리 선호
톤업 또는 보송 마무리 선호
```

추천 주의:

```txt
건성
속건조
보습 부족
뻑뻑함
매트함 싫어함
```

### tone_up_sunscreen

톤업, 자연스러운 보정, 피부톤 개선 신호가 강한 타입.

주요 키워드:

```txt
톤업되는
자연스러운
피부톤이개선되는
뻑뻑하지않은
잘발리는
```

추천 적합:

```txt
톤업 원함
생얼 보정
붉은기/칙칙함 커버
가벼운 베이스 대체
```

추천 주의:

```txt
백탁 싫어함
톤업 원하지 않음
메이크업 밀림 민감
유분감 싫어함
```

### outdoor_high_protection

워터프루프/지속력/고차단 포지션으로 추정되는 타입. 단, 화해 리뷰 신호만으로 실제 차단력 우열을 확정하지 않는다.

추천 적합:

```txt
야외 활동
장시간 외출
땀/피지 노출 가능성
```

추천 주의:

```txt
눈통증
알러지
보습 부족
유분감
흘러내림
```

## 8. negative 키워드 해석 주의

선크림에서 negative는 다섯 종류로 나눈다.

### A. 실제 리스크

```txt
알러지반응오는
가려운
따가운
자극있는
트러블생기는
뒤집어지는
```

민감성/붉은기/장벽 약한 사용자에게 강하게 감점한다.

### B. 눈시림 리스크

```txt
눈통증있는
눈시림
따가운
```

눈시림에 민감한 사용자에게 강하게 감점한다.

### C. 메이크업/레이어링 mismatch

```txt
밀림있는
때처럼나오는
잘굳는
겉도는
흘러내리는
```

아침 루틴, 메이크업 전 사용, 여러 제품을 겹쳐 바르는 사용자에게 감점한다.

### D. 유분감/답답함 mismatch

```txt
유분있는
답답한
미끌거리는
매트하지않은
뽀송하지않은
```

지성/복합성/번들거림 고민 사용자에게 감점한다. 건성 사용자에게는 무조건 단점으로 보지 않는다.

### E. 톤업/커버 mismatch

```txt
톤업안되는
톤보정안되는
커버안되는
미백효과가없는
```

톤업을 원하지 않는 사용자에게는 단점이 아니다. 톤업/보정/생얼 커버를 원하는 사용자에게만 감점한다.

## 9. 제품별 1차 해석 메모

### 자작나무 선크림

- 끈적임 적음/흡수/가벼움/눈통증 없음/밀림 없음 신호가 강하다.
- 유분/따가움/알러지/톤업 없음 신호도 강하다.
- light_no_whitecast_sunscreen 또는 hydrating_daily_sunscreen 후보.
- 민감성 최우선, 톤업 목적에는 보수적으로 본다.

### 맑은쌀 선크림

- 수분/잘 발림/백탁 없음/눈통증 없음/가벼움 신호.
- 유분/따가움/톤업 없음 신호가 있다.
- hydrating_daily_sunscreen 후보.
- 리뷰 수 482개로 confidence는 medium.

### 더마UV365 장벽수분 무기자차 선크림

- 잘 발림/수분/자극 없음/눈통증 없음/보습/트러블 안 생김 신호.
- 무기자차 포지션으로 보이며, 장벽 수분형 후보.
- 알러지/가려움 신호가 있어 민감성 최우선 추천은 보수적으로.
- mineral_matte_sunscreen 또는 hydrating_daily_sunscreen 후보.

### 히아루론산 워터리 선젤

- 수분/가벼움/백탁 없음/흡수/끈적임 적음 신호.
- 리뷰 수 41개로 confidence low.
- hydrating_daily_sunscreen 후보지만 점수 반영은 보수적으로.

### 다이브인 워터리 모이스처 선크림

- 수분/잘 발림/백탁 없음/보습/자극 없음/눈통증 없음 신호.
- 유분/따가움/알러지 신호가 있어 민감성은 주의.
- hydrating_daily_sunscreen 후보.

### 맑은쌀 선크림 아쿠아프레쉬

- 수분/흡수/가벼움/백탁 없음/끈적임 적음/유분 없음 신호.
- 밀림/때처럼 나옴 신호가 상대적으로 중요하다.
- light_no_whitecast_sunscreen 후보.
- 메이크업 전 사용에는 보수적으로.

### 안뗄리오스 UVMune 400 인비저블 플루이드

- 가벼움/잘 발림/백탁 없음 신호가 있으나 리뷰 수 32개로 표본이 작다.
- 유분/흘러내림/자극/눈통증 신호가 있어 민감성·눈시림 사용자에게 주의.
- outdoor_high_protection 후보로 둘 수 있으나 화해 리뷰만으로 고차단 우열 판단 금지.

### 퍼펙트 UV 선스크린 스킨케어 밀크 NA

- 잘 발림/흡수/뽀송/백탁 없음/톤업 신호.
- 눈통증/보습 부족/알러지/트러블/뒤집어짐 신호가 있다.
- ingredient risk.high가 2개로 잡혀 민감성 추천은 매우 보수적으로.
- outdoor_high_protection 후보지만 눈시림/민감성 주의.

### 그린 마일드 업 선 플러스

- 자극 없음/트러블 안 생김/유분 없음/끈적임 적음/뽀송/눈통증 없음 신호.
- 보습 부족/뻑뻑함/매트함/속건조 부족 신호가 강하다.
- mineral_matte_sunscreen 후보.
- 지성/뽀송 선호에는 좋지만 건성/속건조에는 감점.

### 더마 UV365 레드 카밍 톤업 선스크린

- 톤업/자연스러움/피부톤 개선/잘 발림 신호.
- 유분/알러지/지속력/밀림 신호가 있다.
- tone_up_sunscreen 후보.
- 톤업 원하지 않는 사용자에게는 추천하지 않는다.

### 히알루-시카 워터핏 선세럼 UV

- 흡수/가벼움/보습/끈적임 적음/밀림 없음/눈통증 없음 신호.
- 톤업 없음/톤보정 없음 신호가 강하다.
- light_no_whitecast_sunscreen 또는 hydrating_daily_sunscreen 후보.
- 톤업 목적에는 부적합.

## 10. 추천 로직 적용 원칙

Top Pick 산식에서 선크림은 아래 우선순위를 따른다.

```txt
1. 사용자 사용 목적: 데일리 / 야외 / 메이크업 전 / 톤업
2. 백탁 선호/회피
3. 톤업 선호/회피
4. 눈시림 민감 여부
5. 밀림/레이어링 민감 여부
6. 유분감/답답함 회피
7. 민감성/따가움/알러지 risk_score
8. review_count는 confidence 또는 동점자 판별
9. rating은 낮은 경우 감점 참고, 높은 경우 직접 가산 금지
10. ingredient_raw는 보조 플래그로만 사용
```

## 11. 배치 파일 사용 주의

- 배치 파일 안의 `estimated_sunscreen_profile`은 자동 요약용 임시값이다.
- `inferred_signal_flags`는 리뷰 키워드 기반 추정값이며 확정 DB 필드가 아니다.
- 최종 DB 반영 전에는 코덱스/사람 검토를 거친다.
- raw JSON은 원본 근거로 보존한다.
- `category`가 없던 원본은 배치 wrapper에서 `sunscreen`으로 보강했다.
- 화해에 없는 제품은 이 배치 items에 억지로 넣지 말고, 별도 `hwahae_missing` 정책으로 관리한다.
- 매핑 로직이 바뀌면 raw JSON 기준으로 재처리한다.

## 12. 한 줄 결론

선크림 리뷰 신호는 제품의 절대 우열을 정하는 데이터가 아니라, **백탁·톤업·눈시림·밀림·유분감·보습 부족·자극 리스크·사용 목적 적합성**을 분리하기 위한 신호다.
