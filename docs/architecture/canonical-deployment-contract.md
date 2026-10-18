# Canonical Deployment Contract

이 문서는 Phase 46.3c가 참조하는 저장소의 배포 계약이다. 실제 Vercel 프로젝트 설정, 식별자, 자격 증명은 포함하지 않는다.

## Contract

- **Platform:** Vercel
- **Source control:** GitHub 연동
- **Primary production path:** `main` branch push는 GitHub 연동을 통해 Production Deployment를 생성한다.
- **Preview validation:** 현재 `vercel.json`은 `main` 이외의 Git 자동 배포를 차단한다. branch push만으로 Preview 검증이 실행됐다고 간주하지 않는다. 별도 Preview 실행은 명시 승인 후 수행한다.
- **Environment scopes:** runtime environment variables는 Vercel environment scope에서 관리한다. 값은 저장소에 기록하지 않는다.
- **Private dependency installation:** `vercel.json`의 `installCommand`는 `node scripts/security/install-product-dependencies.mjs`를 실행한다. `SCA_PACKAGES_READ_TOKEN`은 production 전용 Secret으로 등록하며, 주 계정의 짧은 만료·`read:packages` 전용 classic PAT를 사용한다. 값은 Git/명령 인자/로그에 남기지 않는다. 설치기는 lifecycle 비활성 설치 후 임시 인증을 삭제하고 실제 수정 코드 검증을 통과한 뒤 rebuild한다. 인증 부재 시 원본 취약 패키지로 대체하지 않고 중단한다.
- **Version and activation:** `package.json`의 Node `22.x` / npm `10.x` 및 lockfile이 기준이다. 저장소 설치 명령은 이 소스가 실제 빌드될 때 적용된다. 현재 main에 없는 설치기를 프로젝트 전역 명령으로 먼저 지정하지 않는다. Secret 등록과 PR의 CI 통과만으로 운영 설치·배포 완료를 주장하지 않는다.
- **Manual promotion:** 기존 Preview Deployment의 수동 Production 승격은 선택적·예외적 경로이며, 현재 표준 배포 절차로 확정하지 않는다. 사용할 경우 별도 승인이 필요하다.
- **Rollback:** 문제가 발생하면 `DISABLE_EVALUATOR_BOUNDARY_CANDIDATE_POLICY_RUNTIME=1`을 우선 적용한다. 배포 자체의 rollback은 이전 정상 Vercel deployment 복귀를 원칙으로 하지만, 정확한 rollback 명령·권한·자동화 방식은 아직 미확정이다. CandidatePolicy runtime rollback에는 DB, Storage, schema 변경이 필요하지 않아야 한다.
- **Kill switch:** `DISABLE_EVALUATOR_BOUNDARY_CANDIDATE_POLICY_RUNTIME=1`을 우선 적용해 runtime을 즉시 기존 경로로 되돌린다. enable flag와 canary scope가 있어도 disable이 우선한다.
- **Approval boundary:** 실제 배포, Production 승격, rollback 실행, Vercel environment variable 변경은 별도 명시 승인이 필요하다.

## Phase 46.3c Reference

Canary 계획은 Preview Deployment에서 synthetic probe와 aggregate observability를 확인한 뒤, 별도 승인된 범위에서만 `main` push 기반 Production Deployment를 검토한다. weighted traffic split은 미확정이므로 가정하지 않는다. kill switch 전파가 확인되지 않거나 safety/response/recommendation/DB/Storage 조건이 깨지면 배포 진행을 중단하고 이전 정상 deployment로 rollback한다. 실행 가능한 dry-run 단계는 [production canary runbook](../runbooks/evaluator-boundary-policy-production-canary-dry-run.md)에 고정한다.

이 문서는 배포 계획을 명문화할 뿐이며, 실제 배포나 환경변수 변경을 수행하지 않는다.

## Not Recorded

Vercel project ID, team ID, token, secret, 실제 환경변수 값 및 hosted API 결과는 기록하지 않는다.

## Still Unconfirmed

저장소에는 실제 Vercel project/team 식별자나 인증값을 기록하지 않는다. 운영 대상 연결은 적용 전에 읽기 전용으로 확인하고, 실제 설치·배포 결과와 traffic/승격 권한은 별도 검증한다. GitHub CI 설치 성공은 Vercel 운영 빌드의 실행 증거를 대신하지 않는다.
