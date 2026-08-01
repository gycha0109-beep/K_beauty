# Synthetic Evaluation Toolkit #T3

# Candidate Import & Provenance Design v1

## 0. 문서 상태

- Toolkit Track: `#T3`
- 작업 유형: 설계 전용
- 기준 브랜치: `feature/T2-generation-contract-prompt-compiler`
- 기준 SHA: `71db2b5c0e1faace78c7d3c74d79e33acb00be01`
- 구현 상태: 미구현
- Provider 호출: 금지
- 이미지 생성: 금지
- production runtime 연결: 금지

`#T3`는 Toolkit 내부 작업 식별자이며 GitHub 실제 PR 번호가 아니다.

---

## 1. 목적

#T3는 사람이 Gemini 또는 GPT 웹 UI에서 저장한 합성 이미지를 로컬 평가 자산으로 안전하게 반입하는 계약을 정의한다.

```text
CompiledPrompt
+ downloaded image
+ operator provenance
→ preflight validation
→ immutable raw asset registration
→ canonical analysis derivative
→ candidate manifest
→ G0_GENERATED
```

이 단계는 이미지에서 무엇이 보이는지 판정하지 않는다.

```text
생성 의도
≠ import provenance
≠ 실제 관찰값
≠ Gold
```

#T3의 결과는 평가 가능한 후보 등록까지다. 관찰, 판단, 합의, 승격은 후속 Track의 책임이다.

---

## 2. #T2와의 연결

#T2는 다음 불변 artifact를 만든다.

- finalized `GenerationSpec`
- `CompiledPrompt`
- `specDigest`
- `promptDigest`
- ProviderProfile ID/version

#T3는 prompt text를 사람이 다시 입력받지 않는다. 반드시 #T2 artifact를 참조한다.

```text
T2 artifact digest
→ T3 import request
→ candidate provenance
```

다음은 금지한다.

- 파일명으로 condition 추정
- 다운로드 폴더 순서로 prompt 연결
- operator가 intended label을 다시 입력
- 원본 prompt를 임의 수정한 뒤 같은 digest 사용
- Provider model/version을 추측

---

## 3. 절대 불변식

### I-01. Raw asset은 불변이다

다운로드한 원본 bytes는 해시 계산 후 수정하지 않는다.

- resize 금지
- crop 금지
- watermark 제거 금지
- metadata 수정 금지
- 재인코딩 금지

분석용 정규화 파일은 별도 canonical derivative로 생성한다.

### I-02. Asset과 candidate는 다른 식별자다

같은 이미지 bytes가 다른 prompt 또는 campaign provenance로 다시 사용될 수 있다.

```text
asset identity = raw bytes
candidate identity = asset + generation provenance + lineage
```

동일한 asset을 재사용한다고 candidate를 자동 병합하지 않는다.

### I-03. Import 성공은 품질 통과가 아니다

파일이 정상 decode돼도 Face Lab에 적합하다는 뜻은 아니다.

```text
imported
≠ eligible
≠ observed
≠ promoted
```

### I-04. 기술 검증과 시각 판단을 분리한다

#T3에서 확인하는 것:

- 파일 형식
- decode 가능성
- 크기와 픽셀 수
- frame 수
- 해시
- path 안전성
- prompt/provenance 연결

#T3에서 확인하지 않는 것:

- 정면 여부
- 동일 인물 여부
- 실제 피부 cue
- 대표 상
- 미적 품질
- Gold 적합성

### I-05. Dry-run은 write 0이다

`--dry-run`은 파일, manifest, lock, index를 영구 저장하지 않는다.

### I-06. Confirm은 원자적이어야 한다

부분 등록 상태를 허용하지 않는다.

```text
staging write
→ full verification
→ atomic rename
→ committed candidate
```

실패 시 staging만 제거하고 기존 자산은 변경하지 않는다.

### I-07. Provider 정보를 추측하지 않는다

웹 UI에서 모델 버전을 확인할 수 없다면 `null`로 저장한다.

### I-08. 생성 플랫폼 표시는 조용히 제거하지 않는다

별 모양 표시, 로고, watermark, symbol이 보인다는 operator hint는 기록할 수 있으나 raw asset에서 제거하지 않는다.

### I-09. 실제 인물 사진을 반입하지 않는다

ImportRequest에 다음 attestation을 요구한다.

```text
syntheticOnly = true
realPersonReferenceUsed = false
```

둘 중 하나라도 충족하지 않으면 fail-closed한다.

### I-10. Global append-only JSONL을 authoritative registry로 사용하지 않는다

동시 실행, crash, partial write에 취약하므로 candidate별 immutable manifest를 authoritative source로 사용한다. index는 재생성 가능한 파생물이다.

---

## 4. 책임 분리

```text
Import Request Builder
  └─ 파일과 T2 artifact를 명시적으로 연결

Preflight Validator
  └─ path, provenance, contract, limits 검증

Raw Asset Store
  └─ content-addressed immutable bytes 저장

Canonicalizer
  └─ analysis-safe derivative 생성

Duplicate Inspector
  └─ exact hash와 perceptual fingerprint 제공

Candidate Registrar
  └─ immutable manifest 생성

Index Builder
  └─ authoritative manifest에서 검색 index 재생성
```

---

## 5. ImportRequest v1

```ts
type ImportRequestV1 = {
  schemaVersion: "candidate-import-request-v1";
  source: {
    inboxRelativePath: string;
    originalDownloadName: string;
  };
  generationArtifact: {
    finalizedSpecPath: string;
    compiledPromptPath: string;
    expectedSpecDigest: string;
    expectedPromptDigest: string;
  };
  providerRun: ProviderRunProvenanceV1;
  grouping: CandidateGroupingV1;
  operatorAttestation: OperatorAttestationV1;
  operatorHints: OperatorHintsV1;
};
```

### 5.1 Source path

`inboxRelativePath`는 configured inbox root에 대한 상대경로만 허용한다.

금지:

- absolute path
- `..`
- drive prefix
- UNC path
- symlink
- hard link가 root 밖 inode를 가리키는 경우
- null byte

`originalDownloadName`은 provenance 표시용이며 저장 경로나 identity에 사용하지 않는다.

### 5.2 Generation artifact

두 artifact를 모두 읽고 다음을 재검증한다.

- schema version
- `specDigest`
- `promptDigest`
- ProviderProfile ID/version
- compiled prompt가 finalized spec을 참조하는지
- expected digest와 실제 digest가 일치하는지

불일치 시 import하지 않는다.

---

## 6. ProviderRunProvenance v1

```ts
type ProviderRunProvenanceV1 = {
  providerProfileId: string;
  providerProfileVersion: string;
  executionMode: "manual_web" | "local_workflow";
  providerModelLabel: string | null;
  providerModelVersion: string | null;
  providerGenerationId: string | null;
  generatedAt: string | null;
  downloadedAt: string;
  exactReproductionAvailable: boolean;
};
```

규칙:

- `api` execution mode는 #T3 v1에서 허용하지 않는다.
- 웹 UI의 정확한 모델 정보가 없으면 `null`이다.
- `generatedAt`을 모르면 `null`이다.
- `downloadedAt`은 operator machine 기준 ISO timestamp다.
- `exactReproductionAvailable`은 수동 웹 생성에서는 기본 `false`다.
- cookie, session token, account ID, email, raw URL은 저장하지 않는다.

---

## 7. CandidateGrouping v1

```ts
type CandidateGroupingV1 = {
  campaignId: string;
  campaignSeriesId: string | null;
  conditionId: string | null;
  lineage: {
    kind: "independent" | "reference_edit";
    parentCandidateId: string | null;
  };
};
```

### campaignSeriesId

A/B/C/D를 같은 실험 묶음으로 관리하기 위한 값이다.

```text
같은 campaignSeriesId
≠ 동일 인물 확정
≠ identity equivalence
```

### reference_edit

다음 조건을 모두 만족해야 한다.

- T2 compiled prompt의 variation이 `reference_edit`
- ProviderProfile이 reference image를 지원
- `parentCandidateId`가 존재
- parent candidate manifest가 존재
- parent와 child가 같은 campaign에 속함

현재 T2 profile은 reference-image capability가 비활성화돼 있으므로 #T3 구현 시 reference-edit import도 fail-closed 상태로 시작한다.

---

## 8. OperatorAttestation v1

```ts
type OperatorAttestationV1 = {
  syntheticOnly: true;
  realPersonReferenceUsed: false;
  termsAndRightsReviewed: boolean;
  downloadedBy: "human_operator";
};
```

`termsAndRightsReviewed`는 법적 적합성의 자동 증명이 아니다. 해당 asset을 내부 평가에 반입하기 전 사람이 사용 조건을 확인했음을 기록하는 운영 필드다.

`false`이면 quarantine가 아니라 import 거부다.

---

## 9. OperatorHints v1

```ts
type OperatorHintsV1 = {
  visiblePlatformMark: "present" | "absent" | "unknown";
  platformMarkLocation:
    | "bottom_right"
    | "bottom_left"
    | "top_right"
    | "top_left"
    | "other"
    | null;
  notes: string | null;
};
```

Operator hint는 observed label이 아니다.

- 기본값은 `unknown`
- `present`이면 location 필요
- `absent` 또는 `unknown`이면 location은 `null`
- mark를 자동 제거하지 않음
- note에 intended label, 신원, 계정 정보, secret을 넣지 않음

---

## 10. 파일 허용 정책

### 허용

- PNG
- JPEG
- WebP static

### 거부

- SVG
- PDF
- GIF
- animated WebP
- TIFF
- HEIC/HEIF v1
- AVIF v1
- RAW camera formats
- archive files
- executable files

### 기술 제한

정확한 수치는 implementation ADR에서 freeze한다. 초기 목표:

- 최대 file size: 25 MiB
- 최소 width/height: 512 px
- 최대 width/height: 4096 px
- 최대 total pixels: 16,777,216
- frame/page count: exactly 1
- alpha 허용

파일 확장자와 실제 decode format이 다르면 actual format을 기준으로 거부한다.

---

## 11. Raw asset identity

```text
rawSha256 = SHA-256(original bytes)
assetId = asset_<first 24 lowercase hex of rawSha256>
```

Asset record:

```ts
type RawAssetRecordV1 = {
  schemaVersion: "raw-asset-v1";
  assetId: string;
  rawSha256: string;
  byteLength: number;
  detectedFormat: "png" | "jpeg" | "webp";
  originalExtension: string;
  width: number;
  height: number;
  frameCount: 1;
  hasAlpha: boolean;
  storedRelativePath: string;
  registeredAt: string;
};
```

`registeredAt`은 asset identity digest에 참여하지 않는다.

Raw asset path:

```text
objects/raw/sha256/<first2>/<fullSha256>.<detectedExt>
```

같은 raw hash가 이미 있으면 bytes를 다시 쓰지 않는다.

---

## 12. Canonical derivative v1

T4 observation이 입력 형식 차이에 좌우되지 않도록 분석용 derivative를 만든다.

### transform contract

```text
canonical-image-v1
```

순서:

1. 안전한 raster decode
2. EXIF orientation 적용
3. 첫 frame만 허용했는지 재확인
4. sRGB color space 변환
5. metadata 제거
6. 픽셀 크기 유지
7. lossless PNG encoding
8. canonical bytes SHA-256

금지:

- crop
- face alignment
- resize
- sharpening
- denoise
- color correction
- skin smoothing
- watermark removal
- background replacement

```ts
type CanonicalAssetRecordV1 = {
  schemaVersion: "canonical-asset-v1";
  transformPolicyVersion: "canonical-image-v1";
  sourceAssetId: string;
  canonicalSha256: string;
  width: number;
  height: number;
  format: "png";
  metadataStripped: true;
  storedRelativePath: string;
};
```

Implementation은 저장소에 이미 고정된 `sharp` 버전을 명시적 workspace dependency로 사용할 수 있다. version upgrade 또는 대체 이미지 라이브러리 추가가 필요하면 중단한다.

---

## 13. Duplicate contract

### 13.1 Exact raw duplicate

같은 raw bytes:

- raw asset은 재사용
- 같은 candidate identity이면 idempotent success
- generation provenance가 다르면 새 candidate 가능

### 13.2 Exact canonical duplicate

원본 bytes는 다르지만 canonical bytes가 같은 경우:

- 별도 raw asset 유지
- candidate manifest에 `exactCanonicalDuplicateOf` 기록
- 자동 탈락하지 않음
- 후속 dataset promotion에서 leakage 검토 대상

### 13.3 Perceptual fingerprint

```text
dhash64-v1
```

- canonical pixels에서 계산
- 64-bit lowercase hex 저장
- nearest candidates와 Hamming distance를 report에 제공
- #T3 v1에서는 임의 threshold로 자동 reject하지 않음
- threshold는 파일럿 결과 후 별도 policy version으로 승인

이유: synthetic face는 의도적으로 비슷한 구도이므로 일반 사진용 threshold를 그대로 쓰면 과도하게 차단할 수 있다.

---

## 14. Candidate identity

Candidate identity는 raw bytes만으로 만들지 않는다.

```ts
type CandidateIdentityPayloadV1 = {
  schemaVersion: "candidate-identity-v1";
  assetId: string;
  specDigest: string;
  promptDigest: string;
  providerProfileId: string;
  providerProfileVersion: string;
  providerGenerationId: string | null;
  campaignId: string;
  campaignSeriesId: string | null;
  conditionId: string | null;
  lineage: {
    kind: "independent" | "reference_edit";
    parentCandidateId: string | null;
  };
  canonicalTransformPolicyVersion: "canonical-image-v1";
};
```

```text
candidateDigest = SHA-256(canonical JSON identity payload)
candidateId = cand_<first 24 lowercase hex of candidateDigest>
```

Identity에서 제외:

- downloadedAt
- registeredAt
- operator notes
- original filename
- filesystem path
- platform mark hint

Provider generation ID가 없는 수동 생성은 `null`을 유지한다. 동일 asset과 동일 provenance를 다시 import하면 동일 candidate ID가 나온다.

---

## 15. CandidateManifest v1

```ts
type CandidateManifestV1 = {
  schemaVersion: "candidate-manifest-v1";
  candidateId: string;
  candidateDigest: string;
  state: "G0_GENERATED";
  asset: {
    assetId: string;
    rawSha256: string;
    canonicalSha256: string;
    canonicalTransformPolicyVersion: "canonical-image-v1";
    perceptualFingerprint: {
      algorithm: "dhash64-v1";
      value: string;
    };
  };
  generation: {
    specDigest: string;
    promptDigest: string;
    providerProfileId: string;
    providerProfileVersion: string;
    providerRun: ProviderRunProvenanceV1;
  };
  grouping: CandidateGroupingV1;
  operatorAttestation: OperatorAttestationV1;
  operatorHints: OperatorHintsV1;
  duplicateReferences: {
    exactCanonicalDuplicateOf: string[];
    nearestPerceptualCandidates: Array<{
      candidateId: string;
      hammingDistance: number;
    }>;
  };
  registeredAt: string;
};
```

Manifest에는 다음을 넣지 않는다.

- intended label 복제본
- observed label
- eligibility
- archetype score
- promotion 결과
- raw prompt를 재입력한 사본
- API key, cookie, session, account identity

Generation intent는 digest로 T2 artifact를 참조한다.

---

## 16. 저장 구조

기본 root:

```text
.synthetic-local/
```

환경변수:

```text
BEJEWELY_SYNTHETIC_DATA_ROOT
```

구조:

```text
.synthetic-local/
├─ inbox/
├─ requests/
├─ staging/
├─ objects/
│  ├─ raw/sha256/
│  └─ canonical/sha256/
├─ assets/
│  └─ <assetId>.json
├─ candidates/
│  └─ <candidateId>/
│     └─ manifest.json
├─ quarantine/
├─ reports/
└─ indexes/
```

권위 순서:

```text
raw bytes + asset record + candidate manifest
→ authoritative

indexes, CSV, JSONL, reports
→ rebuildable derivative
```

---

## 17. 원자적 commit

### dry-run

```text
read
→ validate
→ decode in memory/temp scope
→ calculate proposed IDs
→ print report
→ persistent write 0
```

### confirm

```text
acquire process lock
→ create unique staging directory
→ validate request and artifacts
→ decode and hash
→ write staged raw asset if missing
→ write staged canonical asset if missing
→ write staged asset record
→ write staged candidate manifest
→ fsync where supported
→ atomic rename objects
→ atomic rename records
→ release lock
```

Candidate manifest는 마지막에 publish한다. manifest가 존재하면 필요한 object가 모두 존재해야 한다.

Crash recovery:

- 오래된 staging directory는 다음 실행에서 report만 하고 자동 삭제하지 않음
- `synthetic:import:recover --dry-run` 후 명시적 confirm에서만 정리

---

## 18. CLI 설계

### 단일 요청

```bash
npm run synthetic:import -- \
  --request .synthetic-local/requests/import-0001.json \
  --dry-run
```

```bash
npm run synthetic:import -- \
  --request .synthetic-local/requests/import-0001.json \
  --confirm
```

### batch

Batch request는 각 항목에 독립 `ImportRequestV1`을 포함한다.

```bash
npm run synthetic:import:batch -- \
  --request .synthetic-local/requests/batch-skin-abcd-001.json \
  --dry-run
```

Batch confirm 정책:

- 기본은 all-or-nothing
- 한 항목 실패 시 전체 commit 중단
- partial mode 없음

### 출력

```ts
type ImportReportV1 = {
  ok: boolean;
  mode: "dry_run" | "confirm";
  proposedCandidateId: string | null;
  assetId: string | null;
  validationErrors: ImportErrorV1[];
  warnings: ImportWarningV1[];
  duplicateSummary: object | null;
  writesPerformed: number;
};
```

Dry-run은 항상 `writesPerformed: 0`이어야 한다.

---

## 19. Error contract

```ts
type CandidateImportErrorCode =
  | "invalid_request_schema"
  | "unsafe_source_path"
  | "source_not_found"
  | "symlink_forbidden"
  | "unsupported_file_format"
  | "mime_decode_mismatch"
  | "animated_asset_forbidden"
  | "image_decode_failed"
  | "file_size_limit_exceeded"
  | "dimension_limit_exceeded"
  | "pixel_limit_exceeded"
  | "dimension_below_minimum"
  | "generation_artifact_missing"
  | "generation_artifact_invalid"
  | "spec_digest_mismatch"
  | "prompt_digest_mismatch"
  | "provider_profile_mismatch"
  | "provider_execution_mode_forbidden"
  | "synthetic_attestation_required"
  | "rights_review_required"
  | "sensitive_provenance_forbidden"
  | "invalid_grouping_contract"
  | "parent_candidate_missing"
  | "reference_capability_required"
  | "canonicalization_failed"
  | "candidate_identity_conflict"
  | "storage_lock_unavailable"
  | "atomic_commit_failed";
```

Warnings:

```ts
type CandidateImportWarningCode =
  | "provider_model_unknown"
  | "provider_generation_id_unknown"
  | "generated_at_unknown"
  | "platform_mark_present"
  | "platform_mark_unknown"
  | "canonical_duplicate_found"
  | "perceptual_neighbors_found";
```

Warning은 import를 성공시킬 수 있지만 후속 판단에 그대로 전달된다.

---

## 20. Idempotency

같은 request를 다시 실행했을 때:

### candidate manifest가 동일

```text
result = existing_candidate
writesPerformed = 0
```

### candidate ID는 같지만 manifest 내용이 다름

```text
candidate_identity_conflict
```

기존 manifest를 덮어쓰지 않는다.

### raw asset만 존재

누락된 canonical/manifest를 staging에서 재구성할 수 있다. 기존 raw bytes의 SHA-256을 다시 확인한다.

---

## 21. Quarantine 정책

다음은 import 거부이며 quarantine 대상이 아니다.

- 실제 인물 attestation 위반
- unsupported format
- path traversal
- digest mismatch
- secret/PII provenance
- oversized image

Quarantine는 decode에는 성공했지만 운영 검토가 필요한 경우에 한한다.

초기 quarantine 사유:

- canonical duplicate 존재
- platform mark present
- provider model unknown과 generation ID unknown이 동시에 존재
- legacy artifact version

다만 quarantine는 관찰 실패 또는 Gold 탈락을 의미하지 않는다.

#T3 구현 전 최종 결정에서 `platform mark present`를 quarantine로 둘지 warning-only로 둘지 파일럿 운영 기준을 확정한다.

---

## 22. 개인정보·보안 경계

- 실제 사용자 사진 금지
- 사용자 계정 ID 저장 금지
- Provider 계정 ID 저장 금지
- 다운로드 URL 저장 금지
- EXIF/GPS는 canonical derivative에서 제거
- raw asset은 합성 이미지 전용 private local storage에만 저장
- raw와 canonical 파일은 Git 추적 금지
- report에 image bytes/base64 포함 금지
- 파일 내용이나 metadata를 shell command로 삽입 금지
- path는 shell 문자열 결합이 아니라 filesystem API로 처리

---

## 23. 구현 파일 계획

```text
packages/face-contracts/src/synthetic-import/
├─ import-request.js
├─ asset-record.js
├─ candidate-manifest.js
└─ import-errors.js

tools/synthetic-evaluation/src/import/
├─ validate-import-request.js
├─ resolve-safe-path.js
├─ inspect-image.js
├─ hash-asset.js
├─ canonicalize-image.js
├─ fingerprint-image.js
├─ build-candidate-identity.js
├─ commit-import-transaction.js
├─ read-candidate-registry.js
└─ cli/
   ├─ import-candidate.js
   └─ import-batch.js
```

테스트:

```text
tools/synthetic-evaluation/tests/import/
├─ request-contract.test.mjs
├─ safe-path.test.mjs
├─ image-limits.test.mjs
├─ identity.test.mjs
├─ idempotency.test.mjs
├─ atomicity.test.mjs
├─ duplicate.test.mjs
└─ fixtures/
```

실제 얼굴 이미지는 fixture로 커밋하지 않는다. 테스트용으로 프로그램이 생성한 비인물 raster fixture만 사용한다.

---

## 24. 검증 계획

### Contract

- unknown field fail-closed
- absolute/path traversal/symlink 거부
- T2 digest mismatch 거부
- actual ProviderProfile mismatch 거부
- synthetic attestation 강제
- secret/PII pattern 거부

### Image

- PNG/JPEG/WebP static decode
- animation 거부
- oversized file/dimension/pixels 거부
- extension spoof 거부
- orientation normalization
- metadata stripping
- pixel dimensions 유지

### Identity

- 같은 raw bytes → 같은 asset ID
- 같은 candidate identity → 같은 candidate ID
- 같은 asset + 다른 prompt digest → 다른 candidate ID
- timestamp/note 변경 → 같은 candidate ID
- campaign/lineage 변경 → 다른 candidate ID

### Storage

- dry-run write 0
- manifest-last publish
- crash simulation에서 partial manifest 0
- existing immutable record overwrite 0
- batch all-or-nothing
- index 삭제 후 rebuild 가능

### Boundaries

- production source import 0
- Provider/network/browser call 0
- DB/API/UI 변경 0
- actual synthetic image commit 0
- intended label을 observed label로 복제 0

---

## 25. 구현 순서

```text
T3-1 import contracts and error codes
→ T3-2 safe path and request validation
→ T3-3 image inspection and limits
→ T3-4 raw content-addressed asset store
→ T3-5 canonical-image-v1 derivative
→ T3-6 candidate identity and manifest
→ T3-7 exact duplicate and perceptual fingerprint
→ T3-8 atomic transaction and idempotency
→ T3-9 CLI dry-run/confirm
→ T3-10 batch and registry rebuild tests
```

---

## 26. 명시적 비대상

- Provider API 호출
- Gemini/GPT 웹 자동화
- image generation
- image observation
- face detection
- identity recognition
- same-person verification
- redness/blemish 판정
- archetype scoring
- dataset promotion
- human review UI
- Supabase/DB
- cloud object storage
- user photo import
- watermark removal
- near-duplicate 자동 탈락 threshold
- production Face Lab 연결

---

## 27. 설계 완료 기준

- asset와 candidate identity가 분리돼 있음
- T2 artifact 연결이 digest로 고정됨
- raw와 canonical이 분리돼 있음
- dry-run과 confirm이 명확히 분리됨
- atomicity와 idempotency가 정의됨
- exact duplicate와 perceptual similarity의 의미가 분리됨
- 파일명이나 prompt intent를 observed label로 사용하지 않음
- platform mark를 숨기지 않음
- 실제 인물과 개인정보 반입이 차단됨
- 후속 T4 observation이 canonical asset을 명시적으로 참조할 수 있음

---

## 28. 최종 설계 판단

#T3의 핵심은 이미지를 폴더에 복사하는 것이 아니다.

```text
다운로드 파일
→ 검증된 raw asset

raw bytes
→ content-addressed asset identity

생성 맥락
→ immutable candidate identity

원본 수정
→ 금지

기술 반입 성공
→ candidate only
```

이 경계를 지키면 같은 이미지가 여러 campaign에서 사용되더라도 자산 중복과 실험 provenance를 혼동하지 않고, 후속 관찰과 승격 결과를 재현 가능하게 연결할 수 있다.
