# Face Lab V2 / Visual Try-On — P1-D2A read-authority audit

- 기준 저장소: `gycha0109-beep/K_beauty`
- 기준 `main`: `60224fa0feb17df033e7cc4ca2329318f4c03a48`
- 범위: repository code / migration / grant 정적 근거. **Hosted DB는 조회하지 않음**
- 작업 유형: protected boundary diagnosis + bounded free verifier
- 결정: **D2A의 기존 권한만으로 실제 Product/Variant/Taxonomy를 Try-On ready로 공급할 수 있다는 증거는 없음.**

## 현재 연결할 수 있는 경로

1. `lib/server/face-lab-catalog-product-try-on-reader.js`는 `createServerSupabaseClient()` 및 `auth.getUser()` 뒤 `products.select("id")`를 수행한다. 이는 **상품 식별 확인**용이며, Subject/Variant/Taxonomy의 권한을 부여하지 않는다.
2. `lib/face-lab-v2/catalog-product-try-on-read-core.js`의 `readApprovedTryOnBundle`은 아직 별도 승인된 server-side data source로 연결되지 않았다. 부재 시 `approved_try_on_projection_unavailable`을 반환한다.
3. `lib/face-lab-v2/catalog-product-try-on-binding.js`는 Subject identity/current state, Variant provenance, active canonical Taxonomy, approved category-to-slot mapping, capability evidence를 모두 검증한다.

## 연결을 막는 근거

| 데이터 | 확인한 저장소 증거 | 판정 |
| --- | --- | --- |
| Product | 기존 로그인 사용자 대상 `products.id` 조회 구현 | 제품 존재성 경로 구현. Hosted RLS 및 실제 제품별 성공 여부는 미검증 |
| Product Fact Subject | `20260809115932_product_fact_storage_v1.sql` — `product_fact_subjects`에 RLS, `authenticated` 직접 읽기 미허용, `service_role` select | Face Lab 사용자 경로에서 직접 소비 금지 |
| Subject Variant | 같은 마이그레이션의 `variant_key`는 nullable | Subject가 존재해도 Shade/Variant 준비를 보장하지 않음 |
| Recommendation G3A | `20260822083000_v21_admission_g3a_pf_authority_read_v1.sql` — 전용 `recommendation_admission_runtime`에만 RPC 실행 부여; 해당 Subject projection에 `variant_key` 없음 | 전용 Recommendation 권한을 Face Lab에 차용 금지 |
| Taxonomy | `20260913201050_data_taxonomy1_shadow_catalog_taxonomy_foundation_v1.sql` — `catalog-taxonomy-v1`은 `shadow_only`; 관련 테이블은 service-role read만 명시 | Shadow를 canonical로 승격해 해석 금지 |
| Makeup taxonomy | 같은 seed의 `lip_color`, `foundation` category가 `reserved` | 이 seed를 Try-On 카테고리 승인 증거로 사용할 수 없음 |
| Category → Appearance Slot | 현 Binding 계약은 승인 `categoryBinding`을 요구 | 운영 승인 mapping 공급 경로 미확인 |
| Capability Claims / Shade / Reference | 별도 evidence/asset 승인이 필요 | 실제 승인된 공급 및 운영 데이터 미확인 |

> 마이그레이션은 배포된 실제 DB 상태를 증명하지 않는다. "지금 운영 DB가 모두 shadow이다" 또는 "지원 가능한 상품이 0개다"라는 주장은 하지 않는다.

## D2A의 보호 경계

- 신규 DB/RPC, migration, RLS, Role/Grant, 인증 계약, 서비스 권한 변경 **없음**.
- 전용 Recommendation 자격증명 또는 `service_role`을 Face Lab Try-On에 연결하지 않음.
- 승인된 reference blob이 없으면 상품 썸네일 URL 또는 외부 URL로 대체하지 않음.
- 이용자 요청 데이터의 Product/Variant/Taxonomy 객체를 신뢰하지 않음.
- 실제 이미지 Provider 호출 **0회**. Canary 재실행 없음.
- 기존 `scripts/verify-face-lab-v2-catalog-product-try-on-binding.mjs` 실행 시 이 보호 경계를 무료 정적 검증한다.

## D2B로 분리할 승인 필요 작업

1. Hosted DB에서 현재 실제 Taxonomy lifecycle/authority mode와 Subject Variant coverage를 **명시적으로 승인된 읽기 방식**으로 점검한다.
2. 승인된 subject/variant/canonical taxonomy/assignment/category-binding/capability 근거를 최소 필드로 공급할 **Face Lab 전용 읽기 계약**을 확정한다.
3. 신규 SQL/RPC/role/RLS/환경 자격증명 변경이 필요한 경우 해당 변경만 사용자 별도 승인을 받는다.
4. 바인딩 가능한 실제 제품이 있는지 확인하고, 없다면 Product onboarding/TRUST/Taxonomy approval을 별도 authority 작업으로 남긴다.
5. 위 조건을 통과한 뒤 `readApprovedTryOnBundle`을 연결하고, 유료 호출 없는 Mock 검증과 권한 거부 검증을 수행한다.

**D2A 종료 판정:** 기존 read 경로 재사용 범위와 보호된 데이터 공백을 확인하고, 현 경계에서 재사용할 수 없는 권한을 자동화/CI가 우회하지 않음을 확인한다. 이는 운영 제품 연결 완료가 아니다.
