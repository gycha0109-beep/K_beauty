# CRAWLER-CANONICAL-ADOPTION-AUTHORITY-REMEDIATION v1

## Stage

`CRAWLER-CANONICAL-ADOPTION-AUTHORITY-REMEDIATION`

Primary purpose:

```text
crawler can discover/adopt product identity
but
crawler cannot manufacture Recommendation truth

normalized comparison key
!= authoritative canonical identity
```

## Starting authority

Frozen reassessment authority was merged by PR #292.

```text
Reassessment merge SHA = 9819a83cdb40c757dd7a68751d257ccc19b4292d
Original Recommendation eligibility gap = RESOLVED
Residual blocker = CRAWLER_REASSESSMENT_BLOCKED_BY_CANONICAL_WRITE_AUTHORITY_OVERREACH
Prior resume gate = R1 FAIL / R2 FAIL / R3-R10 PASS
```

G3, G3A, G2, PDA, CandidatePolicy, scoring/ranking and the frozen Legacy 164 corpus are not redesigned by this stage.

## Prestate

Hosted prestate:

```text
products             = 164
registry_versions     = 1
definition_snapshots  = 20
subjects              = 16
fact_instances        = 41
evidence_links        = 41
review_assignments    = 41
review_events         = 180
confirmations         = 41
current_facts         = 41
```

Frozen product UUID corpus:

```text
count = 164
SHA256 = b6577d95353c4151152cf82e1705131516d5a2558cb68241a8f9fd48d9047a05
```

Before remediation the six legacy Recommendation semantic columns were `NOT NULL` and the historical `promote_product_candidate` required and wrote values sourced from `promotion_payload.product`.

## Structural adoption contract

Contract:

`crawler-canonical-product-structural-adoption-v1`

Identity contract:

`crawler-identity-resolution-v1`

Structural canonical field allowlist:

```text
id
name
brand
category
product_form
normalized_name
normalized_brand
external_source
external_type
external_id
source_url
created_at
updated_at
```

Recommendation semantic denylist for crawler canonical adoption:

```text
skin_types
concerns
texture
finish
irritation_risk
sensitivity_safe
```

For a newly structurally adopted non-legacy product, an unestablished value for these legacy semantic columns is represented by SQL `NULL`. It is not converted to `[]`, `false`, `low`, `none`, or any other fabricated semantic value.

Existing Legacy 164 values are not rewritten.

## Identity resolution contract

Allowed states:

```text
unresolved
resolved
identity_ambiguous
variant_scope_conflict
formulation_scope_conflict
reformulation_candidate
```

Only:

```text
resolved
```

may proceed to canonical structural promotion.

All other states fail closed.

`reformulation_candidate` explicitly prevents a renewal/reformulation observation from silently overwriting the current canonical product. Resolution must occur through the review boundary before structural promotion.

Raw/source identity evidence is retained separately from normalized comparison keys. Volume, option/variant and renewal/reformulation markers can be removed from comparison text only while the original source identity and uncertainty signal remain auditable.

## Schema and RPC remediation

Hosted migration history:

```text
20260822130309_crawler_canonical_adoption_authority_remediation_v1
```

Repository migration:

`supabase/migrations/20260822130309_crawler_canonical_adoption_authority_remediation_v1.sql`

Changes:

1. The six legacy Recommendation semantic columns become nullable without defaults.
2. `product_candidates` gains:
   - `identity_resolution_state`
   - `identity_resolution_version`
   - `identity_resolution_evidence`
3. `promote_product_candidate_structural_v1` becomes the structural-only canonical writer.
4. Historical `promote_product_candidate` is retained only as a compatibility entry point delegating to the structural-only writer.
5. `admin_confirm_product_candidate_structural_adoption_v1` provides an explicit reviewed structural adoption boundary.
6. `admin_set_product_candidate_identity_resolution_v1` records reviewed identity state and evidence.
7. Exposed `admin_preflight_product_candidate_review` is narrowed to structural authority.
8. `crawler_canonical_adoption_requests` records idempotent explicit structural adoption requests.

The structural writer does not read or write any member of the six-field Recommendation semantic denylist.

The legacy reviewed-import format may continue to contain historical semantic observations for backward-compatible review artifacts. Those observations no longer become canonical Product Recommendation semantics because every active `promote_product_candidate` product-write path delegates to the structural-only writer and strips the legacy `promotion_payload.product` object when promotion succeeds.

## Privilege boundary

The following functions are `SECURITY DEFINER` with fixed `search_path = public, pg_temp`, have `anon=false`, `authenticated=false`, and `service_role=true` execute privilege:

```text
admin_set_product_candidate_identity_resolution_v1
promote_product_candidate_structural_v1
promote_product_candidate
admin_confirm_product_candidate_structural_adoption_v1
admin_preflight_product_candidate_review
```

Admin-owned identity/adoption functions also call the existing `admin_require_product_review_actor(..., 'admin.products.review')` capability boundary.

No crawler runtime path is granted Product Fact Current, PDA, G2 grant, Recommendation admission, CandidatePolicy or ENFORCE authority.

## Structural fixtures

```text
S1 resolved reviewed candidate -> structural adoption allowed, no semantic assertion
S2 crawler supplies skin_types -> semantic assertion rejected by contract
S3 crawler supplies irritation_risk -> semantic assertion rejected by contract
S4 no Recommendation semantics -> structural adoption valid
S5 semantic NULL/unestablished -> structural adoption valid; G3 remains governing boundary
S6 Legacy 164 -> no legacy row rewrite
```

## Identity fixtures

```text
I1 resolved identity -> promotion allowed
I2 identity_ambiguous -> blocked
I3 variant_scope_conflict -> blocked
I4 formulation_scope_conflict -> blocked
I5 reformulation_candidate -> blocked; no silent overwrite
I6 normalized collision -> blocked / uncertainty preserved
I7 same normalized brand/name with conflicting identity evidence -> blocked
I8 repeated identical observation -> deterministic result
```

Fixtures are deterministic repository fixtures. No fake Production product row is created.

## G3 integration

The Production Recommendation path remains:

```text
raw canonical product enumeration
-> exact Legacy membership check
-> for non-legacy: G3A authority reader
-> PDA
-> G2
-> INITIAL_ADMISSION_GRANT only
-> normalization
-> scoring
-> CandidatePolicy
-> Recommendation
```

Frozen G3 cases establish:

```text
new structural product + missing PF -> REJECTED
unsupported category -> REJECTED
evidence_insufficient -> REJECTED
evidence_conflict -> REJECTED
malformed authority -> fail closed
rejected non-legacy -> no normalization projector invocation
later valid governed PF/PDA/G2 INITIAL_ADMISSION_GRANT -> admission compatible
```

Catalog existence and Recommendation eligibility therefore remain distinct authorities.

## Legacy invariance

Required immutable corpus:

```text
Legacy count = 164
Legacy SHA256 = b6577d95353c4151152cf82e1705131516d5a2558cb68241a8f9fd48d9047a05
```

The focused CI replays the historical canonical 164 x 12 Recommendation matrix using the frozen Recommendation reference at:

`783afb91a964f5d762f46846f9ef854902b48e95`

Required deltas:

```text
score = 0
ranking = 0
Top1 = 0
Top3 = 0
eligibility = 0
CandidatePolicy = 0
```

## Crawler activation

This stage does not activate operational crawling.

```text
scheduled crawler = OFF
Vercel crawler cron = absent
auto-adoption = OFF
Production crawling performed = NO
bulk canonical promotion = NO
```

## Hosted poststate

After applying the schema/RPC migration, business data remained:

```text
products             = 164
registry_versions     = 1
definition_snapshots  = 20
subjects              = 16
fact_instances        = 41
evidence_links        = 41
review_assignments    = 41
review_events         = 180
confirmations         = 41
current_facts         = 41
structural_adoption_requests = 0
```

Product UUID SHA256 remains:

`b6577d95353c4151152cf82e1705131516d5a2558cb68241a8f9fd48d9047a05`

Task-induced Product/PF/review business-data delta = `0`.

## Resume gate

```text
R1 identity/variant/formulation/reformulation uncertainty explicit and fail-closed = PASS
R2 canonical promotion is structural-only and cannot assert crawler Recommendation semantics = PASS
R3 new product cannot inherit Legacy membership = PASS
R4 G3 governs every non-legacy Recommendation admission = PASS
R5 missing PF fails closed = PASS
R6 unsupported category fails closed = PASS
R7 crawler cannot mutate PF/PDA/G2 admission authority = PASS
R8 no Recommendation semantic/admission bypass = PASS
R9 explicit disable/manual review control remains = PASS
R10 catalog/admission G3 telemetry separation remains = PASS
```

## Frozen outcome candidate

Subject to exact-head CI, merge, merged-main verification and final Production/Hosted closeout:

```text
CRAWLER-CANONICAL-ADOPTION-AUTHORITY-REMEDIATION = STRICT SUCCESS / CLOSED
PRIMARY OUTCOME = CRAWLER_CANONICAL_ADOPTION_AUTHORITY_BOUNDARY_OPERATIONAL_AND_FROZEN
CRAWLER_CANONICAL_ADOPTION_BLOCKER = RESOLVED
CRAWLER_RESUME_GATE = SATISFIED
CRAWLER_RESUME = READY_FOR_CONTROLLED_ACTIVATION_STAGE
```

`READY_FOR_CONTROLLED_ACTIVATION_STAGE` does not mean the crawler is activated.
