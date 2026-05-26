# Hwahae Moisturizer Review Signal Batch Notes

## 1. 파일 목적

이 문서는 화해 상품 페이지에서 콘솔 추출기로 수집한 모이스처라이저 리뷰 신호 JSON 묶음의 사용 규칙과 유의사항을 정리한다.

배치 파일:

```txt
hwahae-moisturizer-review-signals.batch.json
```

JSONL 파일:

```txt
hwahae-moisturizer-review-signals.batch.jsonl
```

대상 카테고리:

```txt
moisturizer
```

포함 범위:

```txt
크림 / 로션 / 에멀전 / 수딩크림
```

총 제품 수:

```txt
9개
```

## 2. 포함 제품 요약

| 제품 | 리뷰 수 | 평점 | confidence | 임시 moisture_profile | 주요 positive | 주요 negative |
|---|---:|---:|---|---|---|---|
| 아토베리어365 하이드로 수딩크림 | 2,817 | 4.53 | high | soothing_gel | 가벼운, 흡수잘되는, 자극없는 | 알러지반응오는, 모공관리안되는, 유수분밸런스가맞지않는 |
| 1025 독도 로션 | 26,850 | 4.31 | very_high | light_hydrating | 잘발리는, 흡수잘되는, 가벼운 | 유분있는, 알러지반응오는, 따가운 |
| 아토베리어365로션 | 2,488 | 4.67 | high | barrier_moisturizing | 보습잘되는, 수분있는, 자극없는 | 유분있는, 알러지반응오는, 가려운 |
| 세라마이드 아토 로션 | 2,016 | 4.79 | high | barrier_moisturizing | 보습잘되는, 수분있는, 잘발리는 | 유분있는, 미끌거리는, 답답한 |
| 세라마이드 아토 집중크림 | 52 | 4.33 | low | rich_occlusive | 보습잘되는, 수분있는, 리치한 | 유분있는, 트러블생기는, 인공향나는 |
| 레드 블레미쉬 클리어 수딩 크림 EX | 298 | 4.71 | medium | soothing_gel | 수분있는, 잘발리는, 흡수잘되는 | 유수분밸런스가맞지않는, 알러지반응오는, 미끌거리는 |
| 순정 10무 수분 에멀전 | 106 | 4.41 | medium | barrier_moisturizing | 자극없는, 보습잘되는, 수분있는 | 유분있는, 알러지반응오는, 답답한 |
| 다이브인 저분자 히알루론산 수딩 크림 | 25,605 | 4.68 | very_high | soothing_gel | 가벼운, 자극없는, 끈적하지않은 | 지속력안좋은, 알러지반응오는, 유수분밸런스가맞지않는 |
| DMT 페이셜 로션 | 13,078 | 4.15 | very_high | barrier_moisturizing | 보습잘되는, 자극없는, 잘발리는 | 유분있는, 알러지반응오는, 향이아쉬운 |

## 3. 가장 중요한 운영 원칙

모이스처라이저 리뷰 신호는 **좋고 나쁨의 절대 점수**가 아니다.

모이스처라이저는 같은 보습 제품이라도 수분감, 유분감, 장벽감, 리치함, 산뜻함, 밀림, 지속력, 민감 반응이 서로 다르다. 따라서 리뷰 키워드는 아래 용도로만 사용한다.

```txt
1. moisture_profile 추정
2. 사용자 조건별 적합/부적합 신호 분리
3. 유분감/답답함/밀림 리스크 감지
4. 자극/알러지/가려움 리스크 감지
5. 결과 설명 문구 보강
6. 동점자 판별 또는 confidence 표시
```

금지:

```txt
review_count를 Top Pick 점수에 직접 크게 반영하지 말 것
rating 5.0 또는 고평점을 고품질 확정 신호로 쓰지 말 것
negative count를 절대값만 보고 일괄 감점하지 말 것
보습잘되는을 모든 사용자에게 장점으로 처리하지 말 것
유분있는/답답한을 모든 사용자에게 단점으로 처리하지 말 것
가벼운/산뜻한을 건성·장벽 약한 사용자에게 무조건 장점으로 처리하지 말 것
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
세라마이드 아토 집중크림
- review_count: 52
- 해석: 리치/고보습 후보로 볼 수 있지만 표본이 작다. Top Pick에서 강하게 밀기보다 low confidence 후보로 둔다.
```

```txt
1025 독도 로션
- review_count: 26,850
- 해석: 대중 검증도는 높지만 유분/따가움/알러지/겉돎 신호가 강하다. 지성·민감성 사용자에게 무조건 안정적이라고 보면 안 된다.
```

## 5. 모이스처라이저 moisture_profile 기준

### light_hydrating

가벼운 수분감, 빠른 흡수, 산뜻함, 끈적임 적음, 유분 적음이 강한 타입.

주요 키워드:

```txt
가벼운
흡수잘되는
끈적하지않은
유분없는
산뜻한
속건조에효과있는
```

추천 적합:

```txt
지성
복합성
속건조
답답함 싫어함
끈적임 싫어함
여름/낮 루틴
```

추천 주의:

```txt
극건성
장벽 약함
고보습 마무리 필요
보습 지속력 중요
```

### barrier_moisturizing

보습, 수분, 피부강화, 장벽 보호, 수분 증발 차단 신호가 강한 타입.

주요 키워드:

```txt
보습잘되는
수분있는
자극없는
편안해지는
피부강화되는
```

보조 성분 신호:

```txt
functional.skin protection 높음
functional.moisture evaporation blocking 높음
```

추천 적합:

```txt
건성
속건조
장벽 약함
민감 경향
수분 유지가 필요한 사용자
```

추천 주의:

```txt
지성
유분감 싫어함
답답함 싫어함
메이크업 밀림에 민감함
```

### rich_occlusive

리치함, 쫀득함, 유분감, 고보습 마무리 신호가 있는 타입.

주요 키워드:

```txt
리치한
쫀득한
보습잘되는
유분있는
가볍지않은
끈적한
```

추천 적합:

```txt
건성
극건성
밤 루틴
겨울철 보습
마무리 보습막 필요
```

추천 부적합:

```txt
지성
여드름/모공 고민
답답함 싫어함
산뜻한 마무리 선호
메이크업 전 사용
```

### soothing_gel

진정, 쿨링, 가벼움, 수분감이 함께 잡히는 타입.

주요 키워드:

```txt
진정되는
쿨링되는
자극없는
가벼운
산뜻한
끈적하지않은
```

추천 적합:

```txt
열감
일시적 민감
붉은기 경향
가벼운 수분 진정
```

추천 주의:

```txt
장벽 보강이 필요한 극건성
보습 지속력이 중요한 사용자
```

## 6. negative 키워드 해석 주의

모이스처라이저에서 negative는 세 종류로 나눈다.

### A. 사용감/피부타입 mismatch

```txt
유분있는
답답한
미끌거리는
겉도는
리치한
끈적한
가볍지않은
```

이것은 모든 사용자에게 단점이 아니다.

- 건성/장벽 약한 사용자에게는 보습막 또는 리치함의 반대급부일 수 있다.
- 지성/복합성/답답함 싫어하는 사용자에게는 명확한 감점이다.

### B. 레이어링/메이크업 mismatch

```txt
밀림있는
잘굳는
흘러내리는
때처럼나오는
지속력안좋은
겉도는
```

이것은 아래 사용자에게 감점한다.

```txt
아침 루틴
메이크업 전 사용
여러 제품을 겹쳐 바르는 사용자
끈적임/밀림에 민감한 사용자
```

### C. 실제 리스크

```txt
알러지반응오는
가려운
따가운
트러블생기는
뒤집어지는
```

이것은 민감성/붉은기/장벽 약한 사용자에게 강하게 감점한다.

단, review_count가 매우 작고 count가 1~2 수준이면 과대 반영하지 않는다.

## 7. ingredient_raw 사용 규칙

성분 신호는 보조 근거다.

```txt
risk.high > 0
→ 민감성 추천에서 보수적으로 본다.

risk.low 비중이 높고 high = 0
→ irritation_risk low 후보지만, 리뷰 negative 자극 신호와 함께 본다.

functional.skin hydration 높음
→ dehydration / hydrating 계열 보조 근거.

functional.moisture evaporation blocking 높음
→ barrier_moisturizing / rich_occlusive 보조 근거.

functional.skin protection 높음
→ barrier / sensitive support 보조 근거.

functional.soothing/astringent 존재
→ soothing_gel 또는 민감 진정 보조 근거.
```

주의:

```txt
성분 위험도만으로 sensitivity_safe = true 확정 금지
skin_type 성분 신호만으로 skin_types 확정 금지
보습 성분이 많다고 지성 사용자에게 맞는다고 단정 금지
```

## 8. 제품별 1차 해석 메모

### 아토베리어365 하이드로 수딩크림

- 가벼운/흡수/자극 없음/끈적임 적음/유분 없음 신호가 강하다.
- 속건조 수분 보강에는 좋지만, 알러지/가려움 신호가 있어 민감성 최우선 추천은 보수적으로 본다.
- light_hydrating 또는 soothing_gel 후보.

### 1025 독도 로션

- 잘 발림/흡수/가벼움/끈적임 적음 신호가 강한 대중형 로션.
- 유분/알러지/따가움/겉돎/미끌거림이 크게 잡혀 지성·민감성에 무조건 안전하다고 보면 안 된다.
- light_hydrating 후보지만 oil_heaviness와 sensitivity watch 필요.

### 아토베리어365 로션

- 보습/수분/자극 없음/피부강화 신호.
- 성분상 skin protection과 moisture evaporation blocking도 높다.
- barrier_moisturizing 후보.
- 유분/답답함/가려움 신호로 지성·민감성은 보수적으로 본다.

### 세라마이드 아토 로션

- 보습/수분/잘 발림/흡수/끈적임 적음 신호.
- skin protection과 moisture evaporation blocking이 높아 장벽 보습형 후보.
- 유분/미끌거림/답답함 신호로 지성에게는 감점 가능.

### 세라마이드 아토 집중크림

- 보습/수분/리치함/쫀득함 신호가 있다.
- 리뷰 수가 52개로 표본이 작다.
- rich_occlusive 후보지만 confidence는 low.
- 유분/트러블/끈적함 신호를 주의한다.

### 레드 블레미쉬 클리어 수딩 크림 EX

- 수분/진정/흡수/가벼움/끈적임 적음/산뜻함 신호.
- negative count가 작아 큰 감점보다는 참고 수준.
- soothing_gel 또는 light_hydrating 후보.
- 리뷰 수 298개로 confidence는 medium.

### 순정 10무 수분 에멀전

- 자극 없음/보습/수분/가벼움/트러블 안 생김 신호.
- 리뷰 수 106개로 표본이 크지 않다.
- barrier_moisturizing 또는 light_hydrating 후보.
- 유분/알러지/답답함 신호는 보수적으로 확인.

### 다이브인 저분자 히알루론산 수딩 크림

- 가벼움/자극 없음/끈적임 적음/유분 없음/산뜻함/속건조/쿨링 신호가 매우 강하다.
- light_hydrating 또는 soothing_gel 대표 후보.
- 지속력/겉돎/잘굳음/미끌거림 신호가 있어 보습 지속력이나 레이어링에는 주의.

### DMT 페이셜 로션

- 보습/자극 없음/잘 발림/흡수/트러블 안 생김 신호가 강하다.
- 유분/알러지/향/겉돎/답답함/밀림 신호도 강하다.
- barrier_moisturizing 후보지만 지성·메이크업 전 사용에는 감점 가능.
- 리뷰 수는 충분하지만 평점이 낮아 사용감 호불호를 결과 설명에 반영한다.

## 9. 추천 로직 적용 원칙

Top Pick 산식에서 모이스처라이저는 아래 우선순위를 따른다.

```txt
1. 사용자 피부타입/주고민 적합도
2. moisture_profile 적합도
3. 유분감/답답함/밀림 risk_score
4. 자극/알러지/가려움 risk_score
5. 사용 목적: 낮/밤, 메이크업 전, 속건조, 장벽 보강
6. review_count는 confidence 또는 동점자 판별
7. rating은 낮은 경우 감점 참고, 높은 경우 직접 가산 금지
```

추천 예시:

```txt
지성 + 속건조 + 끈적임 싫음
→ light_hydrating 또는 soothing_gel 우선
→ rich_occlusive 강한 감점
```

```txt
건성 + 장벽 약함 + 밤 루틴
→ barrier_moisturizing 또는 rich_occlusive 후보
→ 유분감 negative는 무조건 제외가 아니라 설명/주의로 처리
```

```txt
민감성 + 붉은기 + 열감
→ soothing_gel 또는 barrier_moisturizing 중 자극 negative 낮은 제품
```

```txt
메이크업 전 사용 + 밀림 싫음
→ 밀림있는/겉도는/잘굳는/때처럼나오는 negative가 있는 제품 감점
```

## 10. 배치 파일 사용 주의

- 배치 파일 안의 `estimated_moisture_profile`은 자동 요약용 임시값이다.
- 최종 DB 반영 전에는 코덱스/사람 검토를 거친다.
- raw JSON은 원본 근거로 보존한다.
- `category`가 없던 원본은 배치 wrapper에서 `moisturizer`로 보강했다.
- 매핑 로직이 바뀌면 raw JSON 기준으로 재처리한다.

## 11. 한 줄 결론

모이스처라이저 리뷰 신호는 제품의 절대 우열을 정하는 데이터가 아니라, **수분감·장벽감·리치함·산뜻함·유분감·밀림·자극 리스크·사용자 취향 적합성**을 분류하기 위한 신호다.
