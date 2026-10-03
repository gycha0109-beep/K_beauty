# V2.1-ADMISSION-G4-0 — Non-Legacy Initial Admission Frontier Design

## Decision

`V21_ADMISSION_G4_0_NONLEGACY_FRONTIER_DESIGN_FROZEN`

This stage is **design-only / zero-write**.

The next Recommendation expansion target is **not** one of the six Product Facts confirmed in 8H. All four 8H Products are already members of the frozen Legacy 164 corpus and enter G3 through `LEGACY_COMPATIBILITY_ADMISSION`.

The first real non-legacy frontier is:

`파티온 / 노스카나인 트러블 세럼`

Product:

`da5df70c-8cdd-4eb2-93b6-ede46c2f171d`

Candidate:

`6a9627b6-a5da-458f-84f7-3a40f91453be`

TRUST intake:

`15566618-d039-44c5-ad45-6413ee399db3`

## Why FATION is the only current frontier

Production has twelve Products outside the frozen Legacy 164 set.

Candidate taxonomy classification:

```text
sunscreen = 11
treatment = 1
```

G2 initial admission currently supports only:

- treatment
- toner_essence
- toner_pad

Therefore FATION is the only current non-legacy Product whose governed candidate classification can eventually enter the existing G2 policy.

The other eleven are excluded from this wave. Their names must not be used to infer a different category.

## FATION authority prestate

Catalog identity is already resolved from convergent Hwahae + FATION official identity evidence.

The exact 30 ml presentation matches across both providers.

That catalog identity is **not Product Fact authority**.

Canonical taxonomy already exists:

```text
taxonomy_version       = catalog-taxonomy-v1
assignment_state       = shadow
assignment_method      = source_classification
canonical_category     = treatment
recommendation_family  = treatment
legacy_projection_key  = null
taxonomy lifecycle     = shadow
taxonomy authority     = shadow_only
```

Legacy Recommendation projection remains:

```text
products.category = NULL
```

This NULL must **not** be backfilled to `treatment`. `products.category` is the legacy Recommendation compatibility projection; canonical classification lives in `product_catalog_taxonomy_assignments`.

Product Fact prestate:

```text
Subject count     = 0
Current Fact      = 0
intake identity   = SUBJECT_CREATION_REQUIRED
intake trust      = REVIEW_REQUIRED
```

Existing tasks:

| Fact | Task | State |
| --- | --- | --- |
| contains_active | `e4677942-4132-43b9-ac13-1ddf3d8167d1` | REVIEW_REQUIRED |
| active_concentration | `3ef281e7-a246-4e90-a53f-9ea1deb6164a` | REVIEW_REQUIRED |
| recommended_use_frequency | `d2eb907c-7185-4e61-bdd2-0259f06babb4` | REVIEW_REQUIRED |

All three have:

```text
subject_id = NULL
blocker_code = SUBJECT_CREATION_REQUIRED
attempt_count = 0
Evidence = NULL
```

## Existing contracts to reuse

The Admin Subject registration path already provides the correct semantic boundary:

- reviewed variant/formulation identity
- deterministic `product-fact-subject-identity-v1` semantic key
- explicit preflight hash
- explicit confirmation
- catalog identity explicitly treated as non-Product-Fact authority
- no automatic Evidence adoption
- no automatic Fact confirmation
- no Recommendation mutation

However, its current post-registration reprocess calls:

`process_catalog_trust_product_v1(uuid)`

Current Production SHA:

`700a6d2c1186400b28f61c334498052520a5b23eb39db97bc314945d8bc9f9d2`

That function dynamically selects the latest effective Registry.

For this V2.1 lineage the reprocess must be pinned to:

`product-fact-registry-cross-category-v1`

through:

`process_catalog_trust_product_v3(uuid,text)`

Current Production SHA:

`bfbeee3b896034129fb4c76ff10dab91df7d2c89ac954cdf75d2454da2e8b704`

Therefore **Subject registration must not execute before G4-A hardens this path**.

## Two independent authority lanes

FATION admission requires two independent lanes to converge.

### Product Fact lane

```text
reviewed Subject identity
→ Subject registration
→ Registry-v1-pinned TRUST reprocess
→ contains_active research
→ Evidence
→ review
→ confirmation preflight
→ explicit Product Fact confirmation
```

G2 requires `contains_active`.

`active_concentration` and `recommended_use_frequency` are useful PDA context but are not allowed to become synthetic admission blockers.

Missing optional context remains uncertainty.

### Recommendation category-authority lane

The existing taxonomy assignment is valid canonical classification lineage, but it is deliberately `shadow` under a globally `shadow_only` taxonomy version.

DATA-TAXONOMY15 explicitly preserves:

`catalog-only Recommendation leak = 0`

Therefore neither of these are allowed:

```text
shadow taxonomy => automatic Recommendation category authority
products.category NULL => backfill treatment
```

G4 will introduce a **Recommendation-specific, product-scoped category-authority grant/read contract** over the exact existing FATION taxonomy assignment.

It must freeze at minimum:

- product ID
- taxonomy version
- category term
- assignment state/method snapshot
- source rule
- candidate ID
- assignment/source snapshot digest
- review policy version
- reviewer/time
- active/revoked status

This grant does **not** globally promote `catalog-taxonomy-v1`.

## Staged execution

### G4-A — Subject registration reprocess contract

Repository/runtime hardening only.

Replace the dynamic Registry reprocess after Subject registration with an exact Registry-v1-pinned path, using `process_catalog_trust_product_v3` or an exactly equivalent verified contract.

Required isolated proof:

```text
SUBJECT_CREATION_REQUIRED
→ exact Subject
→ 3 x RESEARCH_PENDING

Evidence writes = 0
Current Fact writes = 0
Recommendation writes = 0
```

### G4-B — FATION Subject registration

Run existing reviewed Subject identity preflight.

The reviewer must explicitly resolve:

- variant key or reviewed NULL
- formulation revision key
- formulation label when authoritative
- market = KR
- region / validity only when evidenced

Do not invent a formulation identity from product name or 30 ml size.

After explicit confirmation:

```text
Subject +1
intake = EXACT_SUBJECT_FOUND / RESEARCH_PENDING
same 3 tasks bound to Subject
same 3 tasks = RESEARCH_PENDING
SUBJECT_CREATION_REQUIRED blocker = 0
Evidence = 0
Current = unchanged
Recommendation = unchanged
```

### G4-C — Required Fact research

Research `contains_active` first.

Registry semantics require a product-specific active/functional ingredient identity supported by `composition_identity` or `product_claim`.

No inference from the word “trouble serum”, ingredient marketing themes, reviews, or missing official text.

The two context tasks may be researched opportunistically:

- active_concentration
- recommended_use_frequency

Their absence remains uncertainty.

### G4-D — Evidence / review / confirmation preflight

Materialize only admissible Evidence, prepare governed review, and run controlled confirmation preflight.

**STOP before Product Fact confirmation.**

### G4-E — Product Fact confirmation

Separate explicit authority gate.

Only evidence-supported propositions may become Current.

The Recommendation category-authority bridge must still be inactive here, so Product Fact confirmation alone cannot cut FATION into G3.

### G4-F — Category authority shadow

Build a Recommendation-specific category-authority ledger/read contract on top of the exact FATION shadow taxonomy assignment.

Run it in shadow-only dual-read mode.

Required invariants:

```text
products.category remains NULL
catalog-taxonomy-v1 remains shadow/shadow_only
existing assignment remains governed
G3 production decision remains unchanged
catalog-only Recommendation leak remains 0
shadow category result for FATION = treatment
```

### G4-G — Initial admission cutover

Final explicit activation gate.

Preconditions:

- FATION Product Fact authority resolved
- product-scoped Recommendation category authority resolved
- G2 shadow evaluation = `INITIAL_ADMISSION_GRANT`
- Legacy corpus remains exactly 164
- no other non-legacy Product becomes grantable

Expected cutover:

```text
new non-legacy admission = exactly 1
target = FATION NOSCA9 Trouble Serum
```

This gate may change candidate eligibility only. It must not alter:

- score formula
- ranking formula
- CandidatePolicy
- safety/efficacy interpretation
- sunscreen policy
- global taxonomy authority
- Legacy 164 admission semantics

## STOP conditions

Stop immediately if any of the following changes:

- FATION identity/presentation evidence no longer converges
- reviewed formulation identity is ambiguous
- Registry v1 write admissibility fails
- taxonomy assignment or source rule drifts
- taxonomy lifecycle/authority changes unexpectedly
- any Legacy 164 Product changes admission mode
- any non-target non-legacy Product becomes newly admitted
- `contains_active` evidence remains insufficient or below `product_specific_primary`
- G2/G3 behavior changes outside the bounded FATION addition

## Current authority closure

G4-0 authorizes **no Production mutation**.

```text
Subject registration          = NOT AUTHORIZED
task claim                    = NOT AUTHORIZED
Evidence ingest               = NOT AUTHORIZED
Product Fact confirmation     = NOT AUTHORIZED
category authority grant      = NOT AUTHORIZED
Recommendation cutover        = NOT AUTHORIZED
ranking/scoring change        = NOT AUTHORIZED
```

Next gate:

`V2.1-ADMISSION-G4-A_SUBJECT_REGISTRATION_REPROCESS_CONTRACT`
