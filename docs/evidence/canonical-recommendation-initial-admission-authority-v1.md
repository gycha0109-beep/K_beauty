# V2.1-ADMISSION-G2 — Non-Legacy Initial Candidate Admission Policy Authority v1

## Terminal

`NON_LEGACY_INITIAL_CANDIDATE_ADMISSION_AUTHORITY_FROZEN`

Policy version:

`initial-admission-grant-policy-v1`

Authority owner:

`Canonical Recommendation Admission Governance`

This contract creates a new product-level governance authority named `INITIAL_ADMISSION_GRANT`. It does not reinterpret Product Fact adoption, PDA computability, CandidatePolicy `ALLOW`, normative policy `ALLOW`, or `READY_FOR_SEPARATE_POLICY_EVALUATION` as eligibility.

No Production Recommendation runtime gate is implemented by G2.

## Starting authority

- repository: `gycha0109-beep/K_beauty`
- G2 base main: `8d43a30497a310a1d5a64c5c593fc786e3281d12`
- Production at stage entry: same SHA, READY
- Product Fact Registry: `product-fact-registry-cross-category-v1`
- Registry checksum: `79d41ac13de8080df5199543e31ad7bbc1c1763836ef776313613b7547b79575`
- Subject identity serializer: `product-fact-subject-identity-v1`
- proposition serializer: `product-fact-proposition-pilot-v1`
- accepted PDA contract: `exfoliation-non-numeric-pda-contract-v1`
- accepted PDA mapper: `exfoliation-non-numeric-pda-offline-shadow-v1`
- accepted active identity mapping: `exfoliating-active-identity-set-v1`

The G2 policy is downstream of these authorities but does not modify them.

## Existing eligibility boundary

Before G2, existing Recommendation eligibility can be preserved or restricted by later policy layers, but no authority creates initial eligibility for a new non-legacy canonical product.

G2 freezes the missing relationship as a separate authority:

```text
non-legacy canonical product
→ resolved/current Product Fact Subject
→ authoritative required Current Product Facts
→ approved category-scoped PDA contract/mapper output
→ initial-admission-grant-policy-v1
→ INITIAL_ADMISSION_GRANT
```

Future runtime eligibility is intended to be:

```text
LEGACY_FROZEN_RECOMMENDATION_CORPUS_V1 member
OR
valid INITIAL_ADMISSION_GRANT
→ eligible to enter the existing Recommendation candidate evaluation pipeline
```

That runtime OR gate is explicitly out of scope for G2.

## Grant semantics

`INITIAL_ADMISSION_GRANT` means only:

> The canonical product has sufficient governed product-level identity, Product Fact Current, and category-scoped PDA interpretation authority to enter the existing Recommendation candidate evaluation pipeline.

It:

- creates initial candidate eligibility only;
- does not imply Recommendation rank;
- does not imply safety;
- does not imply efficacy;
- does not imply approval;
- does not imply suitability for every user;
- does not bypass CandidatePolicy;
- does not bypass later policy restriction;
- does not authorize ENFORCE;
- does not activate ENFORCE;
- does not modify scoring.

Therefore:

```text
INITIAL_ADMISSION_GRANT
!= SAFE
!= RECOMMENDED
!= APPROVED
!= HIGH_SCORE
!= CandidatePolicy ALLOW
!= normative policy ALLOW
!= ENFORCE AUTHORIZATION
```

## Category classification

| category | G2 classification | v1 disposition |
|---|---|---|
| `treatment` | `INITIAL_ADMISSION_SUPPORTED` | supported through frozen `exfoliation_load` non-numeric PDA authority |
| `toner_essence` | `INITIAL_ADMISSION_SUPPORTED` | supported through frozen `exfoliation_load` non-numeric PDA authority |
| `toner_pad` | `INITIAL_ADMISSION_SUPPORTED` | supported through frozen `exfoliation_load` non-numeric PDA authority |
| `cleanser` | `INITIAL_ADMISSION_AUTHORITY_INSUFFICIENT` | no G2 grant |
| `sunscreen` | `INITIAL_ADMISSION_AUTHORITY_INSUFFICIENT` | no G2 grant |
| `moisturizer_lotion_emulsion` | `INITIAL_ADMISSION_AUTHORITY_INSUFFICIENT` | no G2 grant |
| `moisturizer_balm` | `INITIAL_ADMISSION_AUTHORITY_INSUFFICIENT` | no G2 grant |
| `moisturizer_cream` | `INITIAL_ADMISSION_AUTHORITY_INSUFFICIENT` | no G2 grant |
| `moisturizer_gel` | `INITIAL_ADMISSION_AUTHORITY_INSUFFICIENT` | no G2 grant |
| any undeclared category | `INITIAL_ADMISSION_UNSUPPORTED` | no G2 grant |

G2 does not claim that unsupported/insufficient categories are scientifically invalid. It only states that v1 lacks the complete, explicitly frozen Product Fact/PDA lineage selected for initial admission.

## Required Product Fact matrix

| supported category | required Current Product Fact | authority requirement |
|---|---|---|
| `treatment` | `contains_active` | Current, `supported`, `product_specific_primary`, exact registry/proposition lineage |
| `toner_essence` | `contains_active` | Current, `supported`, `product_specific_primary`, exact registry/proposition lineage |
| `toner_pad` | `contains_active` | Current, `supported`, `product_specific_primary`, exact registry/proposition lineage |

The required Fact is an authority/input requirement, not a potency or efficacy threshold.

Context facts such as `active_concentration`, `recommended_use_frequency`, `product_format`, `wipe_off_use`, and `pad_surface_texture` remain governed PDA context. G2 does not create numeric thresholds or require them merely to inflate admission coverage.

`contains_active` rows in `evidence_conflict`, `evidence_insufficient`, `reviewed_not_established`, `not_reviewed`, or unknown state cannot satisfy the required Current Fact authority.

## Required PDA matrix

| supported category | required PDA | contract | mapper |
|---|---|---|---|
| `treatment` | `exfoliation_load` | `exfoliation-non-numeric-pda-contract-v1` | `exfoliation-non-numeric-pda-offline-shadow-v1` |
| `toner_essence` | `exfoliation_load` | same | same |
| `toner_pad` | `exfoliation_load` | same | same |

Accepted active identity mapping version:

`exfoliating-active-identity-set-v1`

The mapper remains non-numeric. G2 does not create strength, potency, efficacy, score, or rank semantics.

## Positive Product-level PDA state

A v1 supported product may satisfy the PDA portion of Grant only when:

- required `exfoliation_load` PDA is present;
- contract version exactly matches;
- mapper version exactly matches;
- active-identity mapping version exactly matches;
- PDA is current and not stale;
- `signal_status` is one of:
  - `GOVERNED_SIGNAL_ESTABLISHED`
  - `GOVERNED_SIGNAL_NOT_ESTABLISHED`
- coverage is one of:
  - `active_identity_only`
  - `active_identity_with_unscaled_context`
  - `no_relevant_fact`
- no disqualifying authority reason is present.

`GOVERNED_SIGNAL_NOT_ESTABLISHED` is accepted only when the required Product Fact itself is authoritative `supported` Current and the PDA lacks the disqualifying `REVIEWED_NOT_ESTABLISHED` state. This permits a fully governed supported non-axis identity to be described as having no v1-relevant exfoliating identity without turning absence into efficacy or safety meaning.

The following PDA authority reasons are fail-closed for Grant:

- `AUTHORITY_BELOW_PRODUCT_SPECIFIC_PRIMARY`
- `CATEGORY_UNKNOWN`
- `CONFLICTING_GOVERNED_FACT`
- `EVIDENCE_INSUFFICIENT`
- `IDENTITY_BLOCKED`
- `NOT_REVIEWED`
- `REVIEWED_NOT_ESTABLISHED`
- `SOURCE_BLOCKED_OR_MISSING_CURRENT`

Missing optional unscaled context does not create efficacy assumptions and is not by itself a Grant blocker when the frozen PDA still has authoritative product-level signal interpretation.

## Current and version lineage

A positive Grant requires all of the following simultaneously:

```text
canonical UUID product identity = resolved
product is not a frozen legacy member
category = G2 supported
Product Fact Subject = resolved + current
subject serializer = product-fact-subject-identity-v1
identity resolution version = explicitly accepted v1 lineage
registry = product-fact-registry-cross-category-v1
registry checksum = exact frozen checksum
required Current Fact = present + supported + product_specific_primary
proposition serializer = product-fact-proposition-pilot-v1
required Fact provenance IDs = present
PDA axis = exfoliation_load
PDA contract = exfoliation-non-numeric-pda-contract-v1
PDA mapper = exfoliation-non-numeric-pda-offline-shadow-v1
active identity mapping = exfoliating-active-identity-set-v1
PDA state = current, non-stale, accepted structural state
policy = initial-admission-grant-policy-v1
```

No upstream state alone creates Grant.

A successor registry, subject identity resolution version, proposition serializer, PDA contract, mapper, or identity mapping version requires explicit compatibility governance before it can satisfy v1.

## Fail-closed semantics

The policy returns `NO_GRANT` for at least:

- unresolved/non-canonical product identity;
- unresolved/non-current Product Fact Subject;
- missing required Current Fact;
- Fact conflict, insufficiency, reviewed-not-established, not-reviewed, or unknown authority;
- insufficient authority ceiling;
- stale Fact;
- registry/checksum mismatch;
- subject/proposition serializer mismatch;
- unsupported subject identity-resolution version;
- missing required PDA;
- unknown/blocked/unsupported PDA state;
- stale PDA;
- PDA contract/mapper/identity-mapping mismatch;
- insufficient/unsupported category;
- legacy/default semantic fields only;
- crawler marketing evidence only;
- popularity/ranking only;
- Product Fact adoption only;
- PDA computability only;
- CandidatePolicy `ALLOW` only;
- normative policy `ALLOW` only.

Missing authority is `NO_GRANT`. Missing is not false and is not converted into a scientific negative claim.

## Legacy corpus authority

G2 freezes the pre-existing Production corpus independently of the new Grant path.

Version:

`LEGACY_FROZEN_RECOMMENDATION_CORPUS_V1`

Canonical source at freeze:

`public.products.id`

Canonicalization:

- lowercase UUID text;
- bytewise/C lexical ascending;
- one UUID per line;
- UTF-8;
- final LF.

Count:

`164`

SHA-256:

`b6577d95353c4151152cf82e1705131516d5a2558cb68241a8f9fd48d9047a05`

Membership artifact:

`fixtures/recommendation-governance/legacy-frozen-recommendation-corpus-v1.txt`

The legacy corpus is immutable under G2. A new product cannot inherit legacy membership and cannot change the v1 corpus digest. Existing 164 members do not need a retroactive `INITIAL_ADMISSION_GRANT`.

## Deterministic validation

`verify-initial-admission-grant-policy-v1.mjs` validates F1-F20, including:

- exact 164 membership and independent Build A/B digest equality;
- legacy/non-legacy separation;
- fail-closed identity/PF/PDA/category/version behavior;
- Product Fact adoption, PDA computability, CandidatePolicy/normative ALLOW non-equivalence;
- positive executable Grant for all three v1 supported categories;
- stale authority rejection;
- score/rank/safety/approval/ENFORCE non-implication;
- immutable legacy corpus under new-product evaluation.

The dedicated CI additionally replays the upstream exfoliation PDA contract, the production-consumption contract, the canonical 164×12 Recommendation invariance verifier, and the Production build.

## Runtime and hosted boundary

G2 is additive governance-only work.

Explicit invariants:

- `PRODUCTION_RECOMMENDATION_ELIGIBILITY_GATE_IMPLEMENTED = NO`
- `PRODUCT_SOURCE_BEHAVIOR_CHANGED = NO`
- `NORMALIZE_PRODUCT_CHANGED = NO`
- `RECOMMENDATION_SCORER_CHANGED = NO`
- `RECOMMENDATION_RANKER_CHANGED = NO`
- `PRODUCT_FACT_WRITES = 0`
- `PDA_WRITES = 0`
- `HOSTED_SCHEMA_MUTATION = 0`
- `CANDIDATE_POLICY_CHANGED = NO`
- `CANDIDATE_POLICY_ENFORCE_AUTHORIZED = NO`
- `CANDIDATE_POLICY_ENFORCE_ACTIVE = NO`
- `CRAWLER_CANONICAL_ADOPTION = NO`
- `CRAWLER_RESUME = NO`

## Next-stage boundary

G2 success permits a separate **Production Recommendation Eligibility Gate Implementation** stage to implement:

```text
LEGACY_FROZEN_RECOMMENDATION_CORPUS_V1 member
OR
valid INITIAL_ADMISSION_GRANT
→ candidate admission
→ existing normalization/scoring/CandidatePolicy pipeline
```

That stage must preserve all 164 legacy behavior, exclude non-legacy products without valid Grant, admit a controlled non-legacy valid-Grant fixture through the new gate without changing score formulas, pass canonical 164×12 invariance, and verify Production deployment/readback before Crawler resume can be reconsidered.
