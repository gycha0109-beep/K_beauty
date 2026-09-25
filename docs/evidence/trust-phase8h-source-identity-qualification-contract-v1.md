# TRUST Phase 8H-1 — Official Source Exact Identity Qualification Contract v1

## 1. Purpose

Phase 8H-1 converts a non-authoritative transport signal from Phase 8H-0 into a deterministic identity qualification result.

It answers one question only:

> Does this candidate official locator prove the exact governed Product/Subject/market/variant/formulation scope previously represented by the historical Evidence Source?

A successful result is qualification evidence for later Admin relocation preflight. It is not itself a relocation, Evidence adoption, Product Fact mutation, or semantic reaffirmation.

## 2. Authority boundary

The implementation contract is 'trust-phase8h-source-identity-qualification-v1'.

Non-negotiable rules:

- Historical product_evidence_sources.canonical_locator remains immutable provenance.
- HTTP redirect targets, canonical tags, sitemap entries, search results, and Admin-supplied URLs are candidates only.
- Same publisher or same registrable domain is not sufficient for exact identity.
- A product-specific historical URL that collapses to a site root is AMBIGUOUS_IDENTITY, never QUALIFIED_EXACT.
- QUALIFIED_EXACT does not mutate Product Fact, Confirmation, Current, Recommendation, Evidence Source, source binding, or revalidation state.
- 408/425/429, 5xx, timeout, DNS/fetch failure remain retry-only TRANSIENT_FAILURE.
- Dr.G 429 observations remain outside relocation qualification until a successful governed fetch exists.
- Search-engine output may seed a candidate locator but cannot satisfy any qualification check.
- Only a later governed Admin relocation flow may consume a QUALIFIED_EXACT digest.

## 3. Candidate discovery order

Candidates are considered in this order:

1. governed official HTTP redirect target,
2. canonical URL observed on the governed official surface,
3. already reviewed official binding for the exact Product/Subject,
4. bounded same-publisher official sitemap candidate,
5. Admin-supplied official candidate.

The discovery method is recorded. No discovery method is authority by itself.

## 4. Exact qualification dimensions

The qualification engine evaluates:

1. **Transport** — candidate observation is readable through the existing safe official-source fetch boundary.
2. **Official publisher scope** — final host is explicitly allowed and publisher identity is compatible.
3. **Product identity** — required product anchors are present on a product-specific surface.
4. **Subject lineage** — exact governed Product/Subject lineage is proven by reviewed binding or an explicitly allowed stronger proof mode.
5. **Market** — governed, candidate, reviewed-binding, and required market anchors do not conflict.
6. **Variant** — governed variant and reviewed variant match when a variant is governed.
7. **Formulation** — governed formulation lineage is preserved by reviewed redirect lineage or an explicitly allowed anchor-only formulation proof.
8. **Claim anchors** — the candidate still exposes the claim/identity anchors required by the historical Evidence use.

The engine is pure and data-volume independent. Brand names, Source IDs, and current source counts belong in fixtures or canary input, never in classifier branching.

## 5. Dispositions

| Disposition | Meaning | May enter relocation preflight? |
| --- | --- | --- |
| QUALIFIED_EXACT | Exact governed identity proven | Yes |
| AMBIGUOUS_IDENTITY | Candidate is official but product/subject specificity is insufficient | No |
| WRONG_PRODUCT | Required product identity is absent or contradicted | No |
| WRONG_MARKET | Governed market scope is not exact | No |
| WRONG_VARIANT | Governed variant is not exact | No |
| WRONG_FORMULATION | Reviewed formulation lineage conflicts | No |
| ANCHOR_MISSING | Identity may match but required claim anchor is absent | No |
| UNSUPPORTED_SEMANTICS | Available evidence cannot prove governed subject/formulation lineage | No |
| TRANSIENT_FAILURE | Retryable transport condition | No |
| SOURCE_BLOCKED | Safety/publisher/content boundary failed | No |

Only QUALIFIED_EXACT can advance.

## 6. Qualification digest

Every result receives a SHA-256 qualification_digest over stable canonical JSON containing the historical locator/publisher/source kind, governed identity, candidate locator/publisher/source kind, discovery method, observed content digest/canonical/title, checks, disposition, and authority boundary.

A later relocation preflight must require the exact contract and digest. Changing the candidate or any qualification evidence therefore changes the digest.

## 7. Derma Factory canary

Historical source:

- Source: f5eb21f8-4829-4c9b-b927-ccdfb43cdd1b
- Product: Niacinamide 20% Serum
- Subject: 5a9ff33e-68c3-4ad7-ad60-7931c3478ca1
- Market: KR_US
- Formulation: pilot-freeze-3637fac10fd819b43eeb697447a4ef9b
- Reviewed official binding: fd3ddecc-c09a-4b12-bc96-6e6ef2b2e97c

Phase 8H-0 observed a redirect from the www.dermafactory.net product locator to the same path/query on dermafactory.net.

The live 8H-1 canary must independently fetch the candidate through official-source-fetch.mjs and prove:
- the exact product name,
- Korea/U.S. availability anchor,
- niacinamide / 20% claim anchors,
- reviewed exact Product/Subject/formulation lineage.

Expected disposition when all checks remain true: QUALIFIED_EXACT.

## 8. Beauty of Joseon redirect frontier

The four Phase 8H-0 Beauty of Joseon redirect observations land on the official site root.

Those direct redirect targets are intentionally expected to produce AMBIGUOUS_IDENTITY.

They cannot be promoted because:
- the site root is not product-specific,
- three rows concern Relief Sun : Rice + Probiotics,
- one row concerns Relief Sun Aqua-Fresh : Rice + B5,
- same official domain does not prove either exact Subject.

After the direct redirect canary, bounded official-domain rediscovery may propose product-specific candidates. Those candidates must pass this same engine. Search results may help seed candidate URLs but do not count as evidence.

## 9. Dr.G hold

The three Dr.G frontier rows remain TRANSIENT_FAILURE:http_429.

Phase 8H-1 must not infer relocation, terminal loss, or semantic change from those observations. They stay retry-only.

## 10. Production mutation policy

Phase 8H-1 performs no Production writes.

Forbidden:
- Product Fact mutation,
- Current pointer mutation,
- confirmation mutation,
- recommendation mutation,
- Evidence Source locator update,
- new Evidence adoption,
- source-binding retirement/replacement,
- revalidation transition creation.

The only durable outputs in this slice are repository contracts, deterministic fixtures, CI results, and read-only live qualification artifacts.

## 11. Exit criteria

Phase 8H-1 qualification engine is complete when:

1. all ten dispositions are deterministically covered,
2. classifier code contains no brand/Source-ID branching,
3. no database mutation path exists,
4. Derma Factory live canary produces a governed read-only result,
5. Beauty of Joseon homepage redirects cannot qualify,
6. exact-head and merged-main CI pass,
7. any later BOJ rediscovery candidate is forced through the same qualification contract.
