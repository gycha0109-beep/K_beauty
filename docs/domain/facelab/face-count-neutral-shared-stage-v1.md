# Face Lab Neutral Face Count Shared Stage v1

## Purpose

`/facelab/review?t=...` is the shared reviewer entry point. Before the existing Visualy Human-cue review begins, the reviewer completes a neutral Stage A that records only the visible Human face-count category for three frozen public images.

Flow:

```text
shared opaque review link
→ Stage A independence/source/provider-blind attestation
→ Stage A neutral face count (3 images)
→ server persistence + payload SHA-256
→ HttpOnly signed receipt bound to the existing hsi_<uuid> hosted session
→ Stage B existing 14-image Visualy Human-cue review
```

## Neutral observation contract

Allowed response tokens are exactly:

- `none`
- `one`
- `two_or_more`
- `not_assessable`

Before images are shown, the reviewer attests that source/answer information, automated analysis, and other participant responses were not viewed; that only visible Human face count will be judged; and that identity or other sensitive/unnecessary personal traits will not be inferred.

The **server authority** binds each opaque review item to an exact repository asset SHA-256. The **reviewer-facing projection** contains only the opaque `reviewItemId`, opaque asset path, neutral instruction, response vocabulary, and independence attestation. It excludes source names, source URLs, asset digests, expected face-count labels, ground truth, provider outputs, traditional semantics, partitions, and downstream Face Lab judgments.

## Source assets and provenance

Source provenance is isolated in `evidence/facelab/face-count-neutral-source-acquisition-20260831-v1.json`.

The three assets are:

1. NASA/GSFC Earth image — source metadata records U.S. public-domain status.
2. Official-duty U.S. Army Eisenhower portrait — source metadata records U.S. public-domain status.
3. History Trust of South Australia `GN11452` historical group portrait — Wikimedia Commons revision metadata records CC0 1.0.

Rights metadata is evidence provenance, not legal adjudication.

Public filenames are opaque (`fcneutral_01.jpg` through `fcneutral_03.jpg`) and do not contain source names or digest prefixes. The dedicated verifier re-hashes repository bytes and checks JPEG dimensions against the isolated acquisition manifest.

This proves repository byte identity to the acquired evidence package. It does not establish Human face-count consensus or production semantic validity.

## Persistence boundary

Stage A writes only to:

`public.tmp_face_lab_neutral_face_count_submissions`

The table is isolated from the existing hosted Visualy submission table and from production Face Lab result/scoring/profile/report authorities. RLS is enabled. `anon` and `authenticated` have no table privileges; `service_role` has insert/select only. Update/delete are not granted.

The stored payload contains the neutral response envelope and exact independence attestation. Source names, source URLs, expected labels, provider output, traditional semantics, and downstream judgments are excluded.

## Receipt gate

For a real Stage A submission the server:

1. validates the exact authority-bound payload and independence attestation;
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
