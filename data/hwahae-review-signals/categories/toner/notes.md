# Hwahae Toner / Pad Review Signal Batch Notes

## 1. 파일 목적

이 문서는 화해 상품 페이지에서 콘솔 추출기로 수집한 토너/패드 리뷰 신호 JSON 묶음의 사용 규칙과 유의사항을 정리한다.

배치 파일:

```txt
hwahae-toner-pad-review-signals.batch.json
```

JSONL 파일:

```txt
hwahae-toner-pad-review-signals.batch.jsonl
```

대상 카테고리 그룹:

```txt
toner
```

포함 범위:

```txt
토너 / 에센스 토너 / 스킨부스터 / 토너 패드 / 모공 패드 / 산 토너
```

총 제품 수:

```txt
15개
```

카테고리별 수량:

```txt
toner_essence: 11개
toner_pad: 4개
```

## 2. 포함 제품 요약

| 제품 | category | 리뷰 수 | 평점 | confidence | 임시 toner_profile | 권장 사용 빈도 | 주요 positive | 주요 negative |
|---|---|---:|---:|---|---|---|---|---|
| 티트리 시카 수딩 토너 | toner_essence | 454 | 4.39 | medium | soothing_toner | daily_available | 진정되는, 흡수잘되는, 트러블없어지는 | 보습안되는, 따가운, 알러지반응오는 |
| 아쿠아 오아시스 토너 | toner_essence | 26,595 | 4.74 | very_high | active_acid_toner | limited_1_3x_week_or_spot | 가벼운, 잘발리는, 끈적하지않은 | 흘러내리는, 눈통증있는, 알러지반응오는 |
| 제로 모공 패드 2.0 | toner_pad | 3,617 | 4.2 | high | exfoliating_pore_pad | limited_1_3x_week_or_spot | 모공관리되는, 각질제거잘되는, 피부결좋아지는 | 자극있는, 따가운, 끈적한 |
| DMT 에센스 인 토너 | toner_essence | 223 | 4.62 | medium | barrier_hydrating_toner | daily_available | 수분있는, 보습잘되는, 흡수잘되는 | 알러지반응오는, 흘러내리는, 답답한 |
| 데일리 토너 패드 | toner_pad | 1,957 | 4.43 | high | exfoliating_pore_pad | limited_1_3x_week_or_spot | 에센스양많은, 수분있는, 자극없는 | 모공관리안되는, 알러지반응오는, 흘러내리는 |
| 크림스킨 | toner_essence | 1,597 | 4.61 | high | barrier_hydrating_toner | daily_available | 보습잘되는, 수분있는, 속건조에효과있는 | 유분있는, 흘러내리는, 알러지반응오는 |
| 살리시닉 포어 클리어 블랙 모공 토너패드 | toner_pad | 212 | 5 | medium | exfoliating_pore_pad | limited_1_3x_week_or_spot | 피지없어지는, 각질제거잘되는, 자극없는 | 따가운, 밀착안되는, 트러블생기는 |
| 어성초 카밍 토너 스킨부스터 | toner_essence | 1,383 | 4.52 | high | soothing_hydrating_toner | daily_available | 진정되는, 수분있는, 자극없는 | 알러지반응오는, 흘러내리는, 잘굳는 |
| 올리고 히알루론산 딥 토너 | toner_essence | 4,341 | 4.73 | high | barrier_hydrating_toner | daily_available | 수분있는, 보습잘되는, 흡수잘되는 | 흘러내리는, 알러지반응오는, 눈통증있는 |
| 아하 바하 파하 30 데이즈 미라클 토너 | toner_essence | 864 | 4.28 | medium | active_acid_toner | limited_1_3x_week_or_spot | 각질제거잘되는, 트러블없어지는, 자극없는 | 따가운, 알러지반응오는, 블랙헤드안없어지는 |
| 센시티브 패드 | toner_pad | 5,930 | 3.92 | high | exfoliating_pore_pad | limited_1_3x_week_or_spot | 트러블없어지는, 피지없어지는, 피부결좋아지는 | 자극있는, 따가운, 알러지반응오는 |
| 어성초 77 히알루론산 수분 진정 토너 | toner_essence | 2,051 | 4.49 | high | soothing_hydrating_toner | daily_available | 수분있는, 흡수잘되는, 자극없는 | 흘러내리는, 따가운, 알러지반응오는 |
| 하이드라비오 토너 | toner_essence | 2,514 | 4.39 | high | soothing_hydrating_toner | daily_available | 수분있는, 보습잘되는, 자극없는 | 알러지반응오는, 흘러내리는, 인공향나는 |
| 독도토너 | toner_essence | 94,287 | 4.43 | very_high | active_acid_toner | limited_2_3x_week | 각질제거잘되는, 피부결좋아지는, 잘발리는 | 흘러내리는, 알러지반응오는, 가려운 |
| 다이브인 저분자 히알루론산 토너 | toner_essence | 34,271 | 4.7 | very_high | texture_refining_toner | daily_or_limited_by_sensitivity | 가벼운, 트러블안생기는, 끈적하지않은 | 흘러내리는, 알러지반응오는, 눈통증있는 |

## 3. 가장 중요한 운영 원칙

토너/패드 리뷰 신호는 **제품의 절대 우열 점수**가 아니다.

토너/패드는 수분 토너, 진정 토너, 장벽 토너, 피부결 토너, 모공 패드, 산 토너처럼 사용 목적과 리스크가 크게 갈린다. 따라서 리뷰 키워드는 아래 용도로만 사용한다.

```txt
1. toner_profile 추정
2. toner_essence와 toner_pad 분리
3. 매일 사용 가능 제품과 제한 사용 제품 분리
4. 자극/따가움/트러블 리스크 감지
5. 각질/피지/모공 목적 후보 분리
6. 결과 설명 문구 보강
7. 동점자 판별 또는 confidence 표시
```

금지:

```txt
review_count를 Top Pick 점수에 직접 크게 반영하지 말 것
rating 5.0 또는 고평점을 고품질 확정 신호로 쓰지 말 것
수분 토너와 모공 패드를 같은 점수축에서 비교하지 말 것
각질제거잘되는을 모든 사용자에게 장점으로 처리하지 말 것
트러블없어지는을 여드름 피부에 무조건 좋은 신호로 처리하지 말 것
자극없는 positive만 보고 민감성 안전 제품으로 확정하지 말 것
패드/산 토너를 매일 기본 루틴으로 추천하지 말 것
```

## 4. review_count / rating 사용 규칙

리뷰 수와 평점은 추천 본체가 아니라 **검증도와 confidence**로만 사용한다.

```txt
review_count < 100     -> low confidence
100 ~ 999              -> medium confidence
1,000 ~ 9,999          -> high confidence
10,000+                -> very_high confidence
```

예시:

```txt
살리시닉 포어 클리어 블랙 모공 토너패드
- review_count: 212
- rating: 5.0
- 해석: 피지/각질/모공 신호는 있지만 표본이 크지 않고 자극/트러블 신호가 있다. 평점 5.0을 직접 점수화하면 과대평가된다.
```

```txt
독도토너
- review_count: 94,287
- 해석: 검증도는 매우 높지만 알러지/가려움/눈통증/흘러내림 신호도 크다. 모든 민감성 사용자에게 안전하다고 보면 안 된다.
```

## 5. 토너/패드 toner_profile 기준

### hydrating_toner

수분, 속건조, 흡수, 가벼움, 끈적임 적음이 강한 타입.

주요 키워드:

```txt
수분있는
보습잘되는
속건조에효과있는
흡수잘되는
가벼운
끈적하지않은
산뜻한
```

추천 적합:

```txt
속건조
수분 부족
가벼운 첫 단계
지성/복합성 수분 보강
데일리 사용
```

추천 주의:

```txt
각질/피지/모공을 강하게 관리하려는 경우
고보습 장벽 보강이 필요한 경우
```

### soothing_toner

진정, 자극 없음, 트러블 완화 신호가 강한 타입.

주요 키워드:

```txt
진정되는
자극없는
트러블없어지는
트러블안생기는
쿨링되는
```

추천 적합:

```txt
일시적 민감
붉은기 경향
트러블 후 진정
가벼운 진정 루틴
데일리 사용 가능
```

추천 주의:

```txt
따가움/알러지/눈통증 negative가 큰 경우
보습 부족 negative가 큰 경우
```

### soothing_hydrating_toner

수분과 진정 신호가 함께 강한 타입.

추천 적합:

```txt
민감 경향 + 속건조
트러블 후 수분 진정
가벼운 데일리 토너
```

### barrier_hydrating_toner

보습, 속건조, 편안함, 장벽 보조 신호가 강한 타입.

주요 키워드:

```txt
보습잘되는
수분있는
속건조에효과있는
편안해지는
쫀득한
```

보조 성분 신호:

```txt
functional.moisture evaporation blocking 존재
functional.skin protection 높음
```

추천 적합:

```txt
건성
속건조
장벽 약함
보습 첫 단계
```

추천 주의:

```txt
유분감/답답함/미끌거림 싫어함
지성/여드름성 피부
```

### texture_refining_toner

피부결, 각질, 매끄러움 신호가 있으나 강한 산/패드 리스크까지는 아닌 타입.

주요 키워드:

```txt
피부결좋아지는
각질제거잘되는
매끄러운
잘발리는
산뜻한
```

추천 적합:

```txt
피부결
가벼운 각질 정돈
화장 들뜸
칙칙한 결
```

추천 주의:

```txt
민감성
장벽 약함
따가움/알러지 신호가 큰 경우
```

### exfoliating_pore_pad

피지, 모공, 블랙헤드, 각질 제거 신호가 강한 패드 타입.

주요 키워드:

```txt
피지없어지는
모공관리되는
블랙헤드없어지는
각질제거잘되는
피부결좋아지는
```

추천 적합:

```txt
피지
모공
블랙헤드
두꺼운 각질
부위별 관리
```

추천 주의:

```txt
민감성
장벽 약함
붉은기
따가움
트러블 악화
매일 사용
```

### active_acid_toner

AHA/BHA/PHA 또는 산 토너 성격이 강하고 효과와 자극 리스크가 함께 큰 타입.

주요 키워드:

```txt
각질제거잘되는
트러블없어지는
피지없어지는
매끄러운
쿨링되는
```

위험 키워드:

```txt
자극있는
따가운
알러지반응오는
보습안되는
눈통증있는
뒤집어지는
트러블생기는
```

추천 적합:

```txt
지성
피지/모공
각질
트러블 반복
민감성 낮음
```

추천 부적합:

```txt
민감성
장벽 약함
건성
붉은기
세안 후 따가움
```

## 6. 사용 빈도 규칙

토너/패드는 `recommended_usage_frequency`가 중요하다.

```txt
daily_available
→ 수분/진정/장벽 토너. 매일 사용 가능 후보.

daily_or_limited_by_sensitivity
→ 피부결 정돈 토너. 민감도에 따라 매일 또는 제한 사용.

limited_2_3x_week
→ 패드/각질/피지 관리 제품. 주 2~3회 후보.

limited_1_3x_week_or_spot
→ 자극 리스크가 큰 패드/산 토너. 주 1~3회 또는 고민 부위 위주.
```

운영 원칙:

```txt
패드/산 토너는 기본 루틴 Top Pick으로 매일 추천하지 않는다.
민감성/장벽 약함/붉은기 사용자는 limited 제품을 제외하거나 강하게 감점한다.
피지/모공/각질 고민이 강한 사용자에게만 limited 제품을 보조 후보로 제공한다.
```

## 7. negative 키워드 해석 주의

토너/패드에서 negative는 네 종류로 나눈다.

### A. 실제 리스크

```txt
자극있는
따가운
알러지반응오는
가려운
트러블생기는
뒤집어지는
```

민감성/붉은기/장벽 약한 사용자에게 강하게 감점한다.

### B. 보습 부족

```txt
보습안되는
수분없는
속건조에효과없는
```

건성/속건조/장벽 약한 사용자에게 감점한다.

### C. 제형/사용감 mismatch

```txt
흘러내리는
미끌거리는
답답한
잘굳는
겉도는
```

레이어링, 아침 루틴, 끈적임 싫어하는 사용자에게 감점한다.

### D. 기능 기대 mismatch

```txt
블랙헤드안없어지는
화이트헤드안없어지는
모공관리안되는
각질제거안되는
쿨링안되는
```

해당 고민을 주목적으로 선택한 사용자에게만 감점한다.

## 8. ingredient_raw 사용 규칙

성분 신호는 보조 근거다.

```txt
risk.high > 0
→ 민감성 추천에서 보수적으로 본다.

risk.medium 또는 unknown이 많음
→ 민감성/장벽 약함 사용자에게 보수적으로 본다.

functional.skin hydration 높음
→ hydrating_toner / barrier_hydrating_toner 보조 근거.

functional.moisture evaporation blocking 존재
→ barrier_hydrating_toner 보조 근거.

functional.exfoliation 존재
→ texture_refining_toner / active_acid_toner 보조 근거. 단 민감성에는 자극 가능성도 같이 본다.

functional.acne relief 존재
→ acne / pore 보조 근거. 단 효과 확정 금지.
```

주의:

```txt
성분 위험도만으로 sensitivity_safe = true 확정 금지
skin_type 성분 신호만으로 skin_types 확정 금지
exfoliation/acne relief가 있다고 효과를 보장하지 말 것
```

## 9. 제품별 1차 해석 메모

### 티트리 시카 수딩 토너

- 진정/흡수/트러블 완화/가벼움 신호.
- 보습 부족/따가움/알러지 신호가 있어 민감성 최우선 추천은 보수적으로.
- soothing_toner 후보.

### 아쿠아 오아시스 토너

- 가벼움/잘 발림/끈적임 적음/산뜻함/속건조/피부결 신호.
- 눈통증/따가움/알러지 신호가 있어 민감성에는 주의.
- hydrating_toner 또는 texture_refining_toner 후보.

### 제로 모공 패드 2.0

- 모공/각질/피부결/피지/블랙헤드 신호.
- 자극/따가움/알러지/트러블/뒤집어짐 신호가 크고 risk.high가 있다.
- exfoliating_pore_pad 후보.
- 매일 사용 기본 추천 금지.

### DMT 에센스 인 토너

- 수분/보습/속건조/흡수 신호.
- 장벽 보조 성분 신호가 있다.
- barrier_hydrating_toner 후보.

### 데일리 토너 패드

- 에센스양/수분/자극 없음/각질/피부결/트러블 완화 신호.
- 알러지/따가움/risk.high가 있어 패드임에도 민감성은 보수적으로.
- daily_soothing_pad 또는 texture_refining_toner 성격이 있으나 사용 빈도 제한 필요.

### 크림스킨

- 보습/수분/속건조/편안함 신호.
- 유분/답답함/겉돎 신호가 있어 지성에게는 감점 가능.
- barrier_hydrating_toner 후보.

### 살리시닉 포어 클리어 블랙 모공 토너패드

- 피지/각질/모공/블랙헤드/피부결 신호.
- 따가움/트러블/알러지/risk.high가 있어 민감성은 강한 감점.
- exfoliating_pore_pad 후보.
- 평점 5.0을 직접 점수화 금지.

### 어성초 카밍 토너 스킨부스터

- 진정/수분/자극 없음/흡수/보습/트러블 완화 신호.
- soothing_hydrating_toner 후보.
- 알러지 신호는 있으나 전체적으로 데일리 진정 토너 후보.

### 올리고 히알루론산 딥 토너

- 수분/보습/흡수/속건조/가벼움 신호.
- hydrating_toner 후보.
- 흘러내림/눈통증 신호는 레이어링 주의.

### 아하 바하 파하 30 데이즈 미라클 토너

- 각질/트러블/진정/피부결/피지 신호.
- 따가움/알러지/risk.high가 있어 민감성에는 부적합.
- active_acid_toner 후보.
- 매일 기본 추천 금지.

### 센시티브 패드

- 트러블/피지/피부결/쿨링/진정/블랙헤드 신호.
- 자극/따가움/알러지/보습 부족/눈통증/뒤집어짐 신호가 매우 크고 평점이 낮다.
- active_acid_toner 또는 exfoliating_pore_pad 후보.
- 민감성 명칭과 실제 리뷰 리스크를 분리해서 본다.

### 어성초 77 히알루론산 수분 진정 토너

- 수분/흡수/자극 없음/진정/트러블 완화/가벼움 신호.
- soothing_hydrating_toner 후보.
- 따가움/알러지 신호는 보수적으로 반영.

### 하이드라비오 토너

- 수분/보습/자극 없음/흡수/속건조 신호.
- 알러지/향/따가움 신호가 있다.
- hydrating_toner 또는 barrier_hydrating_toner 후보.

### 독도토너

- 각질/피부결/잘 발림/산뜻함/따갑지 않음/뒤집어지지 않음 신호.
- 리뷰 수가 매우 많지만 알러지/가려움/눈통증/흘러내림 신호도 크다.
- texture_refining_toner 후보.
- 대중 검증도는 높지만 민감성 안전 확정 금지.

### 다이브인 저분자 히알루론산 토너

- 가벼움/트러블 안 생김/끈적임 적음/산뜻함/속건조/피부결 신호.
- hydrating_toner 후보.
- 리뷰 수가 많지만 눈통증/알러지/흘러내림 신호는 보수적으로 반영.

## 10. 추천 로직 적용 원칙

Top Pick 산식에서 토너/패드는 아래 우선순위를 따른다.

```txt
1. 사용자 주고민: 수분 / 진정 / 장벽 / 각질 / 피지 / 모공
2. toner_profile 적합도
3. toner_essence와 toner_pad 분리
4. 민감성/장벽 약함/붉은기 risk_score
5. 사용 빈도 적합성
6. 제형/레이어링 mismatch
7. review_count는 confidence 또는 동점자 판별
8. rating은 낮은 경우 감점 참고, 높은 경우 직접 가산 금지
9. ingredient_raw는 보조 플래그로만 사용
```

추천 예시:

```txt
속건조 + 가벼운 데일리 토너 필요
→ hydrating_toner 우선
→ 패드/산 토너 제외
```

```txt
민감 + 붉은기 + 트러블 후 진정
→ soothing_hydrating_toner 우선
→ 따가움/알러지 negative가 큰 제품 감점
```

```txt
피지 + 모공 + 각질 고민 + 민감성 낮음
→ exfoliating_pore_pad 또는 active_acid_toner를 보조 후보로 허용
→ 사용 빈도는 주 1~3회 또는 부위별로 제한
```

```txt
장벽 약함 + 건성
→ barrier_hydrating_toner 우선
→ active_acid_toner와 자극 negative 큰 패드 제외
```

## 11. 배치 파일 사용 주의

- 배치 파일 안의 `estimated_toner_profile`은 자동 요약용 임시값이다.
- `recommended_usage_frequency`는 리뷰 키워드 기반 추정값이며 확정 처방이 아니다.
- 최종 DB 반영 전에는 코덱스/사람 검토를 거친다.
- raw JSON은 원본 근거로 보존한다.
- `category`가 없던 원본은 배치 wrapper에서 `toner_essence` 또는 `toner_pad`로 보강했다.
- 패드/산 토너는 수분 토너와 같은 점수축에서 비교하지 않는다.
- 매핑 로직이 바뀌면 raw JSON 기준으로 재처리한다.

## 12. 한 줄 결론

토너/패드 리뷰 신호는 제품의 절대 우열을 정하는 데이터가 아니라, **수분·진정·장벽·피부결·각질·피지·모공 목적과 매일 사용 가능성/자극 리스크를 분리하기 위한 신호다.**
