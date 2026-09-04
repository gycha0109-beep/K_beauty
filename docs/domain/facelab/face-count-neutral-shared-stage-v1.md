# Face Lab Neutral Face Count Shared Stage v1

## Purpose

`/facelab/review?t=...` is the shared reviewer entry point. Before the existing Visualy Human-cue review begins, the reviewer completes a neutral Stage A that records only the number category of people whose eyes, nose, mouth, and other facial features are visible clearly enough for accurate feature assessment across eight frozen public review images.

Flow:

```text
shared opaque review link
→ Stage A independence/source/provider-blind attestation
→ Stage A neutral face count (8 fixed images)
→ final `1단계 제출` only: server persistence + payload SHA-256
→ HttpOnly signed receipt bound to the existing hsi_<uuid> hosted session
→ Stage B existing 14-image Visualy Human-cue review
```

The reviewer question is exactly:

> 눈, 코, 입 등 얼굴의 정확한 특징을 판별할 수 있을 정도로 보이는 사람은 몇 명인가요?

The Stage A item set and order are fixed by authority. Randomization is not required.

## Neutral observation contract

Allowed response tokens are exactly:

- `none`
- `one`
- `two_or_more`
- `not_assessable`

Before images are shown, the reviewer attests that source/answer information, automated analysis, and other participant responses were not viewed; that only people whose facial features are sufficiently visible for accurate feature assessment will be counted; and that identity or other sensitive/unnecessary personal traits will not be inferred.

The **server authority** binds each opaque review item to an exact repository asset SHA-256. The **reviewer-facing projection** contains only the opaque `reviewItemId`, opaque asset path, exact neutral instruction, response vocabulary, and independence attestation. It excludes source names, source URLs, asset digests, expected face-count labels, ground truth, provider outputs, traditional semantics, partitions, and downstream Face Lab judgments.

## Source assets and provenance

Source provenance is isolated in `evidence/facelab/face-count-neutral-source-acquisition-20260831-v1.json`.

The eight assets are:

1. `fcneutral_01.jpg` — NASA/GSFC Earth image; source metadata records U.S. public-domain status.
2. `fcneutral_02.jpg` — official-duty U.S. Army Eisenhower portrait; source metadata records U.S. public-domain status.
3. `fcneutral_03.jpg` — History Trust of South Australia `GN11452` historical group portrait; Wikimedia Commons revision metadata records CC0 1.0.
4. `fcneutral_04.png` — byte-for-byte reuse of an existing governed FaceLab hosted-review asset.
5. `fcneutral_05.png` — byte-for-byte reuse of an existing governed FaceLab hosted-review asset.
6. `fcneutral_06.png` — byte-for-byte reuse of an existing governed FaceLab hosted-review asset.
7. `fcneutral_07.png` — byte-for-byte reuse of an existing governed FaceLab hosted-review asset.
8. `fcneutral_08.png` — byte-for-byte reuse of an existing governed FaceLab hosted-review asset.

Rights metadata is evidence provenance, not legal adjudication. Reusing the five existing governed repository assets introduces no new external rights claim.

Public filenames are opaque (`fcneutral_01` through `fcneutral_08`) and do not contain source names or digest prefixes. The dedicated verifier reads the exact repository bytes and checks:

- SHA-256 against both authority and acquisition manifest;
- byte length;
- image media type from PNG/JPEG magic bytes;
- encoded width and height;
- for the five reused hosted-review assets, exact byte equality with the governed repository source asset.

The verifier also recomputes the raw acquisition-manifest SHA-256 and the authority digest using the contract's stable-stringify algorithm.

This proves repository byte identity and manifest/authority consistency. It does not establish Human face-count consensus or production semantic validity.

## Reviewer progress and persistence boundary

Stage A answer selection and navigation are browser-local until the final submission action. The page stores in-progress state under a digest-bound `localStorage` key and does not call the neutral submit endpoint merely when the reviewer:

- accepts the attestation;
- selects an answer;
- moves to the previous or next image;
- reaches image `8 / 8`.

Only the final `1단계 제출` action constructs the complete eight-response payload and performs the neutral submit POST. Therefore a reviewer may inspect and answer all eight images without creating a new Stage A database row as long as the final submit button is not activated.

A successful real Stage A submit writes only to:

`public.tmp_face_lab_neutral_face_count_submissions`

The table is isolated from the existing hosted Visualy submission table and from production Face Lab result/scoring/profile/report authorities. RLS is enabled. `anon` and `authenticated` have no table privileges; `service_role` has insert/select only. Update/delete are not granted.

The stored payload contains the neutral response envelope and exact independence attestation. Source names, source URLs, expected labels, provider output, traditional semantics, and downstream judgments are excluded.

Existing Human Review rows are not reset, deleted, truncated, or rewritten by the eight-item expansion.

## Receipt gate

For a real Stage A submission the server:

1. validates the exact authority-bound eight-item payload and independence attestation;
2. persists the neutral row;
3. computes the canonical payload SHA-256;
4. issues an HttpOnly, SameSite=Strict signed receipt;
5. binds that receipt to the persisted row, authority digest, payload digest, and the existing Stage B `hsi_<uuid>` session.

A real Stage B submission is rejected with `neutral_receipt_required` unless the receipt signature and persisted neutral row both verify and the receipt session matches `payload.sessionId`. The receipt cookie is cleared after successful Stage B persistence.

The existing explicit test-only hosted submission mode remains exempt so deterministic smoke tests do not create real Human-evidence authority.

## Authority limits

This slice does not establish:

- expected face-count ground truth;
- inter-reviewer consensus;
- empirical validation;
- provider landmark or face-detector authority;
- traditional face-reading equivalence;
- MyeongHa production geometry or semantic authority.

Stage A rows are independent Human neutral observations only. Any later MyeongHa admission must independently bind the frozen asset digest and governed Human evidence before changing production authority.
