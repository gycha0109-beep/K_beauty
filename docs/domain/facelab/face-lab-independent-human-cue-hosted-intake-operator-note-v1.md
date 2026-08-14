# Face Lab hosted intake v1 operator note

## Required server environment

Configure these only in the approved hosted environment. Do not commit or paste secret values into documentation, chat, client code, logs, or PR text.

- `NEXT_PUBLIC_SUPABASE_URL`: project `bygrczggxfuisupcevaz` URL.
- `SUPABASE_SERVICE_ROLE_KEY`: server-only key for the same project.
- `FACE_LAB_HOSTED_REVIEW_ACCESS_TOKEN`: a cryptographically random base64url token of at least 32 characters.
- `FACE_LAB_HOSTED_REVIEW_ALLOW_TEST_SUBMISSION`: set to `1` only for an explicitly authorized test environment; leave unset for reviewer execution.

Rotate the shared access token if the link is exposed outside the approved reviewer group. A token change invalidates previously issued links but does not alter stored submissions.

## Reviewer link

After merge, deployment, and a deployed smoke PASS, the single reviewer entrypoint is:

`https://<approved-host>/facelab/review?t=<FACE_LAB_HOSTED_REVIEW_ACCESS_TOKEN>`

Send only that link. Do not send D2D-P/D2D-UI1 ZIPs unless the separately approved offline fallback is invoked. Do not add respondent names or reviewer-slot labels to the URL.

## Result access

The reviewer route cannot read any submission. Results are available only to an authorized operator through server/admin or direct database tooling against:

`public.tmp_face_lab_independent_human_cue_submissions`

Operational retrieval must preserve `response_payload_json`, `response_payload_sha256`, authority digests, session ID, status, and timestamps together. Filter out `submission_status = 'test'` before any Human aggregation. Do not promote rows into canonical Face Lab tables during D2D-XP.

## Pre-distribution checklist

1. Confirm deployed commit and hosted authority digest `b92f221f8c9b3521637b9f1660ddd2f6c287883bb8620f4b8ac02bd786e30491`.
2. Confirm the server environment points to Supabase project `bygrczggxfuisupcevaz`.
3. Confirm anon/authenticated select and insert remain denied and service-role update/delete remain denied.
4. With test mode enabled only in the authorized test environment, open the link with `&smoke=1`, run one explicit test-mode submission, and verify its status is `test`, 140 judgments are present, and the payload digest matches.
5. Disable test mode.
6. Confirm the reviewer link is `noindex`, shows 14 neutral images, uses Korean labels, and makes no third-party browser requests.
7. Obtain the separate D2D-X execution authorization before sending the link.

## D2D-X remains closed

This note does not authorize reviewer recruitment, identity binding, link distribution, actual completion, reveal, aggregation, consensus, production consumption, or W2. Those actions require the next explicit gate.
