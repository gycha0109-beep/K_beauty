# Shadow Flag Invariance + Verifier Integrity Preflight

## Phase 40 목적

Phase 39의 disabled-by-default route 배선이 flag off에서 기존 경로를 건드리지 않고, development flag on helper/writer 경로에서도 response·recommendation·DB mutation을 추가하지 않는지 검증했다. 동시에 기존 verifier가 단순 문자열 존재만으로 현재 patch를 자기 승인하지 않는지 source-only negative control로 확인했다.

“이 문서는 disabled shadow dry-run invariance 및 verifier integrity preflight이며, evaluator/CandidatePolicy 정책 연결 승인이 아니다.”

## Phase 39 Patch 요약

- Route call site는 premium session과 기존 guard/capture 처리가 끝난 뒤, response 반환 직전에 위치한다.
- `NODE_ENV === "development"`와 `DEV_ONLY_SHADOW_BOUNDARY_DRY_RUN === "1"`을 모두 만족해야 dynamic import가 실행된다.
- Writer는 local `tmp/shadow-boundary-dry-run/` 하위만 사용하며 schema validation과 forbidden-field scan 이후에만 기록한다.
- Helper/writer 결과는 response, recommendation, premium/store payload에 병합되지 않는다.

## Flag-off 결과

다음 입력은 모두 disabled로 확인됐다.

- env 없음
- development + flag `0`
- development + flag `false`
- development + 빈 flag
- production + flag `1`
- development + exact value가 아닌 `true`

Route static guard는 flag 조건과 return이 dynamic import보다 앞에 있음을 확인했다. Flag-off writer 호출 sample은 모두 `attempted=false`, `written=false`, `skipped=true`였으며 artifact file count delta는 0이었다.

## Flag-on Helper/Writer 결과

Development + exact flag `1` sample에서 sanitized snapshot artifact 생성과 local tmp write가 성공했다. 기록된 artifact는 기존 schema를 통과했다. tmp 경계 밖 output path, forbidden-field sample은 write 전에 차단됐다. 파일 시스템 failure sample은 throw하지 않고 non-blocking summary를 반환했다.

Response-like 및 recommendation-like 입력은 snapshot/helper/writer 실행 전후에 동일했다. topPick ID와 supporting/budget ID 순서만 snapshot에 남고 입력 object는 mutate되지 않았다.

## Response / Recommendation 불변성

- responseMutationDetected: false
- recommendationMutationDetected: false
- shadow 결과의 public response merge 경로: 미검출
- shadow 결과의 premium/store payload merge 경로: 미검출

이번 결과는 실제 route response 비교가 아니라 helper/writer isolated preflight와 route static guard evidence다.

## DB Mutation Delta

기존 `/api/analyze`에는 guard/session mutation 경로가 있으므로 전체 route write count 0을 주장하지 않는다. Phase 40은 isolated helper/writer 경로에 DB/Supabase client/import/mutation 호출이 없고, writer가 local filesystem만 사용한다는 기준으로 다음을 확인했다.

- shadowAddedDbMutationCount: 0
- supabaseWriteExecuted: false
- 기존 route mutation: 실행·계측하지 않음
- 기존 mutation과 shadow-added mutation의 실제 delta 비교: 격리 환경 확보 전까지 미실행

## Verifier Integrity Negative Controls

Static guard를 실제 파일이 아닌 입력 source를 검증하는 pure validator로 보강했다. 다음 10개 변형은 모두 verifier에서 차단됐다.

1. production guard 제거
2. flag default-on 형태
3. guard 밖 dynamic import
4. shadow result response merge
5. recommendation output mutation
6. premium/store payload merge
7. writer Supabase mutation 추가
8. writer output path의 tmp 경계 이탈
9. forbidden field 기록
10. writer failure의 route error 전파

Negative control은 메모리상의 source text만 변형했으며 실제 route/writer 파일은 수정하지 않았다. 검출 결과는 10/10이고 `needs_verifier_hardening` 상태는 발생하지 않았다.

## 실제 Route 실행

실제 `/api/analyze` 요청은 실행하지 않았다.

- skipReason: `actual_route_execution_not_run_unsafe_or_unverified_environment`
- disposable/isolated dev DB 여부: 검증되지 않음
- production/실사용 Supabase와의 분리: 검증되지 않음
- 기존 route mutation과 shadow-added mutation의 별도 계측: 준비되지 않음
- 안전한 입력/image fixture와 cleanup/rollback: 검증되지 않음

Env/secret 값은 조회하거나 출력하지 않았다.

## Preflight Status

`ready_for_isolated_local_flag_on_run`

이는 최초 flag-on route 실행이 완료됐다는 뜻이 아니다. 격리된 non-production DB, 안전한 fixture, baseline/flag-on mutation delta 계측, cleanup/rollback이 준비되면 다음 단계의 local run을 계획할 수 있다는 의미다.

## Limitations

- 실제 API response와 recommendation 결과를 baseline/flag-on으로 비교하지 않았다.
- 기존 guard/session mutation count를 실행하거나 측정하지 않았다.
- Flag-on 결과는 helper/writer isolated evidence다.
- Production 활성화 및 evaluator/CandidatePolicy runtime 연결은 검증·승인 대상이 아니다.

## Phase 41 허용 범위

허용:

- disposable non-production dev DB 확인 절차
- baseline vs flag-on mutation delta instrumentation 설계
- 안전한 input/image fixture와 cleanup runbook
- 격리 조건 충족 후 최초 local flag-on route run

금지:

- evaluator runtime 또는 CandidatePolicy runtime 연결
- API response·추천 결과·UI 변경
- DB/Supabase schema 변경
- production flag 활성화

