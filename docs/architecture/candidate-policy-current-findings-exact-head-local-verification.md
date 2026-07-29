# CandidatePolicy Current Findings Exact-Head Local Verification

## Purpose

Verify the CandidatePolicy current-findings contract against the exact stacked head and the authoritative 164-row Production catalog without changing Production policy.

## Design

- Base: PR #83 exact head `f321dcd49d60acec506d414714b893059952ffab`.
- Data access: two ordered SELECT-only reads of `public.products` through the public RLS boundary.
- Dataset gate: 164 rows, 164 unique IDs, canonical audit hash `f346d90ed722432dd1e1367a50939954ec5030abb9a7ea72fdef61bb1dc93e2f`.
- Comparison: populated canonical current-findings context versus a valid-empty context with identical canonical ranking and safety contexts.
- Required outcome: findings affect ranking relation/score but do not create CandidatePolicy exposure drift.

## Invariants

- runtime/shadow parity;
- current-product transport complete `164/164`;
- UVA-missing sunscreen remains insufficient evidence;
- protection-complete sunscreen remains eligible;
- pilling-only missing sunscreen is not over-blocked;
- stabilization active-axis visibility remains zero;
- malformed findings context fails closed;
- source context remains immutable;
- no product names, brands, URLs, or raw rows are written to evidence.

## Prohibited changes

- runtime activation;
- CandidatePolicy exposure-policy expansion;
- GoalPolicy, safety, or snapshot-contract changes;
- DB writes, migrations, or backfills;
- Production canary or deployment changes.

## Verification state

`PENDING_EXACT_HEAD_EXECUTION`

## Completion verdict

If all invariants pass with zero unexplained exposure drift, the verdict is:

`CANDIDATE_POLICY_CURRENT_FINDINGS_CONTRACTED_NOOP`
