# Face Lab V2 Visual Try-On v1

> Track: Face Lab / product execution
> Status: implementation foundation
> Goal: 구매 전 참고용 제품·스타일 적용 시뮬레이션
> Production paid image execution: disabled in this phase

## 1. Product decision

Face Lab의 이미지 시뮬레이션 목표는 특정 상업 제품의 실제 발색이나 물리적 결과를 픽셀 단위로 복제하는 것이 아니다.

목표는 다음이다.

> 사용자가 선택하거나 추천받은 뷰티/스타일 제품을 자신의 얼굴에 적용했을 때의 대략적인 시각 결과를, 구매 전 참고용으로 신뢰할 수 있을 정도로 보여준다.

따라서 제품명 자체보다 다음을 렌더 근거로 사용한다.

- 적용 영역
- 색 계열 / 언더톤 / 명도 / 채도
- 투명도 / 발색 강도
- 광택 / 펄 / 블러 / 확산
- 제품/스와치/실사용/착용 참고 이미지
- 카탈로그에서 확인된 제품/variant identity

실제 결과는 피부톤, 조명, 도포량, 촬영 조건, 착용 조건에 따라 달라질 수 있으므로 UI와 결과 계약은 항상 "AI 참고용 미리보기"로 표현한다.

---

## 2. Source of truth

Visual Try-On은 별도의 임의 카테고리 체계를 만들지 않는다.

기존 Face Lab V2의 다음 authority를 재사용한다.

- Appearance Slot registry
- Candidate capability contract
- Product Variant / Shade authority
- Shade semantic attributes
- brand / merchant swatch
- applied reference color anchor
- Render Adapter
- identity lock
- image-edit provider runtime

그리고 Try-On 전용 registry는 다음 연결만 선언한다.

```text
기존 제품/스타일 taxonomy
        ↓
Face Lab Appearance Slot
        ↓
Visual Try-On category
        ↓
default application / rollout stage
```

즉 **기존 taxonomy와 Appearance Slot이 source of truth**이고, Visual Try-On은 이를 렌더링 가능한 구조로 투영한다.

---

## 3. Category → Appearance Slot mapping

### Makeup

| Category | Appearance Slot | Rollout |
|---|---|---|
| Base / complexion | complexion_prepare | P3 |
| Base / complexion | complexion_even | P3 |
| Base / complexion | complexion_correct | P3 |
| Base / complexion | complexion_finish | P3 |
| Blush | cheek_color | P0 |
| Contour / shading | face_shadow | P1 |
| Highlighter | face_highlight | P0 |
| Eye shadow | eye_color | P1 |
| Eyeliner | eye_definition | P1 |
| Mascara / lash | lash_definition | P1 |
| Brow | brow_definition | P1 |
| Lip color | lip_color | P0 |
| Lip finish | lip_finish | P0 |

### Vision / style products

| Category | Appearance Slot | Rollout |
|---|---|---|
| Color lens | iris_appearance | P0 |
| Eyewear | facial_frame | P0 |
| Hair style | hair_shape | P2 |
| Hair color | hair_color | P2 |
| Facial hair | facial_hair_shape | P2 |
| Face-adjacent accessory | face_accessory | P2 |

P0/P1/P2/P3는 **최종 지원 범위 제한이 아니라 검증/출시 순서**다.

Authority는 registry에 `supportState=supported`로 등록된 slot을 모두 처리할 수 있어야 하며, rollout stage는 UI 노출과 provider calibration 순서를 관리하기 위한 metadata다.

`overall_palette`는 직접 제품 착용 영역이 아니라 Look Composer의 색 방향이므로 Visual Try-On direct product binding에서 제외한다.

---

## 4. Current total supported slot contract

현재 registry-driven authority는 다음 19개 Appearance Slot을 제품/스타일 selection으로 받을 수 있다.

```text
complexion_prepare
complexion_even
complexion_correct
complexion_finish

cheek_color
face_shadow
face_highlight

eye_color
eye_definition
lash_definition
brow_definition

lip_color
lip_finish

iris_appearance
facial_frame

hair_shape
hair_color
facial_hair_shape
face_accessory
```

즉 Visual Try-On을 립/하이라이터/렌즈 전용으로 만들지 않는다.

그 셋은 초기 수동 실험에서 성공한 첫 canary 조합일 뿐이다.

---

## 5. Planned extension beyond current Appearance Slot registry

다음은 제품 방향상 필요하지만 현재 Appearance Slot에 별도 direct slot이 없는 영역이다.

- 의류 상의 색 / 퍼스널컬러 착장
- neckline / clothing silhouette
- 모자 / headwear를 face_accessory보다 더 명확히 분리하는 경우
- 귀걸이/목걸이 등 액세서리 세분화

이 영역은 기존 slot 의미를 억지로 오염시키지 않는다.

필요 시 별도 Appearance Slot을 추가한 뒤 Visual Try-On registry에 연결한다.

---

## 6. Responsibility boundary

### Style Advisor

- 현재 얼굴 이해
- 추구미
- Style Delta
- Route
- 제품/행동 추천

### Visual Try-On

- 사용자가 선택한 제품/variant/style reference를 특정 시각 영역에 적용
- 선택되지 않은 영역 유지
- 여러 제품을 하나의 look으로 합성
- reference asset을 provider 입력 근거로 전달
- 결과를 참고용 이미지로 반환

Visual Try-On은 추천 점수를 다시 계산하지 않는다.

---

## 7. Direct user selection + recommendation selection

두 진입점을 모두 허용한다.

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

추천받지 않은 제품도 사용자가 직접 선택해서 적용할 수 있다.

---

## 8. Product Render Profile

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
- `style_reference`
- `wearing_reference`

Reference asset은 제품 identity 또는 render guidance의 근거이며, 그 자체가 "실제 사용자에게 동일하게 발색/착용된다"는 보증은 아니다.

---

## 9. Render contract

한 Try-On session은 slot별 선택을 합쳐 하나의 Render Spec을 만든다.

예:

```text
complexion_even
  -> satin base

eye_color
  -> taupe eye shadow

eye_definition
  -> brown-black liner

brow_definition
  -> ash-brown brow

lip_color
  -> coral-orange tint

iris_appearance
  -> gray contact lens

facial_frame
  -> thin gray eyewear

hair_shape
  -> soft layer reference

face_accessory
  -> silver accessory
```

Render Adapter가 담당하는 것:

- 수정 가능 영역 확정
- product-bound operation 생성
- identity lock 유지
- semantic color authority 유지

Try-On Authority가 담당하는 것:

- user-selected slot binding
- duplicate slot 차단
- registry support 확인
- reference asset 목록
- session/look identity
- rollout metadata 보존

---

## 10. Identity / edit-scope rule

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

헤어스타일의 경우 identity/head pose를 유지하되 hair region만 변경한다.

베이스 메이크업은 피부 surface 표현만 변경하고 얼굴 구조 자체를 바꾸지 않는다.

---

## 11. Provider reference-image requirement

수동 ChatGPT 실험에서 의미 있는 결과가 나온 핵심 조건은 source face와 제품 참고 이미지가 함께 제공된 것이다.

따라서 production Visual Try-On은 최종적으로 다음 입력 형태를 목표로 한다.

```text
image[0] = user source portrait
image[1..N] = governed product/swatch/applied/style/wearing references
prompt = render spec + slot/reference mapping + identity/edit-scope rules
```

Reference는 반드시 slot과 묶인다.

예:

```text
reference A -> lip_color
reference B -> face_highlight
reference C -> iris_appearance
reference D -> facial_frame
reference E -> hair_shape
```

현재 provider runtime은 source portrait 1장만 전송한다.

다음 단계에서 multi-reference input을 별도 검증 후 추가한다.

필수 guard:

- reference image byte 총량 제한
- 허용 MIME 제한
- provider call 전에 asset identity/hash 기록
- reference 순서와 slot mapping 결정적 유지
- retry에서도 같은 ordering 유지
- 로그에 이미지 bytes/base64 금지
- URL 직접 fetch 금지 또는 별도 governed fetch 계층 사용

---

## 12. Cost boundary

이 foundation 단계는 provider를 호출하지 않는다.

유료 이미지 실행은 다음 조건을 만족한 뒤 별도 canary에서만 수행한다.

1. Try-On registry verifier PASS
2. Render Spec verifier PASS
3. reference asset ordering verifier PASS
4. multi-reference provider request verifier PASS
5. paid call count hard cap = 1
6. human review 후에만 확대

기존 G-E3 24장 스타일 calibration은 추가 유료 실행하지 않는다.

필요한 연구 자산은 보존하되, 제품/스타일 적용 Try-On 검증을 우선한다.

---

## 13. UX contract

제품 카드:

```text
[제품 정보]
[내 얼굴에 적용]
```

결과:

```text
BEFORE | AFTER

적용:
- base ...
- eye ...
- lip ...
- lens ...
- eyewear ...
- hair ...

AI로 생성된 참고용 이미지입니다.
실제 색상/발색/핏은 조명, 피부톤, 도포량, 착용 조건에 따라 달라질 수 있습니다.
```

향후 "가상 화장대 / 가상 스타일 피팅"에서 여러 제품을 선택하고 한 번에 적용할 수 있다.

---

## 14. Implementation sequence

### Foundation — registry-driven authority

- Visual Try-On category registry
- 기존 Appearance Slot 재사용
- hard-coded P0 allowlist 제거
- direct product/style binding -> Render Spec
- reference asset descriptor
- fail-closed validation
- zero provider call verifier

### Provider adapter — multi-reference

- multiple image input 지원
- source portrait와 reference image 역할 고정
- slot/reference mapping
- input size / count / MIME guard
- retry에서도 동일 image ordering 유지
- provider request unit verifier

### One-image canary

첫 canary는 수동 실험과 동일한 가시성 높은 조합을 우선한다.

```text
coral/orange lip
+ lavender/purple highlighter
+ gray lens
```

이 조합은 **최종 제품 범위가 아니라 provider 경로 검증 fixture**다.

목표:

- identity preservation
- selected-region adherence
- multi-product coexistence
- reference usefulness

신규 유료 output 최대 1장.

내부 Canary 성공 결과는 제품 적용 경로의 기준점으로 고정한다. 별도 승인 없이 추가 이미지 생성·품질 실험을 진행하지 않으며, 이후 카테고리 확장은 코드·계약·모킹/무료 CI 중심으로 검증한다.

### Product/UI wiring

- 추천 제품 카드 -> 내 얼굴에 적용
- 제품 검색 -> 내 얼굴에 적용
- Before/After
- AI 참고용 disclaimer
- saved look / re-entry
- 가상 화장대 / 스타일 조합

---

## 15. Non-goals

v1에서 보증하지 않는다.

- 특정 제품의 픽셀 단위 발색 복제
- 실제 지속력
- 실제 착색/묻어남
- 실제 산화
- 피부 개선 효능
- 렌즈의 실제 착용감/안전성
- 안경의 실제 치수 기반 광학 fitting
- 의류의 실제 사이즈 fitting

Visual Try-On은 구매 전 시각 참고 도구다.

---

## 16. Product-driven catalog binding — P1-A

Implementation: `lib/face-lab-v2/catalog-product-try-on-binding.js`

독립된 첫 단계에서는 실시간 DB 조회·UI·새 테이블을 추가하지 않는다. 이미 신뢰할 수 있는 서버 측 catalog read bundle만 Try-On selection으로 연결한다.

선택 입력은 현행 DB 구조에 맞춘다.

- `public.products.id`: Product ID (UUID)
- `public.product_fact_subjects.subject_id/product_id/variant_key/identity_status/current_state`: 정확한 variant identity
- `public.catalog_taxonomy_versions`: canonical active version
- `public.catalog_taxonomy_terms`: active category term
- `public.product_catalog_taxonomy_assignments`: canonical assignment
- `categoryBinding`: 운영자가 별도로 승인한 taxonomy term → 기존 Visual Try-On category mapping과 증거
- `Face Lab Product Variant Authority` 자료: 동일 Product/variant, source subject provenance, shade facts 및 capability claims

기존 `visual-try-on-registry.js`와 Appearance Slot을 그대로 사용한다. 카테고리명/상품명/쇼핑 설명으로 slot을 추측하지 않으며 다른 product/subject/shade의 binding을 섞지 않는다. `identity_only`이면 참고 이미지가 전혀 없는 제품은 차단한다.

실제 taxonomy가 shadow-only이거나 상품 fact/variant 근거가 미확정이면 `invalid`로 차단한다. 이 경우 제품 도메인 쪽에서 적법한 canonical 읽기 권한을 준비하기 전까지 Try-On 제품으로 자동 노출하지 않는다.

최종 출력: `catalog provenance + governed Try-On selection + 기존 render spec`, 모델 호출 0회.

무료 검증: `npm run verify:face-lab-v2-catalog-product-try-on-binding`

다음 독립 단위: 실제 server read authority 및 product reference asset resolver를 기존 인증/접근 제약 아래에서 별도로 연결한다.
