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

#T4는 #T3가 등록한 합성 후보의 canonical image만 받아, 비주얼리 canonical Vision observation 계약으로 관찰 결과를 생성하고 불변 observation run으로 보존하는 경계를 정의한다.

```text
G0 candidate
→ blind candidate projection
→ canonical asset verification
→ pinned observation contract
→ bounded observation execution
→ normalized VisionObservationBundle
→ immutable observation object
→ manifest-last observation run
→ blind judgment handoff
```

```text
생성 의도
≠ 실제 관찰값
≠ 대표 상 점수
≠ 합의 결과
≠ Gold
```

#T4는 prompt, intended condition, campaign grouping을 보지 않는다. 아키타입 scoring, 합의, 의도 정합성, 목적별 승격은 후속 Track의 책임이다.

---

## 2. 입력 계약

#T3가 제공하는 blind projection만 입력으로 허용한다.

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

의도적으로 제외되는 값:

- generation spec, compiled prompt, spec/prompt digest
- intended skin/face cue
- condition ID, campaign ID, series ID
- 생성 Provider, model, seed
- operator note와 visible external mark hint
- duplicate reference와 원본 다운로드 파일명

T4 실행 프로세스는 candidate manifest 전체를 읽지 않는다. #T3의 `createBlindCandidateInput()` 결과만 입력 경계로 사용한다.

---

## 3. 기준 observation source

설계 시점의 canonical source는 다음에 고정한다.

```text
repository: gycha0109-beep/K_beauty
source branch: codex/survey-input-contract-refactor
source commit: f050b1d5f72588a1ce6a0a8e5fa42b92d0a8a893
vision schema: vision-observation-v1
vision prompt: vision-observation-prompt-v1
face schema: face-lab-observation-v1
face prompt: face-lab-observation-prompt-v1
```

정규화 범위:

- image eligibility
- visible skin signals와 최대 4개 skin observation
- Face Lab image quality
- 자세·각도·가림
- 얼굴 외곽과 폭 관계
- 세로 비율
- 눈매와 이목구비 배치
- 직선·곡선, 윤곽, 대비
- 사진상 컬러 단서

금지 범위:

- 대표 상과 affinity
- 연예인·실존 인물 유사도
- 성격·관상·건강·능력 추론
- 외모 점수와 우열
- 헤어·메이크업·팔레트·코디·완성 룩
- 사용자용 자유 문장
- image bytes, crop, URL, base64, 이름, identity claim

### 3.1 branch lineage

#T3 branch와 canonical source branch는 선형 history가 아니다. 설계 시점 비교에서 #T3 branch는 source branch보다 127 commits behind이며 current observation modules를 직접 포함하지 않는다.

금지:

- 다른 branch의 `lib/**` 상대경로 import
- production app을 Toolkit runtime dependency로 선언
- source commit 없이 observation code 복사
- schema version 문자열만 같다는 이유로 호환 가정

T4 구현은 versioned semantic contract snapshot 또는 정식 shared contract 추출을 사용한다.

---

## 4. 절대 불변식

### I-01. Observation은 process-level blind다

```text
candidate image만 관찰
→ observation artifact 확정
→ 이후 단계에서만 intent와 join
```

관찰 함수에 full manifest를 넘기고 관례로 intent를 무시하는 방식은 허용하지 않는다.

### I-02. Candidate manifest는 불변이다

T4는 #T3 candidate의 state, provenance, asset reference를 변경하지 않는다. Observation은 별도 append-only domain이다. `G2_OBSERVED` 같은 grade는 후속 registry가 파생한다.

### I-03. Canonical image를 다시 가공하지 않는다

- resize/crop/re-encode 금지
- 색 보정과 external mark 제거 금지
- 별도 image copy 생성 금지
- Provider 호출 전 canonical bytes SHA-256 재검증

### I-04. Contract snapshot은 exact source에 고정한다

Snapshot은 source repository, commit, file blob SHA, schema/prompt version, semantic export digest를 기록한다. source가 변경돼도 기존 run을 재해석하지 않는다.

### I-05. Snapshot은 production JS를 실행하지 않는다

Snapshot artifact는 다음만 포함한다.

- source provenance
- enum과 required-shape semantic export
- canonical prompt text/digest
- capability declaration
- parity fixture digest

production source file을 Toolkit에서 직접 실행하거나 alias import를 재현하지 않는다. Toolkit validator/normalizer는 provider-free parity fixture로 source 의미와 동등성을 검증한다.

### I-06. Contract, transport, registration을 분리한다

```text
Contract Snapshot
  ├─ schema/enum export
  ├─ prompt
  └─ parity contract

Observation Transport
  ├─ bounded Provider request
  ├─ timeout/response limit
  └─ response extraction

Observation Registrar
  ├─ canonical normalized object
  └─ manifest-last run publication
```

Next.js route, API-key resolver, Supabase, user session, product logic은 import하지 않는다.

### I-07. 자동 retry는 없다

한 execution의 image-bearing Provider attempt는 최대 1회다. 새 Provider call은 명시적인 새 `replicateOrdinal`을 사용한다. 같은 ordinal은 재호출하지 않고 기존 run을 검증한다.

### I-08. Invalid response는 observation이 아니다

성공 observation object 조건:

- pinned validator/normalizer 통과
- `schemaVersion = vision-observation-v1`
- bundle `status = available`
- canonical Vision eligibility provenance 존재

Provider failure, JSON parse failure, schema mismatch, contract-invalid fallback은 observation object로 저장하지 않는다.

반면 valid bundle 안의 image ineligible, face insufficient, skin unavailable은 유효한 관찰이다. 부적합 사진 관찰과 실행 실패를 혼동하지 않는다.

### I-09. Raw Provider response를 저장하지 않는다

허용:

- normalized bundle
- canonical request/observation digest
- allowlisted Provider/model/token/attempt telemetry
- sanitized failure category

금지:

- raw HTTP body와 unvalidated model prose
- authorization header/API key
- base64 image와 image copy
- absolute local path

Normalized evidence string은 canonical validator를 통과한 observation field의 일부로만 저장한다.

### I-10. Privacy flag 의미를 한정한다

Source bundle의 `privacy.sourceImagePersisted = false`는 **observation execution이 새 image copy를 저장하지 않았음**을 의미한다. #T3가 합성 candidate asset을 이미 보존한다는 사실을 부정하는 전역 보존 선언이 아니다.

### I-11. Observation run은 불변·멱등이다

동일 candidate, canonical SHA, snapshot, profile, model, replicate ordinal은 같은 run identity를 만든다. timestamp와 token usage는 identity에서 제외한다.

### I-12. T4는 판단·승격을 하지 않는다

- archetype scoring 0
- consensus 0
- intended-vs-observed alignment 0
- human review decision 0
- Gold/holdout promotion 0

---

## 5. 책임 분리

```text
Blind Candidate Resolver
  └─ blind input과 canonical object 검증

Contract Snapshot Resolver
  └─ source provenance, semantic export, digest 검증

Observation Preflight
  └─ path/hash/profile/model/budget 검증

Observation Transport
  └─ 한 번의 bounded image request

Observation Validator/Normalizer
  └─ pinned canonical bundle 생성

Observation Object Store
  └─ content-addressed normalized bundle 저장

Observation Run Registrar
  └─ object reference를 가진 manifest-last publication

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
  semanticExport: {
    schemaObjectRelativePath: string;
    promptObjectRelativePath: string;
    parityFixtureManifestRelativePath: string;
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

Source provenance file set:

```text
lib/image-analysis-eligibility.js
lib/face-lab-observation-contract.js
lib/vision-observation-contract.js
lib/vision-observation-normalizer.js
```

`lib/server/vision-observation-service.js`는 transport reference일 뿐 snapshot runtime dependency가 아니다.

Snapshot exporter는 source checkout에서 다음을 검증한다.

1. exact commit checkout
2. file blob SHA
3. exported version token
4. semantic JSON/prompt export
5. parity fixture result digest
6. unknown/missing field fail-closed

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

### `fixture_replay`

- Provider 0
- contract/normalizer/storage 검증 전용
- 실제 관찰 품질 또는 Gold 근거로 사용 금지
- fixture provenance 명시

### `provider_bounded`

- explicit execute에서만 허용
- image-bearing attempt 최대 1
- redirect 거부, bounded response read
- temperature 0, JSON-only response
- raw response 비저장

T4 v1은 current canonical service와 동등한 OpenAI transport만 active 후보로 둔다. Gemini Vision, browser automation, manual JSON paste는 별도 adapter 승인 전까지 금지한다.

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
    requestedModel: string;
    replicateOrdinal: number;
  };
};
```

규칙:

- `replicateOrdinal >= 1`
- Provider model은 실행 전 반드시 명시
- campaign, condition, prompt, intended label 필드 금지
- unknown field fail-closed

---

## 9. Observation object와 run manifest

### 9.1 Canonical observation object

```ts
type SyntheticObservationObjectV1 = {
  schemaVersion: "synthetic-observation-object-v1";
  candidateId: string;
  canonicalSha256: string;
  contractSnapshotDigest: string;
  bundle: VisionObservationBundleV1;
};
```

```text
observationDigest = SHA-256(stable canonical object JSON)
```

### 9.2 ObservationRun manifest

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
  observation: {
    schemaVersion: "synthetic-observation-object-v1";
    digest: string;
    objectRelativePath: string;
    visionSchemaVersion: "vision-observation-v1";
    visionPromptVersion: "vision-observation-prompt-v1";
  } | null;
  failure: {
    code: string;
    category: string;
  } | null;
  retention: {
    observationProcessCreatedImageCopy: false;
    rawProviderResponsePersisted: false;
  };
  registeredAt: string;
};
```

`observed_bundle`일 때 observation reference는 필수이며 failure는 null이다. Failure outcome에서는 observation이 null이다.

---

## 10. Identity와 반복 실행

Run semantic payload:

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
- failure detail
- local path

```text
runDigest = SHA-256(stable semantic payload)
runId = "obs_" + first 24 hex of runDigest
```

같은 ordinal의 재요청은 Provider를 다시 호출하지 않고 기존 run을 검증한다. 새 Provider call은 새 ordinal이다. 따라서 수동 재시도도 독립 attempt로 투명하게 기록된다.

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

순서:

1. normalized observation object canonical serialization
2. immutable content-addressed object write
3. object byte conflict 검사
4. run manifest exclusive create
5. manifest-last publication

Manifest가 없는 object는 registered run이 아니다. Crash orphan은 후속 GC 대상이다. T4는 #T3 asset을 복사하지 않는다.

---

## 12. 실행 인터페이스

```bash
npm run synthetic:observe -- \
  --request .synthetic-local/requests/observe-0001.json \
  --preflight

npm run synthetic:observe -- \
  --request .synthetic-local/requests/observe-0001.json \
  --execute
```

### `--preflight`

- Provider 0
- write 0
- candidate, asset, snapshot, profile, model, identity 검증
- proposed run ID와 실행 예정치 반환

### `--execute`

- explicit Provider 승인
- image-bearing attempt 최대 1
- success 또는 sanitized bounded-failure run 등록

Provider를 호출하는 `dry-run` 오해를 막기 위해 T4는 `preflight/execute` 용어를 사용한다.

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

Failure detail에 secret, header, raw response, image data, absolute path를 넣지 않는다.

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

제외:

- generation intent/prompt
- condition/campaign
- generation Provider/model
- operator hint
- T4 token usage

후속 judgment 계층은 observation artifact가 확정된 뒤 candidateId로 별도 intent 저장소와 join한다.

---

## 15. Verification requirements

### Snapshot/parity

1. source commit과 file blob SHA 일치
2. schema/prompt version 일치
3. semantic export와 parity fixture digest 일치
4. source 변경 후 같은 snapshot ID 재사용 실패
5. Toolkit production `lib/**` runtime import 0

### Blindness

6. request가 campaign, condition, prompt, intended label 거부
7. observation execution이 full candidate manifest를 읽지 않음
8. judgment projection generation provenance 0

### Asset

9. traversal, absolute path, symlink 거부
10. SHA mismatch를 Provider 전 차단
11. image copy/resize/crop/re-encode 0

### Execution

12. preflight Provider 0/write 0
13. execute image attempt 최대 1
14. timeout/redirect/oversize/invalid JSON 분리
15. raw response/base64 저장 0
16. invalid bundle observation object 등록 0
17. valid ineligible bundle을 execution failure로 오분류하지 않음
18. bundle privacy flag를 T3 global retention 선언으로 오해하지 않음

### Identity/storage

19. 같은 request/ordinal은 같은 run ID
20. 같은 ordinal 재요청 Provider 0/write 0
21. 다른 ordinal은 새 run
22. observation object conflict를 manifest 전 차단
23. manifest reference와 object digest 일치
24. manifest-last 이전 failure는 registered run 아님

### Boundary

25. production route/UI/DB/Auth/Payment 변경 0
26. archetype/style/consensus/promotion output 0
27. 실제 사용자 사진 fixture 0

---

## 16. 비대상

- production `/api/analyze` 또는 사용자 session 호출
- Provider credential 자동 탐색
- Gemini Vision/browser automation/manual JSON paste
- human annotation UI
- archetype scoring/same-person verification
- intent alignment/consensus/candidate grade mutation
- Gold/holdout promotion
- batch execution
- DB, Supabase, API route, UI, Auth, Payment
- 실제 사용자 얼굴 사진 수집

---

## 17. 구현 순서

```text
T4-1  contract semantic snapshot exporter + drift verifier
T4-2  parity fixtures + Toolkit validator/normalizer
T4-3  exact run request/object/manifest contracts
T4-4  blind candidate resolver + canonical hash preflight
T4-5  fixture replay adapter
T4-6  immutable observation object + run registrar
T4-7  bounded OpenAI transport
T4-8  CLI preflight/execute
T4-9  blind judgment projection
T4-10 provider-free full contract suite
T4-11 separately approved one-image synthetic Provider smoke
```

T4-1~T4-10은 Provider 없이 검증 가능해야 한다. Provider smoke는 secret·비용·전송 이미지 경계를 별도 승인한 뒤 합성 이미지 1장으로 수행한다.

---

## 18. 완료 기준

설계 완료:

- #T3 blind input과 canonical observation source 연결 방식 확정
- direct import 금지와 semantic snapshot/parity 전략 확정
- observation object와 run manifest 분리 확정
- Provider budget/retry/replicate 정책 확정
- valid ineligible와 execution failure 분리
- privacy flag 의미와 retention 경계 확정
- immutable storage/idempotency/judgment blindness 확정
- 구현·검증 순서 확정

설계 완료가 의미하지 않는 것:

- T4 구현 완료
- Provider 관찰 성공
- G2 또는 Gold 승격
- archetype/style 결과 생성
