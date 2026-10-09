# Face Lab V2 / Visual Try-On — P1-D2B-1 운영 Authority 조사 설계 v1

- 설계 기준: `gycha0109-beep/K_beauty`, `main@1e20ad810119ab53e3bbf89771faba749aacb29c`
- 실행 트랙: `face-research`
- 선행 완료: PR #1169(인증 Product ID reader), #1171(읽기 권한 정적 감사), #1176(Subject↔Variant 승인 Bridge 필수화)
- 참조: `face-lab-v2-p1-d2a-catalog-read-authority-audit-v1.md`; 상세 D2B 상위 설계는 PR #1173에서 검토 중이며 아직 `main`에 병합되지 않았음.
- **본 작업은 설계만 수행한다.** 운영·Hosted DB 접속, 실제 쿼리, API 호출, RPC/role/RLS/GRANT/정책/스키마/저장소/인증/환경 변경, 유료 이미지 호출 모두 미실행.
- 현재 Hosted 권한·버전·데이터 수량·Variant 발행 상태는 **UNKNOWN**. 저장소 migration은 Hosted 현재 상태의 증거가 아님.

## 1. 목적과 명시적 비목표

목적: Face Lab의 `readApprovedTryOnBundle({productId, variantId, slotKey})`을 실제
서버 데이터에 연결하기 **전**에, 운영 환경의 읽기 권한·Canonical 자료·검토된 Variant
identity/bridge/Capability/Category Mapping 존재 여부를 사용자 승인 하에서 **읽기 전용으로 조사**할 계획과 결정 기준을 고정한다.

산출물은 `present / missing / protected / ambiguous / stale / unknown` 단위의
권한 및 데이터 준비도 매트릭스와 다음 D2B-2의 최소 승인 요청 범위다.

아래 작업은 D2B-1의 비목표:
- Product Fact Subject의 `variant_key`를 실제 `variantId` 또는 Shade로 추정
- `shadow_only` Taxonomy를 `canonical`으로 승격하거나 `reserved` category를 활성화
- 신규 카탈로그·Variant·색상·승인 매핑·Capability·증거·이미지 데이터 생성
- 관리자 권한을 Try-On 런타임 자격증명으로 사용; Recommendation 전용 RPC/role 차용
- 새로운 DB migration, GRANT, RLS, RPC, HTTP API, Storage reader, UI 또는 유료 이미지 실행

## 2. 이미 검증된 저장소 측 경계 (운영 사실과 분리)

| 구분 | 저장소 근거 | Hosted 조사에서 결정할 사실 |
| --- | --- | --- |
| Product ID | `lib/server/face-lab-catalog-product-try-on-reader.js`: 사용자 `auth.getUser()` 이후 `products.select("id")` | 실제 사용자·권한 조건에서 해당 Product를 읽을 수 있는가 |
| Subject | `20260809115932_product_fact_storage_v1.sql`: `product_fact_subjects`; `variant_key` NULL 허용, `identity_status`, `current_state`, `market_applicability`, `region_applicability`, `valid_from/to` | 권한·상태·적용 지역별 적법한 Subject가 있는가 |
| Variant bridge | #1176 `catalog-product-try-on-binding.js`: `subjectVariantBridge`의 Product/Subject/Variant/SubjectKey/approval/mappingVersion/evidence 검증 | 실제 승인·유효 관계를 제공할 운영 저장/읽기 source가 있는가 |
| Product Variant/Shade | Gate D `face-lab-v2-product-variant-shade-authority-v1.md`: contract-first, Hosted `product_variants` 생성 주장 없음 | 실 Variant identity·색상·근거 자료가 어디에서 승인되었는가 |
| Taxonomy | `20260913201050_data_taxonomy1_shadow_catalog_taxonomy_foundation_v1.sql`: 초기 `catalog-taxonomy-v1`은 shadow-only, Makeup/Lip 분류 일부 reserved | 배포된 **현재** active+canonical 버전/term/assignment가 존재하는가 |
| Category→Slot | `catalog-product-try-on-binding.js`: `categoryBinding` 승인 버전·근거 필요 | 별도 검토·승인된 mapping의 source는 무엇인가 |
| Capability | `candidate-capability.js` 및 Gate B: 명시적 proof-class/evidence required | 실제 후보별 Style capability 근거가 있는가 |
| Reference | `catalog-reference-resolver.js`: `approved/governed_blob` + usagePermission | 이번에는 source 메타 현황만; 이미지 blob 접근은 P1-E에 남김 |

`read_recommendation_admission_authority_v1` 및
`read_product_evidence_presentation_authority_v1`은
`recommendation_admission_runtime` 전용이며 Face Lab 조회 허가의 증거가 아니다.
`service_role`으로 직접 조회 가능하다는 사실도 Face Lab 사용 권한을 부여하지 않는다.

## 3. 실시 전 반드시 받는 범위별 승인

| 승인 항목 | 승인에 포함해야 할 내용 |
| --- | --- |
| A. 대상 환경 | 운영/스테이징 중 정확히 1개 Supabase/Postgres 프로젝트 및 작업 대상 식별. URL·credential은 보고서에 보관하지 않음 |
| B. 실행 주체 | DB 관리자가 허용한 read-only 진단자, 기재된 조회 역할·접속 경로. 권한 상승/대리 가장 금지 |
| C. 데이터 범위 | §4의 메타데이터 및 집계 **읽기 전용**. 상품·사용자·얼굴·Evidence 원문·이미지 blob·개인정보 원문은 기본 조회 금지 |
| D. 쿼리 조건 | 승인된 스키마/컬럼만 사용, 전체 row export 금지, 페이지네이션으로 전체 데이터 덤프 금지, 건별 상품 샘플은 별도 승인 |
| E. 시간·부하 | 1회 실행, 잠금 최소, `READ ONLY` transaction, 단일 질의 타임아웃 3초/lock timeout 1초, 느린 작업 중단 |
| F. 산출물 | 건수/불리언/역할 권한/버전 키/상태 요약. 비밀정보 및 프로덕션 주소·접속 문자열 제외 |
| G. 금지/종료 | 인가 거부·미확인 대상·비정상 부하·권한 부족·개인정보 접근 필요 발견 시 즉시 중단 |

**이번 PR은 위 어떤 실행 승인도 대신하지 않는다.**
사용자의 명시적 승인을 받은 이후에만 1회 read-only probe를 실행할 수 있다.
권한 부재를 service-role·admin 계정 재사용으로 해결하지 않는다.

## 4. 단계별 read-only 조사 프로토콜 (승인 후에만)

### D2B-1A. 환경·DB 객체·권한 메타 확인

1. 승인된 작업 대상의 식별 정보를 보안 운영 경로에서 재확인한다.
2. 실제 설치 객체 중 `public.products`, `public.product_fact_subjects`,
   `public.catalog_taxonomy_versions`, `public.catalog_taxonomy_terms`,
   `public.product_catalog_taxonomy_assignments` 존재 여부 확인.
3. 대상별 RLS 설정 및 현재 실행 역할의 `SELECT` 권한, Face Lab에 승인된
   읽기용 RPC 존재 여부와 `EXECUTE` 범위 확인. 미설치/권한 거부는
   `missing`과 `protected`로 구분.
4. `read_recommendation_admission_authority_v1` 등 추천 전용 RPC는
   **메타데이터 존재만 확인**하고 실행하지 않는다.
5. 직전 migration 파일의 목록과 실제 설치 DB 객체 사이 차이를
   `deployed`가 아닌 `reconciled / mismatch / unknown` 상태로 기록한다.

**운영자가 검토할 질의 예시(아직 미실행, 관리자 승인 범위 내에서만):**

```sql
BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout = '3s';
SET LOCAL lock_timeout = '1s';

SELECT target.object_name,
       to_regclass('public.' || target.object_name) IS NOT NULL AS present
FROM (VALUES
  ('products'),
  ('product_fact_subjects'),
  ('catalog_taxonomy_versions'),
  ('catalog_taxonomy_terms'),
  ('product_catalog_taxonomy_assignments')
) AS target(object_name);

-- 조회 역할별 실제 권한 확인은 승인된 pg_catalog metadata probe에서만 실행.
-- 승인되지 않은 테이블의 데이터는 SELECT하지 않는다.
ROLLBACK;
```

위 SQL은 예시이며 이 문서 자체가 실제 접속 대상의 정합성을 증명하지 않는다.
메타 질의 가능 여부도 대상 DB 역할의 권한에 좌우된다.

### D2B-1B. Subject·Canonical Taxonomy 상태 집계

A에서 **존재 및 접근이 허가된 객체에 한해서만**:
1. Subject 총량을 `identity_status` / `current_state` 별 집계.
2. `variant_key IS NULL` 수, `current`이며 적용 범위·유효 기간 판단이 필요한
   Subject 수, Product당 current Subject 복수 여부를 **aggregate count로만** 조사.
   Subject 식별자나 formulation 원문을 출력하지 않음.
3. Taxonomy version은 `version`, `lifecycle_state`,
   `authority_mode`별 건수만 집계.
4. Taxonomy category term은 `active/reserved/deprecated` 건수 및
   카테고리 후보의 실수용 상태를 버전별 정리.
5. Product taxonomy assignment는 `shadow/canonical/retired` 상태별 집계.
6. JOIN 후 같은 Product+version+term에서 canonical과 active term이
   정확히 호환되는지 집계; 식별 불가/여러 후보면 `ambiguous`.

승인된 operator가 검토할 대표 질의 형태:

```sql
-- 오직 해당 테이블 접근이 별도로 승인된 경우에만 실행.
SELECT identity_status, current_state, count(*)::bigint AS subjects
FROM public.product_fact_subjects
GROUP BY identity_status, current_state;

SELECT lifecycle_state, authority_mode, count(*)::bigint AS versions
FROM public.catalog_taxonomy_versions
GROUP BY lifecycle_state, authority_mode;

SELECT assignment_state, count(*)::bigint AS assignments
FROM public.product_catalog_taxonomy_assignments
GROUP BY assignment_state;
```

테이블 접근 실패를 `0개`로 바꾸지 않는다: 결과는 `protected` 또는 `unknown`.
소수 집계·카테고리 세부 값의 외부 공유 여부는 운영 데이터 공개 정책으로 제한.

### D2B-1C. Variant·Bridge·Category Mapping·Capability source 검증

이 네 권한은 **실제 테이블이나 RPC가 있다고 가정하지 않는다**.
Gate D 및 P1-A/D의 fixture/runtime 계약은 실제 DB 영속 데이터의 증거가 아니다.

각 source 별 소유자(owner), 갱신 승인 흐름, 승인 철회 방식, 검증 가능한
`approvalState`, `mappingVersion/identityVersion`, `evidenceRefs`,
유효기간/범위, 공식 서버 reader를 조사한다.

- Variant: `productId + variantId`, active/resolved 상태,
  Shade Profile/evidence의 실제 발행 여부
- Subject↔Variant: `subjectId + productId + variantId`와
  `subjectVariantKey` snapshot의 일치·승인 근거
- Category→Slot: canonical taxonomy term ID → Visual Try-On registry category와
  선택 슬롯의 명시적 approval
- Capability: 후보별 Style `supportState`·`proofClass`·`proofVersion`·
  namespaced evidence. Taxonomy `supports_capability`를 대체 근거로 쓰지 않음

등록된 canonical source/reader가 없으면 `source_missing`.
소유자/승인/철회 상태가 불명확하면 `unknown`; 애매한 자료는
`ready` 취급하지 않음. 승인한 read-only source가 없으면
**이 단계에서 정지**하고 D2B-2에 필요한 보호 영역 변경 범위만 작성한다.

### D2B-1D. 대상 제품 1건에 대한 사전검증 판단

D2B-1A~1C가 통과하고 **제품 단위 조회를 별도로 허가**받은 경우에만:
1. 기존 서버의 인증 사용자 Product ID 읽기가 허용되는지 확인.
2. Product ID에 해당하는 Subject 후보를 market/region/validity까지 좁혀
   승인된 bridge로 정확히 하나의 Variant와 연결 가능한지 판정.
3. `active canonical version + active category term + canonical assignment`
   및 승인된 category binding/capability 증거를 교차 판정.
4. reference는 메타 권한의 존재 여부만 기록. 실제 image/blob 읽기 및
   Provider request는 금지.
5. 반환하지 말아야 할 개인정보·Evidence 원문은 저장/로그 미사용.

**운영 데이터상 연결 가능한 사례가 확인되어도** D2B-2 read adapter와
P1-E reference 원본 권한이 없으면 `Try-On ready`를 주장하지 않는다.

## 5. 표준 보고 포맷

```json
{
  "auditVersion": "face-lab-d2b1-hosted-inventory-v1",
  "repositorySha": "<recorded_sha>",
  "targetEnvironment": "authorized_environment_only",
  "permissionStatus": "authorized_or_not_authorized",
  "observedAtUtc": null,
  "executionState": "not_run",
  "schemaAndGrants": "unknown",
  "subjectCoverage": "unknown",
  "canonicalTaxonomy": "unknown",
  "variantAuthority": "unknown",
  "reviewedSubjectVariantBridge": "unknown",
  "approvedCategoryBinding": "unknown",
  "supportedCapabilityEvidence": "unknown",
  "authorizedSingleProductRead": "not_run",
  "providerCalls": 0,
  "evidence": [],
  "blockers": []
}
```

실제 실행 후에만 `observedAtUtc`와 관측된 상태를 기록한다.
상태는 `available / source_missing / protected / ambiguous / stale / unknown`.
`available`은 source가 존재하며 그 source의 권한과 승인 상태가
검증된 경우에만 사용한다. **특정 제품 Try-On ready와 구별**한다.

금지: DB URL, key, JWT, 사용자 식별 정보, 상품별 private raw payload,
얼굴 사진, 원본 evidence, query result dump, blob/body, SHA/비밀값 노출.

## 6. 중단 조건과 분기

| 조건 | 즉시 조치 | 후속 |
| --- | --- | --- |
| 대상 환경 또는 사용자 허가가 불명확 | Hosted 조회 중단 | 정확한 환경/작업 승인 필요 |
| 보호 테이블의 SELECT 권한 거부 | 권한 우회 금지, `protected` 기록 | D2B-2 최소 권한 reader 설계 후보 |
| Taxonomy `shadow_only` 또는 category `reserved` | `not_canonical` 기록 | 승인된 별도 Taxonomy governance 트랙 |
| Subject 후보 0 또는 다수/identity 불명확 | `missing/ambiguous` | Product Fact 신뢰도·subject resolution 트랙 |
| Variant/bridge/category/capability 승인 reader 없음 | `source_missing` | 먼저 운영 승인 source 책임 및 발행 경로 확정 |
| Hosted snapshot / migration 근거 충돌 | `stale/mismatch` | 소유자 검증 전 절대 임의 보수 금지 |
| 권한 상승·쓰기 SQL·비밀/개인정보 조회가 필요 | 즉시 중단 | 별도 보호 작업 승인 |
| 쿼리 지연/비정상 부하/timeout | 해당 조사 중단 | 최소한의 진단 내용만 기록 |

## 7. 종료조건 (A/B/C)

- **A — 설계 종료:** 저장소 근거, 조사 질문, 승인 범위, 질의 경계, 결과 포맷,
  중단 기준과 D2B-2 인수인계를 문서로 확정. Hosted 조회 없음.
- **B — 실제 읽기 조사 종료:** 특정 대상·역할·집계 및 기간·데이터 범위에 대한
  명시적 승인과 1회 read-only 점검 결과. 권한 부족/데이터 부재도 증거로 기록하고
  success를 주장하지 않음.
- **C — 다음 단계 진입 허용:** 기존 안전 읽기 경로가 있는 영역과 새 최소권한 reader
  승인이 필요한 영역이 구분됐고, Subject↔Variant governance source의
  소유자·매핑 승인/철회·증거 계보가 확정됨. **C는 실제 렌더링 연결 성공을 뜻하지 않음.**

D2B-1에서 B 또는 C를 통과하지 못하면 `blocked_by_authority`로 종료하고
운영 읽기 권한을 편의상 넓히거나 가상의 승인 데이터를 생성하지 않는다.

## 8. 다음 PR 경계

- 별도 승인 후: D2B-1 **진단 실행 PR 또는 증거 기록**. Read-only, secret·raw export 없음.
- 이후 D2B-2: 결과에 따라 명시적으로 승인된 좁은 SQL/RPC/role/adapter.
  현재 Recipe/Provider/Payment/Auth/Storage 권한·정책은 변경하지 않는다.
- P1-E: 승인된 Product/Variant reference blob reader는 독립 설계·검증.
- 유료 Provider/canary: **전면 제외**. 기존 이미지 생성 건과 연계해 추가 비용을 발생시키지 않음.

**현재 판정:** D2B-1 설계 가능 / 운영 조사 미승인·미수행 / 데이터 준비도 불명.
