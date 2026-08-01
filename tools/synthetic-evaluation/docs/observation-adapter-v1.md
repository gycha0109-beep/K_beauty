# Synthetic Evaluation Toolkit #T4

# Observation Adapter Design v1

## 0. 문서 상태

- Toolkit Track: `#T4`
- 작업 유형: 설계 전용
- 기준 브랜치: `feature/T3-candidate-import-provenance`
- 기준 SHA: `63d184d20491c13effa14a9fcf22c63a25669764`
- 구현 상태: 미구현
- Provider 호출: 이번 설계 작업에서는 0
- production runtime 변경: 금지
- candidate state 변경: 금지

`#T4`는 Toolkit 내부 작업 식별자이며 GitHub 실제 PR 번호가 아니다.

---

## 1. 목적

#T4는 #T3가 등록한 합성 후보의 canonical image만 받아, 비주얼리의 canonical Vision observation 계약으로 관찰 결과를 생성하고 불변 observation run으로 보존하는 경계를 정의한다.

```text
G0 candidate
→ blind candidate projection
→ canonical asset verification
→ pinned observation contract
→ bounded observation execution
→ normalized VisionObservationBundle
→ immutable observation run
→ blind judgment handoff
```

이 단계의 결과는 관찰 기록이다.

```text
생성 의도
≠ 실제 관찰값
≠ 대표 상 점수
≠ 합의 결과
≠ Gold
```

#T4는 생성 prompt, intended condition, campaign grouping을 보지 않는다. 아키타입 scoring, 합의, 의도 정합성, 목적별 승격은 후속 Track의 책임이다.

---

## 2. 확인된 입력 계약

#T3는 다음 blind projection을 제공한다.

```ts
type BlindCandidateInputV1 = {
  candidateId: string;
  canonicalAsset: {
    sha256: string;
    objectRelativePath: string;
    transformPolicyVersion: "canonical-image-v1";
  };
};
```

의도적으로 포함되지 않는 값:

- generation spec과 compiled prompt
- intended skin cue와 face-feature cue
- condition ID와 campaign series
- 생성 Provider, model, seed
- operator note와 visible external mark hint
- duplicate reference
- 원본 다운로드 파일명

T4 실행 프로세스는 candidate manifest 전체를 입력받지 않는다. #T3의 `createBlindCandidateInput()` 결과만 입력 경계로 사용한다.

---

## 3. 확인된 observation source contract

설계 시점의 current canonical observation source는 다음에 고정한다.

```text
repository: gycha0109-beep/K_beauty
source branch: codex/survey-input-contract-refactor
source commit: f050b1d5f72588a1ce6a0a8e5fa42b92d0a8a893
vision schema: vision-observation-v1
vision prompt: vision-observation-prompt-v1
face schema: face-lab-observation-v1
face prompt: face-lab-observation-prompt-v1
```

source contract가 정규화하는 범위:

- image eligibility
- Skin Match용 visible skin signals와 최대 4개 observation
- Face Lab image quality
- 자세·각도·가림
- 얼굴 외곽과 폭 관계
- 세로 비율
- 눈매
- 이목구비 배치
- 직선·곡선, 윤곽, 대비
- 사진상 컬러 단서

source contract가 금지하는 범위:

- 대표 상과 affinity
- 연예인·실존 인물 유사도
- 성격·관상·건강·능력 추론
- 외모 점수와 우열
- 헤어·메이크업·컬러 팔레트·코디·완성 룩
- 사용자용 자유 문장
- 이미지 bytes, crop, URL, base64, 이름, identity claim

### 3.1 branch lineage 상태

#T3 implementation branch와 current canonical observation source branch는 같은 선형 history가 아니다. 설계 시점 비교에서 #T3 branch는 source branch보다 127 commits behind이며 current observation module을 직접 포함하지 않는다.

따라서 다음을 금지한다.

- 다른 branch의 `lib/**`를 상대경로로 import
- production app source를 Toolkit package dependency로 선언
- source commit 없이 observation code를 복사
- schema version 문자열만 같다는 이유로 호환을 가정

T4 구현은 반드시 versioned contract snapshot 또는 추출된 shared contract를 사용한다.

---

## 4. 절대 불변식

### I-01. Observation은 blind하다

T4 실행 전과 실행 중에 generation intent를 읽지 않는다.

```text
candidate image만 관찰
→ observation artifact 확정
→ 이후 단계에서만 intent와 join
```

### I-02. Candidate manifest는 수정하지 않는다

T4는 #T3 candidate manifest의 `state`, provenance, asset reference를 변경하지 않는다.

Observation run은 별도 append-only artifact다. `G2_OBSERVED` 같은 candidate grade 계산은 후속 registry/promotion 계층에서 수행한다.

### I-03. Canonical asset을 다시 가공하지 않는다

T4는 #T3 canonical PNG를 그대로 읽는다.

- resize 금지
- crop 금지
- 색 보정 금지
- external mark 제거 금지
- 재인코딩 금지

T4는 실행 전 canonical object bytes의 SHA-256과 input의 `sha256`을 재검증한다.

### I-04. Contract snapshot은 source commit에 고정한다

Observation schema, prompt, enum registry, normalizer 의미는 snapshot manifest에 source repository, commit, file blob SHA, schema/prompt version, snapshot digest로 기록한다.

source branch가 변경돼도 기존 run은 재해석하지 않는다.

### I-05. Provider transport와 observation contract를 분리한다

```text
Observation Contract
  ├─ prompt contract
  ├─ schema/enum registry
  └─ normalizer

Observation Transport
  ├─ Provider request
  ├─ timeout/size limit
  └─ response extraction
```

Toolkit core는 API key resolution, Next.js route, Supabase, user session, product logic을 import하지 않는다.

### I-06. 자동 retry는 없다

하나의 execution은 image-bearing Provider attempt를 최대 1회 사용한다.

독립 반복 관찰이 필요하면 retry가 아니라 명시적인 `replicateOrdinal`을 증가시킨 새 run으로 실행한다.

### I-07. Invalid response는 관찰 성공이 아니다

production normalizer의 fallback bundle은 fail-closed 응답을 위한 구조다. T4는 다음을 성공 observation object로 승격하지 않는다.

- Provider failure
- JSON parse failure
- schema mismatch
- normalized bundle status가 `available`이 아닌 결과
- eligibility source가 canonical Vision provenance가 아닌 결과

반면 valid bundle 안의 `ineligible`, `insufficient_evidence`, face/skin unavailable은 유효한 관찰 결과다. 사진이 부적합하다는 관찰과 실행 실패를 혼동하지 않는다.

### I-08. Raw Provider response를 저장하지 않는다

저장 가능:

- normalized observation bundle
- request/observation digest
- allowlisted Provider telemetry
- sanitized failure category

저장 금지:

- raw HTTP body
- raw model prose
- authorization header/API key
- base64 image
- source image 복사본
- full local absolute path

### I-09. Observation run은 불변·멱등이다

동일 candidate, contract snapshot, adapter profile, model, replicate ordinal 조합은 동일 run identity를 만든다.

같은 identity의 재실행은 기존 artifact를 검증하고 `existing_run`을 반환한다. timestamp를 identity에 포함하지 않는다.

### I-10. T4는 판단과 승격을 수행하지 않는다

금지:

- archetype scoring
- multi-judge consensus
- intended-vs-observed alignment
- label correction
- Gold/holdout promotion
- human review decision

---

## 5. 책임 분리

```text
Blind Candidate Resolver
  └─ #T3 blind input과 canonical object 확인

Observation Contract Snapshot Resolver
  └─ source commit, versions, blob SHAs, digest 검증

Observation Preflight
  └─ path, hash, contract, profile, execution budget 검증

Observation Transport
  └─ 한 번의 bounded image-bearing request

Observation Normalizer
  └─ pinned canonical bundle 생성

Observation Run Builder
  └─ identity, telemetry, bundle, privacy record 생성

Observation Registrar
  └─ immutable objects 후 manifest-last publication

Judgment Projection
  └─ generation intent 없는 후속 입력 생성
```

---

## 6. ObservationContractSnapshot v1

```ts
type ObservationContractSnapshotV1 = {
  schemaVersion: "observation-contract-snapshot-v1";
  snapshotId: string;
  source: {
    repository: "gycha0109-beep/K_beauty";
    commitSha: string;
    files: Array<{
      path: string;
      blobSha: string;
    }>;
  };
  versions: {
    visionSchemaVersion: "vision-observation-v1";
    visionPromptVersion: "vision-observation-prompt-v1";
    faceSchemaVersion: "face-lab-observation-v1";
    facePromptVersion: "face-lab-observation-prompt-v1";
  };
  capabilities: {
    eligibility: true;
    skinObservation: true;
    faceObservation: true;
    archetype: false;
    styling: false;
  };
  snapshotDigest: string;
};
```

최소 source file set:

```text
lib/image-analysis-eligibility.js
lib/face-lab-observation-contract.js
lib/vision-observation-contract.js
lib/vision-observation-normalizer.js
```

`lib/server/vision-observation-service.js`는 transport reference로 기록할 수 있으나 shared contract snapshot의 runtime dependency가 아니다.

Snapshot 생성기는 source file 내용을 읽고 blob SHA와 version export를 검증해야 한다. unknown field, missing file, version mismatch는 fail-closed한다.

---

## 7. Adapter profile

```ts
type ObservationAdapterProfileV1 = {
  id: "bejewely-canonical-vision-v1";
  version: "1.0.0";
  contractSnapshotId: string;
  executionMode: "provider_bounded" | "fixture_replay";
  providerFamily: "openai" | "fixture";
  capabilities: {
    imageInput: true;
    maximumAttempts: 1;
    automaticRetry: false;
    rawResponseRetention: false;
  };
  limits: {
    timeoutMs: number;
    maxResponseBytes: number;
    maxOutputTokens: number;
  };
};
```

### 7.1 `fixture_replay`

- contract·normalizer·storage 테스트용
- Provider 호출 0
- 실제 관찰 품질 증빙으로 사용 금지
- fixture provenance를 run에 명시

### 7.2 `provider_bounded`

- explicit execution에서만 허용
- image-bearing attempt 최대 1
- redirect 거부
- bounded response read
- temperature 0
- JSON-only response
- Provider raw response 비저장

T4 v1의 active Provider profile은 current canonical service와 동등한 OpenAI transport만 후보로 둔다. Gemini Vision, 브라우저 자동화, 임의 manual JSON paste는 후속 adapter profile 승인 전까지 금지한다.

---

## 8. ObservationRunRequest v1

```ts
type ObservationRunRequestV1 = {
  schemaVersion: "observation-run-request-v1";
  candidate: BlindCandidateInputV1;
  adapterProfile: {
    id: "bejewely-canonical-vision-v1";
    version: "1.0.0";
  };
  contractSnapshotId: string;
  execution: {
    mode: "fixture_replay" | "provider_bounded";
    requestedModel: string | null;
    replicateOrdinal: number;
  };
};
```

규칙:

- `replicateOrdinal`은 1 이상의 정수다.
- model을 확인할 수 없으면 `null`이 아니라 실행 전 fail한다. Provider 실행에서 실제 request model은 audit에 필수다.
- request에 campaign, condition, prompt, intended label 필드를 허용하지 않는다.
- unknown top-level/nested field는 fail-closed한다.

---

## 9. ObservationRun v1

```ts
type ObservationRunV1 = {
  schemaVersion: "synthetic-observation-run-v1";
  runId: string;
  runDigest: string;
  candidate: {
    candidateId: string;
    canonicalSha256: string;
    canonicalTransformPolicyVersion: "canonical-image-v1";
  };
  adapter: {
    profileId: "bejewely-canonical-vision-v1";
    profileVersion: "1.0.0";
    contractSnapshotId: string;
    contractSnapshotDigest: string;
  };
  execution: {
    mode: "fixture_replay" | "provider_bounded";
    provider: "openai" | "fixture";
    model: string;
    replicateOrdinal: number;
    imageProviderAttemptCount: 0 | 1;
    inputTokens: number | null;
    outputTokens: number | null;
    startedAt: string;
    completedAt: string;
  };
  outcome:
    | "observed_bundle"
    | "provider_failure"
    | "contract_failure";
  observation: VisionObservationBundleV1 | null;
  failure: {
    code: string;
    category: string;
  } | null;
  privacy: {
    sourceImagePersisted: false;
    rawProviderResponsePersisted: false;
  };
  registeredAt: string;
};
```

### 9.1 `observed_bundle`

다음을 모두 만족한다.

- canonical asset hash 일치
- snapshot/profile 검증 성공
- normalized bundle `schemaVersion = vision-observation-v1`
- normalized bundle `status = available`
- bundle privacy flags가 모두 false

bundle 내부의 eligibility 또는 face/skin 상태는 그대로 보존한다. ineligible image도 유효한 `observed_bundle`일 수 있다.

### 9.2 failure outcome

실패 run은 재현·운영 분석을 위해 sanitized failure manifest로 저장할 수 있다. 단, observation object는 `null`이어야 한다.

Provider 호출 전 preflight 실패는 write 0으로 끝낸다. Provider 호출 후 발생한 bounded failure만 명시적인 failure run 등록 후보가 된다.

---

## 10. Identity와 반복 실행

Run identity semantic payload:

```text
candidateId
+ canonicalSha256
+ canonical transform policy
+ adapter profile ID/version
+ contract snapshot digest
+ execution mode
+ provider/model
+ replicateOrdinal
```

제외:

- startedAt/completedAt/registeredAt
- token usage
- failure message
- local path

```text
runDigest = SHA-256(stable canonical semantic payload)
runId = "obs_" + first 24 hex of runDigest
```

같은 ordinal의 retry는 동일 run이다. 동일 이미지에 독립 반복 관찰을 추가하려면 ordinal을 증가시킨다.

---

## 11. Storage layout

```text
.synthetic-local/
├─ objects/
│  └─ observations/
│     └─ by-digest/<first2>/<observationDigest>.json
└─ observation-runs/
   └─ <candidateId>/
      └─ <runId>/
         └─ manifest.json
```

원칙:

1. normalized observation object를 canonical JSON으로 직렬화한다.
2. object를 content-addressed immutable path에 기록한다.
3. observation run manifest를 마지막에 exclusive create한다.
4. manifest가 없는 object는 등록된 run이 아니다.
5. crash로 남은 orphan object는 후속 GC 대상이며 candidate/observation 성공으로 취급하지 않는다.

T4는 #T3 raw/canonical asset object를 복사하지 않는다.

---

## 12. 실행 인터페이스

T4 구현 시 CLI는 다음 두 모드만 후보로 둔다.

```bash
npm run synthetic:observe -- \
  --request .synthetic-local/requests/observe-0001.json \
  --preflight

npm run synthetic:observe -- \
  --request .synthetic-local/requests/observe-0001.json \
  --execute
```

### `--preflight`

- Provider 호출 0
- persistent write 0
- candidate/asset/snapshot/profile/model/budget 검증
- proposed run ID와 실행 예정치만 반환

### `--execute`

- 명시적 Provider 실행 승인
- image-bearing attempt 최대 1
- success 또는 bounded failure run manifest-last 등록

`--dry-run`이 Provider를 호출하는지 혼동할 수 있으므로 T4에서는 사용하지 않는다.

---

## 13. Failure taxonomy

### Preflight

```text
candidate_input_invalid
canonical_asset_path_unsafe
canonical_asset_missing
canonical_asset_hash_mismatch
canonical_transform_policy_unsupported
contract_snapshot_missing
contract_snapshot_digest_mismatch
contract_source_version_mismatch
adapter_profile_unsupported
model_required
replicate_ordinal_invalid
run_identity_conflict
```

### Execution

```text
provider_timeout
provider_redirect_rejected
provider_http_error
provider_response_too_large
provider_response_invalid_json
provider_contract_invalid
observation_object_conflict
run_manifest_conflict
```

failure detail에는 secret, header, raw response, image data, absolute path를 넣지 않는다.

---

## 14. Judgment handoff

```ts
type BlindJudgmentInputV1 = {
  candidateId: string;
  observationRunId: string;
  observationDigest: string;
  canonicalAsset: {
    sha256: string;
    objectRelativePath: string;
  };
  observation: VisionObservationBundleV1;
};
```

포함하지 않는 값:

- generation intent와 prompt
- condition/campaign
- 생성 Provider/model
- operator hint
- T4 Provider token usage

후속 judgment 계층은 candidateId로 의도 저장소와 join할 수 있으나, 관찰 artifact가 확정되기 전에는 join하지 않는다.

---

## 15. Verification requirements

### Contract snapshot

1. source commit과 file blob SHA가 일치한다.
2. exported schema/prompt version이 snapshot manifest와 일치한다.
3. source 변경 후 같은 snapshot ID 재사용은 실패한다.
4. Toolkit은 production `lib/**`를 runtime import하지 않는다.

### Blindness

5. request schema가 campaign, condition, prompt, intended label을 거부한다.
6. observation source가 #T3 candidate manifest 전체를 읽지 않는다.
7. judgment projection에 generation provenance가 없다.

### Asset

8. path traversal, absolute path, symlink를 거부한다.
9. canonical SHA mismatch를 Provider 호출 전에 차단한다.
10. T4가 image copy/resize/crop/re-encode를 수행하지 않는다.

### Execution

11. preflight는 Provider 호출 0, write 0이다.
12. execute는 image-bearing attempt 최대 1이다.
13. timeout, redirect, oversized response, invalid JSON을 분리한다.
14. raw response와 base64 image를 저장하지 않는다.
15. invalid normalized bundle은 observed object로 등록하지 않는다.
16. valid ineligible bundle은 execution failure로 오분류하지 않는다.

### Identity/storage

17. 같은 request와 ordinal은 같은 run ID를 만든다.
18. retry는 기존 `registeredAt`을 보존하고 write 0이다.
19. 다른 ordinal은 새 run identity를 만든다.
20. observation object 충돌은 manifest publication 전에 fail-closed한다.
21. manifest-last 이전 failure는 registered run으로 보이지 않는다.

### Boundary

22. production route/UI/DB/Auth/Payment 파일 변경 0.
23. archetype, style, consensus, promotion output 0.
24. 실제 사용자 사진 fixture 0.

---

## 16. 비대상

- production `/api/analyze` 호출
- production 사용자 session 재사용
- Provider credential 자동 탐색
- Gemini Vision 또는 browser automation
- human annotation UI
- archetype scoring
- same-person verification
- 생성 의도 정합성 계산
- consensus
- candidate grade mutation
- Gold/holdout 승격
- batch execution
- DB, Supabase, API route, UI, Auth, Payment
- 실제 사용자 얼굴 사진 수집

---

## 17. 구현 순서

```text
T4-1  contract snapshot manifest와 drift verifier
T4-2  exact run request/result shared contracts
T4-3  blind candidate resolver와 canonical hash preflight
T4-4  fixture replay adapter
T4-5  immutable observation object/run registrar
T4-6  bounded OpenAI transport adapter
T4-7  CLI preflight/execute
T4-8  blind judgment projection
T4-9  provider-free contract suite
T4-10 bounded Provider smoke — 별도 승인 후
```

T4-1부터 T4-9까지는 Provider 호출 없이 검증 가능해야 한다. 실제 Provider smoke는 secret·비용·전송 이미지 경계를 별도 승인한 뒤 한 번의 합성 이미지로 수행한다.

---

## 18. 완료 기준

#T4 설계 완료는 다음을 의미한다.

- #T3 blind input과 current canonical observation source의 연결 방식 확정
- branch 간 직접 import 금지와 snapshot 전략 확정
- observation run request/result identity 확정
- Provider execution budget와 retry 정책 확정
- raw response/image 비저장 확정
- valid ineligible observation과 execution failure 분리
- immutable storage와 idempotency 확정
- judgment handoff blindness 확정
- 구현·테스트 순서 확정

다음을 의미하지 않는다.

- T4 구현 완료
- Provider 관찰 성공
- candidate가 G2 또는 Gold로 승격됨
- archetype 또는 스타일 결과 생성
