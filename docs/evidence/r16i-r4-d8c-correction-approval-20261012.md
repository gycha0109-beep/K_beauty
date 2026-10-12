# R16I-R4-D8C — 근거 판정 및 정정안 승인 운영 기능 (2026-10-12)

## 목적
D8-A 실조회와 D8-B 비공개 캡처 제출 다음으로 **소유자 판정 → 필드별 정정안 작성 → 소유자 승인·보류·반려** 이력을 저장합니다. Product, Offer, Fact Subject, 리뷰, 추천 및 랭킹의 실제 적용은 이 단계에서 **불가**합니다.

## 운영 동선
1. `/admin/products/r16i-correction-review`에서 먼저 저장된 캡처를 확인.
2. 관리자 owner가 D8-B 비공개 signed 캡처를 실제로 열어 보고, 출처·선택 옵션·가격 검증 범위를 12자 이상 서술하여 `VERIFIED` 또는 `REJECTED` 판정. 단순 업로드는 자동 승인 안 됨. 판정은 불변 1건, 중복 차단.
3. `admin.products.review` 운영자가 VERIFIED 근거를 1건 이상 선택하고 필요한 필드별 before/after를 작성하여 immutable 정정안을 등록. `products.size_ml`, `price_min`, `price_max`, `unit_price_per_10ml`, `buy_link`만 후속 D8-D 후보로 허용하며, 실제 Offer 신규 등록·Subject 생성은 여기서 하지 않음.
4. owner가 `APPROVE_FOR_D8D_REVIEW`, `HOLD`, `REJECT` 중 하나를 이유와 함께 결정. 결정은 정정안당 불변 1회. APPROVE는 D8-D 운영 적용 **권한이 아님**.
5. 승인 RPC가 상품 updated_at을 `FOR UPDATE`로 잠그고, 정정안 리비전 일치·공식몰 및 화해 양측의 개별 VERIFIED 근거·동일 원본 중복/Offer/Subject 충돌 및 관리자 owner 회원 자격을 확인. 실패 시 decision INSERT 자체를 중단.
6. D4의 정체성/Source Binding/Offer collision 검사도 요청 시작 전에 다시 실행.

## 데이터 구조
- `admin_product_correction_evidence_verdicts_v1`: D8-B `evidence_id`당 1개 판정, 별도 append-only. 원본 `evidence_state=UNVERIFIED` 값은 불변이므로 원본 캡처와 판정 레이어 분리.
- `admin_product_correction_proposals_v1`: frozen D4 prestate digest + 리비전 + field_changes JSON + 검증된 증빙 UUID + 작성자 + 이유.
- `admin_product_correction_decisions_v1`: 정정안당 최종 결정 1개; `decide_r16i_product_correction_v1` RPC 단일 승인 경로.
- 테이블 전부 RLS ON + 공개 권한 해제, service-role-only. DB 함수 `SECURITY INVOKER`, `search_path=''`, PUBLIC/anon/authenticated EXECUTE 제거.

## 실패 보호
- 캡처 0건, VERIFIED 0건, owner 미권한, before 값 위조, 임의 필드 주입, 증빙 다른 상품 귀속, UUID 중복, 현재 Product 리비전 변경, Offer/Subject 신규 충돌 모두 FAIL CLOSED.
- 실제 데이터 반영 API/SQL은 전혀 없음. 아직 SKU/결제 직전 가격/리뷰 모집단 확정이 불가능하면 HOLD/REJECT를 이용. 연구용 검색 색인 금액으로 승인 금지.
- D8-B 캡처 업로드 성공과 VERIFIED 판정은 별개. Verified는 검토자의 특정 범위 확인 기록이지 자동 공식 사실 인증이 아님.
- 기존 공급망 취약점 #1208은 별도 미해결.

## 검증/출시 체크
- CI: 기존 consolidated verifier에 D8C 부정 사례 20종, owner-only API, 정정안 whitelist, optimistic revision and DB guard, catalog writes 0 검사 포함.
- DB migration 적용 후 RLS·grant·RPC 권한·빈 테이블 / 정정안·승인 악성 입력 거부 확인.
- 운영 시 D8-B 캡처 0건이면 버튼이 비활성 상태여야 정상. 현재 Production 기존 증빙 상태는 2026-10-12 조회 당시 0건.

## 다음 단계 D8-D
전용 승인된 field set을 기반으로 apply 시점 최신값 재검증, 동일 트랜잭션 Product/Offer 일관성, 롤백, 후속 추천·구매링크 회귀. **D8-C 승인만으로 Production 수정 허용하지 않음.**

Watchtower-Track: taxonomy-ai
