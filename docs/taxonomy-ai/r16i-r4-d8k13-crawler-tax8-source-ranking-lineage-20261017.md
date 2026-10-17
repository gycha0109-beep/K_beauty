# D8K-13 — Crawler SQL 구분자·Taxonomy8 상품 투영·source_rankings 권한 이력 감사

> **2026-10-17 KST / Supabase 읽기 전용 SELECT / 운영 DDL·DML 0 / PR #1341 Draft·HOLD.**
>
> 사용한 근거는 운영 `supabase_migrations.schema_migrations` 전체 178개 기록, 운영 `pg_catalog` 및 집계형 상품 Projection 조회, PR 브랜치의 SQL 파일 blob SHA이다. 고객·상품 식별자와 과거 SQL 본문·credential을 공개 PR에 기록하지 않았다. 결과를 고정한 JSON: `scripts/product-evidence/baselines/d8k13-crawler-taxonomy8-ranking-source-lineage-readonly-20261017.json`.

## 1. Crawler 역사적 SQL 본문 — 종료 세미콜론 6개만 불일치

`20260822130309_crawler_canonical_adoption_authority_remediation_v1.sql`의 현재 Git blob SHA는 `22af0580f01f0f2fecc1611c9f721e05d606244f`. 운영 적용 이력의 `statements[1]`에는 SQL 32,273 bytes / 1개 statement가 남아 있다.

문자열 literal·quoted identifier·dollar-quoted PL/pgSQL 함수 본문을 보존하는 lexer로 과거 원문과 현재 Git SQL을 비교한 결과:

- 운영 저장 기록 **5,072 tokens**, 현재 GitHub 파일 **5,078 tokens**.
- 현재 파일에만 `END;`와 dollar closing delimiter 사이의 `;`가 **정확히 6개** 존재한다. 그 외 **5,072개 토큰 모두 동일**하다.
- 현재 파일에서 해당 위치(1-based 행): **63, 202, 466, 486, 750, 866**.
- 범위: `DO` 블록 1개와 `admin_set_product_candidate_identity_resolution_v1`, `promote_product_candidate_structural_v1`, `promote_product_candidate`, `admin_confirm_product_candidate_structural_adoption_v1`, `admin_preflight_product_candidate_review` 등 함수 5개.
- 운영 DB에서 연관 함수 이름 6개 모두 `pg_proc`에 존재하며 `anon/authenticated` 직접 EXECUTE는 허용되지 않는 것을 SELECT-only로 확인했다.

**판정:** `TOKEN_EQUIVALENT_EXCEPT_SIX_TERMINAL_SEMICOLONS`. 기존 `DELIMITER_OR_FUNCTION_BODY_DRIFT_REQUIRES_NATIVE_PG17_REVIEW`는 **로직 본문 변경이 발견된 사례가 아니라 구분자 차이가 정확히 격리된 사례**로 더 정밀하게 좁혀졌다. 단, `schema_migrations.statements`의 저장 규칙이 왜 종료 세미콜론을 보존하지 않았는지 검증하지 않았으며 **원본 바이트 동등성, 과거 실제 SQL 적용 시점, 전체 migration 재생 성공을 입증하지 않는다**. 기존 fixture의 핵심 SQL을 이 결과만으로 수정하거나 운영에 재실행하지 않는다.

## 2. source_rankings — 현재 안전한 ACL과 과거 ACL 생성 출처는 구별

운영 적용 이력 **178건 전체**에서 `source_rankings` 문자열을 포함하는 migration은 6건. 그 기록들에 `public.source_rankings`를 대상으로 하는 명시적 **CREATE TABLE 0 / GRANT 0 / REVOKE 0**건을 확인했다(정규표현식 기반 텍스트 검사). 2026-06-21의 `phase1_ranking_snapshot_pipeline`은 `ALTER TABLE` 및 INSERT 코드가 있으나 공개 역할에 대한 명시적 테이블 권한 조정은 적용 본문에 남아 있지 않다.

현재 운영 PostgreSQL17의 ACL:
- `source_rankings` 소유자 `postgres`, RLS ON.
- `anon/authenticated` 직접 읽기·쓰기 권한 없음, `service_role` INSERT 허용.
- 현재 `relacl`은 `postgres` 및 `service_role`에만 권한 부여.
- 하지만 **현재** `postgres`가 `public`에 생성하는 테이블의 default ACL에는 `anon` 전체 테이블 권한이 포함된다. 현재 기본값이 테이블 생성 시점에도 동일했다고 증명하지 않는다.

**판정:** `CURRENT_EFFECTIVE_ACCESS_DENIED / HISTORICAL_SOURCE_RANKINGS_ACL_ORIGIN_NOT_ATTESTED`. 공개 쓰기가 현재 열려 있다는 주장은 **틀림**. 반면 테이블이 언제 어떤 SQL로 생성됐고 공개 기본권한이 언제 정리됐는지는 178개 저장된 migration 본문으로 **출처 확인되지 않음**. 자동 `GRANT/REVOKE`, migration-history `repair`, 초기 migration 재실행은 금지한다. 별도 원본 초기 스키마/배포 백업/릴리스 기록 등 독립 증거가 필요하다.

반면 `ranking_snapshots`의 후속 권한 회수/부여는 적용 이력 `20260621151304` 및 `20260621152040`에서 이미 증명됐다. 두 테이블의 ACL 상황을 혼합하지 않는다.

## 3. Taxonomy8 — 현재 투영 미일치 11건 모두 과거 적용 이후 생성

실제 운영 상품 식별자를 출력하지 않고 `public.products`와 `catalog_taxonomy_product_exact_equivalence_v1`을 집계했다.

| 현재 검사 (2026-10-17) | 건수 |
| --- | ---: |
| 상품 전체 | **176** |
| 정확한 단일 legacy Projection 유지 | **165** |
| exact_equivalent=false인 상품 | **11** |
| └ Category NULL + `shadow_only` / `shadow` / projection 없음 | **10** |
| └ Category 존재하지만 정확한 projection 없음 | **1** |
| 정확한 projection 뷰 row 0 또는 복수 row | **0** |
| 11건 중 2026-09-14 이전 생성 | **0** |
| 11건 중 2026-09-14 이후 생성 | **11** |
| 카테고리 있으나 projection 없는 한 건의 생성일 | **2026-10-01** |

과거 `data_taxonomy8_nullable_legacy_category_projection_v1`은 운영에서 `products.category DROP NOT NULL` 단일 **64-byte DDL**만 기록돼 있다. 현재 GitHub의 더 넓은 선행 DO 검사는 적용 이력에 없다.

**의미 구분:**
- 현재 11건의 비정확 투영은 **모두 마이그레이션 버전 날짜 이후 생성**되었다. 이것이 2026-09-14 당시 preflight가 실패했음을 뜻하지 않는다. 과거 시점의 실제 데이터 스냅샷은 아직 없다.
- `shadow_only` 10건의 NULL legacy projection은 구조적 상품 수집과 추천 진실 분리라는 설계상 예상 상태일 가능성이 높다. **실제 Recommendation admission 판정은 별도의 기존 엔진 기준으로 확인**해야 하며, `NULL`이 추천 승인이라는 뜻은 아니다.
- 나머지 **category non-NULL인데 projection 없는 1건**은 운영 상품 데이터 품질/Taxonomy assignment 출처의 **별도 읽기 전용 조사 대상**이다. 자동 보정·상품/Offer/가격/CTA 변경 없이, 독립적으로 원인을 확인한다.

**판정:** `HISTORICAL_TAXONOMY8_PREFLIGHT_NOT_ATTESTED / POST_MIGRATION_PROJECTION_DATA_QUALITY_REVIEW_REQUIRED`. 이 결과로 이미 nullable인 category를 과거처럼 강제 NOT NULL로 만들거나 선행 migration을 재실행하면 안 된다.

## 4. 재현 및 완료·차단 경계

- 실행 검증 PASS: `scripts/product-evidence/sql/d8k13-crawler-taxonomy8-source-ranking-readonly-audit-v1.sql`. **SELECT-only**로 이력/ACL/상품 집계·구분자 개수를 확인한다. SQL 원문과 row ID는 반환하지 않는다.
- 증거 고정: `scripts/product-evidence/baselines/d8k13-crawler-taxonomy8-ranking-source-lineage-readonly-20261017.json`. Crawler 현재 파일 blob SHA, 비교된 6개 줄 번호, historical source_rankings 허용/미확인 구분, Taxonomy8 집계값을 기록한다.
- 오프라인/릴리스 정적 계약 검사에 이 증거와 Git blob SHA를 연결한다. `--enforce-release`는 변경 없이 의도적으로 종료 코드 3을 유지한다.
- 공급망 보안 `#1208`은 독립 security track에서 계속 **OPEN** (braces/node-forge candidate patch CI 존재, 실제 배포 lockfile과 raw npm audit 미해결); 이 PR에서 임시 예외를 연장하거나 의존성을 변경하지 않았다.
- 기존 D8K-13 PG17 부분 체인 및 2026-10-17 SEC-05/Ranking ACL 합성 Docker PG17 **개별 PASS는 유지**하지만, 전체 178개 운영 적용 이력의 원자적 clean-replay/backup restore/OWNER 독립 검토가 인증됐다는 뜻이 아니다.

**결론: Crawler 차이는 6개 종료 세미콜론으로 격리, source_rankings의 현재 공개 권한은 차단, Taxonomy8 현재 미일치 11건은 모두 후발 생성. 운영 전체 릴리스와 자동 데이터·스키마 보정은 여전히 HOLD.**
