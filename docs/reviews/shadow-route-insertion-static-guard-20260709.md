# Shadow Route Insertion Static Guard Review

## Phase 33 Summary

Phase 33 recommended a future `route_outside_helper_dev_only_artifact_writer` approach for disabled-by-default shadow dry-run planning. The plan required sanitized snapshots, local `tmp` artifact writing, no API response mutation, no recommendation mutation, and no DB write.

## Phase 34 Purpose

Phase 34 adds a pure dry-run snapshot contract helper and statically reviews possible `/api/analyze` insertion points. This phase does not change the route.

## Insertion Point Review

### after_public_decision_created

Result: conditional.

Risk: medium response and recommendation mutation risk because the public decision object is close to the response construction path.

Required guardrails:

- read-only public decision snapshot
- no shadow fields on public response
- recommendation snapshot captured before shadow processing

### after_candidate_source_diagnostics_created

Result: recommended with additional snapshot boundary.

Risk: low mutation risk, but final response shape is not necessarily available at that point.

Required guardrails:

- read-only candidate source snapshot
- separate final recommendation snapshot
- local tmp artifact only

### before_premium_store

Result: not preferred.

Risk: medium DB and artifact contamination risk because the persistence boundary is nearby.

Required guardrails:

- no store payload mutation
- dry-run artifact writer not reused for persistence
- DB write count zero verifier

### before_response_return_sanitized_comparison_only

Result: conditional.

Risk: medium response contamination risk because the return path is adjacent.

Required guardrails:

- no response object append
- artifact write failure non-blocking
- shape snapshot only

### route_outside_helper_dev_only_artifact_writer

Result: recommended.

Risk: lowest among reviewed candidates if guardrails are enforced.

Required guardrails:

- disabled-by-default flag gate before helper
- pure snapshot inputs only
- helper result not merged into response
- helper result not persisted
- schema validation before local artifact write
- artifact write failure non-blocking

## Recommended Insertion Point

Recommended insertion point remains `route_outside_helper_dev_only_artifact_writer`.

The static route review found an existing dev-only shadow capture pattern and public decision/candidate diagnostics anchors. A future helper should use sanitized snapshots and a local artifact writer rather than inserting shadow logic directly into response or persistence paths.

## Required Guardrails

- disabled-by-default flag gate before helper
- production disabled or explicit internal allowlist
- snapshot contract helper accepts sanitized inputs only
- helper result not merged into public response
- helper result not written to DB or store payload
- schema validation before local tmp artifact write
- artifact write failure non-blocking for response
- no CandidatePolicy runtime import
- no evaluator score, weight, or hard-filter change
- run no-response/no-recommendation/no-DB-write verifier chain

## Prohibited Implementation Patterns

- append shadow artifact to API response
- mutate public decision or recommendation groups
- write shadow artifact to DB/Supabase
- reuse premium store payload for shadow artifact
- dump full API response body
- record product display fields or raw input
- print env or secret values
- call CandidatePolicy runtime from shadow helper
- change evaluator hard filter, score, or weight

## Snapshot Contract Helper Verification

`lib/shadow-dry-run-snapshot-contract.js` defines sanitized snapshot builders and validation for:

- baseline response shape
- baseline recommendation
- shadow boundary hint
- shadow receiver
- comparison

The verifier confirms valid snapshots pass, forbidden-field samples fail, missing required fields fail, high-risk collapsed receiver counts are kill conditions, and runtime flags remain false.

## Runtime Non-application

No runtime path was changed:

- `/api/analyze` was not called or modified.
- evaluator runtime was not modified.
- CandidatePolicy runtime was not modified.
- UI/API response was not modified.
- recommendation results were not changed.
- DB/Supabase schema and product data were not modified.
- Supabase write was not executed.

## Phase 35 Proposal

Phase 35 should remain design/skeleton-only unless separately approved: disabled-by-default dry-run helper implementation skeleton or final pre-runtime integration checklist.
