# Isolated Shadow Route Runbook

## Phase 42 Purpose

This runbook defines the preconditions and procedure for the first isolated flag-off/flag-on `/api/analyze` comparison. Phase 42 does not execute the route.

## Required Preconditions

- `assert-non-production-supabase-target.mjs` must return `safeToRunRoute: true`.
- The target must be local loopback Supabase or an explicitly allowlisted disposable non-production target.
- The disposable target must have an agreed cleanup and rollback procedure before any request.
- The Phase 42 payload and synthetic image fixture must be used for both requests.
- The route environment must not use a production external-analysis credential.
- A mutation observer must separately count existing route writes and shadow-added writes.
- Artifact output must remain local `tmp/shadow-boundary-dry-run/` only.

## Flag-off Baseline

1. Confirm the shadow flag is unset or off.
2. Start only the isolated development server configured for the approved target.
3. Send one multipart request using the fixture image as `image` and every fixture form field unchanged.
4. Record only sanitized response shape, recommendation IDs/order, existing-route mutation counters, and shadow artifact count.
5. Do not store the complete response body, image bytes, product display fields, secrets, or raw form data.

## Flag-on Dry-run

1. Enable `DEV_ONLY_SHADOW_BOUNDARY_DRY_RUN=1` only in the isolated development process.
2. Repeat the identical multipart request once.
3. Record the same sanitized snapshots and counters.
4. Confirm a local shadow artifact exists, passes schema validation, and has no forbidden fields.

## Comparison Criteria

- Response shape diff must be false.
- topPick ID diff must be false.
- supportingProducts IDs/order diff must be false.
- budgetAlternatives IDs/order diff must be false.
- Shadow artifact delta must be zero for flag-off and within the expected local writer range for flag-on.
- `shadowAddedDbMutationDelta` equals `flagOnShadowMutationCount - flagOffShadowMutationCount` and must be zero.
- Existing guard/session/premium writes may exist; compare their counters between runs and do not classify them as shadow writes.
- Any high-risk, sensitivity unsafe, metadata incomplete, or strong caution collapsed receiver count must remain zero.

## Cleanup and Rollback

1. Turn the shadow flag off.
2. Stop the isolated development process.
3. Remove local tmp artifacts from the isolated run.
4. Run the approved disposable-target cleanup procedure.
5. Re-run target assertion and verify the production block remains active for non-approved environments.
6. Preserve only sanitized summaries required for the review artifact.

## Prohibitions

- No production or unverified hosted Supabase target.
- No evaluator/CandidatePolicy runtime connection.
- No API response, recommendation, UI, schema, migration, or product-data change.
- No user image, complete response body, secret, raw form, product display field, URL, review text, or PII in artifacts.

This document is not approval for evaluator/CandidatePolicy runtime connection.
