# V2.1-ADMISSION-G4-A — Subject Registration Registry-Pinned Reprocess Contract

## Decision

`V21_ADMISSION_G4_A_REPOSITORY_CONTRACT_READY`

G4-A changes the existing Subject registration orchestration only.

It does **not** register the FATION Subject and performs **zero Production data writes**.

## Problem

The existing controlled Subject registration flow registers a reviewed Product Fact Subject and then refreshes TRUST through:

`process_catalog_trust_product_v1(uuid)`

That historical processor dynamically selects the latest effective Product Fact Registry.

The V2.1 lineage is explicitly pinned to:

`product-fact-registry-cross-category-v1`

and already has a deployed explicit-registry processor plus identity-preserving wrapper.

## Contract

The post-registration refresh now routes through:

`process_catalog_trust_product_v3(uuid,text)`

with:

`p_registry_version = product-fact-registry-cross-category-v1`

The app layer also fails closed unless the result proves all of:

```text
status               = processed
product_id           = requested Product
registry_version     = product-fact-registry-cross-category-v1
registry_selection   = explicit
orchestrator_version = v21-8g1-identity-authority-preserving-v1
```

The historical `process_catalog_trust_product_v1` remains in the database for compatibility but is forbidden from the Subject registration path.

## Reused deployed authority

No new database writer is introduced.

G4-A reuses:

- `process_catalog_trust_product_v2(uuid,text)` from V2.1-8G0
- `process_catalog_trust_product_v3(uuid,text)` from V2.1-8G1

Existing checked-in Production readback already proves:

- explicit Registry-v1 processing is executable;
- the probe rolled back without residue;
- Subject-bound reconciliation can move reviewed identity tasks into `RESEARCH_PENDING`;
- Evidence / Fact Current / Recommendation authority is not crossed by that processor.

## FATION boundary

Current FATION state remains unchanged in G4-A:

```text
Subject = 0
intake identity = SUBJECT_CREATION_REQUIRED
intake trust = REVIEW_REQUIRED
tasks = 3 x REVIEW_REQUIRED
```

The expected future G4-B transition is:

```text
reviewed Subject registration
→ EXACT_SUBJECT_FOUND
→ Registry-v1-pinned v3 reprocess
→ same 3 tasks bound to Subject
→ 3 x RESEARCH_PENDING
```

Expected automatic writes from reprocess:

```text
Evidence = 0
Product Fact Current = 0
Recommendation = 0
```

G4-A does not execute that transition.

## Authority closure

```text
Production business-data write = 0
Subject registration            = NOT AUTHORIZED
task claim                      = NOT AUTHORIZED
Evidence ingest                 = NOT AUTHORIZED
Product Fact confirmation       = NOT AUTHORIZED
Recommendation admission       = NOT AUTHORIZED
```

Next gate after merge:

`V2.1-ADMISSION-G4-B_FATION_SUBJECT_REGISTRATION`
