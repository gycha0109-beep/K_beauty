# Canonical Deployment Contract

이 문서는 Phase 46.3c가 참조하는 저장소의 배포 계약이다. 실제 Vercel 프로젝트 설정, 식별자, 자격 증명은 포함하지 않는다.

## Contract

- **Platform:** Vercel
- **Source control:** GitHub 연동
- **Primary production path:** `main` branch push는 GitHub 연동을 통해 Production Deployment를 생성한다.
- **Preview validation:** `main` 이외의 branch push는 Preview Deployment를 생성하며, Production 반영 전 검증에 사용한다.
- **Environment scopes:** runtime environment variables는 Vercel environment scope에서 관리한다. 값은 저장소에 기록하지 않는다.
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

저장소에는 Vercel project metadata나 CI/CD workflow가 포함되어 있지 않으므로, 정확한 project linkage, team 설정, traffic split, 자동 승격 job 및 운영자 권한은 별도 확인 대상이다.
