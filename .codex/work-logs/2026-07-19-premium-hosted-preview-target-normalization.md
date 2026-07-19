# Premium Hosted Preview Target Normalization

## 기준

- 저장소: `gycha0109-beep/K_beauty`
- 구현 Draft PR: #51
- 수정 시작 HEAD: `27df1bc033b86b3b39a452e439b62055f9216e69`
- READY Deployment: `dpl_4EwrmFYcHwM31gD9MkWVfEku6a2M`
- Vercel project: `prj_VHh3BMegmXFGwxgOJLlgFQjksmKA`
- 환경: Preview only

## 발견한 live blocker

Vercel의 실제 PR Preview Deployment API 응답은 `target: null`을 반환했다.
기존 attestation generator는 해당 값을 그대로 기록하고 verifier는 `vercelTarget === "preview"`만 허용하므로, 정상 PR Preview도 `attestation_target_invalid`로 거부된다.

Production 허용이나 verifier 완화 없이 Vercel API 의미를 안전하게 정규화해야 했다.

## 설계

`target: null`을 단독으로 Preview로 간주하지 않는다.
다음 세 Vercel Git identity가 GitHub PR의 authoritative identity와 모두 일치할 때만 Preview로 정규화한다.

- `githubPrId` 또는 `gitSource.prId` = 현재 PR 번호
- `githubCommitRef` 또는 `gitSource.ref` = 현재 PR head ref
- `githubCommitSha` 또는 `gitSource.sha` = 현재 PR head SHA

허용:

- raw target `preview` + exact PR/ref/SHA binding
- raw target `null` + exact PR/ref/SHA binding

거부:

- Production
- 다른 PR
- 다른 branch ref
- 다른 SHA
- custom/unknown target
- identity metadata 누락

## 구현

- `scripts/premium-hosted-preview-vercel-target.mjs` 추가
- attestation generator가 PR-bound Vercel identity를 먼저 검증한 뒤 target을 정규화
- attestation에 raw target, target evidence, Vercel PR/ref identity를 함께 기록
- contract verifier에 null-target Preview, explicit Preview, wrong PR/ref/SHA, Production 적대 테스트 추가

## 자체 리뷰

최초 검토:

- Critical 1: `target: null`만 보고 Preview로 인정하면 비-Production deployment를 과도하게 허용할 수 있음
- Important 1: downstream evidence에서 정규화 근거를 확인하기 어려움

보완:

- null target 단독 허용 금지
- PR 번호, head ref, head SHA 3중 결속
- attestation에 `vercelRawTarget`, `vercelTargetEvidence`, `vercelSourcePrNumber`, `vercelSourceRef` 기록
- Production 및 identity mismatch 적대 테스트 추가

최종 리뷰:

- Critical 0
- Important 0
- Medium 0

## 범위

- Production 승격 없음
- DB/schema/RLS/Auth/Payment/runtime/UI 변경 없음
- 사용자 로컬 작업 트리 접근 없음
- merge 및 Draft 해제 없음
