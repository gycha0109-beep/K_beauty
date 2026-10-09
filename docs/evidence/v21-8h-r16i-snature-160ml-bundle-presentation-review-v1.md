# R16I — 에스네이처 수분크림 160ml 카탈로그 범위 재검증

**판정: `R16I_BUNDLE_PRESENTATION_MISMATCH_CONFIRMED_REVIEW_REQUIRED_HOLD`**

2026-10-10, R16H-R4의 에스네이처 젤크림 80·90ml 제조사 확인 대기 때문에 해당 Subject 검증을 진행할 수 없으므로 R16B의 **다른 독립적 HOLD**인 아쿠아 스쿠알란 수분크림 160ml 행을 웹 공개자료로 추가 조사했다. 기존 R16B HOLD를 자동 해제하지 않으며, PR/문서 수준에서만 진단한다.

## 검토 대상·출처

| 구분 | 근거 | 관찰된 실물/판매 단위 |
|---|---|---|
| Production catalog, R16B 당시 | `products.id=b639c8b4-6a61-440e-b4db-fac7381593ff` | `catalog_size_ml=160`; 연결 소스 화해 `45194`, Subject 0건 |
| 에스네이처 한국 공식몰 | https://www.snature.kr/product/detail.html?product_no=151 | **아쿠아 스쿠알란 수분크림 80ml**, 공식 상품번호 **151**, 단품 |
| 화해쇼핑, 해당 연결 URL | https://www.hwahae.co.kr/goods/45194 | **[only화해] 아쿠아 스쿠알란 수분크림 80ml 더블+세럼 10ml 세트**; 상품 가격 옆 **160ml** 표기 |

`80ml × 2 = 160ml`은 판매 제목의 **더블** 및 표기된 크림 총용량과 대응한다. 추가 **세럼 10ml**는 다른 제품이므로 크림 단품 용량에 더할 수 없다. 따라서 **카탈로그 160ml는 160ml 단일 용기의 화장품 포뮬러 식별자가 아니라, 제휴 유통사의 복수 포장 총용량에서 파생됐을 가능성이 높다.**

### 증거 한계

- 공식몰의 80ml **단품 판매는 확인**했다. 공식몰에서 *160ml 단일 용기가 존재하지 않는다*고 단정하지 않는다.
- 화해쇼핑의 **80ml 더블+세럼 10ml 세트** 표기는 명시적으로 확인했으나 실물 박스의 개별 용량/구성 사진 및 공식 제조 로트 고시는 이번 단계에서 별도 확보하지 않았다.
- 이니스프리/젤크림 80ml의 기존 포뮬러 신원을 이 제품에 전이하지 않는다. **아쿠아 스쿠알란 수분크림은 별도의 상품**이다.
- 각 웹 출처의 전체 원본 HTML 바이트는 이번 단계에서 따로 아카이브하지 않았다. **Digest는 null**, 임의 계산 금지.

## 권고되는 모델 분리 — 자동 수정하지 않음

현재 `products.id`가 **상업/추천용 기준점**이며 Product Fact Subject는 **의미상 동일한 제품 처방 세대**라는 PF-1 아키텍처 원칙에 따른다.

| 층위 | 검토해야 할 표현 |
|---|---|
| Product Fact 후보 | 아쿠아 스쿠알란 수분크림의 특정 처방 세대 — 아직 신원 확정 불가 |
| 단품 상업 프레젠테이션 | 브랜드 공식 80ml, 상품번호 #151 |
| 판매 패키지/Offer | 화해 한정 **80ml 크림 더블 + 세럼 10ml** |
| 판매처 합산 크림 용량 | **160ml (80ml × 2)** |
| 현재 카탈로그 160ml 필드 | **단품 크기인지 합산 판매 수량인지 혼재된 값** — 관리자 재검토 대상 |

**자동으로 160ml→80ml로 수정하는 것도 허용하지 않는다.** 현재 Product row가 브랜드 단품을 뜻하는지, 화해 한정 Offer를 뜻하는지 확정된 운영 계약이 없기 때문이다. 연결 URL/리뷰/시장 신호가 화해 패키지 범위에 속하는 경우 80ml 단품 정보에 곧장 결합하면 새 데이터 오염이 발생할 수 있다.

## 단계별 조치와 종료조건

- **A — 패키지 범위 확인:** 공식 80ml 단품과 화해 80ml 더블 기획의 상업적 관계 파악. 이번 단계에서 **근거 충분**.
- **B — 기존 catalog row 단위 확정:** 소유자/관리자 승인으로 행이 *단품 제품*인지 *기획세트 Offer*인지 결정. **미완료**.
- **C — 수정 전 승인 게이트:** 최신 Production `products` 행, `source_binding`, intake prestate를 read-only 점검하고, 영향 범위(추천 링크·리뷰·가격·용량 표기)를 확인. **미완료**.
- **D — 안전한 정정/분리:** 운영자 명시 승인, 독립 검토, 정정 후 정확한 readback이 있어야 함. **미착수**.

이 작업은 공용 카탈로그 용량을 자동 변경하거나 R16B Product Fact Subject HOLD를 해제하는 작업이 아니다. `formulation_revision_key` / `subject_semantic_key`를 생성하지 않으며, Intake·Source Binding·Product Fact·추천·DB 쓰기 0건. 기존 R16B 아누아 HOLD, R16H 젤크림 HOLD, ZEROID HOLD 및 164×12=1,968건 비수치 PDA 불변.

**다음 게이트:** `R16I_R2_REVIEW_BUNDLE_CATALOG_MODEL_AND_APPROVE_NONAUTOMATIC_CORRECTION`

증적: `evidence/product-decision-axis-non-numeric-shadow-v2/barrier-support-p1-r16i-snature-160ml-bundle-boundary-v1.json`
