# V2.1-8H-R3 — Barrier Support Non-Numeric PDA Contract

## Decision

`NON_NUMERIC_BARRIER_SUPPORT_PDA_CONTRACT_FROZEN`

R3 freezes a deterministic, truth-aware, non-numeric Product Decision Axis contract for `barrier_support`. It does not activate Recommendation consumption.

## Authority

- execution main: `f822511c5e1c8efc1cef520cc7674bfc72a27ada`
- R2 merged main: `087328f3e47c7c397b1525fa06534686c8fc6e10`
- Hosted project: `bygrczggxfuisupcevaz`
- Registry: `product-fact-registry-cross-category-v1`
- Registry checksum: `79d41ac13de8080df5199543e31ad7bbc1c1763836ef776313613b7547b79575`
- contract mode: `STRUCTURED_CATEGORICAL`

R2 remains authoritative for feasibility: numeric effect, ordinal strength, and direct binary Recommendation boost are rejected. Structured categorical shadow representation is the permitted path.

## Contract state machine

Canonical states:

```text
GOVERNED_BARRIER_CLAIM_ESTABLISHED_TRUE
GOVERNED_BARRIER_CLAIM_ESTABLISHED_FALSE
GOVERNED_BARRIER_CLAIM_UNKNOWN
GOVERNED_BARRIER_CLAIM_BLOCKED
NOT_APPLICABLE
```

| governed Product Fact state | R3 barrier PDA |
| --- | --- |
| `supported(true)` + required authority | `ESTABLISHED_TRUE` |
| `supported(false)` + required authority | `ESTABLISHED_FALSE` |
| missing Current | `UNKNOWN` |
| `reviewed_not_established` | `UNKNOWN` |
| `not_reviewed` | `UNKNOWN` |
| `evidence_insufficient` | `UNKNOWN` |
| authority below `product_specific_primary` | `UNKNOWN` |
| `evidence_conflict` | `BLOCKED` |
| unresolved/non-current Subject | `BLOCKED` |
| known non-moisturizer category | `NOT_APPLICABLE` |

Hard negative rule:

```text
missing != false
reviewed_not_established != false
not_reviewed != false
evidence_insufficient != false
evidence_conflict != false
```

Only canonical `supported(false)` can produce `ESTABLISHED_FALSE`. Upstream Registry/confirmation authority remains responsible for explicit-negative admission.

## Historical mapper compatibility gap

The historical `product-decision-axis-cross-category-v1` barrier mapper filters `semantic_status === supported` but does not inspect boolean `typed_value` when deciding whether a barrier claim exists.

A future governed `supported(false)` could therefore be treated as generic `claim_only` if that historical mapper were reused directly.

R3 does **not** rewrite the historical authority. It freezes a new truth-aware contract with the regression guard:

```text
supported(false) MUST NOT map to claim-positive state
```

## Context separation

`primary_use_role` is preserved as context only.

Allowed Registry values:

```text
full_face
local_area
spot_use
multi_area
body_possible
```

It cannot change claim truth, effect magnitude, ranking, scoring, or candidate eligibility. Missing role may change coverage from `claim_with_usage_role_context` to `claim_only`, but cannot change TRUE/FALSE signal truth.

## Scope contract and resolver gap

Hosted Product Fact authority stores fact scope:

```text
market
region
locale
valid_from
valid_to
```

and Subject scope:

```text
variant_key
formulation_revision_key
market_applicability
region_applicability
```

Live established barrier claims currently include KR-, ZA-, and locale-scoped propositions.

However `product-fact-current-resolver-v1` does not transport these scope fields. R3 freezes this as `SCOPE_TRANSPORT_GAP` and does not mutate the historical resolver.

R4 must use either a scope-complete read-only snapshot or a separately versioned scope-complete resolver. It must not silently use the current resolver and pretend scope authority is preserved.

Cross-scope truth:

```text
same boolean across scopes
→ keep one truth value and preserve every scope

opposite boolean across provably disjoint scope
→ UNKNOWN + SCOPE_CONTEXT_REQUIRED

opposite boolean across potentially overlapping scope
→ BLOCKED + CONFLICTING_GOVERNED_FACT
```

The consumer is not allowed to select market/locale implicitly.

## Coverage vocabulary

```text
claim_only
claim_with_usage_role_context
explicit_negative_claim_only
explicit_negative_with_usage_role_context
missing_fact
insufficient_fact
scope_context_required
conflict_blocked
identity_blocked
category_unknown
not_applicable
```

Coverage is structural information, not a numeric confidence score.

## Magnitude boundary

Every R3 object freezes:

```text
numeric_estimate   = null
ordinal_magnitude  = null
effect_strength    = null
```

Therefore official barrier claim != measured barrier improvement; claim=true != stronger product; claim=false != harmful product; primary_use_role != efficacy.

## Legacy non-additive boundary

R2 observed overlap among six established claim products:

```text
legacy concern barrier    5/6
legacy ingredient barrier 6/6
legacy review barrier     4/6
```

R3 freezes:

```text
legacy_numeric_contribution = PROHIBITED
direct_fact_to_score        = PROHIBITED
direct_fact_to_rank         = PROHIBITED
```

The intrinsic PDA excludes legacy concern score, ingredient bonus, review score, user barrier/dehydration score, final Recommendation decision, and candidate eligibility.

## Provenance

Each consumed Current Fact preserves at least:

```text
subject_id
fact_instance_id
confirmation_id
proposition_key
fact_key
semantic_status
typed_value
authority_ceiling
fused_confidence
fusion_input_digest
scope
mapper_input_role
```

`barrier_support_claim` uses `SIGNAL`; `primary_use_role` uses `CONTEXT`. Raw Evidence bodies are not embedded.

## Deterministic contract examples

R3 freezes 11 synthetic boundary fixtures covering true, explicit false, missing, insufficient, conflict, identity block, not-applicable, disjoint-scope disagreement, overlapping-scope conflict, low authority, and unknown category.

Synthetic fixtures are contract tests only and never claim to be Production facts.

Expected state totals:

```text
TRUE            1
FALSE           1
UNKNOWN         5
BLOCKED         3
NOT_APPLICABLE  1
```

## Live corpus remains unchanged

R2 frozen live authority remains:

```text
catalog                         176
Product Fact Current            101
resolved moisturizer Subjects    10
barrier claim true products       6
no-current claim products         4
supported false products          0
```

R3 does not create false examples in Production. False exists only as a synthetic contract boundary until governed explicit-negative Current data exists.

## Production invariance

```text
Hosted Product Fact writes       = 0
Registry delta                   = 0
migration delta                  = 0
historical mapper mutation       = 0
historical resolver mutation     = 0
numeric fitting                  = 0
score delta                      = 0
rank delta                       = 0
eligibility delta                = 0
CandidatePolicy delta            = 0
candidate admission delta        = 0
Recommendation behavior delta    = 0
public response delta            = 0
PDA Production consumption       = NO
Recommendation activation        = NO
public activation                = NO
production cutover               = NO
```

## Artifacts

- `evidence/product-decision-axis-non-numeric-contract-v2/barrier-support-non-numeric-pda-contract-v1.json`
- `evidence/product-decision-axis-non-numeric-contract-v2/barrier-support-non-numeric-pda-examples-v1.json`
- `evidence/product-decision-axis-non-numeric-contract-v2/barrier-support-non-numeric-pda-replay-v1.json`
- `scripts/product-evidence/barrier-support-non-numeric-pda-contract-v1.mjs`
- `scripts/product-evidence/verify-barrier-support-non-numeric-pda-contract-v1.mjs`

## Next gate

`V2.1-8H-R4 — Barrier Support Non-Numeric PDA Offline Shadow Replay`

R4 may implement the frozen R3 contract over a **scope-complete, read-only 176-product snapshot** and prove deterministic full-catalog replay.

R4 remains prohibited from changing Production scoring, ranking, eligibility, CandidatePolicy, candidate admission, public response, or Recommendation activation.
