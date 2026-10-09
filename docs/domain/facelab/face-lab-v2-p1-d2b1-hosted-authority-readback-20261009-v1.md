# Face Lab V2 / Visual Try-On — D2B-1 실제 연결 DB 읽기 전용 조사 결과 (2026-10-09)

- 기준 코드: `main@0c38485842c4250621ccb1b17cbf358556a3270d`
- 기준 설계: `face-lab-v2-p1-d2b1-hosted-authority-inventory-design-v1.md` (PR #1177)
- 읽기 방식: 연결된 Supabase의 비주얼리 계정 안에서 K_beauty의 Product Fact/Taxonomy 객체를 가진 프로젝트를 식별한 뒤, 관리 메타 조회 및 `BEGIN TRANSACTION READ ONLY` 쿼리 수행
- 관측 시점(UTC): `2026-10-09T06:32:52Z` (권한 메타), `2026-10-09T06:33:50Z` (집계)
- **대상 한계:** 프로젝트가 비주얼리 관련 DB임은 해당 스키마 5개 존재로 확인했으나, 실제 운영 중인 배포 서비스와 **동일한 DB 프로젝트인지 배포 설정으로 재확인하지 못했다**. 따라서 'production parity verified'는 아님.
- **계정·권한 한계:** 조사 SQL은 연결된 관리 컨텍스트의 `postgres` 역할로 실행되었다. 이는 Face Lab 런타임 사용자 역할/최소권한 reader의 존재를 증명하지 않음. 메타 확인은 SELECT만, 이후 SQL은 READ ONLY 트랜잭션(`read_only=on`) + `statement_timeout=3s` + `lock_timeout=1s`, 종료 ROLLBACK.
- 보호 대상: SQL 쓰기·migration·RLS·GRANT·role·auth·storage·환경·호출자 보안 경계 **수정 없음**. 운영 데이터 원문/얼굴 이미지/개인정보/비밀/키 미추출. Paid provider 호출 **0회**.

## 1. DB 객체·일반 사용자 접근 권한 (실제 확인)

| 공개 테이블 | 객체 존재 | RLS | `authenticated` 테이블 SELECT | `anon` 테이블 SELECT |
| --- | --- | --- | --- | --- |
| `products` | yes | on | yes | yes |
| `product_fact_subjects` | yes | on | no | no |
| `catalog_taxonomy_versions` | yes | on | no | no |
| `catalog_taxonomy_terms` | yes | on | no | no |
| `product_catalog_taxonomy_assignments` | yes | on | no | no |

`has_table_privilege(..., 'SELECT')`와 `pg_class.relrowsecurity` 기반 집계다.
테이블 SELECT 권한이 있다고 특정 사용자에게 특정 **row**가 RLS를 통과하는 것은 아니다.
사용자 쿠키/JWT 실제 시뮬레이션은 하지 않았다.

다음 기존 RPC는 `public`에 존재하지만 `anon`/`authenticated`에 EXECUTE가 없고,
**Recommendation 전용이므로 Face Lab 호출 경로로 전용하면 안 된다**:
- `read_recommendation_admission_authority_v1`
- `read_product_evidence_presentation_authority_v1`

그밖에 제한된 함수명 검색(try_on, catalog_taxonomy, variant authority 패턴)에서
Face Lab Try-On 전용 읽기 RPC는 확인되지 않았다. 이름 패턴 외 RPC/비공개 스키마·외부 source는 검증 대상에서 제외했다.

## 2. Product Fact Subject 집계 (실제 확인)

| 항목 | 측정값 | 주의 |
| --- | ---: | --- |
| Subject 전체 | 51 | Product 수와 다름 |
| `current/resolved` | 47 | 지원 가능한 Style Variant 47개를 뜻하지 않음 |
| `historical/resolved` | 4 | 현재 후보로 사용 금지 |
| 전체 Subject의 `variant_key IS NULL` | 35 | Product Fact formulation 키이며 실제 Shade ID와 별개 |
| Current Subject가 존재하는 Product | 47 | 고유 Product ID는 출력하지 않음 |
| Product별 Current Subject 2개 이상 | 0 | 단순 Product별 집계이며 해당 기간 내 속성값·승인 매핑 증명 아님 |
| 미래 시작/기간 만료 Current Subject | 각각 0 | 쿼리 시점 조건만 반영 |

Product Fact Subject의 `variant_key`를 `Face Lab Product Variant variantId`로
추정·변환하지 않았다. D2B-0(#1176)의 승인된 `subjectVariantBridge`를
실제 DB에서 공급하는 출처도 확인되지 않았다.

## 3. Taxonomy·Assignment 집계 (실제 확인)

| 항목 | 결과 |
| --- | --- |
| 설치된 Taxonomy version | `catalog-taxonomy-v1` 한 개 |
| 실제 version 상태 | `lifecycle_state=shadow`, `authority_mode=shadow_only` |
| Category term 상태 수 | active 5, reserved 5 |
| `product_catalog_taxonomy_assignments` 전체 | 175 |
| Assignment 상태 | **shadow 175 / canonical 0** |
| `active canonical version + active category term + canonical assignment` 통과 | **0** |

**판정:** 이번에 조사한 DB에서는 P1-A의 필수 Canonical Taxonomy 조건을 통과하는 Product의 Category Assignment가 0건이다.
따라서 Subject/Variant/Reference 데이터가 있다고 가정하더라도,
현재 운영 읽기 계약으로 실제 Catalog Try-On `ready`를 도출할 수 없다.
이를 우회하려고 shadow를 canonical로 해석하거나 레거시 `products.category`를
Face Lab canonical evidence로 승격하지 않는다.

## 4. Variant·Bridge·Category Binding·Capability 출처 조사

연결된 Supabase `public` 테이블 이름 91개를 대상으로 metadata 검색한 결과,
Face Lab Product Variant/Shade/Subject↔Variant bridge/Appearance Capability
전용 저장소임이 명확한 테이블은 발견되지 않았다. 이는 **전용 승인 데이터가
어느 곳에도 존재하지 않는다는 증거가 아니다**:
- 비공개 스키마, 별도 플랫폼, 코드 기반 수기 발행 source 등은 조사하지 않았다.
- `recommendation_category_authority_reviews`처럼 이름이 유사한 기존 구조를
  Face Lab Category→Slot 승인 출처로 자동 승격하지 않았다.
- `catalog_taxonomy` shadow classification 관련 객체가 존재한다는 사실만으로
  별도 승인된 Face Lab Capability proof가 된다고 판단하지 않는다.

| 필요 Authority | 지금 판정 | 근거/제약 |
| --- | --- | --- |
| Product 기본 저장소 | `available_metadata_only` | Product 테이블 설치/권한 확인. 사용자별 row 조회 미실시 |
| Subject | `available_admin_read_only` | 현재 47건, 직접 authenticated SELECT 없음 |
| Canonical Taxonomy + Assignment | **`not_canonical`** | shadow-only version, canonical assignment 0 |
| Product Variant / Shade | `unknown_source` | 공개 스키마 전용 source 미확인 |
| Subject↔Variant 승인 Bridge | `unknown_source` | D2B-0 계약은 존재, 운영 발행 source 미확인 |
| Category→Appearance Slot approval | `unknown_source` | 실제 소유자/철회/근거 저장 위치 미확인 |
| Style Capability proof | `unknown_source` | taxonomy supports_capability와 불동일 |
| 승인 이미지 Blob | `not_checked` | P1-E 별도 권한 |
| Product ID 1건 readback | **`not_run`** | Canonical 전제 실패, 사용자별 권한/배포 매핑 미확인 |

## 5. 운영·권한 차단 및 다음 조치

현재 D2B-2는 바로 SQL/RPC를 추가할 문제가 아니다. 선행 의존성이 두 가지다.

1. **DATA-TAXONOMY 운영 Governance:** 실제 active+canonical version/term/assignment로 전환할 승인 절차와 담당 authority, 해당 버전의 Makeup category가 `reserved`에서 언제 합법적으로 활성화될지 검토. 승인·운영 영향 평가 없이는 DB 내용 미변경.
2. **Face Lab 도메인 Governance:** 안정적인 `variantId`, Shade evidence, Subject↔Variant bridge,
   category→slot 승인/철회, capability proof의 **실제 발행·저장·읽기 source** 확정.
   `approved` 값이나 namespaced evidence 문자열을 자동 생성하는 것은 불허.
3. 배포 환경의 실제 Supabase project identity를 운영자가 확인해 현재 관측 프로젝트와 대조.
4. 위 항목과 개별 변경 승인이 확보된 뒤에만 Face Lab 전용 최소권한 read projection 설계·구현.
   `postgres`, `service_role`, Recommendation 실행 역할을 Face Lab 런타임에 사용하지 않는다.

이번 작업에서 특정 Product ID, 사적인 원문, reference byte, 모델 input을 조회하거나 실행하지 않았다.

## 6. 종료 판정 A/B/C

- **A — 문서 설계:** 완료 (#1177).
- **B — 승인 범위의 read-only 현황 조사:** **부분 완료**. 테이블/권한·Subject·Taxonomy 실측 완료, 반면 배포 프로젝트 매핑·도메인별 공식 approval source 미확정.
- **C — D2B-2 구현 진입:** **HOLD / `blocked_by_authority`**. Canonical Taxonomy 조건 0건, Variant·승인 Bridge/Mapping/Capability 공급자 불명.
- **잔여 리스크:** 실제 배포 DB 동등성 미검증, RLS row-level 사용자 조건 미검증, 비공개 스키마/외부 승인 source 미조사, 실제 Product Variant 1건 end-to-end readback 미실시.

이 결과는 실제 Hosted DB에서 조회된 **집계·메타데이터**에 한정된다.
배포된 Face Lab의 제품 노출 건수나 얼굴 이미지 품질에 대한 주장이 아니다.
