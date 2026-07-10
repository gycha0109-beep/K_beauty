# Shadow Dry-run Implementation Plan Review

## Purpose

Phase 33 defines the disabled-by-default shadow dry-run implementation plan needed before any future route touch. This phase is planning only.

## Phase 32 Result Summary

Phase 32 added verifier skeletons for:

- no response change
- no recommendation change
- no DB write

The integrated safety verifier confirmed runtime isolation, synthetic skeleton sample separation, Phase 31 schema compatibility, and forbidden-field rejection.

## Implementation Plan Summary

The plan requires a future explicit flag, disabled by default, with production disabled unless an additional allowlist or dev-only guard exists. If the flag is off, the dry-run path must not execute. If the flag is on, it may only produce sanitized snapshots and local `tmp` artifacts.

The plan does not add that flag to `/api/analyze`.

## Recommended Insertion Point

Recommended insertion point: route-outside helper with a dev-only local artifact writer.

Reason: it keeps shadow logic out of the main route body, accepts pure sanitized snapshots as inputs, validates artifacts against the schema, and avoids response, recommendation, and DB mutation.

## Snapshot Contract Summary

Required future snapshots:

- baseline response shape snapshot
- baseline recommendation snapshot with topPick/supporting/budget ids and order
- shadow boundary hint snapshot
- shadow receiver snapshot
- comparison snapshot

Forbidden:

- full API response body dump
- product name or brand
- purchase URL
- review text
- raw form
- image/base64
- PII
- env/secret values

## Verifier Chain Summary

Future implementation must run:

- no-response-change verifier
- no-recommendation-change verifier
- no-DB-write verifier
- forbidden artifact field verifier
- required contract tests
- dry-run artifact schema verifier
- high-risk collapsed receiver kill condition
- metadata incomplete collapsed receiver kill condition
- strong caution collapsed receiver kill condition

## Kill Conditions

Runtime connection or dry-run expansion must be blocked on:

- high-risk collapsed receiver violation
- response shape diff
- recommendation result diff
- DB write
- metadata incomplete collapsed receiver violation
- strong caution collapsed receiver violation
- forbidden artifact field

Flag off must immediately disable dry-run behavior. Artifact write failure must not change response or recommendation results.

## Phase 34 Proposal

Phase 34 should remain design-only unless separately approved:

- dry-run snapshot contract helper design
- future flag contract documentation
- snapshot-schema-backed verifier refinement
- static route insertion guard review

## Remaining Limitations

- No runtime flag was implemented.
- No route insertion was implemented.
- No actual `/api/analyze` dry-run snapshot exists yet.
- No actual response/recommendation/DB snapshot comparison was performed.

## Runtime Non-application

No runtime path was changed:

- `/api/analyze` was not called or modified.
- evaluator runtime was not modified.
- CandidatePolicy runtime was not modified.
- UI/API response was not modified.
- recommendation results were not changed.
- DB/Supabase schema and product data were not modified.
- Supabase write was not executed.
