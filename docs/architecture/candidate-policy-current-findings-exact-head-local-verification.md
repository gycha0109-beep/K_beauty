# CandidatePolicy Current Findings Exact-Head Local Verification

## Purpose

Verify the CandidatePolicy current-findings contract against PR #83 exact head and the preserved 164-row Production export without changing Production policy.

## Base

- PR #83 exact head: `f321dcd49d60acec506d414714b893059952ffab`
- Production code changes in this task: none
- Database writes, migration, backfill, runtime activation, canary, or deployment changes: none

## Design and review

The verification isolates current-findings behavior by comparing:

- a populated canonical current-findings context; and
- a valid-empty findings context injected into the same canonical goal and safety envelope.

This prevents changes in canonical safety or goal state caused by current-product input from being misclassified as a current-findings exposure effect.

Actual-product fixtures were selected deterministically from catalog capabilities rather than from hard-coded product identities or a hard-coded concern axis.

No product names, brands, URLs, complete IDs, or raw rows were written to logs or evidence.

## Preserved export gate

Expected preserved export evidence:

- rows: `164`
- dataset hash: `f346d90ed722432dd1e1367a50939954ec5030abb9a7ea72fdef61bb1dc93e2f`

The original local ignored export was not accessible in the execution environment. Two ordered SELECT-only reads of the same Production `public.products` relation returned:

- rows: `164`
- unique IDs: `164`
- repeated row set: identical
- current dataset hash: `2c0f7f9db11305c995c123c5a6683be99f4937dcb64cffa288cc4bbead251a68`
- current reconstructed export hash: `86588f6295ccc784c77ea043a9bee27949cbd7465322a34899fe93d24b0026d8`

The current dataset hash does not equal the preserved-export hash. The expected hash was not rewritten or accepted as equivalent.

`products.updated_at` showed zero rows updated after the recorded export time and the table has an update timestamp trigger, but this does not prove that the two datasets are byte- or field-equivalent. Exact preserved-export verification therefore remains blocked.

## Current Production catalog diagnostic

The current 164-row catalog completed a read-only diagnostic replay:

- audit status: `audit_complete`
- current-product transport complete: `164/164`
- gaps: critical `0`, important `3`, quality `0`
- actual scenarios: `13`
- unexplained CandidatePolicy exposure drift: `0`
- runtime/shadow divergence: `0`
- malformed findings context: fail-closed
- source context mutation: `0`

Current-findings ranking effect was observed without exposure-policy expansion:

- support scenario score changes: `164`
- support scenario relation changes: `164`
- same-product relations: `1`
- duplicate-axis scenario score changes: `164`
- duplicate-axis relations: `162`

Safety and transport invariants remained intact:

- sunscreen rows: `11`
- protection-complete: `10`
- protection-complete visible under neutral UV context: `10`
- UVA-missing sunscreen: fail-closed
- pilling-only missing sunscreen: visible under neutral baseline
- pilling selection populated/empty findings exposure result: identical
- stabilization active-axis source candidates: `86`
- stabilization active-axis visible candidates: `0`

Diagnostic assertions: `135`

Diagnostic semantic hash:

`a68e38b44d9487a8d5787396d6f4545e34ed6b292552d9fa603bae1e22684175`

## Review corrections

The initial verifier was corrected in the verification-only harness for three invalid fixture assumptions:

1. A fixed acne-treatment pair did not exist at the required confidence level, so the duplicate active goal was derived from actual catalog capabilities.
2. The requested-only product also supported the canonical goal, so an actual non-overlapping requested-only fixture was selected.
3. A fixed visible-sunscreen count and the first pilling-missing row mixed preference and safety effects, so neutral-context eligibility and findings-only exposure comparisons were separated.

These corrections did not modify Production CandidatePolicy code.

## Cleanup

The live catalog verifier, temporary diagnostic wrapper, embedded public access material, and temporary security-manifest entry were removed after evidence collection. The final branch retains only this architecture record over PR #83.

## Final result

- Current Production catalog CandidatePolicy diagnostic: `PASS`
- Preserved exact-export verification: `PRECONDITION_FAILURE`
- Production code repair required from this task: none

The completion verdict `CANDIDATE_POLICY_CURRENT_FINDINGS_CONTRACTED_NOOP` cannot be assigned to the preserved export until the original ignored export with the expected hash is supplied to an exact-head local run.
