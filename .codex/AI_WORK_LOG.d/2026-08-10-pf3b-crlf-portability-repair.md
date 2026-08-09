# PF-3B governed replay verifier CRLF portability repair

- Scope: changed only `scripts/verify-product-fact-replay-baseline-v1.mjs` plus this audit entry. Baseline fixture bytes, materializer, production migrations, package files, and workflows were not changed.
- Root cause: M8 applied an LF-only line mutation to raw bridge SQL. A fresh Windows checkout materialized the SQL with CRLF, so the mutation was a no-op and `M8:toner_pad:mutation_not_detected` was raised.
- Repair: all mutation-test SQL working strings now pass through the existing `normalizeLineEndings()` primitive before line-sensitive mutations. The verifier constructs independent LF and CRLF representations in memory and runs the unchanged 17-guard semantic suite against each representation.
- Verification boundary: syntax, focused verifier, fresh-Windows-checkout, diff, and architecture checks only. Docker, Supabase, PostgreSQL, migration replay, schema/sentinel fingerprint cycles, Hosted, and Production were not accessed.
