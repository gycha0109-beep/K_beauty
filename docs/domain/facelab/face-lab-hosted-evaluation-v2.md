# Face Lab Hosted Evaluation Contract v2

## 1. 상태

- 작업명: Face Lab 1C-1.1 Hosted Evaluation Rate-limit & Failure Classification Hardening
- 적용 대상: consented local fixture를 사용하는 `/api/face-reading` hosted evaluation harness
- 비대상: observation enum·threshold·Vision prompt 의미·대표 상·스타일링·무료/Premium UI·DB·인증·결제·Production API
- v1 문서: `face-lab-hosted-evaluation-v1.md`는 당시 harness 계약과 과거 결과 해석을 위한 역사적 기준으로 유지한다.
- 신규 실행·신규 record·summary·report는 v2 계약을 따른다.

이 계약은 Face Lab의 전체 제품 구조를 새로 정의하지 않는다. Face Lab의 canonical observation 계약을 실제 provider 환경에서 안전하게 평가할 때 transport 실패와 제품 계약 실패를 분리하는 실행·판정 경계다.

## 2. 목적

v2는 다음 오류를 제거한다.

1. HTTP 429의 일반 `message`, `retryAfterSeconds`를 privacy violation으로 집계
2. transport 실패로 eligibility 결과가 없는데도 expected eligibility와 비교해 mismatch로 집계
3. 평가 불완전 상태를 계약 FAIL 또는 PASS로 축약
4. terminal 429 이후 후속 case를 계속 호출
5. timeout·network failure를 무조건 재시도해 중복 분석·중복 과금 가능
6. case ID가 한 번 기록됐다는 이유만으로 resume 완료 처리
7. malformed/partial JSONL을 조용히 누락
8. 문자열 containment만으로 fixture 경로를 신뢰
9. response·image·manifest·record row를 무제한 읽기

## 3. 판정 계층

평가는 반드시 다음 순서로 분리한다.

```text
Transport
→ Canonical validation
→ Expected-result comparison
→ Persisted-output privacy audit
→ Run gate
```

### 3.1 Transport

```text
success
rate_limited
client_error
server_error
timeout
network_error
not_attempted
```

`success`가 아니면 canonical과 expected-result 비교는 `not_evaluable`이다.

### 3.2 Canonical

```text
valid
invalid
not_evaluable
```

- HTTP 2xx의 canonical observation object가 현재 observation contract를 충족하면 `valid`
- expected-ineligible case에서 명시적 ineligible eligibility와 정상 unavailable envelope이 반환되고 canonical analysis가 없으면 `valid`
- HTTP 2xx이지만 canonical shape가 malformed이면 `invalid`
- transport가 success가 아니면 `not_evaluable`

### 3.3 Eligibility comparison

```text
match
mismatch
not_evaluable
```

transport success와 명시적 eligibility가 모두 있어야 비교한다. 결과가 없으면 mismatch가 아니다.

### 3.4 Privacy

```text
pass
violation
```

privacy audit는 저장되는 allowlisted projection의 불변식을 검사한다.

실제 violation:

- raw `observation_analysis` 노출
- image/base64/crop/buffer payload
- `sourceImagePersisted: true`

privacy violation이 아닌 항목:

- 429 오류 응답의 일반 `message`
- `retryAfterSeconds`
- 예상하지 못한 일반 response key

예상하지 못한 key는 `unexpectedResponseShape` 진단으로만 분리한다. 원래 key 이름이나 raw body는 record에 저장하지 않는다.

## 4. Gate

```text
FAIL > INCONCLUSIVE > PASS
```

### PASS

- 모든 planned case의 최신 final record가 존재
- 모든 case가 평가 가능
- privacy/canonical/expected-result 위반 없음
- records integrity 정상
- legacy partial classification 없음

### FAIL

다음 중 하나 이상:

- privacy violation
- canonical contract failure
- expected-ineligible canonical violation
- eligibility mismatch

미평가 case가 동시에 존재해도 gate는 `FAIL`이며 `evaluationComplete`는 `false`다.

### INCONCLUSIVE

실제 계약 위반은 없지만 다음 중 하나 이상:

- terminal 429
- timeout/network failure
- 회복되지 않은 retryable 5xx
- circuit breaker 또는 attempt cap에 따른 not-attempted
- planned case 미완료
- malformed/partial/duplicate/non-monotonic JSONL
- summary 생성 중 records 변경
- v1 record의 partial legacy reclassification

## 5. Retry와 circuit breaker

### 기본값

- concurrency: 1
- case delay: 1500ms
- 429: 유효한 retry hint가 있고 최대 대기 시간 이내일 때 최대 1회
- 429 hint 없음: 재시도 없음
- 502/503/504: 최대 1회
- 500: 재시도 없음
- 400/401/403/404/413/415/422: 재시도 없음
- timeout/network: 재시도 없음
- ambiguous retry: 명시적 `--retry-ambiguous-failures`에서만 허용
- max retry wait: 120000ms
- jitter: 사용하지 않음

### Retry-After

다음을 지원한다.

- numeric `Retry-After`
- HTTP-date `Retry-After`
- JSON body의 safe numeric `retryAfterSeconds`

header와 body hint가 모두 유효하면 더 긴 대기 시간을 선택한다. 최대 대기 시간을 초과하면 재시도하지 않는다.

### 전역 429 circuit breaker

최종 transport 결과가 `rate_limited`이면 나머지 case의 HTTP 요청을 중단한다.

```js
transport.status = "not_attempted";
transport.reasonCode = "rate_limit_circuit_open";
```

이 case는 privacy/canonical/eligibility/request failure로 중복 집계하지 않는다. run은 `INCONCLUSIVE`가 된다.

## 6. Network boundary

- base URL: `http://localhost`, `http://127.0.0.1`, `http://[::1]` 계열 origin만 허용
- base URL에 path/query/hash/credentials 금지
- endpoint: 고정 `/api/face-reading`
- fetch: `redirect: "error"`
- final response origin이 시작 origin과 다르면 실패
- raw response body, provider message, headers, stack, cause를 저장·출력하지 않음
- console은 정규화한 case ID와 transport status만 출력

## 7. 파일 경계

### Fixture

- logical path는 `private/face-lab-fixtures/` 아래 repository-relative path
- fixture root와 image의 `realpath` 확인
- image realpath가 fixture root realpath 밖이면 차단
- symlink escape 차단
- regular file만 허용
- case ID를 파일명으로 사용하지 않음

### MIME

확장자와 magic byte가 모두 일치해야 한다.

- JPEG
- PNG
- WEBP

manifest의 declared MIME이 있으면 magic byte와도 일치해야 한다.

### 기본 크기 제한

- image: 15 MiB
- response body: 2 MiB
- manifest/run manifest: 1 MiB
- records JSONL row: 256 KiB

Content-Length만 신뢰하지 않고 실제 읽은 response byte도 제한한다.

## 8. Run lock와 JSONL integrity

### Run lock

```text
<run-dir>/.lock
```

- `open(..., O_EXCL)` 방식의 배타 생성
- lock이 있으면 기본 실패
- 자동 stale 판단·삭제 금지
- 운영자가 실행 프로세스 부재를 확인한 경우에만 `--recover-stale-lock`

### JSONL

- 완성된 JSON 문자열과 newline을 한 번의 append로 기록
- row size 제한
- malformed middle row 차단
- 마지막 partial line을 corruption으로 분류
- `recordSequence` positive safe integer
- duplicate/non-monotonic sequence 차단
- summary 생성 전후 size/mtime/SHA-256 비교
- records integrity가 invalid면 PASS 금지 및 신규 요청 중단

## 9. Record v2

```js
{
  schemaVersion: "face-lab-hosted-eval-record-v2",
  runId,
  caseId,
  fixtureId,
  subjectId,
  locale,
  repetition,
  recordSequence,
  attemptSequence,
  isFinal,
  expectedEligibility,
  expectedDegradation,
  transport: {
    status,
    httpStatus,
    attemptCount,
    retryCount,
    retryExhausted,
    retryAfterMs,
    durationMs,
    reasonCode
  },
  evaluation: {
    canonicalStatus,
    eligibilityComparison,
    privacyStatus,
    unexpectedResponseShape
  },
  eligibility: allowlistedProjectionOrNull,
  analysis: allowlistedProjectionOrNull,
  privacyAudit: allowlistedBooleanAudit
}
```

금지:

- raw provider JSON
- provider error message
- evidence sentence
- image/base64/crop/buffer
- absolute path
- full headers
- secret/cookie/authorization
- stack/cause/request object

## 10. Resume

case별 최신 final record는 가장 큰 `recordSequence`로 선택한다. timestamp는 선택 기준이 아니다.

- success final: skip
- non-retryable final client error 및 500: 기본 skip
- 429, 502/503/504, timeout, network: 재실행 가능
- `not_attempted`: 재실행 가능
- 기존 attempt history 유지
- 새 실행은 `attemptSequence` 증가
- summary는 case별 최신 final record만 집계
- 과거 attempt는 `historicalAttempts`로 분리
- 실패 후 성공한 case는 `recoveredCases`로 집계

`--max-calls`는 logical planned case 수, `--max-attempts`는 retry를 포함한 실제 HTTP attempt 수다.

## 11. Summary v2

```js
{
  schemaVersion: "face-lab-hosted-eval-summary-v2",
  gateStatus: "PASS" | "FAIL" | "INCONCLUSIVE",
  evaluationComplete: boolean,
  legacyClassification: boolean,
  classificationConfidence: "full" | "partial",
  contractFailures: {
    privacyViolations,
    canonicalContractFailures,
    ineligibleCanonicalViolations
  },
  expectationFailures: {
    eligibilityMismatches
  },
  operationalFailures: {
    rateLimitedCases,
    clientErrorCases,
    serverErrorCases,
    timeoutCases,
    networkErrorCases,
    retryExhaustedCases,
    notAttemptedCases
  },
  evaluationCounts: {
    plannedCases,
    finalCases,
    evaluableCases,
    notEvaluableCases
  },
  historicalAttempts,
  recoveredCases,
  baseline,
  repeatAgreement,
  localeAgreement,
  latency,
  recordsIntegrity,
  issues
}
```

v1 consumer를 위한 compatibility alias는 남길 수 있으나 v2 의미를 바꾸지 않는다. `hardInvariantFailures` alias는 operational failure를 포함하지 않고 실제 contract/expectation failure만 의미한다.

## 12. Legacy v1 migration

v1 record는 report reader에서 읽을 수 있다. 안전하게 추론 가능한 범위만 v2로 adapter한다.

- 2xx: success
- 429: rate_limited
- 4xx: client_error
- 5xx: server_error
- timeout/network name: 해당 transport 상태
- v1 `unknownProviderKeyFound`만으로 privacy violation을 만들지 않음
- non-success에서 canonical/eligibility는 not-evaluable
- `legacyClassification: true`
- `classificationConfidence: partial`

v1만으로 완전 재구성이 불가능하므로 실제 FAIL이 없는 legacy run도 v2 PASS로 승격하지 않고 `INCONCLUSIVE`로 둔다.

## 13. 기존 smoke의 안전한 재해석

기존 run:

```text
face-lab-2026-07-17T07-57-17-744Z-383c7523
```

제공된 v1 record 정보가 다음을 확인하는 범위에서는:

- 200 success: 2
- 429: 6
- 실제 privacy violation: 0
- actual eligibility mismatch: 0
- canonical failure: 0

v2 의미:

```text
Gate status: INCONCLUSIVE
Evaluation complete: false
Evaluable: 2/8
Not evaluable: 6/8
Rate limited: 6
Privacy violations: 0
Eligibility mismatches: 0
```

단, v1 adapter 결과에는 `legacyClassification: true`, `classificationConfidence: partial`을 남긴다. 존재하지 않는 evidence를 사후 생성하지 않는다.

## 14. CLI

```bash
npm run face-lab:eval -- \
  --manifest private/face-lab-fixtures/manifest.local.json \
  --base-url http://localhost:3001 \
  --plan smoke \
  --max-calls 20
```

계획 확인 후:

```bash
npm run face-lab:eval -- \
  --manifest private/face-lab-fixtures/manifest.local.json \
  --base-url http://localhost:3001 \
  --plan smoke \
  --max-calls 20 \
  --max-attempts 40 \
  --delay-ms 1500 \
  --timeout-ms 120000 \
  --max-retries-per-case 1 \
  --max-retry-wait-ms 120000 \
  --max-image-bytes 15728640 \
  --max-response-bytes 2097152 \
  --confirm RUN
```

선택 옵션:

```text
--retry-429-without-hint
--retry-ambiguous-failures
--recover-stale-lock
```

기존 run을 덮어쓰지 않는다. 새 smoke는 새 `run-id`를 사용한다.

Report 재생성:

```bash
npm run face-lab:eval:report -- \
  --run-dir tmp/face-lab-hosted-evaluation/<run-id>
```

Synthetic 검증:

```bash
npm run face-lab:eval:verify
```

## 15. 검증 경계

synthetic verifier는 transport, retry, circuit, classification, gate, resume, lock, JSONL integrity, realpath, MIME, size limits, legacy adapter, privacy regression을 실제 함수 입력→출력 assertion으로 검증한다.

실제 사용자 사진과 provider 비용이 필요한 smoke는 자동 verifier에서 실행하지 않는다. observation enum·threshold·confidence·prompt 의미는 새 hosted 결과를 검토한 뒤 별도 calibration 단계에서만 변경한다.
