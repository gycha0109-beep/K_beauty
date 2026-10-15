# D8K-10 — 운영 Supabase 실제 SELECT-only Product / Offer / Evidence 실사

> 수행: 2026-10-15 16:47 KST · taxonomy-ai
> **USER_APPROVED_READ_ONLY_SELECT / LIVE_DB_AUDIT_COMPLETE / PROTECTED_CHANGE_NOT_APPROVED / ALL_PUBLIC_COMMERCE_RELEASE_HOLD**
>
> 사용자로부터 `운영 Supabase SELECT 조회만` 명시 승인을 받은 후 Supabase 연결 프로젝트의 실제 PostgreSQL 17.6에서 SELECT만 실행했다.
> **데이터 INSERT/UPDATE/DELETE, DDL, 마이그레이션, RLS, GRANT, RPC 호출, 스토리지 파일 다운로드, 병합, 배포는 수행하지 않았다.**
>
> 형식화된 민감하지 않은 결과: `fixtures/recommendation-metadata/r16i-d8k10-live-select-only-snapshot-20261015.json`.
> 스냅샷에는 원본 이미지 바이트, Storage object path, 실제 SHA-256값, 개인 계정/사용자 ID, 원본 미검증 가격을 저장하지 않았다.

## 1. 실제 운영 DB와 기준 제품

- 연결 계정: `비주얼리, 랭킹/어노테이터`; 프로젝트: 서울 리전의 기존 비주얼리 PostgreSQL 17.6.
- 조회 관측 시점: **2026-10-15T16:47:04.893494+09:00**.
- 기준 Product ID: `b639c8b4-6a61-440e-b4db-fac7381593ff` / 에스네이처 `아쿠아 스쿠알란 수분크림`.
- Product `size_ml=160`, 기존 `price_min=29900` / `price_max=29900`, `buy_link`는 화해 `goods/45194`.
- 위 가격·링크는 기존 Product 레거시 필드다. **80ml 단품의 실제 검증된 선택 옵션/결제 가격도, 최신 재고·구매가능 증거도 아니다.**
- Product `updated_at=2026-09-10T09:32:38.713599+09:00`, 2026-10-13에 보관한 상태와 핵심 값 동일.

## 2. 상품 실체·판매 기록 진단

| SELECT 조회 대상 | 실제 결과 | D8K-9 판단 |
| --- | --- | --- |
| `product_source_bindings` | 화해 `external_id=45194`, `binding_state=resolved`, `product_scope_state=product_subject_unresolved` | URL 키가 연결돼도 제품 실체·formulation 증명은 아님 |
| `catalog_trust_intake` | 1건: `identity_state=SUBJECT_CREATION_REQUIRED`, `trust_state=REVIEW_REQUIRED`, `subject_id=NULL` | Product Fact 신규 subject 승인 필요 |
| `product_fact_subjects` | 0건 | 실제 formulation/SKU subject 미확정 |
| `product_offers` by Product | 0건 | 실제 부모 Offer UUID **없음** |
| `product_offers` by `hwahae:45194` listing ID | 0건 | 기존 화해 소스 참조를 Offer로 간주하면 안 됨 |
| `product_offers` by `hwahae:45194` URL | 0건 | 상품 링크 ≠ 부모 Offer |
| 이외 실사 후보 listing `hwahae:35905`, `coupang:8393759227`, `snature:151` | DB에 일치하는 parent Offer 0건 | 별도 검토/신규 등록 승인 없이는 UUID 제조 금지 |
| R16I 교정 `proposals` / `decisions` / `applications` | 각각 0건 | 기존 교정안이 운영 DB에 실제 적용됐다고 간주 불가 |
| `admin_r16i_correction_release_gate_v1.enabled` | **false** | 릴리스/교정 gate 유지 |
| D8K-5/6 선택 옵션 자식 테이블 2개 | **두 테이블 모두 없음** | Docker에서 통과한 후보 SQL은 운영 DB에 적용되지 않았음 |

**결론:** D8K-9 테스트의 실제 대상은 지금도 `CATALOG_UNIT_SIZE_VS_SELECTED_OPTION_CONFLICT`(160ml Product vs 80ml 단품) 및 `PARENT_OFFER_NOT_FOUND_IN_PRODUCT_SCOPE`(부모 Offer 0)에서 HOLD해야 한다. 과거 스냅샷이 오래됐기 때문이 아니라 운영 DB 최신 SELECT에서도 같은 차단 사유가 재확인됐다.

## 3. 이미 존재하는 원본 증빙 — 재수집보다 독립 검토 우선

`public.admin_product_correction_evidence_v1`의 R16I 증빙 SELECT:

| 근거 | 등록된 선택 옵션 | 현장 캡처 시점 | 증거 파일·SHA 참조 | 저장 검토 상태 |
| --- | --- | --- | --- | --- |
| `hwahae_bundle` / `goods/45194` | 수분크림 80ml×2 + 세럼 10ml | 2026-10-14 09:50 KST | 양쪽 모두 존재 | **UNVERIFIED** |
| `official_single` / `www.snature.kr/product/detail.html?product_no=151` | 수분크림 80ml 1개 | 2026-10-14 09:50 KST | 양쪽 모두 존재 | **UNVERIFIED** |

- 이 2개 기록에는 선택옵션 가격 **입력 메타데이터**가 있지만 검증되지 않았으므로 이를 실제 확정 결제가·소비자 노출 가격으로 취급하지 않는다.
- `file_sha256` 값과 비공개 Storage `object_path`는 읽거나 본 문서에 복제하지 않았다. 원본 실제 픽셀/판매처 발행자/선택 SKU/결제 조건/배송비/검토자 인증은 확인하지 않았다.
- 기존 관리자 R16I 증빙 워크벤치에는 7개 검토 항목이 있으므로 재활용해야 한다. 먼저 **기존 두 증빙을 독립 리뷰**한 뒤, 필요한 추가 공식몰/판매처 근거만 수집할 수 있다. 사용자가 촬영을 전부 다시 해야 한다는 결론은 근거 부족.
- **보존해야 할 차이:** `80ml 단품`과 `80ml×2 + 세럼 10ml`는 동일 결제 SKU가 아니며, 현재 레거시 Product 160ml를 80ml의 실체로 조용히 정정해서도 안 된다. 이는 기존 D8D 교정 승인 경로를 따로 통과해야 하는 보호 변경이다.

## 4. 전체 Offer 73건의 운영 상태 및 가격 노출 가능성

| 현재 저장된 seller | Offer | Product scope | 재고 | 링크 상태 | 최근 하루 관측/링크 재검사 |
| --- | ---: | --- | --- | --- | --- |
| `oliveyoung` | 72 | `product_subject_unresolved` | `unknown` | `unknown` | 0 / 0 |
| `torriden_official` | 1 | `product` | `in_stock` | `unchecked` | 0 / 0 |
| **합계** | **73** | | | | |

실제 조건 `offer_state='current' AND product_scope_state='product' AND availability_state='in_stock' AND link_health_state='healthy' AND market_code='KR' AND currency_code='KRW'`을 모두 만족하는 행 **0건**. 선택옵션별 검토·배송·진위 조건은 여기에도 추가로 필요한데, 현재 그 전 단계조차 통과하지 못했다.

따라서 **전 상품 가격 비교 기능을 켜거나, 기존 Offer 가격을 검증된 selected option/checkout price로 표시할 근거가 없다**.

## 5. 현재 DB의 제한적 조회 권한

카탈로그 메타데이터 SELECT로 `public.read_product_offer_presentation_authority_v2(uuid[])` 존재와 권한 상태를 확인했다.

- owner: `product_offer_presentation_reader_owner`, `SECURITY DEFINER=true`.
- `anon` / `authenticated` / `service_role`: `EXECUTE=false`.
- `recommendation_admission_runtime`: `EXECUTE=true`.
- D8K-5/6의 신규 `read_selected_offer_option_evidence_v1`은 **미생성**.

권한 설정이 DB에 존재하는 것은 확인했지만 **실제 해당 내부 역할로 함수를 호출하거나 서버 런타임 권한 상승/결합을 실행하지 않았다**. 사용자 승인 범위가 `SELECT만`이기 때문이다.

## 6. D8K-11까지의 실제 선행조건과 승인 경계

순서:

1. **기존 R16I 증빙 2건 독립 검토:** 보관된 캡처 원본을 정당한 권한으로 열람하여 SKU/실제 판매처/수량·증정/배송/캡처 시각/결제 가격/원본 해시를 대조하고 검토자 신원을 인증. 미검증 증빙을 자동 승인하면 안 됨. Storage 다운로드는 이번 SELECT 승인 범위 밖이므로 수행하지 않음.
2. **Product Fact와 160ml↔80ml 교정:** 대상 상품을 그대로 유지할지, 단품 subject와 묶음 Offer를 분리할지 R16I 기존 관리자 승인 경로에서 결정. Product ID/현재 revision/prestate 재확인 후에만 제안·승인·쓰기 단계 실행.
3. **실재하는 parent Offer 생성 또는 연결:** 현재 R16I Offer 0건이므로 존재하지 않는 UUID를 임의 재사용하지 않는다. `seller_key/listing_id/url` 충돌을 재검사하고 SKU/가격/배송 근거 단위로 child observation을 분리.
4. **D8K-5/6 후보 SQL의 운영 승격과 권한:** 실제 격리 PG17 검증 완료만으로 자동 승인되지 않는다. 별도 owner 명시 승인, migration + 독립 writer/reviewer + RLS/roles + 안전한 감사/철회 절차 필요.
5. **읽기 계약/모바일 렌더링:** Product recommendation admission/개인정보·공유 범위 + 실제 인증 서버 + verified amount/배송/CTA 허가에 대해 별도 테스트와 릴리스 승인.
6. **보안 #1208 해결 후에만** 관련 PR 병합·배포 검토.

**STOP:** 이번 D8K-10 증거로 상품 가격이나 링크를 고객에게 노출하거나 교정 proposal/apply, Storage 열람, DDL/마이그레이션·권한 변경, 판매기록 삽입/수정, 배포하지 않는다.

## 7. 실행 범위와 재현성

사용자 승인: `운영 Supabase에서 상품·판매기록·소스 연결 상태를 SELECT만으로 조회`.

실제 사용한 조회는 `information_schema.columns`, `pg_catalog.pg_proc`, `public.products`, `product_source_bindings`, `catalog_trust_intake`, `product_fact_subjects`, `product_offers`, `admin_r16i_correction_*_v1`, `admin_product_correction_*_v1`, `to_regclass` 및 권한 메타데이터의 일반 `SELECT`. 데이터 반환은 소량의 대상 상품 한정 또는 전체 Offer 73건의 그룹 집계로 제한했다.

**조회 과정에 실제 DB write는 없고, 개인 계정이나 비공개 원본 이미지 본문은 읽지 않았다.** 2026-10-15 현황은 시간이 지나면 달라질 수 있으므로 이후 단계 진입 시 반드시 fresh SELECT로 다시 확인해야 한다.
