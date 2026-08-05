# 2026-08-05 — ADMIN-PRODUCT-CLEANSER-METADATA-V2

- Type: bounded Admin product metadata contract implementation with DB/Auth/RLS protected surfaces.
- Durable base: exact PR #166 head `4efa74c8ce4c89b03cc592e7edbf93b20c6fd687`.
- Excluded lineages: PR #168 hosted audit documentation, PR #169 local rehearsal tooling, PR #167 recommendation metadata shadow/policy evidence.
- Delta: explicit Product Review v2 bundle/parser/export adapter, cleanser field semantics, review states/confidence, digest-bound field evidence, dry-run/canonical preflight, server-derived reviewer, versioned storage, atomic v1-delegating confirm, completeness projection, isolated local replay, verifier, workflow integration, and architecture document.
- v1 boundary: v1 constants, headers, parser, dry-run, confirm, hash, create and merge code are unchanged.
- Storage: reuses `products.cleansing_profile`; adds `product_metadata_field_reviews` and a separate v2 idempotency ledger. No legacy cleanser backfill.
- Non-targets: scorer, `isDeepCleanser`, hard penalty, `-18`, ranking, Top Pick, CandidatePolicy, Premium/public response, hosted migration, Production write, deployment, Provider, merge.
- Verification target: v1 regression, v2 contract matrix, TypeScript, architecture guard, production build, exact-head path invariance, isolated Supabase reset twice and end-to-end atomic confirm.
- CI topology: v2 checks are added only to the existing Admin current-main integration workflow. Temporary standalone and unrelated security-workflow workarounds were removed after they proved unable to trigger for a stacked PR whose base branch is not the default branch.
