# Migration candidate reconciliation — canonical DB integration owner

**Owner:** taxonomy-ai (data meaning), `database-integration.yml` (single technical CI executor).
**Status:** candidate-only diagnostic / **HOLD**. Strict repository-only collision guard `scripts/verify-database-integration-authority.mjs` is preserved.

This directory extracts the **candidate-only migration classifier and local-file CLI** reviewed in Face Lab PR #1209 without duplicating Face Lab-specific pg_catalog/GRANT/RLS checks. The strict legacy-version reconciler in #1209 cannot complete on the actual repository: two different `20260824_*.sql` files share a timestamp. This candidate inspector intentionally preserves that collision and offers an investigation report; it never rewrites, repairs, drops, applies, or blesses either migration.

## Safe, explicit usage

Obtain a **nonsecret** migration metadata export from a separately approved source in the format `{"migrations":[{"version":"20261012000000","name":"example_migration"}]}`. Keep the file outside the repository. Do **not** supply database URLs, tokens, customer data, credential files or confidential SQL dumps.

```bash
node scripts/database/audit/inspect-candidate-migrations.mjs \
  --repo-dir supabase/migrations \
  --hosted-list /path/to/nonsecret-candidate-migrations.json \
  --out-dir /path/to/local-audit-output

node scripts/verify-database-migration-candidate-reconciliation.mjs
```

Output is local-only: `candidate-migration-diagnostic.{json,md,csv}`. Input `*.sql` bytes are SHA-256 hashed locally, **not executed**. Only local migration filenames/digests and candidate list metadata are compared. Repo version/name drift, name-only matching and duplicate versions **all remain unverified**. CSV protects against spreadsheet formula interpretation.

## CI responsibility without duplicate gates

- `database-integration.yml` executes the **single hermetic fixture verifier** above alongside the existing repository collision/target-safety check.
- PR/push CI does **not** fetch the connected Supabase candidate project or a Production DB; consequently a green check asserts only the offline comparison contract, not a database reconciliation pass.
- Face Lab Foundation should retain its **Face Lab-specific** application/catalog guard and existing #1209 tests **until** equivalent catalog tests are demonstrably preserved at the owning checks. Do not delete any unique security/pg_catalog coverage.
- When #1209 is rebased/split, drop only its **shared candidate comparison CLI/core duplicated by this canonical extraction**, and replace Face Lab's call to shared migration-audit functionality with an explicit dependency on this owner if actually required; never add a second executor of the same heavy probe.
- Do not rename the `20260824` files, migrate/replay a hosted DB or edit GRANT/RLS as a CI cleanup shortcut.

**Evidence:** `docs/evidence/taxonomy-ai-migration-candidate-readonly-20261012.md` (in PR #1229). Numbers are pinned snapshots, not evergreen Production state. Runtime server Production identity / applied SQL bytes / effective permissions are independent **HOLD** gates.

Watchtower-Track: taxonomy-ai
