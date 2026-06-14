# Hwahae Serum / Essence / Ampoule Review Signal Batch Notes

## 1. 파일 목적

이 문서는 화해 상품 페이지에서 콘솔 추출기로 수집한 세럼/에센스/앰플 리뷰 신호 JSON 묶음의 사용 규칙과 유의사항을 정리한다.

배치 파일:

```txt
hwahae-serum-essence-ampoule-review-signals.batch.json
```

JSONL 파일:

```txt
hwahae-serum-essence-ampoule-review-signals.batch.jsonl
```

대상 카테고리:

```txt
serum
```

포함 범위:

```txt
세럼 / 에센스 / 앰플
```

총 제품 수:

```txt
9개
```

## 2. 포함 제품 요약

| 제품 | 리뷰 수 | 평점 | confidence | 임시 serum_profile | availability | id placeholder 처리 | 주요 positive | 주요 negative |
|---|---:|---:|---|---|---|---|---|---|
| 미샤 타임 레볼루션 더 퍼스트 에센스 5X | 17 | 4.41 | low | hydrating_serum | unknown | yes | 수분있는, 보습잘되는, 흡수잘되는 | 따가운 |
| 다이브인세럼 | 80,754 | 4.6 | very_high | hydrating_serum | unknown | no | 속건조에효과있는, 가벼운, 트러블안생기는 | 알러지반응오는, 흘러내리는, 지속력안좋은 |
| 마다가스카르 센텔라 앰플 | 451 | 4.53 | medium | soothing_ampoule | unknown | no | 흡수잘되는, 수분있는, 진정되는 | 흘러내리는, 유분있는, 알러지반응오는 |
| 코스알엑스 어드밴스드 스네일 96 뮤신 파워 에센스 | 269 | 4.21 | medium | elasticity_glow | unknown | yes | 수분있는, 흡수잘되는, 보습잘되는 | 미끌거리는, 알러지반응오는, 유분있는 |
| 콩 에센스 | 112 | 4.45 | medium | texture_refining_essence | unknown | no | 자극없는, 각질제거잘되는, 피지없어지는 | 끈적한, 알러지반응오는, 밀림있는 |
| 아토베리어365 하이드로 세라-히얼 앰플 | 475 | 4.48 | medium | barrier_ampoule | unknown | no | 수분있는, 보습잘되는, 흡수잘되는 | 트러블생기는, 알러지반응오는, 따가운 |
| 리쥬란 턴오버 앰플 | 312 | 4.02 | medium | elasticity_glow | unknown_check_needed | no | 흡수잘되는, 쫀득한, 보습잘되는 | 끈적한, 밀림있는, 트러블생기는 |
| 나이아신아마이드 20% 세럼 | 314 | 4.46 | medium | brightening_active | unknown | no | 흡수잘되는, 자극없는, 피지없어지는 | 따가운, 잘굳는, 보습안되는 |
| 피디알엔 히알루론산 캡슐 100 세럼 | 11,618 | 4.61 | very_high | hydrating_elasticity_serum | unknown | no | 보습잘되는, 속건조에효과있는, 윤기나는 | 흘러내리는, 유분있는, 알러지반응오는 |

## 3. 가장 중요한 운영 원칙

세럼/에센스/앰플 리뷰 신호는 **제품의 절대 우열 점수**가 아니다.

이 카테고리는 수분, 진정, 장벽, 피부결, 피지/모공, 미백, 탄력, 윤기처럼 제품 목적이 강하게 갈린다. 따라서 리뷰 키워드는 아래 용도로만 사용한다.

```txt
1. serum_profile 추정
2. 사용자 핵심 고민별 후보 분리
3. 고기능 성분 제품의 자극/트러블 리스크 감지
4. 레이어링/밀림/겉돎 리스크 감지
5. 결과 설명 문구 보강
6. 동점자 판별 또는 confidence 표시
7. availability 확인 필요 제품 표시
```

금지:

```txt
review_count를 Top Pick 점수에 직접 크게 반영하지 말 것
다이브인처럼 리뷰가 많은 수분 세럼이 모든 케이스를 이기게 만들지 말 것
rating 고점을 고품질 확정 신호로 쓰지 말 것
negative count를 절대값만 보고 일괄 감점하지 말 것
기능형 active 제품을 범용 수분 세럼과 같은 축에서 비교하지 말 것
단종/비활성 가능 제품을 availability 확인 없이 강추천하지 말 것
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
미샤 타임 레볼루션 더 퍼스트 에센스 5X
- review_count: 17
- 해석: 수분/피부결/톤 보조 후보로 볼 수 있으나 표본이 매우 작다. 리뷰 신호를 Top Pick 점수에 직접 반영하지 않는다.
```

```txt
다이브인 세럼
- review_count: 80,754
- 해석: 수분/속건조 세럼으로 검증도는 매우 높다. 단, 수분 목적에 한정해야 하며 미백/피지/탄력 고민까지 무조건 이기게 만들면 안 된다.
```

## 5. productId placeholder 처리 규칙

일부 원본 JSON에는 `productId`가 아래 값으로 남아 있을 수 있다.

```txt
USER_MUST_REPLACE_SUPABASE_PRODUCT_ID
```

이번 배치에서는 파일명 앞 UUID를 기준으로 `productId`를 보강했다.

배치 wrapper에는 아래 필드를 남긴다.

```txt
product_id_was_placeholder: true | false
```

주의:

```txt
product_id_was_placeholder = true인 항목은 import 전에 실제 Supabase products.id와 일치하는지 한 번 더 확인한다.
raw JSON은 배치 내부에서 productId가 보강되어 있지만, 원본 파일 자체의 이력은 문서로 남긴다.
```

## 6. availability 사용 규칙

세럼/에센스/앰플은 화해에서 리뷰가 적거나 비활성/단종처럼 보이는 제품이 있을 수 있다.

배치에서는 확정하지 않고 아래처럼 보수적으로 둔다.

```txt
availability_status: unknown
availability_status: unknown_check_needed
```

특히 아래 제품은 별도 확인이 필요하다.

```txt
리쥬란 턴오버 앰플
```

주의:

```txt
availability_status가 unknown_check_needed인 제품은 판매처/올리브영/공식몰 등에서 현재 판매 상태를 확인하기 전까지 강추천하지 않는다.
```

## 7. 세럼 serum_profile 기준

### hydrating_serum

수분, 속건조, 가벼움, 산뜻함, 유분 없음 신호가 강한 타입.

주요 키워드:

```txt
수분있는
보습잘되는
속건조에효과있는
가벼운
산뜻한
유분없는
끈적하지않은
```

추천 적합:

```txt
속건조
수분 부족
지성/복합성 수분 보강
가벼운 루틴
끈적임 싫어함
```

추천 주의:

```txt
탄력/미백/피지/각질 같은 기능 목적이 주고민인 경우
보습 지속력이 중요한 극건성
```

### soothing_ampoule

진정, 자극 없음, 트러블 완화, 센텔라 계열 신호가 강한 타입.

주요 키워드:

```txt
진정되는
자극없는
트러블없어지는
트러블안생기는
편안해지는
```

추천 적합:

```txt
일시적 민감
붉은기 경향
트러블 후 진정
가벼운 진정 앰플
```

추천 주의:

```txt
진정 외 고기능 효과를 기대하는 경우
보습 지속력이 주목적인 경우
```

### barrier_ampoule

보습, 수분, 장벽, 세라/히얼, 피부강화 신호가 강한 타입.

주요 키워드:

```txt
보습잘되는
수분있는
속건조에효과있는
자극없는
피부강화되는
편안해지는
```

보조 성분 신호:

```txt
functional.skin protection 높음
functional.moisture evaporation blocking 존재
```

추천 적합:

```txt
장벽 약함
속건조
민감 경향
보습 세럼 필요
```

추천 주의:

```txt
트러블생기는
알러지반응오는
따가운
```

### texture_refining_essence

피부결, 각질, 피지, 매끄러움, 모공 신호가 강한 타입.

주요 키워드:

```txt
피부결좋아지는
각질제거잘되는
피지없어지는
모공관리되는
매끄러운
```

추천 적합:

```txt
피부결
각질
피지
모공
화장 들뜸
```

추천 주의:

```txt
민감성
장벽 약함
따가움/알러지/뒤집어짐 신호가 있는 경우
```

### brightening_active

나이아신아마이드, 톤 개선, 미백, 피지/모공 개선 신호가 강한 고기능 타입.

주요 키워드:

```txt
피부톤이개선되는
미백효과가있는
피지없어지는
모공관리되는
```

추천 적합:

```txt
칙칙함
톤 불균일
피지
모공
지성/복합성
```

추천 주의:

```txt
민감성
따가움
트러블생기는
보습안되는
밀림있는
고농도 active에 약한 피부
```

### elasticity_glow

윤기, 탄력, 쫀득함, 피부결, 보습감이 강한 타입.

주요 키워드:

```txt
윤기나는
탄력생기는
쫀득한
피부결좋아지는
보습잘되는
```

추천 적합:

```txt
윤기
탄력
피부결
건조로 인한 푸석함
밤 루틴
```

추천 주의:

```txt
끈적임 싫어함
밀림 민감
트러블 경향
지성/모공 고민
```

### hydrating_elasticity_serum

수분/속건조와 윤기/쫀득함이 같이 잡히는 타입.

주요 키워드:

```txt
보습잘되는
속건조에효과있는
윤기나는
쫀득한
가벼운
끈적하지않은
```

추천 적합:

```txt
속건조
윤기 부족
건조로 인한 탄력 저하
수분감과 광채를 동시에 원하는 사용자
```

추천 주의:

```txt
흘러내림
유분감
눈통증
알러지 신호
```

## 8. negative 키워드 해석 주의

세럼/에센스/앰플에서 negative는 네 종류로 나눈다.

### A. 실제 리스크

```txt
알러지반응오는
가려운
따가운
트러블생기는
뒤집어지는
```

이것은 민감성/붉은기/장벽 약한 사용자에게 강하게 감점한다.

특히 active 계열 제품에서는 count가 아주 크지 않아도 주의한다.

### B. 레이어링/제형 mismatch

```txt
밀림있는
잘굳는
때처럼나오는
겉도는
흘러내리는
미끌거리는
```

이것은 아래 사용자에게 감점한다.

```txt
아침 루틴
메이크업 전 사용
여러 제품을 겹쳐 바르는 사용자
끈적임/밀림에 민감한 사용자
```

### C. 보습 지속력 mismatch

```txt
보습안되는
수분없는
지속력안좋은
속건조에효과없는
```

이것은 속건조/건성/장벽 약한 사용자에게 감점한다.

### D. 고기능 active mismatch

```txt
따가운
잘굳는
보습안되는
트러블생기는
알갱이있는
```

나이아신아마이드 고함량, 턴오버/탄력, 각질/피지 목적 제품에서 특히 주의한다.

## 9. ingredient_raw 사용 규칙

성분 신호는 보조 근거다.

```txt
risk.high > 0
→ 민감성 추천에서 보수적으로 본다.

risk.low 비중이 높고 high = 0
→ irritation_risk low 후보지만, 리뷰 negative 자극 신호와 함께 본다.

functional.skin hydration 높음
→ hydrating_serum / barrier_ampoule 보조 근거.

functional.skin protection 높음
→ barrier_ampoule 보조 근거.

functional.whitening 존재
→ brightening_active / tone support 보조 근거.

functional.wrinkle improvement 존재
→ elasticity_glow 보조 근거.

functional.exfoliation 존재
→ texture_refining_essence 보조 가능. 단 민감성에는 자극 가능성도 같이 본다.
```

주의:

```txt
성분 위험도만으로 sensitivity_safe = true 확정 금지
skin_type 성분 신호만으로 skin_types 확정 금지
기능 성분이 있다고 해당 효과를 강하게 보장하지 말 것
```

## 10. 제품별 1차 해석 메모

### 미샤 타임 레볼루션 더 퍼스트 에센스 5X

- 리뷰 수 17개로 표본이 매우 작다.
- 수분/보습/흡수/피부결/톤 보조 신호가 있으나 confidence는 low.
- productId는 파일명 기준으로 보강했다.
- hydrating_serum 또는 tone_texture_support 후보지만, 추천 점수 반영은 보수적으로.

### 다이브인 세럼

- 속건조/가벼움/트러블 안 생김/산뜻함/유분 없음/밀림 없음 신호가 매우 강하다.
- hydrating_serum 대표 후보.
- 리뷰 수가 매우 많아 confidence는 very_high.
- 단, 수분 목적에 한정해야 하며 모든 세럼 케이스를 이기게 만들면 안 된다.
- 알러지/가려움/흘러내림/지속력 신호는 주의.

### 마다가스카르 센텔라 앰플

- 흡수/수분/진정/가벼움/자극 없음/트러블 완화 신호.
- soothing_ampoule 후보.
- 리뷰 수 451개로 confidence는 medium.
- 흘러내림/유분감 신호는 레이어링에서 주의.

### 코스알엑스 어드밴스드 스네일 96 뮤신 파워 에센스

- 수분/흡수/보습/쫀득함/매끄러움 신호.
- productId는 파일명 기준으로 보강했다.
- elasticity_glow 또는 hydrating_essence 후보.
- 알러지/뒤집어짐/밀림/겉돎 신호는 민감성·레이어링에서 주의.

### 콩 에센스

- 각질/피지/매끄러움/피부결 신호.
- texture_refining_essence 후보.
- 리뷰 수 112개로 confidence는 medium에 가깝지만 낮은 쪽으로 본다.
- 끈적함/밀림/알러지 신호 주의.
- 수분 세럼과 같은 축에서 비교하면 안 된다.

### 아토베리어365 하이드로 세라-히얼 앰플

- 수분/보습/흡수/속건조/자극 없음 신호.
- barrier_ampoule 또는 hydrating_serum 후보.
- 트러블/알러지/따가움 신호가 있어 민감성 최우선 추천은 보수적으로.
- confidence는 medium.

### 리쥬란 턴오버 앰플

- 흡수/쫀득함/보습/윤기/탄력/피부결 신호.
- elasticity_glow 후보.
- 평점 4.02, 끈적함/밀림/트러블/알러지 신호가 강하다.
- availability 확인 필요.
- 추천 후보로 강하게 밀기보다 특정 탄력/윤기 목적에서만 보수적으로 사용한다.

### 나이아신아마이드 20% 세럼

- 피지/모공/피부톤/피부결/미백 신호.
- brightening_active 또는 pore_oil_active 후보.
- 따가움/잘굳음/보습 부족/트러블/밀림 신호가 강하다.
- 민감성/장벽 약한 사용자에게는 강하게 감점한다.
- 범용 수분 세럼으로 쓰면 안 된다.

### 피디알엔 히알루론산 캡슐 100 세럼

- 보습/속건조/윤기/잘 발림/끈적임 적음/가벼움/쫀득함 신호.
- hydrating_elasticity_serum 후보.
- 리뷰 수가 많아 confidence는 very_high.
- 흘러내림/유분감/눈통증/알러지 신호는 주의한다.

## 11. 추천 로직 적용 원칙

Top Pick 산식에서 세럼/에센스/앰플은 아래 우선순위를 따른다.

```txt
1. 사용자 주고민 적합도
2. serum_profile 적합도
3. active 성분/기능 목적 적합도
4. 자극/알러지/트러블 risk_score
5. 레이어링/밀림/겉돎 risk_score
6. availability 확인 상태
7. review_count는 confidence 또는 동점자 판별
8. rating은 낮은 경우 감점 참고, 높은 경우 직접 가산 금지
```

추천 예시:

```txt
속건조 + 가벼운 수분 세럼 필요
→ hydrating_serum 우선
→ 다이브인 세럼 같은 대표 수분형 후보 가능
```

```txt
피지 + 모공 + 톤 고민 + 민감성 낮음
→ brightening_active 또는 texture_refining_essence 후보
→ 나이아신아마이드 20%는 자극 리스크를 강하게 확인
```

```txt
민감 + 붉은기 + 트러블 후 진정
→ soothing_ampoule 우선
→ 센텔라 앰플 같은 진정형 후보
```

```txt
탄력 + 윤기 + 밤 루틴
→ elasticity_glow 또는 hydrating_elasticity_serum 후보
→ 밀림/끈적임/트러블 negative가 강한 제품은 보수적으로
```

```txt
단종/비활성 의심 제품
→ availability 확인 전까지 강추천 금지
```

## 12. 배치 파일 사용 주의

- 배치 파일 안의 `estimated_serum_profile`은 자동 요약용 임시값이다.
- 최종 DB 반영 전에는 코덱스/사람 검토를 거친다.
- raw JSON은 원본 근거로 보존한다.
- `category`가 없던 원본은 배치 wrapper에서 `serum`으로 보강했다.
- productId placeholder는 파일명 UUID 기준으로 보강했다.
- availability_status는 확정값이 아니라 확인 필요 신호다.
- 매핑 로직이 바뀌면 raw JSON 기준으로 재처리한다.

## 13. 한 줄 결론

세럼/에센스/앰플 리뷰 신호는 제품의 절대 우열을 정하는 데이터가 아니라, **수분·진정·장벽·피부결·피지/모공·미백·탄력·윤기 목적과 자극/레이어링 리스크를 분리하기 위한 신호다.**
