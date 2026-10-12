# taxonomy-ai → Face Lab: Canonical Product Supply / Consumption Contract v1

> 상태: **책임·데이터 계약 확정안 / Production adapter 연결 아님**
> 근거: 2026-10-12 main `487021eea2b163ccaf01aabb93ae7994dd00c401`와 미병합 PR #1167.
> 변경 권한: 데이터 원본/근거 정책 = taxonomy-ai, Face Lab 적합성/시뮬레이션 = face-research, auth/RLS = Security, 호스팅 DB 연결 = Platform/DB.

## 1. 공급자와 소비자

```text
Existing products / Product Fact Registry + Subject / Current + Confirmations
   + Taxonomy / Evidence Record → Source-Subject Binding → Official Source
   + governed review observations
   + approved, scoped reference asset metadata (if present)
       ↓  taxonomy-ai: canonical authority + read-only projection contract
authorized server reader (Security-authorized; Platform-approved DB connection)
       ↓  exact actor/product/subject/variant/slot scope, no raw user-supplied Facts
Face Lab consumer guard / binding / reference validation
       ↓
ready OR explicit unavailable/invalid/unsupported/HOLD
```

**이 문서는 새로운 테이블·RPC·서비스 role·reader를 생성하지 않는다.** 실제 공급 가능한 필드, 권한과 운영 데이터 존재는 별도 검증 대상이다. Product Fact 축적/자동 평가 성공 자체가 추천 허가 또는 가상 착용 이미지 사용 허가는 아니다.

## 2. Canonical 공급 필드·원본·허가 조건

| 의미 | 공급 측 authoritative 원본 / 기존 코드 증거 | Face Lab 사용 규칙 |
| --- | --- | --- |
| Product identity | `products.id` (main `lib/product-intelligence/automatic-product-evidence-db-reader-v1.mjs`) | 입력 Product ID는 식별자만 허용; 조회 객체 ID 동일성 검증 |
| Subject identity, current, formulation | `product_fact_subjects.subject_id,product_id,identity_status,current_state,variant_key,formulation_revision_key` | `resolved` + `current` + 정확한 Product 연결 없으면 중단. Subject 없음/복수도 정상 승격 금지 |
| Current Fact와 confirmation | `product_fact_current` → `product_fact_instances` / `product_fact_confirmations` | confirmation·scope·registry validity 검증된 사실만 Fact로 표현; 빈 Fact = 거짓 아님 |
| Registry / fact key | `product_fact_definition_snapshots` 및 Registry version | `proposed`/deprecated/미확정 key는 사용 권위가 아님 |
| 공식 근거 lineage | `product_fact_evidence_links` → `product_evidence_records` → `product_evidence_source_subject_bindings` → `product_evidence_sources` | 같은 URL이나 주장 문구가 있다는 이유로 사실 확정 금지; 정확한 subject scope 및 source version 확인 |
| Canonical taxonomy | `product_catalog_taxonomy_assignments` + taxonomy version/term | `lifecycle_state=active`, `authority_mode=canonical`, `assignment_state=canonical`를 검증하기 전까지 shadow/proposed를 canonical로 간주 금지 |
| Variant, shade, slot | Face Lab `catalog-product-try-on-binding.js`의 **approved** Subject↔Variant 및 category↔slot mapping을 데이터 공급자에게 요청 | Subject `variant_key`가 곧 commerce shade/SKU의 `variantId`라는 가정 금지. 승인된 `subjectVariantBridge`와 `evidenceRefs`, `mappingVersion` 요구 |
| 제조사 주장 | 출처가 있는 claim evidence / product-intelligence evaluator | `manufacturerClaim`은 `verifiedFact`로 자동 격상 금지 |
| 후기 관찰 | provenance / 대상·표본 정의가 명시된 review observation | 리뷰 추세·빈도·개별 사용자 반응을 임상 효과·확정 사실·추천 권한으로 둔갑 금지 |
| 데이터 평가 | `automatic-product-evidence-evaluator-v1.mjs` | `assessment`가 좋거나 예외 0개여도 관리자 confirmation, selection eligibility, reference approval과 분리 |
| 이미지 자산 | 승인된 asset의 `assetRef`, `evidenceRef`, `role`, `approvalState`, `assetStatus`, `usagePermission`, `storageKind`, `storageKey`, `mimeType`, `byteLength`, `sha256` | `catalog-reference-resolver.js`의 가상착용 허가·active·governed private blob·MIME/SHA/용량 검사를 거치지 않으면 사용 불가. 상품 썸네일 또는 외부 URL 자동 대체 금지 |
| 데이터 읽기 결과 | Security가 승인한 server-only read projection | 브라우저에서 service-role 직접 호출 금지. 권한 거부·source 미확정·DB 실패는 실패로 보존, 빈 값/Mock으로 성공 처리 금지 |

## 3. 실제 기존 소비자 계약에 맞춘 응답 경계

- 현재 main의 `resolveFaceLabCatalogTryOnRead`는 `request.productId / variantId / slotKey`만 받고, `lookupCatalogProduct`와 `readApprovedTryOnBundle`을 **주입형 reader**로 사용한다. `readApprovedTryOnBundle`의 실제 Production 연결이 증명되지 않은 상태를 `approved_try_on_projection_unavailable` 등으로 보존한다.
- 현재 main의 `buildFaceLabCatalogProductTryOnSelection`은 상품/Subject/Variant/Taxonomy/Assignment/Category-to-slot/Capability를 개별 검증한다. 반환 `ready`는 해당 **Face Lab 선택의 검증 경계**이지 Product Fact 자체의 새로운 원본 권위가 아니다.
- #1167(미병합)의 `resolveFaceLabTryOnCatalogRead`는 별도 `actorId`, `sessionId`, exact `productId/subjectId/slotKey`, `readAuthorizedSelection`, `readAuthorizedAssets` 응답을 요구한다. 이 PR을 현재 main에 이미 연결된 Production reader로 간주하지 않는다.
- **검토 필요:** #1167은 허용 asset key를 구성할 때 `subject.variant_key`를 `createFaceLabProductVariantRef({variantId: ...})`에 전달한다. 현재 main의 Face Lab binding은 별도 approved `subjectVariantBridge.variantId`를 요구한다. 두 값이 항상 동등하다는 canonical 증거 없이는 동일시하지 않는다. face-research가 #1167 리베이스·소비자 검증에서 이 일치성/불일치성 경계를 확정한다.
- 주입형 reader의 서비스 권한 정책·token 처리·서버 DB identity는 Security/Platform 승인 대상이다. taxonomy-ai가 별도의 관리자 진단 route나 서비스 자격증명을 추가하지 않는다.

## 4. Fail-closed 상태 표기 정책

| 공급 관찰 | 소비자 판정 | 금지 동작 |
| --- | --- | --- |
| Subject `unresolved`/`ambiguous`/중복 | `HOLD` 또는 기존 소비자 `unsupported`/`invalid` | resolved로 대체 |
| Current 미확정, Fact/confirmation·Registry scope 충돌 | `HOLD` / `unavailable` | 평가 결과로 Current 자동 생성 |
| shadow taxonomy, `reserved` category, 승인 없는 매핑 | `unsupported` / `HOLD` | canonical·approved로 자동 승격 |
| 미승인 asset, 사용권 `virtual_try_on` 없음, blob/read 실패 | `invalid` / `unavailable` | 외부 이미지 URL이나 썸네일 대체 |
| 제조사 주장, 후기 추세만 존재 | `claim_only` / `observational`로 구별하여 비허가 | 효능/무자극/추천·시뮬레이션 허가로 전환 |
| 정책상 허가되어 조회·증빙까지 모두 통과 | 현재 owning consumer 계약의 `ready`만 허용 | ready를 Production DB 신원/보안 전체 인증으로 확대 |

표의 상태는 **의미상 매핑 지침**이다. 새 DB enum/API 응답 enum을 임의 확정하는 규격이 아니다. 구현 시 해당 owning schema의 기존 `invalid` / `unsupported` / `unavailable` / `ready`에 맞춘다. 사용자 리포트의 `UNKNOWN`/`HOLD` 의미를 침해하지 않는다.

## 5. 최소 검증 및 중복 제거 수용 기준

1. 기존 `scripts/verify-face-lab-v2-catalog-product-try-on-binding.mjs`, #1167 `scripts/verify-face-lab-v2-try-on-catalog-read-bridge.mjs` (PR merge 전에는 해당 head에서만)를 재사용; 새로운 Face Lab authority scorer는 작성하지 않음.
2. canonical `resolved/current`, exact Subject↔Product↔Variant mapping, taxonomy canonical+active, 매핑 승인, capability 및 자산 사용 허가를 모두 각각 음성·양성 케이스로 검사.
3. Source/Subject 불일치, 근거 누락, old Current, `UNKNOWN`/`HOLD`, unapproved asset을 정상 추천/이미지 준비로 바꾸지 않음.
4. `lib/product-intelligence/automatic-product-evidence-db-reader-v1.mjs`와 기존 운영 워크벤치를 그대로 사용. 동일한 `product_fact_*` 테이블 전체를 따로 읽는 Face Lab 상품 신뢰 평가 파이프라인 신설 금지.
5. 검토/confirmation/recommendation activation/try-on eligibility는 서로 다른 승인 단계. 자동 평가 성공만으로 어느 후행 단계도 승인하지 않음.
6. 실 DB 사본·운영 키·user photo·private blob·raw provider output을 fixture/로그/PR에 노출하지 않음.
7. 이미 존재하는 Face Lab Foundation / taxonomy-ai / Security CI 중 **각 책임 검증은 한 번만** 수행하도록 추후 연결 위치 결정. 신규 workflow 생성 금지.
8. 실제 Production 데이터 가용성, RLS/GRANT, public/server Supabase ref 동일성은 외부 권한이 확인되기 전까지 **미검증 / HOLD**.

**권한 경계:** 이 계약 문서는 hosted data를 생성·승격·조회하지 않았으며, 배포·마이그레이션·권한·보안 규칙을 변경하지 않았다.

Watchtower-Track: taxonomy-ai
