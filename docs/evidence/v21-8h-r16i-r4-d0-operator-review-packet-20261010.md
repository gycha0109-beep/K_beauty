# R16I-R4-D0 — 운영자 검토 패키지 (비승인·무쓰기)

> 구현 대상: R16I-R4 **D0 (결정 자료 준비)**. **D (실제 운영자 승인), E (정정 실행), R5 (추천/링크 반영)**는 구현/승인되지 않음.
> 기존 PR #1214의 A~C(사전상태 및 차단 검증)를 그대로 사용. 별도 CI workflow나 Migration을 만들지 않음.

## 핵심 구분

- **Product:** `b639c8b4-6a61-440e-b4db-fac7381593ff`. 추천/카탈로그의 기존 Product ID를 보존하는 **A안이 우선 설계**.
- **Single Presentation:** 에스네이처 공식몰 #151, **80ml**. 구체적인 현재 구매/회원가격·SKU/바코드·처방은 별도 근거 필요.
- **Retail Offer:** 화해 #45194, 제목상 **크림 80ml×2 + 세럼 10ml**. 별도 가격·프로모션·구성·실물/배송 검증 필요. 세럼은 크림 총 160ml에 포함되지 않음.
- **Product Fact Subject:** 제품의 처방/제조 변경 의미. 단품 용량이나 할인세트 구성만으로 발급하지 않음.
- **기존 레거시:** `products.size_ml=160` / `price_min=price_max=29900` / `unit_price_per_10ml=1868.75` / `buy_link=화해45194`. **29,900원은 단품 80ml 가격으로 재사용 불가**. 80ml만 덮어쓰면 잘못된 10ml당 단가 `3737.5`를 생성할 수 있음.

## D0 출력

`lib/product-offer-r16i-r4-operator-review-packet.mjs`의 `buildR16IR4OperatorReviewPacket(snapshot, composition)`은 A~C의 `evaluateR16IR4Preflight` 결과를 재검증하고 다음 *읽기 전용* 내용만 구성한다.

- 선택된 당시 Product/Binding/Offer/Subject/Intake의 SHA-256(selected JSON state digest): **서명/신규 DB 락 아님**.
- **A/B/C 옵션**과 각 옵션의 미해결 근거 목록. A는 `PREFERRED_DESIGN_ONLY`이며 선택되거나 승인된 상태가 아님.
- `products` 용량/가격/단위가격/구매 링크/출처/리뷰, Binding scope, Intake 상태, Offer/Subject 신규 연결, 추천/랭킹 등 **개별 검토 행**. 기존 값은 참고용 `before`, 신규 `after=null`, `write_authorized=false`를 고정.
- 세트 구성(크림 160ml + 세럼 10ml 별도)과 **현재 가격 `null`**. 최신 가격이나 세럼 SKU 미확인 시 절대 임의 보완하지 않음.
- 미해결 게이트: 원문 근거/실물/정확 가격/리뷰 귀속/제품 계열 소유권/링크 정책/보안 이슈 #1208/164×12 추천 회귀/운영 권한/정확 최신 readback/rollback.
- 실제 승인자 신원·결정·서명·실행/롤백 SQL·락·멱등 키는 전부 **`null`** 또는 `false`. `release_ready=false`.

**엄격 차단:** R4-C 기준 사전상태가 변경됐거나 가짜 `approved_changes`, `operator_approval`, `approval_signature`, `execution_plan`, `write_set`, `approved_after` 같은 값을 스냅샷에 주입하면 D0는 `BLOCKED`와 빈 변경 검토 배열을 반환한다. 패킷은 깊게 불변 처리하지만 원래 SELECT 스냅샷은 변경하거나 freeze하지 않는다.

## 실제 승인 전 필요한 작업

1. 공식 출처의 원문 파일/캡처·표시 옵션/실제 판매구성·세럼 공식명/SKU·현재가·결제/배송 범위 및 원본 해시 확보. 검색 색인만으로 품절 여부나 상품 포뮬러 동일성을 확정하지 않음.
2. 운영 소유자가 **상품 계열(Product) vs 단품(Presentation) vs 기획세트(Offer)** 의미를 결정하고 변경 대상 필드마다 정확한 before→after, 권위 출처, 리뷰/시장 신호·링크 전파 범위를 명시.
3. 사전상태는 **신규 Production SELECT**에서 재확인; 승인 시각의 optimistic condition/동시성 충돌 탐지/트랜잭션·롤백·멱등성/전후 readback을 별도 검증 및 구현.
4. R16I-R3A exact-listing PR #1211과 R16I-R4-A~D0 PR #1214의 실제 병합 상태/최신 main HEAD 확인. 두 PR은 미병합 동안 Production 계약이 아님.
5. 공급망 보안 #1208 해결. [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)은 2026-10-10 조회 기준 upstream 패치가 없으므로 임시 exception 일자 연장이나 위험 누락으로 통과시키지 않음. 별도 node-forge exception도 만료일 2026-10-16이므로 보안 트랙에서 조치 필요.
6. Product Decision Axis **164×12=1,968** 불변성과 추천/구매 링크 read-path를 승인된 실제 변경 후보 기준으로 별도 replay.

## 권한 경계

**A~D0 종료 상태:** `R16I_R4_D0_OPERATOR_REVIEW_PACKET_PREPARED_NO_AUTHORITY`

- Packet 생성 ≠ 운영자 승인.
- 스냅샷 SHA-256 ≠ 감사 가능한 승인 서명 또는 live DB write lock.
- `write_set=null`과 `after=null`은 실행할 값을 확인하지 못했다는 뜻이며 자동 정정 대상이 아니다.
- Product/Offer/Subject/Binding/Intake/Review/Price/Recommendation **Production 쓰기 0**.
- 다른 R16B/R16H/ZEROID HOLD 및 기존 PDA 1,968 결과 불변.
- 보안 검사 FAIL 또는 미확인 항목이 존재하면 **병합·운영 활성화는 별도 게이트**.

연결된 작업: [운영 승인 검토 #1204](https://github.com/gycha0109-beep/K_beauty/issues/1204), [Supply Chain 보안 #1208](https://github.com/gycha0109-beep/K_beauty/issues/1208).

Watchtower-Track: taxonomy-ai
