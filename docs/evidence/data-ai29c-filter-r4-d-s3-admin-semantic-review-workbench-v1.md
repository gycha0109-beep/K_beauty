# DATA-AI29C-FILTER-R4-D-S3 — BUSHMAN 관리자 Semantic Review 실행 경로

## 판정

`S3_AUTHENTICATED_ADMIN_ONE_FIELD_REVIEW_WORKBENCH_IMPLEMENTED_NO_AUTOMATED_PRODUCTION_WRITE`

S2 웹 근거 검토안은 [R4-D-S2 PR #1193](https://github.com/gycha0109-beep/K_beauty/pull/1193)의 동결 자료만을 사용한다. 신규 DB migration이나 관리자 임의 권한 부여 없음.

## Production에서 읽기 전용으로 확인된 실제 조건 (2026-10-09)

- 제품 Product ID `4608b3b4-8b51-4464-b46e-380b05c1a3d7`, Subject ID `0b5963bb-67d6-4738-a620-32ec86c1e3d0`.
- Product Fact Current 3개, Subject lineage `data-ai29c-c5-presentation-identity-correction-v1`, Semantic Review Current 0/12.
- `admin_register_sunscreen_recommendation_semantic_field_v1(uuid,text,jsonb)`: `SECURITY DEFINER`, `service_role`만 EXECUTE 허용(`anon`, `authenticated` 모두 불가).
- `admin_require_product_review_actor`는 활성 `admin_memberships`와 `admin.products.review` capability를 검사. 활성 admin role은 `admin_owner` 1개(사용자 UUID/메일 표시 금지).
- 공식 제품의 legacy category는 null, `catalog-taxonomy-v1:category:sunscreen` / shadow assignment 존재.
- 기존 `read_sunscreen_recommendation_semantic_bundle_v1`로 12개 상태를 조회하며, 현재 한 Subject에 귀속되어야 한다.

## 구현

- 관리자 주소: `/admin/products/bushman-semantic-review` (관리자 로그인 및 `admin.products.review` capability 필요).
- 변경 전용 API: `POST /api/admin/products/bushman-semantic-review/confirm`.
- 같은 출처 제약 및 authenticated account-user session에서 조회한 `access.userId`만 RPC `p_actor_user_id`로 사용한다. 클라이언트는 `actorUserId`, 제품 ID, 검토값 또는 evidence 배열을 지정할 수 없다.
- 화면에는 S2 필드별 제안과 근거가 표시되며 **한 필드당 명시적 확인** 후에만 RPC를 호출한다.
- S2 동결 JSON의 정확한 8개 키와 기존 RPC evidence contract 검증, live Subject exact, 전체 12개 필드 스키마, 해당 필드 현재 `not_reviewed` + `reviewId=null` 확인 후, 정해진 상품·Subject에 대해 1회 등록.
- 기존 current review가 있으면 자동 덮어쓰기/승계하지 않고 `409 CURRENT_FIELD_ALREADY_REVIEWED_RECHECK_REQUIRED`로 중단. 동일 `requestId` 재호출도 현재 리뷰가 있으면 자동 중단하며, RPC 내 idempotency 로직은 별도 유지.
- 성공 시 RPC 내부의 실제 `review_id`와 `audit_id`를 응답하며, 외부 시스템에 별도 승격/후보 등록을 하지 않는다.

## 중요 경계

1. 50g·50ml는 사용자 지정 **내부 동일 제품 가정**이며 제조사 동일 SKU attestation이 아니다.
2. S2의 `2 established / 10 reviewed_not_established` 그대로 사용. white_cast / eye_sting / pilling / sensitivity 등 가변적 특성을 임의로 낮추지 않는다.
3. 이 PR이 merge되더라도 **운영 Semantic Review는 자동 작성되지 않는다**. 관리자 본인의 화면별 클릭 이후 결과를 다시 확인해야 한다.
4. 등록 여부와 무관하게 Subject lineage와 Recommendation Admission 권한은 자동 승격되지 않는다.
5. `Product`, `Product Fact`, `Subject`, `Registry`, `Ranking`, `Beta`, `Public`, `UVA`, `Water` Production write 없음.
6. 추후 필요시 관리자 본인이 R4-D-S3 항목별 기록을 완료한 뒤, S4에서는 실제 Production 12/12 current와 core 2개 established를 읽기 전용 검증한다. R4-E 추천 편입 평가는 Subject authority 별도 준비 후 진행한다.

## 검증 범위

- `scripts/verify-data-ai29c-filter-r4-d-s3-admin-review-workbench.mjs`는 제안서 12개 필드 각각의 payload preflight와 음성 사례를 검증하고, source identity, 관리자 로그인/권한/출처 보호 및 1회 1필드만 기록 가능한 구조를 정적으로 점검.
- DB 이전이나 `admin_register_sunscreen_recommendation_semantic_field_v1` 실제 호출 없이 기존 CI에서 검증.
- admin membership/민감 정보는 파일·테스트 출력에 보관하지 않음.
