# R16I-R4-D8D — 트랜잭션 적용·원복 (2026-10-12)

## 목표와 운영 결론
D8C의 `APPROVE_FOR_D8D_REVIEW`로 승인된 **에스네이처 단일 사례**의 Product/Offer를 서로 일관된 값으로 동시에 적용할 수 있는 DB RPC와 원복 경로를 준비합니다. **현재 기본 잠금 ON**, 운영 Product/Offer 수정 시도 0건. 최종 적용 가능 상태는 근거 확보, #1208 공급망 보안 조치, 별도 운영 배포 승인 및 릴리스 잠금 해제에 달립니다.

## 실제 적용의 의미
- `Product` 대표 정보를 제조사 **80ml 단품**으로 한정: `size_ml=80`, `price_min=price_max=실제 공식몰 캡처값`, `unit_price_per_10ml=round(공식몰 가격/8,2)`, `buy_link=공식몰 #151`.
- `Offer`: 별도 `hwahae` #45194 목록을 신설하고 **화해 기획세트 결제 직전 입력값**을 `price_amount`에 저장. `product_scope_state=product_subject_unresolved`, `availability_state=unknown`, `link_health_state=unchecked`. **세트 금액을 80ml 단품으로 복사하지 않음**.
- 기존 리뷰 `market_signals`/Source Binding/Fact Subject/추천/랭킹 값은 변경하지 않음.
- PostgreSQL 함수의 한 트랜잭션에서 prestate lock → 원본 2건 검증 → 변경 필드 제한 → Product UPDATE → Offer INSERT → after readback → 애플리케이션 기록과 이벤트 작성. 중간 실패하면 모두 자동 rollback.
- Product `updated_at`·기존 상품 identity·외부 출처·Binding·Intake·Offer 충돌·두 판매처 VERIFIED 원본·30일 내 캡처·정확한 선택 옵션·두 판매처 결제가격·단위가격 일관성 확인. 하나라도 충족하지 않으면 오류.
- 동일 정정안 또는 활성 제품의 재실행은 차단. 고유 request UUID로 이벤트 추적.
- 원복: 적용 당시 Product의 필드와 `updated_at`, 생성된 Offer ID와 가격/출처 일치를 검증하고, Offer 삭제와 Product 값 복원/원복 감사 이벤트를 한 트랜잭션에서 처리. 후속 수정이 있으면 원복 **거부**. 원복 후 제품 데이터는 이전 값으로 돌아오지만, 리비전은 새 시각이므로 D4 frozen snapshot/다음 승인 플로우 **재기준화 필요**.

## 두 겹 이상의 안전 잠금
1. `admin.products.review` + **owner 역할** 검증.
2. 서버 환경변수 `BEJEWELY_R16I_D8D_APPLY_ENABLED=true` (없으면 APPLY 423).
3. DB 전용 `admin_r16i_correction_release_gate_v1.enabled` (마이그레이션 기본 false, 서비스 API에서 수정 불가).
4. 승인된 정정안 + fresh D4 이전값 + 양쪽 VERIFIED 증빙 + 80ml 단품 가격/세트 Offer 분리 일관성 검사.
5. 수동 확인 문자열 “실제 DB 반영”; 원복은 “원복 실행”.

DB release gate 해제는 신뢰된 운영 change control에서 보안 #1208 해소 및 검증 증빙을 확인한 이후에만 별도로 허용. **이번 PR은 릴리스 잠금을 해제하지 않음.**

## 제공 API/UI
- GET `/api/admin/products/r16i-correction-review/apply`: owner만 DB release gate/서버 잠금/적용 이벤트 조회. D4 snapshot이 적용 이후 바뀌어도 적용 이력은 지속 조회 가능.
- POST 동일 엔드포인트, `PREVIEW/APPLY/ROLLBACK`: 동일 출처 JSON·최대 2KB, exact payload, requestId UUID 및 운영자 명시 확인.
- 관리 UI: 승인안 선택 → 검증된 변경 전후/Offer 미리보기 → 두 잠금 해제 확인 후 적용 버튼 → 적용 및 원복 이력.
- `PREVIEW`는 DB에서 검증하고 **쓰기 0건**, 기본 잠금 상태에서도 조회 가능.

## 격리 테스트
새 GitHub workflow 없음. 기존 `database-integration.yml`의 PostgreSQL 17 컨테이너에 별도 임시 DB `taxonomy_r16i_d8d`를 만들고 테스트.
- 가짜 가격(24000원 공식몰 / 29900원 기획세트)은 테스트 전용 **합성 데이터**.
- PREVIEW 쓰기 0, owner 아닌 호출 거부, 두 release gate 거부, 중간 Offer 실패 injection 시 Product/Offer/감사 0건, 성공 시 원자적 Product+Offer+event, 재적용 거부, Product drift 시 원복 거부, 이전값 원복과 이벤트 2건, 중복 원복 차단, RPC role 권한 확인.

## 배포·종료 조건
**R4-D8D 개발 완료:** PR/격리 PG 테스트/Main Health/Admin build/CodeQL 등 통과, 운영 DB에 D8D schema 적용 및 release gate **disabled** 확인, Vercel 적용 이력 페이지 정상.
**실제 제품 정정 완료:** 증빙 VERIFIED 2건 + 정정안 승인 + 공급망 보안 장애 제거 + 운영 승인 + 두 release gate 명시 해제 + apply readback + D8E 추천 164×12 회귀. 해당 조건을 이행하지 않은 상태에서 ‘실제 상품 갱신 완료’로 보고 금지.

Watchtower-Track: taxonomy-ai
