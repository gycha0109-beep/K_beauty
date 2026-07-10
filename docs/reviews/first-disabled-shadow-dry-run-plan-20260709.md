# First Disabled Shadow Dry-run Plan Review

## Phase 37 Purpose

Phase 37 fixes the preflight, runbook, snapshot, kill, and rollback criteria required before a first disabled-by-default shadow dry-run can be proposed. This phase is not runtime integration.

## Phase 36 Checklist Status

Phase 36 status was `ready_for_first_disabled_shadow_dry_run_plan`.

That means the project is ready to write the first disabled shadow dry-run plan. It does not mean `/api/analyze` route connection is approved.

## Preflight Checklist Summary

The plan requires:

- branch clean or only intended changes
- future route change scope described in a separate approved phase
- flag default off
- production disabled or guarded
- helper and artifact writer separation
- artifact writer failure non-blocking
- local `tmp` artifact path only
- schema validation before write
- no response merge
- no recommendation mutation
- no DB/Supabase write
- forbidden fields blocked
- required contract tests passed
- no-response, no-recommendation, and no-DB-write verifier availability

## Runbook Summary

The future runbook sequence is:

1. prepare baseline run
2. capture flag-off baseline snapshots
3. execute flag-on dry-run under explicit guard
4. check response shape diff
5. check recommendation diff
6. check DB write count
7. validate artifact schema
8. scan forbidden fields
9. check safety kill counts
10. confirm flag-off rollback

Phase 37 does not execute the runbook.

## Kill Criteria Summary

The plan blocks progress on:

- API response shape diff
- `topPick`, `supportingProducts`, or `budgetAlternatives` diff
- DB write count greater than zero
- high-risk collapsed receiver count greater than zero
- sensitivitySafe false collapsed receiver count greater than zero
- metadata incomplete collapsed receiver count greater than zero
- strong caution collapsed receiver count greater than zero
- forbidden artifact field detected
- artifact writer failure affecting response or recommendation
- insufficient production guard
- helper result merged into public response or store payload

## Rollback Plan Summary

Rollback is flag-off first, then artifact writer disabled, local `tmp` cleanup if needed, future route dry-run block disabled or removed, baseline reconfirmed, verifier chain rerun, and failure report written.

## Phase 38 Proposal

Phase 38 should remain non-runtime unless separately approved. Allowed work is a first disabled shadow dry-run implementation patch plan, minimal route insertion proposal, artifact writer skeleton proposal, flag guard implementation plan, or dry-run snapshot verifier refinement.

## Remaining Limitations

- No actual dry-run was executed.
- No actual baseline/after response snapshot pair exists.
- No actual baseline/after recommendation snapshot pair exists.
- Artifact writer remains unconnected.
- Route remains untouched.

## Runtime Non-application

No runtime path was changed:

- `/api/analyze` was not modified or called.
- evaluator runtime was not modified.
- CandidatePolicy runtime was not modified.
- UI/API response was not modified.
- recommendation output was not modified.
- DB/Supabase was not modified or written.
