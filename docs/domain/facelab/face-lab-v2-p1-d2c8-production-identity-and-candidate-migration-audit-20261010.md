# Face Lab P1-D2C8 — Vercel Production 식별 및 후보 DB 마이그레이션 읽기 감사

- 관찰일: 2026-10-10 KST
- 저장소 고정 SHA: `8755bb6e5faa010c9e9e4dae8775da61628fca20`
- 선행 설계: `docs/domain/facelab/face-lab-v2-p1-d2c6-hosted-identity-migration-reconciliation-plan-v1.md`
- 작업 종류: **연결된 Vercel·Supabase의 승인된 메타데이터/공식 이력 조회, 저장소 정적 확인만 수행**.
- 금지 유지: env 평문 및 비밀키 출력·수집, DB SQL/RPC/DDL 실행, migration 적용·기록 변경, 서비스 배포, CI 보안 예외 연장, 운영권한 변경.
- **종합 판정: A-HOLD / B-CANDIDATE-ONLY-HOLD**. 실제 서비스 DB 동일성이 확인되지 않았으므로 아래 후보 DB 이력은 Production 결론이 아니다.

## A. 현재 제공 중인 Vercel 배포 및 배포 대상 식별

| 증거 | 관찰값 | 해석 |
| --- | --- | --- |
| Vercel 프로젝트 | `k-beauty` / `prj_VHh3BMegmXFGwxgOJLlgFQjksmKA` | 읽기 메타데이터 |
| Project team | `team_xuYA9OhCWlJETaYFOmeVodgS` | Vercel 식별자 |
| Production 최신 READY 배포 | `dpl_3FNjyLaN2w8hyDf9UmZA7GBqt8ck` | 목록과 별칭 API에서 확인 |
| 배포 환경/브랜치 | `production` / `main` | Vercel 메타데이터 |
| 배포 Git SHA | `8755bb6e5faa010c9e9e4dae8775da61628fca20` | 저장소 `main` SHA와 당시 일치 |
| 현재 배포에 붙은 alias | `k-beauty-two.vercel.app`, `k-beauty-johnny-self.vercel.app`, `k-beauty-git-main-johnny-self.vercel.app` | `list_deployment_aliases` 결과 |
| 연동 Supabase 계정의 후보 프로젝트 | `bygrczggxfuisupcevaz` (서울, ACTIVE_HEALTHY) | DB 연결 동일성 증거는 아님 |
| 후보 계정의 기타 프로젝트 | `yjdubukqkcvkymabskzd` (RanKing&Radar) | 이름만으로 대상 추정 금지 |
| Vercel Production 환경 변수 목록 | **HTTP 403 / forbidden** | 값·설정 식별 불가. 권한 우회하지 않음 |
| Production Supabase 프로젝트 참조 일치 | **unknown** | `A-HOLD` |

### 코드상 대상 설정 경로(정적 조사)

아래 경로에서 `NEXT_PUBLIC_SUPABASE_URL`을 공통 URL 소스로 사용한다.

- `lib/supabase/browser.js`, `lib/supabase/browser-client.js`: 브라우저 클라이언트
- `lib/supabase/server.js`, `lib/supabase/server-client.js`: 서버 SSR / 인증 경로
- `lib/supabase/middleware.js`: 세션 미들웨어
- `lib/supabase-admin.js`: 서버 관리 클라이언트의 URL은 같은 변수를 사용하지만 인증키는 별도 `SUPABASE_SERVICE_ROLE_KEY`.

이는 **코드상의 기본 설정 계약**일 뿐, 실제 배포 변수의 값이나 다른 코드 경로의 별도 연결 부재를 보장하지 않는다. 서비스에서 관찰한 공개 빌드 설정으로 서버 연결까지 단정하지 않는다.

### A-HOLD 해제에 필요한 소유자 확인

Vercel의 승인된 Production 설정 확인 권한이 있는 소유자/관리자가 다음 **결과만** 보관한다.

1. 현재 alias가 가리키는 Production 배포 ID 및 SHA가 위와 같은지 재확인.
2. 해당 배포의 `NEXT_PUBLIC_SUPABASE_URL` 프로젝트 ref와 Supabase 관리 화면 후보 ref가 같은지 **boolean** 비교. `SUPABASE_SERVICE_ROLE_KEY`, 접속 문자열, 전체 URL, 토큰, env 값 원문은 채팅/PR/로그에 기입하지 않음.
3. 서버 전용 DB URL override가 있는지 존재 여부만 확인하고, 있다면 승인된 참조 비교로 추가 검증.
4. 조사 시각/확인 주체/Production 환경 확인 범위/프로젝트 ref 일치 여부/override 의심 여부를 기록.

하나라도 확인 불가 시 A-HOLD 지속. ref 불일치 시 A-FAIL 및 실제 대상으로 조사 범위 재설정.

## B. 후보 Supabase 프로젝트 마이그레이션 목록 대조

**대상 경계:** 연결된 Supabase 후보 프로젝트 `bygrczggxfuisupcevaz`의 공식 `list_migrations` 조회 결과. **현재 운영 서비스 DB라고 확인된 것이 아님.** 저장소 Git tree는 위 SHA. 모든 숫자는 재조사 시 바뀔 수 있다.

| 단위 | 수량 | 비고 |
| --- | ---: | --- |
| 저장소 `supabase/migrations/*.sql` | 143 | 14자리 버전 136 / 과거 8자리 버전 7 |
| 저장소 고유 버전 | 142 | `20260824` 중복 파일 2개 |
| 후보 DB 이력 행/고유 버전 | 171 / 171 | 공식 API, 동일 버전 중복 0 |
| 버전 문자열이 일치한 **저장소 파일** | 101 | SQL 실행·해시·객체 동일성 증명 아님 |
| 저장소에서 일치 버전이 없는 **파일** | 42 | **41개 고유 버전**. 중복 파일 때문에 파일 수가 1개 더 큼 |
| 후보 DB에서 일치 저장소 버전이 없는 **이력** | 70 | 누락/재실행 대상 확정 아님 |
| 저장소 잘못된 이름 | 0 | 파일명 인벤토리 사전 점검 기준 |

※ 이전 보고서의 `repo-only 41`은 **버전 집합 수**, 이번 `repo-only 42`는 **파일 수**다. 서로 다른 집계 단위를 구분해야 하며 과거 데이터와 모순된 것은 아니다.

### 특별 조사: `20260824` 충돌

| 출처 | 버전 | 설명 이름 | 확인된 의미 |
| --- | --- | --- | --- |
| 저장소 | `20260824` | `add_product_localized_names` | 표시용 `products.name_en`/`brand_en` 컬럼 추가 |
| 저장소 | `20260824` | `backfill_product_english_display_names` | 상품 영문 표시명 백필 |
| 후보 DB 공식 이력 | `20260824123819` | `add_product_localized_names` | 버전/이름 **이력 행만** 확인 |
| 후보 DB 공식 이력 | 해당 이름의 행 없음 | `backfill_product_english_display_names` | SQL 실행 여부 **미확정** |

- 저장소의 두 SQL은 2026-08-24 PR #303, Git merge commit `aa3042eb5c94128d4af7a4286231a1fc390362a5`에서 함께 추가.
- `20260824123819_add_product_localized_names`는 이름이 대응하는 **버전 변환 후보**다. 원본 SQL SHA의 DB 내 동일성·실제 실행 증거가 아니므로 `renamed_or_reversioned_candidate`, 판정 HOLD.
- 백필 이름이 공식 이력 목록에 없더라도 수동 적용/일괄 스크립트/기타 방법 실행 가능성이 남는다. **미적용 확정, 복구 실행, 파일명 자동 변경 모두 금지**.
- 후보 DB의 기존 `name_en`/`brand_en` 컬럼 존재 여부·값 상태는 **이번 조사에서 조회하지 않음**. 프로젝트 신원이 확정된 후 허가된 읽기 전용 객체 점검을 별도로 설계.

### Face Lab 관련 이력 이름의 존재

후보 목록에는 `face_lab_hosted_intake_v1`, `face_lab_neutral_face_count_intake_v1`, `face_lab_neutral_face_count_campaign_v2_compat`, `face_lab_v2_persistence_revision`, `face_lab_test_quota_partition_v1`, `face_lab_simulation_test_guard_v1` 이름의 기록이 존재한다. **객체 설치 상태, 접근 권한 정상, Production 적용 여부의 증거가 아니다.**

## C. 보안 CI 및 작업 PR 연결

- Face Lab 비교기/진단기 PR [#1209](https://github.com/gycha0109-beep/K_beauty/pull/1209)에서 실제 디렉터리 기준 Node 검증 23건 PASS, DB 호출 0, SQL 적용 0 확인.
- 공급망 검사 `Package integrity and vulnerability gate`는 본선에도 존재하는 `braces@3.0.3` 취약점 `GHSA-vfj7-8cjw-p6xm`의 임시 예외 만료로 실패. [보안 이슈 #1208](https://github.com/gycha0109-beep/K_beauty/issues/1208). 현재 GitHub Advisory 기준 upstream 수정 배포 버전 없음.
- 이 보고서는 보안 예외 수정/연장이나 PR #1209의 CI 우회를 정당화하지 않는다. 전체 필수 게이트 PASS 이전에는 PR 병합 보류.

## D. 다음 실행 조건/순서

1. **A-ID:** 승인된 Vercel 소유자 확인으로 Production DB ref 일치 boolean 및 서버 전용 override 여부 확정. 미확정이면 Production 판정 HOLD.
2. **B-MIG:** A-PASS 후 대상 고정 SHA/시각의 최신 Git SQL + **실제 동일 DB의** 공식 이력 목록을 재수집. 오프라인 비교기 사용.
3. **B-OBJ:** 해당 DB에 대한 별도 허가를 받은 후, `20260824` 컬럼/백필 및 Face Lab/Auth/RLS 의존 객체를 **읽기 전용**으로 좁게 검사; 인가/설치·기록 일치 여부를 증명.
4. **보안 트랙:** 취약 전이 경로 제거/안전한 상위 의존성 대체를 검증 후 공급망 게이트 복구. 임시 예외 기간만 연장하지 않음.
5. **설계 승인:** A/B 불일치·권한 위험 정리 전까지 Face Lab 물리 스키마 설치, SQL 재실행, migration 이력 수정 금지.

### 종료 판정

- **배포-별칭 식별:** 메타데이터 조회 완료.
- **배포↔Supabase 후보 DB 동일성:** 확인 권한 부족으로 **A-HOLD**.
- **후보 DB 공식 migration 목록:** 171행 읽기 완료, 보존된 스냅샷 집계 확보. **B-CANDIDATE-ONLY-HOLD**.
- **실제 운영 DB migration reconciliation:** 미착수 / **HOLD**.
- **운영 변경 및 DB 쓰기:** 0건.
