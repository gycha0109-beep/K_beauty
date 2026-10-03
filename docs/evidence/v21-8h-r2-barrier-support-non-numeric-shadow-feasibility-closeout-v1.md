# V2.1-8H-R2 — Barrier Support Non-Numeric PDA Shadow Feasibility

## Decision

`BARRIER_SUPPORT_NON_NUMERIC_SHADOW_FEASIBLE_CONTRACT_REQUIRED`

R2 establishes that governed `barrier_support_claim` can add useful **non-numeric, non-additive shadow information**, but cannot authorize barrier-effect magnitude, stronger/weaker ordering, numeric Recommendation bonus, candidate eligibility change, or Production Recommendation consumption.

## Authority

- execution main: `7fe4c2c229208202947e63c2c6695722712c58c4`
- Hosted project: `bygrczggxfuisupcevaz`
- Registry: `product-fact-registry-cross-category-v1`
- Registry checksum: `79d41ac13de8080df5199543e31ad7bbc1c1763836ef776313613b7547b79575`
- R1 readiness: `barrier_support = STRUCTURALLY_READY_FOR_BOUNDED_OFFLINE_CALIBRATION`
- mapper coverage: `claim_only`
- mapper numeric estimate: `null`

The Registry definition is authoritative: `barrier_support_claim` is an official barrier-support claim and is distinct from measured barrier improvement. `primary_use_role` remains usage context and is not recommendation policy or efficacy magnitude.

## Live governed barrier corpus

```text
resolved moisturizer Product Fact Subjects = 10
governed barrier_support_claim=true        = 6
no Current barrier_support_claim           = 4
primary authority among true claims        = 6/6 product_specific_primary
confidence among true claims               = 6/6 high
```

Missing Current is **unknown, not false**. Supported false, if encountered later, is admissible only through the Registry explicit-negative contract.

## Candidate availability

All 10 resolved moisturizer products are already members of the frozen Legacy 164 candidate corpus.

```text
candidate admission extension required = NO
G2/G3 admission policy change          = NO
```

Thus feasibility can be tested as a shadow overlay without changing Recommendation eligibility.

## Frozen scenario coverage

The existing PDA shadow maps both `barrier` and `dehydration` user concerns to `barrier_support`.

```text
relevant scenarios                    = U2 U3 U4 U5 U6 U7 U9 U10 U11
relevant scenario count               = 9
adopted moisturizer products          = 10
bounded scenario × product pairs      = 90
established-claim pairs               = 54
no-current-claim pairs                = 36
```

The 36 no-current pairs remain unknown rather than negative.

## Duplication audit

| Legacy pathway | overlap among 6 claim products |
| --- | ---: |
| product `concerns` contains `barrier` | 5/6 |
| ingredient functional barrier signal | 6/6 |
| review signal mapped to `barrier` | 4/6 |

The production engine already adds a tiered numeric `functional-barrier` ingredient bonus for barrier-focused users and separately applies moisturizer slot/hero logic. A new numeric Product Fact barrier bonus would therefore create a high double-count risk and exceed Product Fact authority.

Evidence identity equivalence is **not** claimed. Legacy metadata/review/ingredient pathways and governed Product Fact evidence remain separate provenance; they simply must not become additive numeric units without a separately authorized policy.

## Downstream requirement result

```text
audited requirements                               = 12
non-numeric/context requirements                   = 9
numeric/ordinal requirements lacking authority     = 3
direct Product Fact score requirement authorized   = NO
non-numeric shadow need established                = YES
```

Not authorized from current Facts: numeric barrier effect score, stronger/weaker ordering, or Product Fact binary claim → numeric Recommendation boost.

Feasible without magnitude: governed claim truth-state representation, usage-role context, user concern relevance annotation, provenance-grounded explanation, explicit unknown/blocked handling, and non-additive comparison with existing Legacy pathways.

## Representation option decision

| option | disposition |
| --- | --- |
| numeric effect score | **REJECTED** |
| ordinal stronger/weaker | **REJECTED** |
| direct binary Recommendation boost | **REJECTED** |
| structured categorical claim state | **RECOMMENDED PRIMARY** |

R3 may formalize categorical states equivalent to:

```text
GOVERNED_BARRIER_CLAIM_ESTABLISHED_TRUE
GOVERNED_BARRIER_CLAIM_ESTABLISHED_FALSE
GOVERNED_BARRIER_CLAIM_UNKNOWN
GOVERNED_BARRIER_CLAIM_BLOCKED
NOT_APPLICABLE
```

These names are R2 feasibility output, not Production runtime authority.

## Required guardrails for R3

```text
NO_EFFECT_MAGNITUDE
NO_STRENGTH_ORDERING
NO_DIRECT_FACT_TO_SCORE
PRIMARY_USE_ROLE_CONTEXT_ONLY
MISSING_NOT_FALSE
EXPLICIT_NEGATIVE_ONLY_FOR_FALSE
LEGACY_PATHWAYS_NON_ADDITIVE
PRODUCTION_CONSUMPTION_DISABLED
```

Key separations: official barrier claim != measured barrier improvement; claim presence != score; claim presence != stronger product; usage role != efficacy; missing claim != false; Fact adoption != Recommendation activation.

## Production invariance

```text
Hosted Product Fact writes     = 0
PDA writes                     = 0
Registry delta                 = 0
migration delta                = 0
numeric fitting                = 0
scorer changed                 = false
ranker changed                 = false
CandidatePolicy changed        = false
candidate admission changed    = false
Recommendation behavior delta  = 0
Production PDA consumption     = 0
Recommendation activated       = false
public activation              = false
```

## Artifacts

- `evidence/product-decision-axis-feasibility-v2/barrier-support-shadow-feasibility-corpus-v1.json`
- `evidence/product-decision-axis-feasibility-v2/barrier-support-downstream-requirement-ledger-v1.json`
- `evidence/product-decision-axis-feasibility-v2/barrier-support-representation-option-matrix-v1.json`
- `evidence/product-decision-axis-feasibility-v2/barrier-support-non-numeric-shadow-feasibility-v1.json`
- `scripts/verify-v21-8h-r2-barrier-support-non-numeric-shadow-feasibility.mjs`

## Next gate

Exactly one next gate is authorized for design/implementation work, but not executed by R2:

`V2.1-8H-R3 — Barrier Support Non-Numeric PDA Contract`

R3 may formalize the structured categorical representation and deterministic missing/conflict/provenance semantics. It must not wire the contract into Production scoring, ranking, candidate eligibility, public response, or final Recommendation behavior.
