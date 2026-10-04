# V2.1-ADMISSION-G4-F2 — Category Authority Shadow Dual Read

## Decision

`V21_ADMISSION_G4_F2_CATEGORY_AUTHORITY_SHADOW_DUAL_READ_READY`

FATION의 Product-level category authority를 Production Recommendation 판정에 연결하지 않고, 기존 G3 Product Fact authority와 나란히 읽는 shadow 관측 경로를 추가한다.

## 핵심 경계

- Production Recommendation 판정 소스는 계속 `G3_PF_AUTHORITY_ONLY`다.
- `lib/server/recommendation-candidate-admission-runtime.js`는 수정하지 않는다.
- 기존 `lib/recommendation-admission-authority-reader.js`도 수정하지 않는다.
- category authority는 별도 protected reader를 통해서만 읽는다.
- `products.category`를 수정하지 않는다.
- taxonomy global authority를 활성화하지 않는다.
- Product Fact를 생성/수정하지 않는다.
- Recommendation admission 또는 production cutover를 수행하지 않는다.

## Shadow dual-read 경로

내부 OIDC 보호 route:

`/api/internal/recommendation-category-authority-shadow-dual-read`

같은 `recommendation_admission_runtime` 자격으로 다음 두 결과를 병렬 관측한다.

1. 기존 G3 Product Fact authority
2. `read_recommendation_category_authority_v1(uuid)`

FATION의 category authority 기대값은 다음과 같다.

- status: `CATEGORY_AUTHORITY_RESOLVED`
- category: `treatment`
- assignment digest: `eaed6cb9dd58b0f1e08bc5b35da817a72887b81ee497e0d144fcb5018b108d39`

G3 Product Fact authority 결과는 관측만 하며, category authority가 그 결과를 대체하거나 보정하지 않는다.

## 보안 경계

shadow probe는 실제 runtime role을 확인하고 다음 raw SELECT가 모두 거부되는지 검증한다.

- `recommendation_category_authority_reviews`
- `product_catalog_taxonomy_assignments`
- `catalog_taxonomy_versions`

허용되는 category authority 접근은 protected SECURITY DEFINER reader EXECUTE뿐이다.

## Production 검증

PR 단계에서는 정적 계약과 wiring을 검증한다.

main merge 후 기존 G3A workflow가 실제 배포 URL에 대해 FATION shadow dual-read probe를 실행한다. 이 probe는 Recommendation 결과를 변경하지 않고 category authority가 안전하게 읽히는지만 검증한다.

## Next gate

`V2.1-ADMISSION-G4-F2-D1_DEPLOYED_SHADOW_DUAL_READ_OBSERVATION`
