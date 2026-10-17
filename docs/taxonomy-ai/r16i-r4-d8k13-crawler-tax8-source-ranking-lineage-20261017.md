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
| 이 1건의 canonical taxonomy assignment | **0건** |
| 이 1건의 legacy 카테고리 / 수집 원천 유형 | **sunscreen / official_product_page** |

과거 `data_taxonomy8_nullable_legacy_category_projection_v1`은 운영에서 `products.category DROP NOT NULL` 단일 **64-byte DDL**만 기록돼 있다. 현재 GitHub의 더 넓은 선행 DO 검사는 적용 이력에 없다.

**의미 구분:**
- 현재 11건의 비정확 투영은 **모두 마이그레이션 버전 날짜 이후 생성**되었다. 이것이 2026-09-14 당시 preflight가 실패했음을 뜻하지 않는다. 과거 시점의 실제 데이터 스냅샷은 아직 없다.
- `shadow_only` 10건의 NULL legacy projection은 구조적 상품 수집과 추천 진실 분리라는 설계상 예상 상태일 가능성이 높다. **실제 Recommendation admission 판정은 별도의 기존 엔진 기준으로 확인**해야 하며, `NULL`이 추천 승인이라는 뜻은 아니다.
- 나머지 **category non-NULL인데 projection 없는 1건**을 추가 조회한 결과, **sunscreen + official_product_page** 출처이며 **canonical taxonomy assignment가 0건**이다. 이는 shadow-only 10건과 구별되는 실제 정합성 검토 대상이다. 원본 상품 ID·상품명은 공개 PR에 게시하지 않으며 자동 보정·상품/Offer/가격/CTA 변경 없이 독립적으로 원인을 확인한다.

**판정:** `HISTORICAL_TAXONOMY8_PREFLIGHT_NOT_ATTESTED / POST_MIGRATION_PROJECTION_DATA_QUALITY_REVIEW_REQUIRED`. 이 결과로 이미 nullable인 category를 과거처럼 강제 NOT NULL로 만들거나 선행 migration을 재실행하면 안 된다.

## 4. 재현 및 완료·차단 경계

- 실행 검증 PASS: `scripts/product-evidence/sql/d8k13-crawler-taxonomy8-source-ranking-readonly-audit-v1.sql`. **SELECT-only**로 이력/ACL/상품 집계·구분자 개수를 확인한다. SQL 원문과 row ID는 반환하지 않는다.
- 증거 고정: `scripts/product-evidence/baselines/d8k13-crawler-taxonomy8-ranking-source-lineage-readonly-20261017.json`. Crawler 현재 파일 blob SHA, 비교된 6개 줄 번호, historical source_rankings 허용/미확인 구분, Taxonomy8 집계값을 기록한다.
- 오프라인/릴리스 정적 계약 검사에 이 증거와 Git blob SHA를 연결한다. `--enforce-release`는 변경 없이 의도적으로 종료 코드 3을 유지한다.
- 공급망 보안 `#1208`은 독립 security track에서 계속 **OPEN** (braces/node-forge candidate patch CI 존재, 실제 배포 lockfile과 raw npm audit 미해결); 이 PR에서 임시 예외를 연장하거나 의존성을 변경하지 않았다.
- 기존 D8K-13 PG17 부분 체인 및 2026-10-17 SEC-05/Ranking ACL 합성 Docker PG17 **개별 PASS는 유지**하지만, 전체 178개 운영 적용 이력의 원자적 clean-replay/backup restore/OWNER 독립 검토가 인증됐다는 뜻이 아니다.

**결론: Crawler 차이는 6개 종료 세미콜론으로 격리, source_rankings의 현재 공개 권한은 차단, Taxonomy8 현재 미일치 11건은 모두 후발 생성. 운영 전체 릴리스와 자동 데이터·스키마 보정은 여전히 HOLD.**


## 5. Supabase 보안 Advisor 읽기 전용 확인

2026-10-17 실제 Supabase `security advisors`를 **조회만** 했다. 총 5개 lint 유형 / 82개 findings(`INFO 77`, `WARN 5`)이다. **82개가 실증된 취약점이라는 뜻은 아니다.**

- `rls_enabled_no_policy` **INFO 77개**: RLS ON에 정책이 없는 서버 전용 테이블이 다수 포함된다. 실제 권한/사용 목적 확인 없이 SELECT 정책을 자동 추가하면 오히려 노출 위험이 생기므로 조치 금지. <https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy>
- `authenticated_security_definer_function_executable` **WARN 2개**: `public.admin_has_capability(text)`과 `public.get_current_admin_role()`. 두 함수는 authenticated가 호출할 수 있는 `SECURITY DEFINER`지만, 실제 함수 코드에서 `auth.uid()`와 **활성 admin_memberships** 검사 및 role capability 비교를 확인했다. `anon/PUBLIC` 직접 실행은 거부된다. **권한 우회가 입증된 것은 아니며**, 관리자 RPC 공개 범위에 대한 독립 보안 검토가 필요하다. <https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable>
- `auth_allow_anonymous_sign_ins` **WARN 2개**: `admin_audit_logs`의 SELECT 정책은 `admin_has_capability('admin.audit.read')` 조건, `admin_memberships`의 SELECT 정책은 `user_id=auth.uid()` 및 `is_active=true` 조건이 있다. 익명 로그인 사용자도 PostgreSQL `authenticated` 역할을 가질 수 있으므로 실제 멤버십/권한 정책에 대해 따로 검토하되, 이 경고만으로 데이터 유출이 실증됐다고 판단하지 않는다. <https://supabase.com/docs/guides/database/database-advisors?queryGroups=lint&lint=0012_auth_allow_anonymous_sign_ins>
- `auth_leaked_password_protection` **WARN 1개**: 유출 비밀번호 방지 기능 비활성화. 인증 관리자에게 별도 설정·사용자 영향·배포 권한 승인 요청이 필요하며 이번 작업에서 Auth 설정을 변경하지 않았다. <https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection>

저장된 advisor metadata-only snapshot: `scripts/product-evidence/baselines/d8k13-hosted-security-advisors-readonly-20261017.json`. 운영 자격 증명, user membership rows, function 내부 비밀값 및 실제 사용자/상품 식별자는 저장하지 않았다.

**보안 리뷰/운영 Auth 설정 승인/공급망 `#1208`/백업 복원/독립 OWNER 미완료이므로 릴리스 HOLD.**

## 6. 후속 P0 읽기 전용 조사 계약 및 아직 결론 내릴 수 없는 부분

최신 8소스 SEC-05 확장 PG17 PASS는 **역사적 ACL/마이그레이션 계보**를 입증하지 않는다. 다음은 본 2026-10-17 SELECT-only 스냅샷으로 확인된 범위와 아직 필요한 독립 근거다.

| P0 항목 | 현재 확인 | 남은 증명 |
| --- | --- | --- |
| `source_rankings` | 운영 RLS ON, 공개 역할 직접 읽기·쓰기 차단. 저장 178건 SQL에서 명시적 CREATE/GRANT/REVOKE 이력 0 | 최초 객체 생성·소유자·default ACL 및 변경 시점의 별도 초기 백업/릴리스 artifact |
| `product_candidates` | 현재 RLS ON, anon/authenticated 접근 거부, service_role INSERT/UPDATE; 명시적 ACL 변경 적용 본문 확인 불가 | 원시 CREATE 경로와 이후 GRANT/REVOKE 이력의 독립 attestation |
| Crawler | 현재 SQL과 저장 SQL의 비구분자 5,072 토큰 일치, 종료 세미콜론 여섯 곳 차이 | 과거 serialization 원인 및 격리 PG17 parser/function replay. 구분자 외 변경으로 단정 금지 |
| Taxonomy8 | 176건 중 정확 projection 165, shadow_only 10, 후발 `sunscreen`/공식 페이지 1건 canonical assignment 누락 | 특정 행 식별자는 비공개 read-only 검토 후 taxonomy assignment 근거, 생성/승격 경로 및 revision 정합 확인 |
| 178건 전체 | 일부 body·이름/버전 provenance와 후속 ranking repair 입증 | 독립 deployed artifact 복원, 실행 순서·데이터 의존성·clean replay 및 실백업 복원 |

이 체크포인트는 새로운 운영 조회를 실시했다고 주장하지 않는다. 사용자/상품 식별자 및 실제 `schema_migrations.statements` 본문은 공개 GitHub에 올리지 않는다. 별도 안전한 read-only 접근과 확인 가능한 외부 출처가 확보될 때까지 `PROVENANCE_UNATTESTED` / **HOLD** 유지한다.

## 7. 2026-10-17 후속 운영 SELECT-only P0 재조회 (식별자 비공개)

실제 연결된 Supabase PostgreSQL17에서 SQL 본문을 밖으로 출력하지 않는 **SELECT-only** 쿼리로 178개 applied statements 및 현재 `pg_catalog`를 재확인했다. 식별자·개별 제품명·원시 상품 데이터·SQL 원문은 이 증거에 포함하지 않았다.

- `source_rankings`: 저장 적용 SQL 텍스트 포함 기록 6건. 명시적인 직접 `CREATE TABLE` / `GRANT/REVOKE` 좁은 패턴 매칭은 각 **0건**. 현재 RLS ON, `anon/authenticated` SELECT/INSERT=false, `service_role` INSERT=true.
- `product_candidates`: 저장 SQL 텍스트 포함 기록 **40건**. 같은 직접 `CREATE TABLE` / `GRANT/REVOKE` 좁은 패턴 매칭은 각 **0건**. 현재 RLS ON, `anon/authenticated` SELECT/INSERT=false, `service_role` INSERT=true.
- Taxonomy8의 예외 한 건: 기존 `sunscreen` category를 가진 2026-10-01 생성 상품이며 `product_form`은 NULL, canonical assignment **0건**. 이 Product에 결합된 Candidate **1건**의 `review_status=promoted`, `identity_resolution_state=resolved`를 확인. **승격 후보가 있다는 사실은 taxonomy assignment 반영이나 추천 승인·판매 승인과 동의어가 아니다.**

증거: `scripts/product-evidence/baselines/d8k13-p0-targeted-hosted-readonly-20261017.json` (aggregate-only, 식별자 제외). 정규식 매칭은 완전한 SQL parser가 아니고 178개 적용 기록 바깥 초기 스키마/동적 SQL/다른 명명·인용 방식을 증명하거나 배제할 수 없다. **최초 ACL 출처와 단일 상품 assignment 누락 원인은 여전히 미확인**이며, 독립 초기 배포 artifact 및 상품 승격·taxonomy 작성 이벤트의 승인된 감사 근거를 확보하기 전까지 자동 SQL 보정 금지. 전체 `HOLD` 유지.
