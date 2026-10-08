# Face Lab V2 / Visual Try-On — P1-D2B Approved Catalog Read 상세 실행 설계 v1

- 기준: `gycha0109-beep/K_beauty` / `main@34e701d1e72904396eb87a361034428a625972de`
- 선행 완료: PR #1169 (인증 Product ID + 읽기 경계), PR #1171 (권한 감사·Fail-closed CI)
- 성격: **설계 확정 및 구현 작업 분할**. 이 문서 자체는 Hosted DB 실제 상태·승인·권한을 입증하지 않는다.
- 보호: SQL / migration / RLS / GRANT / role / auth / env / storage / provider / production 데이터 **변경·호출 없음**.

## 1. D2B의 실질 목표

사용자의 `productId + variantId + slotKey` 선택을 **서버에서 다시 조회·검증**하여
Product identity, 적법한 Subject 관계, 승인된 Product Variant/Shade,
활성 Canonical Taxonomy + canonical assignment, 승인된 Category→Appearance Slot,
명시적 Capability Evidence를 갖춘 경우에만 기존
`buildFaceLabCatalogProductTryOnSelection`으로 연결한다.

D2B에서는 렌더러·이미지 생성·UI·참고 이미지 blob 권한을 구현하지 않는다.
`referenceAssets`는 별도의 P1-E에서 접근 승인·검증된 레코드로 공급하며,
없으면 기존 resolver가 요구하는 경우 그대로 차단한다.

## 2. 확인한 계약 및 필수 수정: Product Fact Variant는 Commerce Variant가 아니다

Gate D `docs/domain/facelab/face-lab-v2-product-variant-shade-authority-v1.md` `2.2·`13에 따라
`product_fact_subjects.variant_key != Product Variant variantId`이며,
명시적으로 심사·승인된 mapping이 있는 경우만 연결할 수 있다.

현재 다음 세 모듈은 암묵적인 동등성을 가정한다.

1. `catalog-product-try-on-read-core.js`: 요청 `variantKey`와 `subject.variant_key`, `variant.variantId`를 모두 동일하게 강제.
2. `catalog-product-try-on-binding.js`: `variant.variantId === subject.variant_key`, `variant.variantAxes.shade === subject.variant_key` 검증 및 이를 사용한 `variantRef` 생성.
3. `catalog-reference-resolver.js`: `raw.subject.variant_key`에서 `candidateRef` 생성. 따라서 Look Session까지 전파된다.

**결정:** 실 DB 투입 전에 이 암묵 동등성 가정을 수정한다. 
기존 Product Fact `variant_key`를 지우거나 재해석하지 않으며,
`variantId`는 별도의 검토된 Face Lab Variant identity로 유지한다.
`variantAxes.shade`도 Subject의 키가 아니라 승인된 Shade Profile의 `shadeKey`를 따른다.
상품명·storefront option·SKU 문자열 파싱으로 `variantId` 또는 shade를 만들지 않는다.

### 2.1 명시적 Subject↔Variant bridge

별도의 승인된 서버 authority source가 최소 다음 관계를 제공해야 한다. **현행 DB 테이블이 있다는 뜻이 아니다.**

| 속성 | 의미 |
| --- | --- |
| `productId` | 기존 `products.id` |
| `subjectId` | 기존 `product_fact_subjects.subject_id` |
| `variantId` | 안정적인 내부 Face Lab Product Variant ID |
| `mappingVersion` | 심사 완료된 매핑 버전 |
| `approvalState` | `approved`만 통과 |
| `evidenceRefs[]` | Subject와 Variant의 관계를 증명하는 namespaced 근거 |
| `subjectVariantKey` | nullable Product Fact formulation/market 키. **실제 shade ID와 동등하지 않음** |

Bridge가 존재하더라도 product/subject/variant의 identity·상태와
mapping proof가 모두 맞는 경우만 통과한다. 하나라도 불명확하면 `unsupported`.
`sourceVariantRefs` 문자열에 Subject ID가 단순히 포함된 것만으로
심사·승인된 bridge를 대신할 수 없다.

### 2.2 입력 계약

신규 server-only 경계의 선택 입력은 `productId + variantId + slotKey`.
현재 내부 테스트의 `variantKey` 입력은 과거 형태이므로 코드 변경 PR에서
버전 변경·호출부·회귀 영향 범위를 확인한다. 아직 공개 API route는 구현되어 있지 않다.
이전 이름을 호환시키더라도 Subject `variant_key`로 다시 해석하지 않는다.
서로 다른 ID가 혼재하면 무조건 차단한다.

## 3. Authority source inventory — 출처와 현재 공백

| Authority | 현재 신뢰할 수 있는 근거 | 운영 연결 판정 |
| --- | --- | --- |
| Product | 로그인 사용자 Supabase `products.id` 읽기 | 식별 확인 경로만 구현. 실제 사용자별 Hosted 성공 미검증 |
| Product Fact Subject | `public.product_fact_subjects`, identity/current/market/region/validity | 현재 Face Lab 사용자 직접 읽기 권한 없음 |
| Face Lab Product Variant | Gate D 런타임 검증·fixtures | 실제 Hosted Variant/Shade 발행·조회 authority 미확인 |
| Subject↔Variant bridge | Gate D 명시적 심사 원칙 | 기존 자동 등가가 잘못된 가정. 승인 자료 필요 |
| Catalog Taxonomy | `catalog_taxonomy_versions/terms`, `product_catalog_taxonomy_assignments` | 초기 seed shadow-only, 현재 Hosted canonical cutover 미검증 |
| Category→Slot mapping | `categoryBinding` approval+evidence 계약 | 저장소 검증 계약은 있으나 승인된 운영 source 미확인 |
| Capability evidence | Gate B `capabilityClaims[]`, proofClass/evidenceRefs | Taxonomy `supports_capability`는 style-capability 증거 아님 |
| Reference metadata/blob | P1-B approved/governed record 및 private blob 계약 | P1-E로 분리, Product 썸네일 URL을 승격하지 않음 |

Subject 구조의 `variant_key`는 NULL 허용이며 market/region·validity별
둘 이상의 current Subject가 가능하다. Product ID만으로 임의의 첫 Subject를
고르지 않는다. 동일 Product/variant/시장·지역 범위에 후보가 여럿이면
`subject_ambiguous`로 차단한다.

## 4. Server-only 승인 읽기 계약(제안)

함수의 내부 이름: `readApprovedTryOnBundle({ productId, variantId, slotKey })`.
해당 함수는 **호출자로부터 bundle/approvalState/evidence를 받지 않으며**
서버의 각 승인 authority source를 이용해 구성한다.

반환 구조의 기준 필드:

```text
{
  product: { id },
  subject: { subject_id, product_id, variant_key, identity_status,
             current_state, market_applicability, region_applicability,
             valid_from, valid_to },
  subjectVariantBridge: {
    productId, subjectId, variantId,
    mappingVersion, approvalState, evidenceRefs
  },
  taxonomyVersion: { version, lifecycle_state, authority_mode },
  taxonomyTerm: { term_id, taxonomy_version, axis, term_key, lifecycle_state },
  taxonomyAssignment: { product_id, taxonomy_version,
                        category_term_id, assignment_state },
  categoryBinding: { approvalState, mappingVersion, taxonomyVersion,
                     categoryTermId, tryOnCategoryKey, evidenceRefs },
  variant: { productId, variantId, identityVersion, identityState,
             lifecycleState, variantAxes, identityEvidenceRefs,
             sourceVariantRefs, shadeProfile? },
  capabilityClaims: [ ...governed Gate B claim records... ],
  slotKey,
  referenceAssets: []   // 승인된 P1-E reference source 도입 전
}
```

필드명은 기존 바인딩 객체 기준의 **내부 설계안**이며 공개 API 응답 변경 승인이 아니다.
`subjectVariantBridge`의 저장 장소·승인 기록·갱신 소유자는 운영 협의가 필요하다.
`variant`, `categoryBinding`, `capabilityClaims`는 없는 값을 자동 합성하지 않는다.
기존 `buildFaceLabCatalogProductTryOnSelection` 검증과
`evaluateFaceLabCandidateCapability`는 그대로 authority 심사의 마지막 단계로 둔다.

### 4.1 필수 검증 순서

1. 인증 세션 확인 → Request productId / variantId / slotKey 타입 검증.
2. 사용자에게 조회 가능한 `products.id` 존재성 확인.
3. 서버 승인 reader를 통한 Subject 목록·시장·지역·시점·current/resolved 검증.
4. **승인된 bridge**로 정확히 하나의 Subject↔Variant 관계 확인.
5. Variant identity `resolved` + lifecycle `active` + SHADE/evidence 유효성 확인.
6. Taxonomy version `active` AND `canonical`, category term `active`,
   assignment `canonical` 및 같은 version·Product·term 일치.
7. 별도 `categoryBinding.approvalState === approved`, category→slot 일치.
8. 증거가 있는 `capabilityClaims`로 Slot `eligible` 확인.
9. 필요 시 승인된 reference metadata만 전달(P1-E 이후).
10. 기존 Binding·Resolver/Look Session에서 전체 identity 재검증. 실패 시 렌더 호출 없음.

각 단계의 실 DB 호출 여부와 데이터 사용권은 아래 독립 승인 gate에 묶는다.

## 5. DB 접근 설계 — 승인 전 구현 금지

### 5.1 현재 보안 경계

- `read_recommendation_admission_authority_v1(uuid)`는 `recommendation_admission_runtime` 전용; Subject에 `variant_key`도 제공하지 않는다.
- `read_product_evidence_presentation_authority_v1(uuid)`도 해당 전용 role 실행만 허용하며, explanation-only transport다. Face Lab 권한으로 우회 사용하지 않는다.
- Product Fact, Taxonomy는 `authenticated` 직접 테이블 읽기 계약이 아니며, `service_role` 사용도 D2B의 권한 근거가 아니다.
- 본 문서는 실제 Hosted DB의 설치된 migration, role, active taxonomy, 데이터 존재성·커버리지를 확인하지 않았다.

### 5.2 권장 승인안 (정책 변경 후에만)

1. 최소 컬럼만 반환하는 **Face Lab 전용 read-only projection**을 별도 승인.
   Product, Subject, Canonical Taxonomy / Assignment만 읽고, 사용자 비공개 원본
   Evidence body·개인정보·관리자 내부 필드는 전혀 반환하지 않는다.
2. 데이터 읽기 owner(비로그인)와 server-only 실행 role(최소 EXECUTE)을 분리.
   기존 Recommendation runtime credential 재사용 금지.
3. SQL `SECURITY DEFINER`가 필요하면 `search_path=''`,
   모든 table/function fully qualified, 제한된 owner column grants,
   호출자 직접 테이블 SELECT 불허, `PUBLIC/anon/authenticated`
   실행 권한 명시적 REVOKE, 실행 role만 GRANT를 사전 리뷰한다.
4. 기존 사용자 cookie 기반 `auth.getUser()`를 먼저 통과한 서버만
   전용 reader를 호출한다. 비로그인·무승인 제품은 읽을 수 없고,
   credential을 Client Bundle/응답/로그에 노출하지 않는다.
5. 범위 조건: exact Product ID + 승인된 subject/variant bridge를 통해
   결정된 Subject ID, active/canonical term, 중복·누락 시 실패.
6. 읽기 계약의 서버 제공 여부(전용 DB URL/role, RPC, 다른 검증된 source)는
   보안 검토 후 확정한다. 환경 변수 추가·배포·Hosted probe는 본 설계의 실행 승인이 아니다.

추가 migration/role/RLS/GRANT/전용 비밀자격/프로덕션 접근은 **각각 별도 명시적 사용자 승인**이 필요하다.
DB role만으로 approval evidence·Variant source가 자동 생기지는 않는다.

## 6. 작업을 4개 독립 단위로 분리

### D2B-0 — Subject↔Variant 계약 불일치 보수 (코드만; 다음 실행 우선순위 1)

- 대상: `lib/face-lab-v2/catalog-product-try-on-read-core.js`,
  `catalog-product-try-on-binding.js`,
  `catalog-reference-resolver.js`, 관련 Fixture/Verifier.
- 승인된 bridge 없이 Subject `variant_key`를 Commerce `variantId`로 사용하지 않도록 보수.
- `variantRef`는 `variant.variantId`만 사용, slot·product·subject provenance 일치.
- 명시적 mapping 없거나 ID 충돌·ambiguous·NULL일 때 차단.
- 미변경: DB/인증/HTTP API 저장 필드, Look Session 영구화, UI, Provider.
- 종료: 긍정/부정 Mock 회귀 PASS; Face Lab + Current Main Health CI PASS.

### D2B-1 — 운영 읽기 승인/현황 인벤토리 (별도 승인 후; 우선순위 2)

- 확인: 실제 마이그레이션 적용 여부, role/EXECUTE/SELECT/정책,
  Taxonomy `authority_mode/lifecycle_state`,
  Product↔Subject/market/region/validity 분포,
  실제 Variant/Shade/bridge, category mapping, capability evidence 공급 여부.
- read-only, 집계 위주. 사용자 얼굴 이미지·민감한 원문·secret 출력 금지.
- 산출: `available / missing / ambiguous / protected` 필드별 매트릭스.
- 승인 없이는 코드/마이그레이션 근거까지만 기록, Hosted 상태 불명으로 유지.

### D2B-2 — Approved read contract 승인·구현 (보호 영역; 우선순위 3)

- D2B-1에서 기존 안전 경로의 부재가 입증될 때만 최소 projection SQL/RPC/role 설계,
  security review·승인, 정식 migration 적용.
- Variant/bridge/category/capability의 검토된 실제 authority source를 별도 확정.
- 서버 adapter가 `readApprovedTryOnBundle`을 호출하게 연결한다.
- 권한 실패·누락·중복·stale authority는 Fail closed.
- 실행·배포 승인 전 Mock/SQL 정적 테스트만 가능.

### D2B-3 — 무료 통합/권한 거부 검증 (승인된 경로에서만; 우선순위 4)

- fixture: 두 Variant가 같은 Product Fact formulation key를 공유,
  null Subject `variant_key`, 시장/지역 복수 Subject,
  revoked bridge, inactive version/term, shadow taxonomy, capability contradiction,
  lost/stale evidence, Product↔Subject drift, auth expiry, DB 5xx.
- 음수 요청에서 어떠한 provider 호출도 없어야 함.
- 서버 success는 source·bridge·taxonomy/capability·Reference 승인 모두 충족한 경우만 보고.
- P1-E Blob read 및 P1-F UI 연결은 D2B와 독립 관리.

## 7. 응답/실패 분류(내부)

| status | case | 내부 reason 예시 |
| --- | --- | --- |
| `invalid` | 잘못된 UUID/variantId/slot 입력 | `catalog_try_on_request_invalid` |
| `unavailable` | 세션·전용 reader·DB 접근 문제 | `authentication_required` / `approved_try_on_projection_unavailable` / `approved_try_on_projection_read_failed` |
| `unsupported` | 승인 자료 없음, Subject ambiguous, revoked bridge, inactive/shadow taxonomy, capability 미충족 | 기존 binding reason 또는 신규 승인된 reason |
| `ready` | 승인된 전체 authority가 현재까지 일치 | `approved_catalog_product_bound` |

기존 응답 필드명을 별도 승인 없이 변경하지 않는다.
인증 실패·권한 부족을 사용자에게 내부 RBAC 정보로 구체 노출하지 않는다.
향후 API를 도입할 경우 HTTP 401/403/404/409/503 매핑은 별도 HTTP 계약 리뷰 대상.

## 8. 검증 게이트 / 종료 조건

| Gate | 명시적 PASS 조건 |
| --- | --- |
| A. Semantics | Subject variant_key ≠ VariantId인 승인 Fixture는 통과하고, 매핑 없는 동등/비동등 사례는 모두 차단 |
| B. Identity | Product/Subject/variant/market/region/validity 및 mapping evidence drift 차단 |
| C. Taxonomy | `active + canonical` 버전/term/assignment만 통과. `shadow_only`·`reserved` 차단 |
| D. Capability | taxonomy capability metadata를 style proof로 승격하지 않음 |
| E. Security | Client 직통 Product Fact/Taxonomy SELECT, Recommendation role 차용, service_role 우회, public URL fallback 차단 |
| F. Provider cost | 유료 이미지 생성 0회, Canary 재실행 0회 |
| G. Regression | 기존 catalog binding/reference resolver/look session, Face Lab Foundation, Current Main Health PASS |
| H. Runtime | 승인된 Hosted 환경을 실제 조회하기 전에는 '실 상품 연결 완료'라고 보고하지 않음 |

**D2B-0 종료(A):** 코드 계약의 암묵 동등성이 제거되고 무료 회귀 테스트 완료.
**D2B-1 종료(B):** 허가된 실제 Hosted source, 권한, 데이터 갭 증거 확보.
**D2B-2/3 종료(C):** 승인된 최소 read transport + 검토된 authority source + 권한 거부 증거로 실제 Product Variant 1건 이상 read-only 성공.
조건 C가 미충족이면 현재 상태를 `blocked_by_authority`로 표시하고 다음 단계로 넘기지 않는다.

## 9. 다음 실행 결정

**즉시 착수 가능:** D2B-0 코드 계약 보수(PR 하나, DB/Provider 호출 없음).
**사전 허가가 필요한 것:** D2B-1 Hosted read-only probe, D2B-2 신규 보안 영역.
**아직 진행하지 않음:** P1-E storage blob read, P1-F UI, 신규 paid canary, 앱 배포.

본 설계는 현 계약의 충돌을 근거로 실데이터 연결을 서두르지 않고,
기존 Face Lab authority의 출처·승인·비용 경계를 보존한다.
