# TRUST P3 — read-only deterministic official product claim candidates

## Scope
P3 foundation consumes bytes from a **robots-authorized, same-origin official-product fetch** and outputs unconfirmed candidate diagnostics. This is not a production Fact creation API. All outputs set \`factConfirmationAuthorized=false\`, \`subjectCreationAuthorized=false\`, and \`dbWrites=0\`.

## Acceptance gates
1. Primary product identity must be anchored by a structured Product/title/heading candidate.
2. Catalog \`size_ml\` must explicitly equal the official page title size. Wrong sizes, packs, absence of size, ambiguous identities, inaccessible sources remain HOLD.
3. Only opt-in official product specification roots (\`data-product-specs\` / \`product-specifications\` / \`product-claims\`) are read. Page-wide text, scripts, related products and third-party statements never give positive claim authority.
4. Explicit SPF, PA and UV-filter descriptions become **direct-claim candidates**, not materialized Facts. Negations and contradictions remain withheld.
5. Ingredient list is extracted as a labeled list candidate; INCI cannot infer or confirm UV-filter type.
6. This track does **not** introduce machine actor, administrative impersonation, automatic Subject, Fact Current, ranking or recommendation mutation, or paid AI API.

## Verification
\`node scripts/verify-trust-p3-official-extraction-v1.mjs\` is executed by the existing canonical TRUST static workflow. Tests include SPF50+, PA++++, direct organic claim, INCI, wrong size, robots hold, third party hold, unrelated body-only mention, negated wording, conflicting filter descriptions and missing scoping.

## Known limitations and next stage
This conservative parser does not yet support every brand's official markup. Unsupported templates produce UNKNOWN/REVIEW, never synthetic knowledge. Real official SPF/PA cohort coverage requires policy-allowed sunscreen pages and independent evaluation before preflight. The security advisory exception expiry in Supply Chain CI remains owned by the security track, and must not be waived to pass P3.

Watchtower-Track: pipeline-reliability
