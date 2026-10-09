# Face Lab V2 / P1-D2C6 — 배포 DB 식별 및 마이그레이션 이력 차이 해소 실행 설계 v1

- 작성일: 2026-10-10
- 설계 기준 본선: `54aae425134cbebe65c958845c98aa87a0825afa`
- 사실 근거: `face-lab-v2-p1-d2c5-hosted-readonly-audit-20261009-v1.md` (#1199), `face-lab-v2-p1-d2c5-operational-storage-security-preflight-v1.md` (#1198)
- 유형: **설계만**. DB/Auth/RLS/Storage/마이그레이션/환경변수/API/배포/운영 데이터/유료 이미지 호출 변경 없음.
- **최종 의도:** 4나-1 감사에서 남은 두 개의 `HOLD`를 객관적 증거로 해소한 후에만 Face Lab 전용 물리 스키마·권한 리뷰(4나-2) 및 격리 DB 리허설(4나-3)로 이동.
- 보고 범위: 현재 Supabase 후보 DB는 운영과 구조가 비슷하지만 **실제 Vercel Production DB라고 확인하지 못함**. 아래 숫자는 2026-10-09 스냅샷이며 다음 조사 때 다시 수집해야 한다.

## 1. 먼저 분리해서 다룰 두 개의 차단 조건

| ID | 실패 조건 | 이전 관찰 | 위험 | 통과 원칙 |
| --- | --- | --- | --- | --- |
| `HOLD-ID` | 배포와 DB 후보의 연결 정체성 미확정 | Vercel `k-beauty` Production READY 및 GitHub 연동 확인, Production env 목록 권한 403 | 엉뚱한 DB를 프로덕션으로 오인 | **실제로 서빙 중인 Production 배포**의 프로젝트 참조를 후보 DB 참조와 비교, 감사 시점/증거 위치 기록 |
| `HOLD-MIG` | 저장소 파일과 DB 적용 이력 차이 | Git SQL 142개, hosted 이력 171개, 동일 버전 101개 / repo-only 41개 / hosted-only 70개 | 중복 실행, 순서 역전, 대상 불일치, 권한/함수 충돌 | 모든 불일치 버전의 설명/출처/영향을 분류하고 Face Lab 의존 객체의 설치 상태·변경 위험 판정 |

**우선순위:** A(배포 DB 정체성) → B(그 DB의 이력 대조). A가 해결되기 전에는 후보 DB의 이력 대조를 **후보 감사**로만 표시하고 프로덕션 결론으로 승격하지 않는다.

## 2. A트랙 — Vercel Production ↔ Supabase 프로젝트 식별

### 2.1 식별할 대상과 증거 수준

1. Vercel `k-beauty` 프로젝트의 Git 연동 저장소·Production branch 및 해당 시점 실제 서비스 도메인의 활성 배포/alias를 확인.
2. 활성 Production 배포의 고정 SHA와 대상 환경(`production`)을 기록. `READY`는 성공적인 배포 상태일 뿐 **도메인에서 현재 제공되는 배포와의 일치 증명은 별도**.
3. 운영 서버가 실제 받는 공개 설정 `NEXT_PUBLIC_SUPABASE_URL`에서 **프로젝트 참조 문자열만** 추출. API 키/서비스 키/전체 URL·환경변수 원문은 보관하지 않음.
4. Supabase 연결 계정의 확인된 프로젝트 참조와 비교.
5. Production/Preview/Development가 같은 프로젝트를 사용 중인지 여부를 **참조 비교만으로** 별도 확인. Preview 환경을 Production으로 오인하지 않음.

### 2.2 안전한 증거 획득 경로

- **우선:** Vercel 관리자가 Production 변수 목록을 **값 복호화 없이** 확인할 수 있는 최소 조회 권한을 통해 프로젝트 참조를 비교. 실제 값은 기록/복사하지 않고 `same_project_ref=true/false`, 확인 시각, Vercel 프로젝트/Production 범위, 확인 주체만 기록.
- **대안:** 권한 있는 프로젝트 소유자가 Vercel 대시보드에서 `NEXT_PUBLIC_SUPABASE_URL`의 프로젝트 참조만 확인하여, Supabase 프로젝트 관리 화면에 보이는 참조와 **동일/불일치 판정**을 전달. 비밀키·토큰·DB 접속 문자열은 제공하지 않음.
- 공개 빌드 번들에 설정이 노출되는 경우도 있지만 **403 권한을 우회하려고 무단으로 내부 배포 파일/비밀 값을 추출하지 않는다**. 브라우저 번들 정보만으로 실제 서버 측 비공개 연결을 단정하지 않는다.
- Vercel 계정에 접근 권한이 없으면 **확인 불가(HOLD)**. 다른 Supabase 프로젝트로 추측 교체하지 않는다.
- 환경변수 이름이 없거나 서로 상충할 경우 앱의 실제 서버 설정 로딩 경로·배포 환경별 override를 별도 정적 조사한다.

### 2.3 PASS / HOLD / FAIL

| 결과 | 판정 |
| --- | --- |
| 현재 서비스 도메인 → Production 배포 SHA·프로젝트 확인; Production 공개 Supabase 참조 ↔ 후보 프로젝트 참조 일치; 앱의 읽기 경로에서 다른 프로젝트 override 정황 없음 | **A-PASS**: 해당 범위에서 DB 동일성 확인 |
| env 접근 403, 알 수 없는 override, 참조는 같지만 실제 서버 런타임 연결 경로 불명확 | **A-HOLD**: 더 좁은 서버 확인 필요 |
| 참조 불일치, Preview/다른 Vercel 프로젝트/다른 서비스 도메인 확인 | **A-FAIL**: 잘못된 후보. 실제 대상부터 재식별 |

**추가 주의:** 공개 `NEXT_PUBLIC_` 연결 참조의 일치는 사용자가 요청하는 일반 Supabase 클라이언트의 연결을 뒷받침하지만, 별도 서버 전용 연결/읽기 역할까지 같은 DB라는 보장은 아니다. 서버 전용 연결 여부는 정적 설정 경로와 허가된 설정 메타데이터를 조합해 점검한다.

### 2.4 결과물

`production-db-identity-evidence.md` 개념 보고 항목:
- 조사 시각/도메인/프로젝트 이름/active Production SHA
- Production 환경 확인 방법과 접근 수준
- 프로젝트 참조 **비교 결과(boolean)**, 서버 측 override 의심 여부
- 의심 경로/해소 담당자, A-PASS/A-HOLD/A-FAIL
- 키/URL/토큰/환경변수 평문 **0건**

## 3. B트랙 — migration 이력 대조 규칙

### 3.1 비교에 사용하는 세 자료

1. GitHub 기준 브랜치 `main`의 `supabase/migrations/*.sql` 파일명, 버전/이름/파일 SHA-256, Git 커밋 이력(읽기 전용).
2. **A트랙에서 확정된 대상 DB**의 공식 migration 목록: 적용 버전/설명/기록 순서.
3. 필요할 때만 개별 migration의 **기대 객체 집합**과 실제 `pg_catalog`의 객체 존재·인덱스·함수 시그니처·GRANT·RLS/정책 상태를 대상별 읽기 전용 대조.

저장소의 SQL 해시와 현재 DB의 객체 상태는 서로 다른 관찰 대상이다. **버전/이름이 같아도 SQL 실제 내용의 동일 실행을 보증하지 않으며**, SQL 파일이 목록에 없다고 미적용이라고 확정할 수 없다.

### 3.2 키 파싱·매칭 및 판정 알고리즘

- 파일명은 `^([0-9]{14})_(.+)\\.sql$`로 버전과 나머지 설명을 분리. 파싱 실패한 파일은 예외로 기록하고 임의 이름 보정 금지.
- hosted 버전은 문자열로 보존하여 숫자 오버플로/타임스탬프 손실 방지.
- **1차 매칭:** 동일 버전으로 결합. 설명 이름 같은지 추가 표시(다르면 `version_match_name_drift`).
- **2차 후보:** repo-only와 hosted-only에서 설명 이름을 정규화하여 가능한 대응 후보 열거. 동일 이름 다수가 있으면 자동 1:1 확정 금지.
- **3차 증거:** Git 히스토리에서 이름 변경/이동, 별도 브랜치 채택 기록, PR merge·변경 이력 확인. 이 단계도 파일 내용과 실행 여부 증거와 혼동하지 않는다.
- **4차 객체 대조:** 출처/시점/영향 범위가 중요한 파일만 SQL이 추가·변경한 테이블/함수/인덱스/정책과 현재 객체 상태를 read-only로 비교. 실제 적용 로그 없이 SQL 부분 실행 여부를 단정 금지.
- **5차 리스크:** 대상이 Face Lab 또는 인증/관리 권한/RLS/Storage/추천 공용 경계를 건드렸는지, 재실행하면 충돌할지, 동일 객체 다른 버전 관리가 존재하는지 분류.
- 최종 분류는 모든 파일/이력에 `exact_record`, `version_match_name_drift`, `renamed_or_reversioned_candidate`, `repo_only_intentional`, `hosted_only_intentional`, `missing_or_unrecorded`, `object_drift`, `unresolved` 중 하나. `candidate`는 확인 완료와 다르다.

### 3.3 필수 출력 표(컬럼)

| 필드 | 설명 |
| --- | --- |
| `repo_version`, `repo_name`, `repo_sql_sha256` | 저장소 근거. 없으면 null |
| `hosted_version`, `hosted_name` | 확인된 DB 이력 근거. 없으면 null |
| `match_type` | 버전/설명/이름 바뀐 후보/단독 |
| `git_commit_or_pr` | 변경·합치기·이름 변경 근거 |
| `object_probe_scope` | DB 객체 단위 확인 범위 |
| `object_status` | 일치/차이/미검증 |
| `affects_face_lab_or_privileges` | 직접/간접/무관/불명 |
| `classification` | 최종 분류 상태 |
| `evidence_level` | 파일명/이력/코드 역사/객체 검사 |
| `action_proposal` | 읽기 추가 조사/설계 검토/보류/격리 테스트 권고 |
| `decision` | PASS/HOLD/FAIL 및 근거 |

기본 출력 `migration-reconciliation.csv`와 사람이 검토할 요약 `migration-reconciliation-review.md`. **신규 migration 작성/실행 결과물이 아니다**.

### 3.4 초기 집계와 그 의미

2026-10-09 감사 기준: repo 142, hosted 171, 버전 동일 101, repo-only 41, hosted-only 70.

- 기준 시점 이후 `main`이나 hosted가 바뀔 수 있으므로 **매 조사 시작에 새로 수집**하고 이전 숫자를 자동으로 재사용하지 않음.
- 차이 111(41+70)개는 **미대응 버전의 양측 건수 합계**다. 이것이 곧 문제가 있는 SQL 111개, 또는 미적용 41건이라는 뜻이 아니다.
- 같은 버전 101건도 이름·실제 객체가 동일한지 별도 확인이 필요하다.
- 파일이 누락돼 있다고 생성/복사/재실행하거나, 이력을 맞추려고 `supabase_migrations` 행을 직접 편집하지 않는다.

### 3.5 검증 스크립트 규격(다음 단계, 별도 구현)

입력은 사람이 확보한 비밀 없는 **읽기 전용 목록 JSON/CSV** 및 해당 브랜치의 migration 파일 목록. 스크립트 자체는 네트워크/DB 없이 실행할 수 있게 설계한다.

예상 파일:
- `scripts/facelab/audit/compare-face-lab-migration-history.mjs`
- `scripts/facelab/audit/verify-face-lab-migration-history.mjs`

요건:
- 파일명에서 버전/이름 정확 추출, 중복 버전 충돌 감지, 정렬 결정성, 전체 집합 보존 검증(`matched + repo_only == repo_count`, `matched + hosted_only == hosted_count`).
- 설명 이름만 맞는 항목은 **후보** 표시. 동일성이 확인되지 않은 항목을 `applied`로 승격 금지.
- SQL 내용 해시와 DB 실제 적용 상태를 동일시하지 않음.
- 입력 누락/중복/파싱 실패/기준 커밋 또는 후보 DB 정체성 미확정 때 보고서 상태 `HOLD`.
- 출력은 민감 정보 없는 이름·버전·결과만, 임의 DDL 실행·마이그레이션 자동 적용 없음.
- 계층별 범위: 모든 이력 집계 + **Face Lab 의존 객체 우선 심층 검증**. 무관한 트랙의 불일치도 분류하되, 자동으로 재실행하지 않음.

## 4. 기존 보안 경고 및 독립 Face Lab 저장소와의 연결

2026-10-09 후보 DB 읽기 조사에서:
- `public` 일반 테이블 91개 모두 RLS 활성화, 뷰 6개 `security_invoker=true`
- `admin_memberships`/`admin_audit_logs` 존재
- Face Lab 전용 상품 운영 스키마/테이블 0, Storage buckets 0
- Supabase Advisor는 익명 로그인·`SECURITY DEFINER` 실행/비밀번호 유출 보호 등의 추가 검토 항목 제시

**이 관찰은 권한 침해/권한 정상의 최종 결론이 아니다.** 다음 보호 경계 설계에서는:
1. `admin_has_capability` 등의 실제 함수 실행 권한·관리자 계정/익명 계정에서의 거부 검사.
2. DB 대상이 확정된 뒤 Face Lab 전용 비공개 스키마, 9개 논리 자료 모델, publication/review heads, 철회 세대, 고유 제약, immutable version 설계.
3. 직접 사용자 테이블 읽기를 기본 차단하고 서버 전용 최소권한 조회 경계를 확정.
4. 실제 Storage 비공개 버킷과 사용권·객체 SHA 검증은 **별도 격리 대상에서만**, 허가 뒤 수행.
5. 배포 중인 사용자 앱의 스킨케어 추천·Face Lab 분석/추구미/루틴 등 비상품 기능 보존.

## 5. 전체 실행 순서와 중단 조건

| 순서 | 범위 | 실행 산출물 | 진행 조건 |
| --- | --- | --- | --- |
| 1 | Production alias → 활성 배포 SHA → 실제 Vercel 프로젝트/Production 범위 식별 | `deployment-identity-evidence` | 기존 Vercel 읽기 권한 |
| 2 | Production 공개 Supabase 참조 vs 후보 DB 참조 **boolean 비교** | A-PASS / A-HOLD / A-FAIL | Vercel 변수 조회 권한 또는 소유자 안전 확인 |
| 3 | 대상 확정 후 Git SQL 파일 + DB 이력 최신 **읽기** 수집 | 두 출처 개수·고정 시점 스냅샷 | A-PASS |
| 4 | 버전/이름/이력 및 객체 위험 분류 | reconciliation CSV 및 예외 검토표 | 전수 분류; 불명분은 unresolved |
| 5 | Face Lab·Auth·관리자·Storage 의존 migration의 정확한 선행 상태 확인 | 의존성 검토/충돌 위험표 | 고위험 불명/충돌이 있으면 HOLD |
| 6 | Face Lab 물리 스키마/RLS/서버 조회 설계 확정 | migration 설계서, GRANT/RLS 매트릭스, rollback 계획 | A-PASS, B 결과 검토 PASS |
| 7 | 격리 DB 설치·두 접속에서 경합/철회/권한 거부 검증 | 실제 테스트 로그 | **별도 명시 승인**, 운영 DB 비접근 |
| 8 | 운영 설치 | 본선 승인 migration/플래그/검증 | **별도 명시 운영 승인** |

**즉시 중단 규칙**
- Vercel 환경변수 403을 근거 없이 우회하거나 Production/Preview 대상을 혼합하는 경우.
- migration/version 설명이 같다는 이유로 자동 실행하거나 hosted migration 이력을 삭제/수정하려는 경우.
- `service_role` 등 기존 강한 권한을 이용해 Face Lab 사용자 읽기를 편법으로 열려는 경우.
- DB 비밀, 토큰, 전체 접속 URL 또는 사용자 얼굴/이미지 원본이 보고서/로그/PR에 들어가는 경우.
- 관리자 인증·RLS·Data API 정책 변경이 사용자 허가 없이 필요해지는 경우.

## 6. 종료 판정

- **A — 연결 DB 식별 계획 작성:** Production 범위, 대상 비교, 403 대응 경로, 필요 증거, PASS/HOLD/FAIL 정의 **설계 완료**. **실제 프로젝트 동일성 아직 미확정**.
- **B — migration 정합성 절차 작성:** 전체 집합 보존, 버전/설명 대응, 이력·실제 객체 증거 분리, 분류 및 출력 계약 **설계 완료**. **실제 재대조 아직 미수행**.
- **C — 설치 안전성 증빙:** A-PASS 및 4나-2 의존성 분류 완료 후, 격리 DB/운영 권한 검증. **미착수**.

**권고하는 바로 다음 실행:** 비밀 없는 migration 목록에 대한 오프라인 대응표 생성기(네트워크/DB 호출 0)를 먼저 구현하고, Vercel Production 프로젝트 확인은 권한 있는 소유자 또는 최소권한 조회 경로로 별도 추진한다.

관련: #1199 읽기 전용 감사, #1198 스키마/권한 사전 설계, #1196 오프라인 발표본/철회 모델.
