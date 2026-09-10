# 2026-09-10 / DATA-SRC6 guarded legacy Offer importer

- Task type: execution / High DB-adjacent importer hardening with Production mutation explicitly excluded.
- Baseline: branch `feat/data-src6-guarded-offer-import-v1` started from DATA-SRC5 main `fcb720f645a64430e62dac4028302f29c1881510`; Production readback remained `products=164`, `product_offers=0`.
- Implementation: added a default-dry-run, insert-only importer for reviewed `legacy_offer_link_only_manifest_v1`. Confirm requires exact token `legacy-offer-link-only-import-v1` plus exact manifest digest; batch size is capped at 5; stale Product or listing identity conflict blocks the batch; selected rows are re-read before insert; exact post-insert readback is required. Price remains null, availability unknown, product scope unresolved; no Product writes, Offer UPDATE, or Offer DELETE path was added.
- Authority boundary: current `product_offers` identity uniqueness and service-role SELECT+INSERT grants are reused; no new Offer RPC, schema, migration, RLS, grant, recommendation, or ranking change. Hosted/Production confirm remains a separate protected mutation and was not executed.
- Verification: exact code head `f3b2daf9f0386aef7cb74f3cc7a63185048ee73b` passed all 8 PR workflows. Product Offers isolated runtime proved wrong-digest zero writes, dry-run zero writes, exact-confirm one insert with null price/unknown availability, exact readback, repeat idempotency, existing Product Offers regression, cleanup, and diff hygiene.
- Problem/remediation: one intermediate runtime-test revision failed TypeScript because `spawnSync` output inferred `string | Buffer`; stdout/stderr were narrowed to strings and the final code head passed.
- Next boundary: verify this log-bearing head, then merge #407. Production pilot import requires separate explicit protected-data authority.
- Context promotion candidate: none.
