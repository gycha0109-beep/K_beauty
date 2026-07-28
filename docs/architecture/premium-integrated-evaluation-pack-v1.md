# Premium Integrated Decision Evaluation Pack v1

## Purpose

This read-only evaluation pack executes product evidence auditing and the canonical premium decision entrypoint as independent lanes, then checks their semantic alignment. It does not alter policies, scoring, products, routes, storage, or database state.

## Pipeline

1. Raw catalog fixtures → `buildProductDataSufficiencyAudit()`.
2. Premium report fixtures → `buildPremiumDecisionState()`.
3. Cross-lane rules compare product evaluability, active-axis interpretation, legacy-category semantics, and sunscreen evidence.
4. Global invariants protect bundle lineage, raw/effective separation, protection continuity, fallback enforcement, non-causation for unknown products, determinism, and input immutability.

## Fixture contract

The manifest version is `premium-integrated-evaluation-fixtures-v1`. Sixteen logical scenario IDs are mandatory. Locale parity uses explicit KO/EN variants and a manifest comparison. Revision behavior uses ordered rebuild steps rather than implicit assertions.

Assertion paths use safe dot notation only. Wildcards, bracket expressions, `__proto__`, `prototype`, and `constructor` are rejected. Syntactically valid missing paths remain assertion outcomes, allowing `not_exists` to work correctly.

## Outputs

The CLI writes summary, full results, failures, and a Markdown report. Existing output directories are rejected unless `--force` is provided. Any fixture-invalid or failed result returns a non-zero exit code.

## Boundaries

Fixtures prove decision-engine integration only. Actual product database coverage, API/session/storage/reentry behavior, browser rendering, Hosted Preview, and production behavior remain unverified.

## Next phase

Route / Storage / Reentry Integration Verification.
