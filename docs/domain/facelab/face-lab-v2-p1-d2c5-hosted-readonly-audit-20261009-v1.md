# Face Lab V2 / P1-D2C5 — 배포 후보 DB·권한 읽기 전용 감사 (2026-10-09)

- 조사 범위: BEJEWELY `K_beauty` Vercel production 배포 메타데이터, 연결된 비주얼리 Supabase 계정의 후보 프로젝트 메타데이터·Postgres 카탈로그·보안 Advisor, GitHub migration 이력.
- 조사 기준 본선: `a5eb99ac3c7f17e1b55343fc02fda6080c9045e9` (#1198)
- 실행 유형: **읽기 전용**. 프로젝트 목록/메타데이터, `SELECT` 기반 시스템 카탈로그, migration/Advisor 목록만 확인. 비밀값, 사용자별 행, 얼굴 사진, 이미지 원본·JWT는 조회·반출하지 않음.
- **핵심 결론:** 현재 확인된 Supabase 프로젝트는 저장소와 상당 부분 일치하는 유력 후보이지만, **Vercel 프로덕션에 실제 연결된 프로젝트라는 직접 증거가 없음**. 신규 Face Lab 독립 상품 저장소도 아직 없음. **운영 DB 변경/권한 부여 불가(HOLD).**

## 1. 범위 및 식별

| 항목 | 관찰 사실 | 판정 |
| --- | --- | --- |
| Vercel 프로젝트 | `k-beauty`, 연결 Git 저장소 `gycha0109-beep/K_beauty` | 확인 |
| 최신 production 배포 | 배포 상태 `READY`, `main` commit `a5eb99ac` (#1198) | 빌드 배포 메타데이터 확인; 실제 서비스 HTTP 사용 가능/정상 동작을 보장하지 않음 |
| Supabase 연결 계정 | `비주얼리, 랭킹/어노잉레이다` 계정의 프로젝트 중 K-beauty 구조와 일치하는 유력 후보 1건 발견 | 후보 확인 |
| 후보 DB | `gycha0109-beep's Project`, 서울 리전 `ap-northeast-2`, `ACTIVE_HEALTHY`, PostgreSQL 17.6 계열 | 메타데이터 확인 |
| 프로덕션 DB 동일성 | Vercel 프로젝트 환경변수 목록 `GET /v10/projects/{id}/env`에서 **403 Forbidden** (프로젝트/팀 범위 명시 후 재확인 403) | **미확인/설치 차단** |
| Supabase 실제 API 노출 스키마 설정 | 대시보드 Data API 설정을 직접 확인하지 못함 | 미확인/추가 확인 |
| GitHub↔Supabase 정황 | `products`, `product_fact_subjects`, 기존 관리자 및 추천 도메인 다수 확인 | 코드와 일치하는 정황. **배포 연결 증명은 아님** |

**주의:** 감사한 후보 프로젝트를 '현재 운영 프로덕션 DB'라고 단정하지 않는다. 향후 환경 확인 시 Vercel **Production**의 공개 `NEXT_PUBLIC_SUPABASE_URL`에 포함된 프로젝트 참조와 후보 프로젝트의 참조를 안전하게 비교하되, URL 원문·키·비밀값을 보고서에 기록하지 않는다. 계정 관리자 화면에서 담당자가 일치/불일치만 기록할 수도 있다. 환경변수 접근 허용은 별도 권한 절차다.

## 2. 후보 DB 구조·현재 상태

| 조사 | 후보 DB에서 관찰 | 의미 |
| --- | --- | --- |
| `public` 일반 테이블 | **91개**, 현재 RLS enabled 91개 | 현재 설정 상태 확인. 정책 실제 우회 불가능을 증명하지 않음 |
| `public` 일반 뷰 | **6개**, 모두 `security_invoker=true` | 검사한 6개 뷰는 `anon`·`authenticated`에 직접 SELECT 권한 없음 |
| 전체 네임스페이스 | `auth`, `extensions`, `public`, `realtime`, `storage`, `supabase_migrations`, `vault` 확인 | **`face_lab_catalog_private` 스키마 없음** |
| 페이스랩 전용 저장 구조 | `face_lab_%` 이름의 전용 상품 운영 테이블 **0개** | #1196의 모의 조회기만 있으며 실제 전용 저장/공개본 head/철회 원장 미구축 |
| 기존 Face Lab 관련 임시 테이블 | `tmp_face_lab_independent_human_cue_submissions`, `tmp_face_lab_neutral_face_count_submissions` 존재 | 연구/시험 자료로 보이며 실제 신규 상품 운영 저장소로 전용하지 않음 |
| Storage buckets | `storage.buckets` **0개** | 상품 참고 이미지 비공개 버킷/원본 파일 체계 미설치. 다른 환경의 실제 Storage 상태는 별도 |
| 관리자 테이블 | `admin_memberships`, `admin_audit_logs` 존재, RLS 사용 | 기존 관리자 기반은 존재. **Face Lab 전용 승인 권한/업무 테이블은 없음** |

### 2.1 대상별 실제 GRANT 관찰

| 대상 | `anon` SELECT | `authenticated` SELECT | `authenticated` 쓰기 | 해석 |
| --- | --- | --- | --- | --- |
| `public.admin_memberships` | 없음 | 있음 | 없음 | 자신의 활성 회원 기록을 읽는 RLS 정책 존재 |
| `public.admin_audit_logs` | 없음 | 있음 | 없음 | `admin_has_capability('admin.audit.read')` RLS 정책 존재 |
| `public.product_fact_subjects` | 없음 | 없음 | 없음 | 일반 이용자 직접 접근 제한. Face Lab 신규 데이터와 결합하지 않음 |
| `public.products` | 있음 | 있음 | 없음 | 기존 공개 상품 목록. Face Lab 독립 상품의 승인 근거가 아님 |
| `public.tmp_face_lab_*` 두 개 | 없음 | 없음 | 없음 | 임시 테이블을 신규 상품 DB로 사용하지 않음 |

**행 단위 결과 검사 미수행:** SQL 권한 목록/정책 메타데이터를 확인했으며, 실제 `anon`·일반 `authenticated`·관리자 계정별 API 호출로 **허용/거부를 재현한 것은 아니다**. `GRANT`와 RLS는 별개 통제 수단이다.

## 3. 권한 상승 함수·Advisor 관찰

- `public`에서 이름에 `admin_` 또는 `face_lab`를 포함하는 함수 **59건**, 그중 `SECURITY DEFINER` **55건**. 이를 모두 취약하다고 결론 내리지 않는다.
- 위 59건 이름 필터 범위에서 `authenticated`에게 EXECUTE가 열려 있는 `SECURITY DEFINER`는 `admin_has_capability` **1건**. 범위 바깥에 있는 별도의 `get_current_admin_role` 함수도 `SECURITY DEFINER`·`authenticated` 실행 가능으로 확인. **두 함수 모두 `anon` 직접 EXECUTE 권한 없음**. 이 집계는 개별 함수 서명/명칭 필터 기준으로 제한된 결과이며 프로젝트 전체 함수 감사를 뜻하지 않음.
- `get_current_admin_role`은 `auth.uid()`와 `admin_memberships`를 참조하며, `admin_has_capability`는 상위 역할 판정 함수를 거친다. 실제 권한 우회/익명 계정 차단은 호출 실험 없이 확정하지 않는다. **같은 이름의 오버로드/서명에 따라 검사 행이 달라질 수 있으므로 위 건수 자체를 전역 보증으로 사용하지 않는다.**
- 관리자 감사 RLS는 `admin_has_capability('admin.audit.read')`; 회원 RLS는 `user_id = auth.uid()`와 `is_active`를 검사한다. 현재 `is_anonymous`를 명시 확인하는 코드는 발견하지 못했다.
- Supabase Security Advisor 관찰: `rls_enabled_no_policy`(INFO), `authenticated_security_definer_function_executable`(WARN), `auth_allow_anonymous_sign_ins` 관련 관리자 테이블 2건(WARN), `auth_leaked_password_protection`(WARN).
- **판정:** 경고는 보완 검토 대상이지 침해 증거가 아니다. RLS에 정책이 없는 테이블은 의도적 기본 거부일 수 있다. 익명 사용자가 `authenticated` Postgres 역할을 가질 수 있다는 점을 관리자 기능의 권한 조건에서 분리 검증해야 한다.

후속 검토 참고:
- https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy
- https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable
- https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

**한계:** 일반 인증 역할에 EXECUTE가 가능하다는 사실만으로 함수 내용이 악용 가능하다고 결론 내릴 수 없다. 관리자 함수 내부 분기와 실제 익명 사용자의 역할별 호출 거부를 별도 시험해야 한다.

## 4. 저장소 migration ↔ 후보 DB의 이력 불일치

| 비교 기준 | 건수 |
| --- | ---: |
| GitHub `supabase/migrations` SQL 파일 버전 | **142** |
| 후보 Supabase migration 이력 버전 | **171** |
| 동일 버전 번호 | **101** |
| 저장소에만 있는 버전 | **41** |
| 후보 DB 이력에만 있는 버전 | **70** |

- 기존 관리 기반의 `20260730152900_admin_access_foundation`, `20260804233200_admin_product_candidate_reviews_security_hardening`, `20260815023734_face_lab_hosted_intake_v1`의 **버전 등록은 확인됨**.
- 후보 DB 이력에 최신 등록된 항목은 2026-10-07 무렵이었고, GitHub에는 2026-10-09의 새 SQL 버전도 있다.
- 날짜·번호 변경, 재적용/이력 재기록/브랜치 차이 등 여러 가능성이 있으며, 위 차이만으로 **171건 중 70건이 실제로 잘못 적용됐다거나 41건이 반드시 미적용이라고 단정하지 않는다**.
- 다만 두 버전 목록이 동일하지 않으므로 새 Face Lab SQL 파일을 생성/배포할 때 잘못된 중복 설치·이력 충돌이 발생할 위험이 있다. **이력 대응표/실제 대상 식별 전 마이그레이션 변경 금지**.

## 5. 4나-1 판정 및 실행 가능한 후속 게이트

| 게이트 | 판정 | 후속 확인 |
| --- | --- | --- |
| A. Vercel 프로덕션·저장소 식별 | PASS(배포 메타데이터) | 실사용 호스트 검증은 별도 |
| B. 배포 Supabase 프로젝트 동등성 | **HOLD** | Vercel Production 공개 프로젝트 URL의 **참조 값만** 안전 비교(키 원문 금지). 권한 403 해소 또는 소유자 측 일치 확인 |
| C. 후보 DB 스키마·GRANT·RLS 메타 관찰 | PASS(읽기 전용) | 실제 역할별 DB/API deny 테스트는 미실행 |
| D. 관리자/Storage 기반 존재 | PARTIAL | 관리자 체계 존재, Face Lab 전용 자료/이미지 버킷 부재 |
| E. Git migration 동등성 | **HOLD** | 142/171 버전 대응표, 타임스탬프/이름 교차 참조, 실제 대상 migration 전략 문서화 |
| F. 보안 Advisor 판단 | PARTIAL | 권한 상승 함수/익명 사용자/암호 설정 상세 확인, false positive와 실위험 분리 |
| G. 실제 Face Lab 전용 DB·권한 적용 | **NOT STARTED** | 위 HOLD 해소 및 **별도 명시 승인 후에만** 격리 DB부터 리허설 |

### 권장 작업 순서

1. **4나-1 후속:** Vercel 프로젝트 관리자에게 환경변수 **이름/Production 공개 Supabase 프로젝트 참조 일치 여부만** 확인 가능한 접근을 확보한다. 비밀값을 메시지·PR·로그에 공개하지 않는다.
2. GitHub migrations ↔ DB 이력 **번호/설명 대응표** 작성. 기존 171개를 재실행하거나 41개를 일괄 적용하지 않는다.
3. Supabase Security Advisor에서 실제 위험을 좁혀 검사: `admin_has_capability` 경로, 익명 로그인과 관리자 권한 경계, 공개 뷰·RPC의 GRANT/RLS 실제 허용/거부.
4. 연결 동등성 확보 후 **4나-2**: 기존 #1198 물리 DDL/GRANT/RLS·공개 버전/철회 DB 거래 계약을 실제 관찰된 설치 상태에 맞춰 확정.
5. **4나-3**: 사용자 별도 승인된 격리 DB에서 CAS·중복 요청·철회 경합·비공개 참고 이미지 접근 거부 리허설.
6. 실제 운영 설치 및 비용이 발생하는 체험은 전부 별도 승인 단계.

## 6. 감사 종료 조건

- **A(읽기 전용 후보 메타·기본권한 감사): 완료.**
- **B(실제 프로덕션 Supabase 연결 및 migration 동등성): 미완료. 403 및 이력 차이로 HOLD.**
- **C(실제 권한 거부 테스트/전용 저장소 설치/운영 연결): 미수행.**

**변경 영향:** 감사용 읽기·GitHub 문서/작업기록 외에 DB, RLS, Storage, 인증, API, 데이터, 보안 함수, 배포 설정, 유료 모델 호출 변경 0.
