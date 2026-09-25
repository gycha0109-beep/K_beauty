# CI Consolidation Audits

This directory contains evidence for reducing duplicate CI execution without deleting unique verification coverage.

## Phase A boundary

Phase A is audit-only. It does not delete, rename, merge, or rewrite workflow files.

The audit engine is `scripts/audit-ci-workflow-overlap.mjs`. It reconstructs workflow coverage from the current working tree, expands root npm verifier drivers such as `verify:current`, compares exact coverage units, and emits overlap evidence.

Run:

```bash
node scripts/audit-ci-workflow-overlap.mjs --check
node scripts/audit-ci-workflow-overlap.mjs --json
```

`--check` is fail-closed for workflow/registry inventory drift and for the three protected Mobile required-check compatibility shims. It never auto-classifies a workflow as `RETIRE`.

The checked-in baseline records the audit authority SHA, hard safety rules, priority clusters, and a recent 500-run Actions timing sample. The workflow inventory is frozen separately so a later audit can distinguish repository growth from Phase A evidence.

## Decision vocabulary

- `CANONICAL`: canonical owner already proven.
- `COMPAT_SHIM`: required-check compatibility name; heavy execution is retired but the check remains.
- `PROJECT_WIDE_AUDIT`: project-wide health workflow that may overlap dedicated owners but is not an automatic consolidation target.
- `MANUAL_ONLY_REVIEW`: dispatch-only release/artifact authority that may be inappropriate for routine PR execution.
- `REVIEW`: evidence exists but no consolidation decision is authorized.

`RETIRE` is intentionally not emitted in Phase A.
