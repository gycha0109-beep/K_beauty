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

Actual-product fixtures are selected deterministically from preserved-export capabilities rather than from product identities or a fixed concern axis.

No product names, brands, URLs, complete IDs, or raw rows are written to logs or evidence.

## Preserved export identity gate

Required exact evidence:

- input basename: `products-raw-export.json`
- raw export SHA-256: `2b16bd7c66aa719367cb9a5cd422a40d57ccf2296b780e931892b4d5325aeed6`
- rows: `164`
- unique IDs: `164`
- audit dataset hash: `f346d90ed722432dd1e1367a50939954ec5030abb9a7ea72fdef61bb1dc93e2f`

The expected hashes are immutable gates. A mismatch is reported as `PRECONDITION_FAILURE`; the expected values are not rewritten or accepted as equivalent.

## Exact local gate runner

The retained verifier is:

`scripts/verify-preserved-product-export-exact-gate.mjs`

It performs only local file reads and pure in-process evaluation. It performs no DB, Supabase, HTTP, deployment, environment, or credential access.

Run from the repository:

```powershell
cd "D:\Ji_hwan\K_Beauti AI"
git fetch origin
git switch codex/candidate-policy-current-findings-exact-head-local-verification
git pull --ff-only
node scripts/verify-preserved-product-export-exact-gate.mjs --input "_local_data/products-raw-export.json"
```

Machine-readable output:

`tmp/preserved-product-export-exact-gate.json`

The runner fails closed when:

- the tracked working tree is dirty;
- PR #83 exact head is not an ancestor;
- files other than this verifier and this architecture record differ from PR #83;
- the input file is absent;
- raw export hash, row count, unique ID count, or dataset hash differs;
- Product Data Sufficiency Audit invariants differ;
- runtime/shadow parity fails;
- Current Findings changes exposure;
- UVA protection metadata fails open;
- stabilization exposes an active-axis candidate;
- malformed findings fail to block;
- replay is not deterministic.

## Current Production catalog diagnostic

The current 164-row catalog previously completed a read-only diagnostic replay:

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

The earlier live-catalog harness exposed three invalid fixture assumptions:

1. A fixed acne-treatment pair did not exist at the required confidence level, so duplicate active goal selection is capability-derived.
2. A requested-only product could also support the canonical goal, so the runner selects a non-overlapping product deterministically.
3. Preference and safety effects could be mixed with Current Findings, so neutral eligibility and findings-only exposure comparisons are separated.

These corrections do not modify Production CandidatePolicy code.

## CI validation boundary

Every retained-verifier change must pass the existing security exact-manifest suite, JavaScript syntax gate, Production build, and diff hygiene before the PR base is restored to PR #83.

## Current state

- Current Production catalog CandidatePolicy diagnostic: `PASS`
- Preserved export exact runner: implemented; CI rerun required at the latest head
- Preserved local file execution in this environment: unavailable
- Production code repair required from this task: none

The final completion verdict remains `PRECONDITION_FAILURE` until the local command runs against the preserved file and returns:

`CANDIDATE_POLICY_CURRENT_FINDINGS_CONTRACTED_NOOP`
