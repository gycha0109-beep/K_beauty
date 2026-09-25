# TRUST Phase 8H — Official Source Rediscovery / Governed Relocation Contract v1

## 1. Purpose

Phase 8H closes the operational gap between immutable historical Product Evidence and official source movement.

A source locator can disappear, redirect, replatform, become temporarily blocked, or move to a new official surface. None of those events independently prove that Product Fact truth changed. Phase 8H therefore separates transport discovery from identity qualification, governed relocation, and semantic revalidation.

The contract is data-volume independent. No rule is tied to the current 38 Product Evidence Sources or to any named brand. The current Production inventory is only a point-in-time audit fixture.

## 2. Non-negotiable invariants

- Historical `product_evidence_sources.canonical_locator` is immutable provenance. Phase 8H must not patch it to a newly discovered URL.
- A redirect is not Product/Subject/formulation equivalence.
- A 404/410 is not evidence that the Product Fact is false.
- 408/425/429, 5xx, timeout, DNS/fetch failure are transient and cannot authorize relocation.
- Search results, sitemap entries, canonical tags, redirects, and manually supplied URLs are discovery candidates only.
- A rediscovery candidate cannot become Evidence or Product Fact authority without existing controlled official-source review and explicit governed adoption.
- Relocation alone must not mutate Product Fact instances, confirmations, Current pointers, Recommendation authority, or recommendation logs.
- Same-semantic recovery must reuse Phase 8D/8E. Changed-semantic recovery must reuse Phase 8F. Phase 8H must not implement a second Fact replacement path.
- Production mutation is forbidden in the 8H-0 frontier audit.

## 3. Phase 8H-0 transport frontier

The first boundary is deliberately transport-only.

Input:
- any bounded inventory satisfying `trust-phase8h-source-frontier-inventory-v1`
- one or more HTTPS official source locators

Output contract:
- `trust-phase8h-source-frontier-audit-v1`

Allowed states:

| State | Meaning | Authority |
| --- | --- | --- |
| `HEALTHY_SAME_LOCATOR` | Safe fetch completed at the same locator | No relocation |
| `REDIRECTED` | Safe fetch completed at a different final URL | Candidate signal only |
| `TERMINAL_MISSING` | 404/410 from the governed fetch boundary | Rediscovery eligible; not relocation authority |
| `TRANSIENT_FAILURE` | retryable HTTP/network condition | Retry only |
| `SOURCE_BLOCKED` | safety/content/access boundary prevented a valid observation | Hold/manual investigation |

8H-0 does not emit `QUALIFIED_EXACT`, `AMBIGUOUS_IDENTITY`, or semantic conclusions. Those belong to the later qualification boundary.

## 4. Safe fetch reuse

The audit reuses `lib/trust/official-source-fetch.mjs` rather than creating a second HTTP client. Therefore the existing HTTPS-only, private-network denial, bounded response, timeout, redirect, content-type, and transient-failure rules remain authoritative.

The audit may follow redirects only through that boundary. The resulting final URL is recorded as an observation, never written back to Product Evidence.

## 5. Scale contract

The audit implementation accepts an inventory array and uses bounded concurrency. It must not contain:
- hard-coded Source IDs,
- brand-specific branching,
- assumptions about a fixed source count,
- Product Fact writes,
- Supabase RPC/write clients.

A Production snapshot may contain 36 rows today and hundreds or thousands later. Scaling is performed by generating a new inventory snapshot or by a future read-only inventory adapter; the classifier remains unchanged.

## 6. Rediscovery qualification boundary — next implementation slice

A transport signal can create a rediscovery candidate only after the frontier audit. Candidate discovery order is:

1. official HTTP redirect target,
2. official canonical URL on the same governed surface,
3. an already reviewed official binding for the same Product/Subject,
4. bounded same-publisher official sitemap candidates,
5. an Admin-supplied official candidate.

Every candidate remains non-authoritative until qualification proves the exact governed identity dimensions required by the current Subject:
- `product_id`
- `subject_id`
- market
- variant key
- formulation revision key
- publisher/source kind
- required claim/identity anchors where applicable.

Expected qualification dispositions are `QUALIFIED_EXACT`, `AMBIGUOUS_IDENTITY`, `WRONG_PRODUCT`, `WRONG_MARKET`, `WRONG_VARIANT`, `WRONG_FORMULATION`, `ANCHOR_MISSING`, `UNSUPPORTED_SEMANTICS`, `TRANSIENT_FAILURE`, and `SOURCE_BLOCKED`.

Only `QUALIFIED_EXACT` may enter Admin relocation preflight.

## 7. Governed relocation boundary — planned

The next DB slice will record an immutable lineage from the historical Evidence Source to a reviewed replacement `product_source_bindings` row. It will not update the historical Evidence Source locator.

The relocation ledger will carry at minimum:
- historical `source_id`
- exact Product/Subject scope
- reviewed replacement binding
- old and replacement locators
- discovery/qualification contract and digest
- prestate digest
- actor/request identity
- supersession lineage.

Admin flow remains preflight then explicit confirmation with idempotency and stale-prestate rejection.

## 8. Revalidation handoff — planned

An approved relocation is an operational revalidation trigger, not a semantic verdict.

The intended path is:

`approved relocation -> Phase 8D research -> Phase 8E same-semantic reaffirmation OR Phase 8F changed-semantic replacement review`

The existing Phase 8G comparability gate remains intact for verification-triggered revalidation. Legacy sources without a comparable profile are not silently promoted to comparable; relocation will be a separately governed trigger with its own lineage.

## 9. Current Production frontier snapshot

The snapshot captured on 2026-09-25 contains:
- Product Evidence Sources: 38
- sources with Phase 8G verification profiles: 2
- unprofiled frontier sources: 36
- revalidation transitions: 0
- revalidation research bridges: 0
- revalidation resolutions: 0

The 36-row inventory in `docs/evidence/trust-phase8h-source-frontier-inventory-v1.json` is evidence of the current frontier only. It is not a code-level limit.

## 10. Exit criteria for 8H-0

8H-0 is complete when:
1. the Production unprofiled frontier is captured without writes,
2. the classifier is deterministic under mocked transport outcomes,
3. the implementation reuses the governed safe-fetch boundary,
4. the audit code contains no database mutation path,
5. CI verifies inventory integrity and exact-head diff hygiene,
6. live probes, when run, produce an artifact whose states cannot themselves mutate authority.
