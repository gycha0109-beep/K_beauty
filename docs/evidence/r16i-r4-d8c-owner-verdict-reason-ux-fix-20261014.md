# R16I D8C — OWNER verdict reason minimum-length removal (2026-10-14)

> Track: taxonomy-ai · PR #1255 · Issue #1204 · Independent security gate #1208. **No Product/Offer apply or security bypass.**

## Reported problem

The OWNER had already opened the private original and checked the source-confirmation box, but the evidence verdict buttons remained disabled when the reason was `오너 확인 완료`. The UI silently enforced `verdictReason.trim().length < 12`; server validation and the existing DB check also rejected fewer than 12 non-whitespace characters. The 12-character minimum had no verified fraud- or authorization-prevention effect and blocked valid concise human judgments.

## Exact fix

- Evidence OWNER `review_evidence` verdicts **VERIFIED** and **REJECTED** accept a reason of **1–2000 non-leading/trailing-whitespace characters**. Empty or whitespace-only reasons remain denied. Existing server-side OWNER capability, origin validation, exact evidence-ID scoping, immutable verdict ledger and submit audit metadata are unchanged.
- The UI disables buttons **only** when owner has not confirmed opening the original, the trimmed verdict reason is blank, or an operation is in progress. A live status message tells the reviewer which condition remains. The input placeholder explicitly states the nonblank requirement.
- Independent field-proposal rationale and final proposal-decision reason retain the pre-existing **12–2000-character** rules. No Product price, Offer, source identity, review, ranking, released CTA or Auth/RLS privileges are changed.
- New SQL migration `20261014121000_taxonomy_ai_r16i_verdict_reason_nonempty_v1.sql` replaces **only** the existing evidence-verdict reason CHECK `>=12` with `BETWEEN 1 AND 2000`, guarded against missing or drifted predecessor constraint. The applied migration history must match exactly when eventually executed. Existing evidence and verdict rows are preserved.
- Focused D8C verifier covers a 1-character reason, human text `오너 확인 완료`, space-trimmed valid input, whitespace-only/empty/over-2000 invalid inputs, and migration scope; already wired through existing D8F offline CI.

## Release state

This is a source-code/migration artifact change on PR #1255; **not a completed Production rollout**. The connected Supabase candidate has not had its schema modified as part of this patch. The effective deployed server DB identity is still not independently attested; do not assume a GitHub migration file is live.

Mandatory Supply Chain Security #1208 remains an independent blocking red gate. Do **not** merge PR #1255, deploy code or apply an unverified hosted database migration by bypassing this gate. The user can continue using existing hosted screen with a reason of at least 12 characters until the UI+server+DB changes are safely deployed. Do not manufacture an OWNER verdict.

## Isolated SQL execution contract added (not deployed)

- New `tests/fixtures/r16i-d8d/30_verdict_reason_migration_pg17.sql` creates the exact predecessor verdict CHECK, verifies short text was previously blocked, executes the actual migration from disk in one transaction, then checks one-character Korean text, `오너 확인 완료`, and 2000 characters succeed; whitespace-only and 2001 characters fail.
- The same isolated test verifies the old verdict remains and the independent proposal/decision minimums are not weakened, and ROLLBACK leaves no tables. The database integration workflow runs it in a disposable PG17 database and drops that database afterward.
- This tests a fixture-compatible migration only. Hosted schema has **not** been changed; a green isolated CI cannot independently authorize Production migration, code deployment or owner-verdict insertion.
