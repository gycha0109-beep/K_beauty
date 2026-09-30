# DATA-AI29C-D1B — Fail-closed Sunscreen Semantic Projection Policy

## 왜 D1의 12/12 established 규칙을 그대로 쓰지 않는가

D1 리뷰 결과에서 일부 필드는 공식 설명과 사용자 리뷰가 충돌하거나,
리뷰 데이터만으로 절대적인 제품 속성으로 확정할 수 없습니다.

대표적으로:

- `sensitivity_safe`
- `irritation_risk`
- `white_cast`
- `pilling_risk`

이 값을 admission을 위해 억지로 하나의 enum/boolean으로 확정하면
`missing != false` 원칙을 깨고 추천 왜곡을 만들 수 있습니다.

D1B는 raw semantic bundle을 수정하지 않습니다.
대신 **review-complete envelope**와 **query-context scoring eligibility**를 분리합니다.

## Product-level semantic envelope

D2 initial admission 심사로 넘어가기 위한 D1B envelope 조건:

1. exact current Subject
2. semantic bundle contract v1
3. 12개 필드 전부 사람이/관리자 경로로 review됨
4. `not_reviewed = 0`
5. `category_slot = sunscreen` established
6. `uv_filter_type` established + governed Product Fact authority

즉 conflict/reviewed_not_established가 존재해도 그 불확실성이 명시적으로
review되어 있다면 envelope 자체는 ready가 될 수 있습니다.

이것은 **scoring 가능**이나 **추천 적합**을 의미하지 않습니다.

## Projection

scorer에 넘길 수 있는 값은 오직 `established` 값뿐입니다.

- established → runtime projection 가능
- conflict → 값 미투영
- reviewed_not_established → 값 미투영
- not_reviewed → envelope 자체 fail

unknown 값을 `false`, `medium`, `low` 같은 기본값으로 바꾸지 않습니다.

## Contextual fail-closed gates

불확실한 값이 기존 scorer의 penalty/hard-reject를 우회할 수 있는 요청에서는
scoring 전에 제품을 해당 요청에서 차단합니다.

| 사용자 맥락 | 반드시 established여야 하는 필드 |
|---|---|
| 민감성 관련 | sensitivity_safe + irritation_risk |
| 백탁 회피 | white_cast |
| 눈시림 민감 | eye_sting |
| 메이크업 사용 | pilling_risk |
| 톤업 선호/회피가 rank-relevant | tone_up |
| finish가 rank-relevant | finish |
| texture가 rank-relevant | texture |

반대로 `skin_types`, `concerns`처럼 미확정이면 단순히 positive match를 잃는
필드는 값이 없다는 이유만으로 전역 차단하지 않습니다.

## 현재 C6 primary 5

D1A 이후 5종 모두:

- category_slot established
- uv_filter_type = mineral established
- 12/12 fields reviewed
- not_reviewed = 0

따라서 **D1B semantic envelope는 5/5 ready**입니다.

하지만 query-context별 eligibility는 다릅니다.

- neutral protection-only context → 5/5 가능
- sensitivity-relevant → 0/5
- makeup/pilling-relevant → 0/5
- white-cast relevant → 3/5
- eye-sting relevant → 4/5
- tone-up relevant → 4/5
- finish relevant → 1/5
- texture relevant → 2/5

이는 데이터를 억지로 채우지 않고도 기존 scorer의 unknown-value advantage를 막습니다.

## Authority boundary

D1B는 다음을 하지 않습니다.

- Product row mutation
- Recommendation admission grant
- Production ranking 변경
- public activation
- unknown → false 변환
- conflict → 임의 값 선택

다음 단계 D2는 이 envelope-ready 상태를 입력으로
`SUNSCREEN_INITIAL_ADMISSION_GRANT` 정책을 구현합니다.
Grant 이후에도 실제 request scoring은 D1B contextual gate를 통과해야 합니다.
