# Face Lab V2 Visual Try-On v1

> Track: Face Lab / product execution
> Status: implementation foundation
> Goal: 구매 전 참고용 제품 적용 시뮬레이션
> Production paid image execution: disabled in this phase

## 1. Product decision

Face Lab의 이미지 시뮬레이션 목표를 "특정 상업 제품의 물리적 발색을 픽셀 단위로 복제"로 두지 않는다.

목표는 다음이다.

> 사용자가 선택하거나 추천받은 뷰티/스타일 제품을 자신의 얼굴에 적용했을 때의 대략적인 시각 결과를, 구매 전 참고용으로 신뢰할 수 있을 정도로 보여준다.

따라서 제품명 자체보다 다음을 렌더 근거로 사용한다.

- 적용 영역
- 색 계열 / 언더톤 / 명도 / 채도
- 투명도 / 발색 강도
- 광택 / 펄 / 블러 / 확산
- 제품/스와치/실사용 참고 이미지
- 카탈로그에서 확인된 제품/variant identity

실제 결과는 피부톤, 조명, 도포량, 촬영 조건에 따라 달라질 수 있으므로 UI와 결과 계약은 항상 "AI 참고용 미리보기"로 표현한다.

## 2. Existing V2 assets reused

기존 Face Lab V2 자산을 폐기하지 않는다.

이미 존재하는 기반:

- Appearance Slot registry
- Candidate capability contract
- Product Variant / Shade authority
- Shade semantic attributes
- brand / merchant swatch
- applied reference color anchor
- Render Adapter
- identity lock
- image-edit provider runtime

Visual Try-On은 이 위에 직접 제품 선택 경로를 추가한다.

```text
Face Lab recommendation ─┐
                         ├─> Visual Try-On Authority
Product search/selection ─┘
                                  |
                                  v
                         Product-bound Render Spec
                                  |
                                  v
                         Reference-aware image edit
                                  |
                                  v
                         AI 참고용 적용 이미지
```

## 3. Responsibility boundary

### Style Advisor

- 현재 얼굴 이해
- 추구미
- Style Delta
- Route
- 제품/행동 추천

### Visual Try-On

- 사용자가 선택한 제품/variant를 특정 얼굴 영역에 적용
- 선택되지 않은 영역 유지
- 여러 제품을 하나의 look으로 합성
- reference asset을 provider 입력 근거로 전달
- 결과를 참고용 이미지로 반환

Visual Try-On은 추천 점수를 다시 계산하지 않는다.

## 4. P0 scope

첫 구현 범위:

- `lip_color`
- `lip_finish`
- `cheek_color`
- `face_highlight`
- `iris_appearance`
- `facial_frame`

의미:

- 립/틴트/립스틱
- 블러셔
- 하이라이터
- 컬러렌즈
- 안경

P1 이후:

- eye shadow
- eyeliner
- brow
- hair color

P2 이후:

- hair shape
- hat/accessory
- clothing/personal-color visualization

P3 이후:

- cushion/foundation/concealer/contour/sunscreen tone-up

베이스 메이크업은 조명/피부결 영향이 커서 후순위로 둔다.

## 5. Product Render Profile

새로운 거대한 별도 카탈로그를 만들지 않는다.

기존 Product Variant / Shade authority를 기본 source of truth로 사용하고, Try-On 단계에서는 다음 projection만 만든다.

```text
candidate identity
+ attribute snapshot
+ render hints / color anchors
+ application cue
+ reference assets
= Visual Try-On selection
```

Reference asset role:

- `product_image`
- `brand_swatch`
- `merchant_swatch`
- `applied_reference`

Reference asset은 제품 identity 또는 render guidance의 근거이며, 그 자체가 "실제 사용자에게 동일하게 발색된다"는 보증은 아니다.

## 6. Render contract

한 Try-On session은 slot별 선택을 합쳐 하나의 Render Spec을 만든다.

예:

```text
lip_color
  -> coral-orange tint variant

face_highlight
  -> lavender pearl highlighter

iris_appearance
  -> gray contact lens
```

Render Adapter가 담당하는 것:

- 수정 가능 영역 확정
- product-bound operation 생성
- identity lock 유지
- semantic color authority 유지

Try-On Authority가 담당하는 것:

- user-selected slot binding
- duplicate slot 차단
- 허용 P0 slot 차단
- reference asset 목록
- session/look identity

## 7. Identity / edit-scope rule

기본 원칙:

- 같은 사람 유지
- 얼굴 geometry 유지
- head pose 유지
- camera perspective 유지
- expression 유지
- background 유지
- lighting direction 유지
- 선택된 영역만 수정
- 선택되지 않은 스타일 영역 수정 금지

컬러렌즈의 경우 iris appearance만 변경하며 eye anatomy는 변경하지 않는다.

안경의 경우 eyewear region에 product/reference를 적용하되 얼굴 geometry는 변경하지 않는다.

## 8. Provider reference-image requirement

ChatGPT 내 실험에서 의미 있는 결과가 나온 핵심 조건은 source face와 제품 참고 이미지가 함께 제공된 것이다.

따라서 production Visual Try-On은 최종적으로 다음 입력 형태를 목표로 한다.

```text
image[0] = user source portrait
image[1..N] = governed product/swatch/applied references
prompt = render spec + slot/reference mapping + identity/edit-scope rules
```

현재 provider runtime은 source portrait 1장만 전송한다.
따라서 P0 다음 단계에서 multi-reference input을 별도 검증 후 추가한다.

중요:

- reference image byte 총량 제한
- 허용 MIME 제한
- URL 직접 fetch 금지 또는 별도 governed fetch 계층 사용
- provider call 전에 asset identity/hash 기록
- reference 순서와 slot mapping 결정적 유지
- 로그에 이미지 bytes/base64 금지

## 9. Cost boundary

이 foundation 단계는 provider를 호출하지 않는다.

유료 이미지 실행은 다음 조건을 만족한 뒤 별도 canary에서만 수행한다.

1. Try-On Render Spec verifier PASS
2. reference asset ordering verifier PASS
3. multi-reference provider request verifier PASS
4. paid call count hard cap = 1
5. human review 후에만 확대

기존 G-E3 24장 스타일 calibration은 당분간 추가 유료 실행하지 않는다.
필요한 연구 자산은 보존하되, 제품 적용 Try-On 검증을 우선한다.

## 10. UX contract

제품 카드:

```text
[제품 정보]
[내 얼굴에 적용]
```

결과:

```text
BEFORE | AFTER

적용:
- lip ...
- highlight ...
- lens ...

AI로 생성된 참고용 이미지입니다.
실제 색상/발색/핏은 조명, 피부톤, 도포량, 제품 개체 차이에 따라 달라질 수 있습니다.
```

향후 "가상 화장대"에서 여러 제품을 선택하고 한 번에 적용할 수 있다.

## 11. Implementation sequence

### P0-A — authority foundation

- Visual Try-On Authority 추가
- P0 slot allowlist
- direct product binding -> Render Spec
- reference asset descriptor
- fail-closed validation
- zero provider call verifier

### P0-B — reference-aware provider adapter

- multiple image input 지원
- source portrait와 reference image 역할 고정
- input size / count / MIME guard
- retry에서도 동일 image ordering 유지
- provider request unit verifier

### P0-C — one-image canary

테스트 look:

- coral/orange lip
- lavender/purple highlighter
- gray lens

목표:

- identity preservation
- selected-region adherence
- multi-product coexistence
- reference usefulness

신규 유료 output 최대 1장.

### P0-D — product/UI wiring

- 추천 제품 카드 -> 내 얼굴에 적용
- 제품 검색 -> 내 얼굴에 적용
- Before/After
- AI 참고용 disclaimer
- saved look / re-entry

## 12. Non-goals

v1에서 보증하지 않는다.

- 특정 제품의 픽셀 단위 발색 복제
- 실제 지속력
- 실제 착색/묻어남
- 실제 산화
- 피부 개선 효능
- 렌즈의 실제 착용감/안전성
- 안경의 실제 치수 기반 광학 fitting

Visual Try-On은 구매 전 시각 참고 도구다.
