# TRUST Phase 8H-1B — Bounded Official-Domain Rediscovery Contract v1

## Purpose

This slice handles the Beauty of Joseon redirect frontier left by Phase 8H-1 direct qualification.

The four historical Evidence Source rows do not relocate to the site root. Instead, the system performs bounded read-only discovery on official publisher surfaces and forces every discovered product-specific candidate back through the existing Phase 8H exact identity qualification engine.

## Invariants

- Discovery never updates historical Evidence Source locators.
- Discovery never creates Product Fact, Evidence, Current, Confirmation, Recommendation, source-binding, or revalidation authority.
- A sitemap entry, catalog link, internal-search link, or external-search result is a candidate only.
- External search may seed a candidate URL but contributes zero qualification authority.
- Candidate pages are fetched again through the governed official-source safe-fetch boundary before qualification.
- Localized/market-specific paths can be excluded by governed input when they cannot represent the historical market.
- Duplicate historical Evidence Source rows sharing one Product/Subject may share one rediscovery execution, but all source IDs remain in lineage.
- Dr.G HTTP 429 rows remain retry-only and are not part of this slice.

## Discovery surfaces

The generic rediscovery engine supports:

1. official sitemap XML,
2. official HTML catalog/index/search surfaces,
3. external-search URL seeds.

Sitemap fetching reuses the existing HTTPS/private-network/redirect/timeout/size boundary and adds only XML/text content types.

The engine is bounded by allowed official hosts, product path prefixes, optional path exclusions, maximum sitemap count, maximum candidate count, and maximum qualification candidate count.

No brand name or Source ID is embedded in classifier code.

## Beauty of Joseon governed cases

### Relief Sun : Rice + Probiotics

Historical lineage covers three Evidence Source rows for one governed Product/Subject.

Rediscovery may consider only main-host product pages after excluding explicitly localized UK/EU and duo paths.

The existing reviewed official binding proves Product/Subject/variant/formulation lineage for the historical locator. A newly discovered non-redirect candidate still needs current page evidence. Exact qualification requires:
- Relief Sun product identity,
- Rice + Probiotics or renamed Rice + Niacinamide identity,
- SPF50+ claim anchor,
- explicit same-formula continuity language tying the old and renamed product names together.

The formulation continuity anchors are intentionally required because a sitemap candidate is not the same proof mode as a direct HTTP redirect.

### Relief Sun Aqua-Fresh : Rice + B5

The historical Evidence Source has exact Product/Subject binding but no reviewed official source binding in the current governed review ledger.

Rediscovery may find product-specific candidates, but the current contract does not permit anchor-only Subject/formulation authority for this case.

Therefore a readable exact-looking Aqua-Fresh page can still end in UNSUPPORTED_SEMANTICS until a reviewed official binding establishes the missing governed lineage.

## Rediscovery outcomes

Case-level outcomes:

- QUALIFIED_EXACT_CANDIDATE_FOUND
- CANDIDATES_HELD_AFTER_QUALIFICATION
- NO_SAFE_OFFICIAL_CANDIDATE
- EXTERNAL_SEEDS_ONLY (rediscovery-layer diagnostic only)
- NO_SAFE_CANDIDATE
- TRANSIENT_FAILURE
- SOURCE_BLOCKED

Score-zero catalog/sitemap noise is excluded whenever query terms exist. External-search seeds are counted separately from official rediscovery candidates; external seeds alone resolve the case to NO_SAFE_OFFICIAL_CANDIDATE even if they are re-fetched and qualified as a hold. Only a nested qualification disposition of QUALIFIED_EXACT can become eligible for the future Admin relocation preflight.

## Current search seed boundary

Public search discovery currently exposes official Beauty of Joseon product content indicating that Relief Sun has been renamed from Rice + Probiotics to Rice + Niacinamide while claiming formula continuity.

That observation is useful only to define candidate anchors. It is not recorded as governed evidence here. The candidate must expose the same continuity statement when fetched through the repository safe-fetch boundary.

## Production mutation policy

This slice is read-only.

Durable outputs are limited to rediscovery/qualification code, deterministic fixtures, live CI artifacts, and repository evidence summaries.

Production database writes remain zero.
