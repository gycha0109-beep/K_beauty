# Face Lab independent Human cue hosted intake v1

## Status

- State: `D2D-XP hosted intake draft ready`
- Execution: not started
- Human judgments: 0
- Consensus: 0
- W2: `W2_REMAINS_LOCKED`
- Production Face Lab consumption: false

This boundary replaces reviewer-specific ZIP delivery and manual JSON return as the planned execution path. It does not replace, mutate, or supersede sealed D2D-P packets or the D2D-UI1 offline Korean distribution. Those artifacts remain the provenance authority, reference implementation, and offline fallback.

## Product decision

One shared opaque link serves one deterministic 14-image set. Every respondent receives the same neutral order and creates an independent submission identified by a random session ID. Reviewer slots and reviewer-specific permutations are absent from the hosted UI and hosted response contract.

The Korean UI keeps D2D-UI1's reviewer-safe definitions, canonical token mapping, uncertainty handling, not-assessable reasons, independent-review attestations, progress persistence, and final validation. The 8 primary and 2 validation axes appear together for each image, so the reviewer makes one pass across 14 images. `featureContrast` remains excluded.

## Frozen authorities

- D2C-F definition digest: `8e630605ece0629da6a51e30829297688c27f10a3a92be6a3c8e3413f546bb46`
- D2D-P packet authority digest: `1f344a9d1cbd8e8ac6076b06da7780d213ff6ff71df80ea7a9f818617965339c`
- D2D-UI1 distribution authority digest: `23636cf323ac944ae0c283e75e3161ebfaceedee2838bc672789488bcf772a32`
- Hosted single-set authority digest: `b92f221f8c9b3521637b9f1660ddd2f6c287883bb8620f4b8ac02bd786e30491`
- Hosted authority artifact: `evidence/facelab/face-lab-independent-human-cue-single-hosted-set-20260815-v1.json`

The hosted order is the lexical order of `sha256(authorityVersion + NUL + opaqueReviewItemId)`. The tracked authority binds each neutral asset path to the source review-asset SHA-256 and pixel digest. Assets are byte-for-byte copies of the sealed reviewer-safe PNGs; they are not renamed to target labels, transformed, recompressed, or regenerated.

## Hosted boundary

- Review document: `GET /facelab/review?t=<opaque-token>`
- Submission endpoint: `POST /api/facelab/review/submit`
- Storage table: `public.tmp_face_lab_independent_human_cue_submissions`
- Distribution mode: `single_hosted_set`
- Access mode: `shared_opaque_link`

The review document requires the server-only `FACE_LAB_HOSTED_REVIEW_ACCESS_TOKEN`. The same bearer token is sent only to the same-origin submit endpoint in a dedicated header. The route validates same-origin browser context, token equality with a timing-safe digest comparison, request content type and byte limit, the exact hosted response schema, canonical answer tokens, authority digests, item/axis order, attestations, and completion counts before inserting.

The browser never receives a Supabase service-role key and never inserts into Supabase directly. No analytics or third-party tracker is present. The review document is `noindex`, `noarchive`, `no-store`, and `no-referrer`.

## Persistence and immutability

The tmp table stores one row per session with server submission time, optional client submission time, the complete canonical response envelope, deterministic response SHA-256, completion summary, attestations, and all source authority digests. Korean display labels are not storage authority.

RLS is enabled. `public`, `anon`, and `authenticated` have no table privilege and there are no public policies. `service_role` has insert and select only; update and delete are revoked. The application exposes no list/read/update/delete route. `(campaign_key, session_id)` is unique, so a submitted session cannot overwrite or replay its row.

## Validation evidence

- Existing D2D-P protocol verifier: PASS, Human judgments 0.
- Existing D2D-UI1 local distribution verifier: PASS with the sealed authority digest and zero source mutation.
- Hosted set verifier: PASS, 14 asset SHA checks, reviewer slots 0.
- Hosted response verifier: PASS, 140 canonical judgments plus negative cases.
- Hosted static UI/security verifier: PASS.
- Next production build: PASS on Next.js 15.5.22.
- Browser test-only flow: PASS from Korean intro through all 14 images, progress validation, localStorage restore, mock submit success, and state cleanup; external browser requests 0.
- Hosted migration: applied to Supabase project `bygrczggxfuisupcevaz`.
- Hosted service-role smoke: one `submission_status=test` row inserted with 140 judgments and matching authority/digest fields; real Human submitted rows remain 0.

The repository hook blocked loading the primary checkout's protected `.env.local` into the temporary browser server. That boundary was not bypassed. Browser interaction and hosted service-role persistence were therefore validated as separate gates rather than claiming a local route-to-hosted end-to-end credential run.

## Non-goals

- No production Face Lab engine, result, profile, or report change.
- No scorer weight, threshold, taxonomy, observation, or generation change.
- No D2D-P or D2D-UI1 mutation.
- No reviewer identity binding, packet distribution, Human judgment, reveal, aggregation, or consensus.
- No W2 or D2D-X execution.

## Next gate

D2D-X may start only after the Draft PR is reviewed and merged, the hosted environment receives the approved secrets, a non-production deployed route-to-hosted smoke passes, the exact shared link is approved, and reviewer recruitment/consent and execution authority are explicitly granted. Until then, do not distribute the link.
