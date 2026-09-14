# Face Lab Neutral Face Count Shared Stage v2

## Purpose

`/facelab/review?t=...` is the shared reviewer entry point. Before the existing Visualy Human-cue review begins, the reviewer completes a neutral Stage A that records only the number category of people whose eyes, nose, mouth, and other facial features are visible clearly enough for accurate feature assessment across eight frozen review images.

Stage v2 replaces the v1 item set. Existing v1 submission rows remain immutable historical evidence; no reset, delete, truncate, rewrite, or migration of prior Human Review rows is performed.

Flow:

```text
shared opaque review link
→ Stage A independence/source/provider-blind attestation
→ Stage A neutral face count (8 fixed v2 images)
→ final `1단계 제출` only: server persistence + payload SHA-256
→ HttpOnly signed receipt bound to the existing hsi_<uuid> hosted session
→ Stage B existing 14-image Visualy Human-cue review
```

The reviewer question is exactly:

> 눈, 코, 입 등 얼굴의 정확한 특징을 판별할 수 있을 정도로 보이는 사람은 몇 명인가요?

The Stage A item set and order are fixed by authority. Randomization is not required.

## Neutral observation contract

Allowed response tokens remain exactly:

- `none`
- `one`
- `two_or_more`
- `not_assessable`

Before images are shown, the reviewer attests that source/answer information, automated analysis, and other participant responses were not viewed; that only people whose facial features are sufficiently visible for accurate feature assessment will be counted; and that identity or other sensitive/unnecessary personal traits will not be inferred.

The active server authority is `evidence/facelab/face-count-neutral-review-authority-20260905-v2.json`. It binds each opaque review item to an exact repository SHA-256. The reviewer-facing projection contains only opaque `reviewItemId`, opaque asset path, exact neutral instruction, response vocabulary, and independence attestation. It excludes source names, source URLs, asset digests, expected face-count classes, curation rationale, provider outputs, traditional semantics, partitions, and downstream Face Lab judgments.

## v2 natural photo set

Source provenance is isolated in `evidence/facelab/face-count-neutral-source-acquisition-20260905-v2.json`. Import byte metadata is frozen in `evidence/facelab/face-count-neutral-natural-set-import-20260905-v2.json`. Internal semantic-set validation is isolated in `evidence/facelab/face-count-neutral-curation-validation-20260905-v2.json` and must never be projected to reviewer HTML or submission payloads.

The v2 set uses eight independent natural photographs rather than reusing the current FaceLab hosted-review headshot set. It contains the required semantic diversity:

- `none`: 2 images
- `one`: 3 images
- `two_or_more`: 3 images

The ordered answer-bucket pattern is intentionally mixed rather than grouped. The set includes no synthetic blur or synthetic multi-person composite. The acquisition manifest must contain zero selected sources under `/facelab/hosted-review/`.

The physical public assets are exactly:

```text
/facelab/neutral-review/v2/assets/fcneutralv2_01.jpg
/facelab/neutral-review/v2/assets/fcneutralv2_02.jpg
/facelab/neutral-review/v2/assets/fcneutralv2_03.jpg
/facelab/neutral-review/v2/assets/fcneutralv2_04.jpg
/facelab/neutral-review/v2/assets/fcneutralv2_05.jpg
/facelab/neutral-review/v2/assets/fcneutralv2_06.jpg
/facelab/neutral-review/v2/assets/fcneutralv2_07.jpg
/facelab/neutral-review/v2/assets/fcneutralv2_08.jpg
```

Rights/source metadata is evidence provenance, not legal adjudication. Some v2 bytes are reused from the prior neutral Stage A set, but no v2 asset is selected from the current FaceLab hosted-review headshot path.

## Byte and semantic verification

The dedicated Stage A verifier reads the exact repository bytes and hard-fails on drift. It verifies:

- active authority schema/version/ref and exact question wording;
- raw source-acquisition manifest SHA-256;
- authority digest via stable-stringify;
- exactly eight unique authority/acquisition/import/curation bindings;
- physical SHA-256, byte length, JPEG media type, encoded width, and encoded height;
- exact v2 public path pattern;
- required internal distribution `none=2`, `one=3`, `two_or_more=3`;
- zero hosted-review selected-source reuse;
- no synthetic blur/composite flag;
- no expected class, provenance, digest, or ground-truth leakage into the public reviewer model;
- unchanged four-token response contract and independence attestation;
- final-submit-only persistence and receipt gating invariants.

This proves repository byte identity, acquisition/authority consistency, and curation-set diversity. It does not establish inter-reviewer consensus, empirical detector accuracy, traditional face-reading equivalence, or MyeongHa production semantic authority.

## Reviewer progress and persistence boundary

Stage A answer selection and navigation are browser-local until the final submission action. In-progress state is stored under a digest-bound `localStorage` key. No neutral submit POST occurs merely when the reviewer:

- accepts the attestation;
- selects an answer;
- moves to the previous or next image;
- reaches image `8 / 8`.

Only the final `1단계 제출` action constructs the complete eight-response payload and performs the neutral submit POST. A reviewer can therefore inspect and answer all eight images without creating a new Stage A database row as long as the final submit button is not activated.

A successful real Stage A submit writes only to:

`public.tmp_face_lab_neutral_face_count_submissions`

The table remains isolated from the existing hosted Visualy submission table and from production Face Lab result/scoring/profile/report authorities. Existing Human Review rows are not reset, deleted, truncated, or rewritten by v2 activation.

## Receipt gate

For a real Stage A submission the server:

1. validates the active authority-bound eight-item payload and independence attestation;
2. persists the neutral row;
3. computes the canonical payload SHA-256;
4. issues an HttpOnly, SameSite=Strict signed receipt;
5. binds that receipt to the persisted row, active authority digest, payload digest, and the existing Stage B `hsi_<uuid>` session.

A real Stage B submission is rejected with `neutral_receipt_required` unless the receipt signature and persisted neutral row verify against the active authority and the receipt session matches `payload.sessionId`. The receipt cookie is cleared after successful Stage B persistence.

The existing explicit test-only hosted submission mode remains exempt so deterministic smoke tests do not create real Human-evidence authority.

## Production verification

Changes to Stage A authority, assets, intake, review runtime, checker, or this documentation trigger the dedicated production-browser workflow. On merged `main`, that workflow waits for the canonical Vercel production deployment to report the exact merged Git SHA, then exercises the sanitized canonical Stage A HTML in Chromium through all eight items.

The smoke must reach `8 / 8`, verify the exact question and four response buttons, retain eight local responses, expose the final `1단계 제출` label, observe zero neutral-submit POST requests, and leave `finalSubmitActivated=false`.

The secret-safe internal smoke probe is deliberately time-bounded and automatically becomes 404 after its expiry. It never returns the raw production review token.

## Authority limits

This slice does not establish:

- inter-reviewer consensus;
- empirical validation;
- provider landmark or face-detector authority;
- traditional face-reading equivalence;
- MyeongHa production geometry or semantic authority.

Stage A rows are independent Human neutral observations only. Any later production admission must independently bind the frozen asset digest and governed Human evidence before changing production authority.
