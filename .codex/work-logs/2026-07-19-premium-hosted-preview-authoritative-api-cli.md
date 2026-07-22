# Premium Hosted Preview Authoritative API CLI Fallback

## 목적

Hosted Preview attestation 생성 시 `GITHUB_TOKEN`과 `VERCEL_TOKEN`을 직접 복사하지 않아도, 이미 인증된 `gh` 및 `vercel` CLI 세션을 사용할 수 있게 한다.

## 설계

우선순위:

1. 환경변수 bearer token이 있으면 기존 REST fetch 사용
2. token이 없으면 shell 없이 인증된 CLI 호출
   - GitHub: `gh api`
   - Vercel: `vercel api`
3. 두 경로 모두 JSON만 허용하고 redirect를 자동 추종하지 않음
4. CLI stdout 파싱 실패, 실행 파일 부재, 비정상 종료는 fail-closed
5. token, stdout 원문, stderr 원문을 결과 artifact에 기록하지 않음

Windows에서는 `gh.exe`, `vercel.cmd`를 명시하고 `shell`을 사용하지 않는다.

## 구현

- `scripts/premium-hosted-preview-authoritative-api.mjs`
- `scripts/verify-premium-hosted-preview-authoritative-api.mjs`
- attestation generator의 API client 교체
- package verifier script 추가

## 적대 테스트

- Windows CLI 명령과 인자 고정
- token 모드에서 CLI 호출 금지
- CLI 모드에서 fetch 호출 금지
- bearer header 확인
- redirect manual 확인
- malformed JSON 거부
- CLI 부재/실패 거부

## 리뷰

최초 발견:

- Important 1: shell 사용 시 인자 주입 및 command history 노출 가능
- Important 1: CLI stderr 원문을 오류에 포함하면 민감정보 유출 가능
- Medium 1: Windows `.cmd` 실행 경계 불명확

보완:

- `execFile`만 사용하고 shell 금지
- 오류에는 정규화된 code만 남김
- Windows 실행 파일명을 명시
- stdout 최대 크기 제한
- token/CLI 모드를 결과에 비민감 문자열로만 표시

최종:

- Critical 0
- Important 0
- Medium 0

## 비대상

- Production
- DB/schema/RLS/Auth 정책
- OAuth credential 자체
- 실제 로그인 자동화
- merge 및 Draft 해제
