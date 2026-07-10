# First Disabled Shadow Dry-run Minimal Patch Review

## Phase 39 목적

Phase 38 patch plan에 따라 최초의 disabled-by-default shadow dry-run 배선을 최소 범위로 추가했다. 이 단계의 목적은 boundary/evaluator/CandidatePolicy 정책 연결이 아니라, 명시적 development flag가 켜진 경우에만 route 밖 helper와 local artifact writer를 호출할 수 있는지 정적·계약 샘플로 검증하는 것이다.

“이 문서는 first disabled shadow dry-run minimal patch review이며, runtime 정책 변경 또는 CandidatePolicy 연결 승인이 아니다.”

## 적용 범위

- `app/api/analyze/route.js`: 기존 response와 recommendation이 확정되고 premium session, guard completion, 기존 functional shadow capture가 끝난 뒤 guarded call site를 추가했다.
- `lib/shadow-boundary-dry-run-artifact-writer.js`: schema validation과 forbidden-field validation을 통과한 artifact만 local `tmp/shadow-boundary-dry-run/` 아래에 기록하는 writer를 추가했다.
- Phase 39 static/invariance verifier 두 개를 추가했다.
- API response 필드, recommendation 결과, evaluator/CandidatePolicy runtime, DB/Supabase 구조와 데이터는 변경하지 않았다.

## Route Call Site와 Guard

Call site는 최종 `responsePayload`와 recommendation ID 순서가 준비된 뒤, `return response` 직전에 배치했다. premium/store payload를 만든 뒤에 위치하므로 helper 결과가 저장 payload에 합쳐질 경로가 없다.

실행 조건은 다음 두 조건을 모두 만족해야 한다.

- `NODE_ENV === "development"`
- `DEV_ONLY_SHADOW_BOUNDARY_DRY_RUN === "1"`

기본값과 production에서는 guard가 dynamic import 이전에 반환한다. flag 값은 log 또는 artifact에 기록하지 않는다. helper/writer 예외는 고정된 warning만 남기고 기존 response 흐름을 계속한다.

## Feature Flag 동작

- flag 미설정: disabled
- development이 아닌 환경: disabled
- development + 명시적 flag: dry-run wiring만 실행 가능
- production 활성화: 불가
- flag on이어도 response, recommendation, premium/store payload, DB/Supabase에는 영향을 주지 않는다.

## Artifact Writer

Writer는 dev-only flag를 다시 확인하는 이중 guard를 갖는다. 출력 디렉터리는 workspace의 `tmp/shadow-boundary-dry-run/` 하위로 제한하며 경계 밖 경로는 거부한다. schema 검증 및 forbidden-field scan 이전에는 파일을 쓰지 않는다.

Writer 실패는 throw하지 않고 `artifact_write_failed_non_blocking` summary를 반환한다. DB client, Supabase client, RPC, Storage 또는 analytics writer를 import하거나 호출하지 않는다. route는 writer 반환값을 response나 persistence payload에 사용하지 않는다.

## Snapshot 범위

- baseline response: top-level key 목록과 shape hash만 보존한다.
- baseline recommendation: topPick ID, supporting product ID 순서, budget alternative ID 순서만 보존한다.
- boundary hint: Phase 39에서는 empty/not-connected snapshot이다.
- receiver: Phase 39에서는 empty/not-connected snapshot이다.
- comparison: response/recommendation diff false, DB write count 0, safety violation count 0, forbidden-field detected false로 생성한다.

Route에서 writer로 전달되는 값은 snapshot contract와 dry-run helper가 만든 sanitized artifact뿐이다. 전체 response body와 제품 표시 데이터, raw input, media, PII, env/secret 값은 전달하거나 저장하지 않는다.

## 불변성 검증

- response mutation: 정적 diff 검사에서 감지되지 않았다. 기존 payload는 동일한 `publicDecision + meta` 구조로 `NextResponse.json`에 전달된다.
- recommendation mutation: topPick, supportingProducts, budgetAlternatives 할당 또는 순서 변경 로직이 추가되지 않았다.
- DB/Supabase write: writer에 client/import/mutation 호출이 없고 계약 artifact의 write marker는 false다.
- forbidden fields: 금지 필드를 주입한 sample은 schema/forbidden scan 단계에서 write가 차단됐다.
- actual route invocation: 수행하지 않았다. Phase 39 artifact의 `routeInvoked`는 false다.

## 아직 연결하지 않은 범위

- evaluator runtime 및 hard filter/score/weight
- CandidatePolicy runtime 및 hint receiver runtime
- API response와 UI
- 추천 결과 교체 또는 노출 그룹 변경
- DB/Supabase 저장, schema, migration
- production flag 활성화

## Rollback

1. `DEV_ONLY_SHADOW_BOUNDARY_DRY_RUN`을 off 또는 미설정 상태로 유지한다.
2. route의 guarded call site를 제거하거나 비활성화한다.
3. local `tmp/shadow-boundary-dry-run/` artifact를 정리한다.
4. response/recommendation/DB-write verifier와 build를 다시 실행한다.

Flag 기본값이 off이므로 첫 번째 rollback은 code path를 dynamic import 이전에 차단한다.

## Phase 40 제안

별도 승인 아래 actual `/api/analyze` 요청 없이 flag-off/flag-on helper-level verification을 먼저 확장하거나, local development에서 첫 dry-run을 수행할 경우 기존 runbook의 response/recommendation/DB-write baseline 비교와 kill criteria를 그대로 적용한다.

