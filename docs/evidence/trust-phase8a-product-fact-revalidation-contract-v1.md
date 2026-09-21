# TRUST Phase 8A — Product Fact Revalidation Contract v1

Status: **contract + read-only Production lifecycle audit; no Product Fact mutation, no Recommendation activation**

Authority baseline:

```text
repository: gycha0109-beep/K_beauty
base main: 0c405fe99a6732e938912a3492a8b1776aa59ba5
contract: trust-phase8a-product-fact-revalidation-contract-v1
```

## 1. Purpose

TRUST Phase 8A freezes the lifecycle boundary after a Product Fact has already been explicitly confirmed.

The current controlled path can research, ingest Evidence, prepare review, preflight and explicitly confirm a Product Fact. Phase 8A defines what must happen later when a source changes, disappears, a new Evidence record appears, a Subject/formulation changes, or Registry authority changes.

This phase does not add a revalidation table or RPC and does not mutate Production state.

## 2. Frozen semantic boundaries

```text
source_changed != fact_changed
source_unavailable != fact_false
new_evidence != automatic_fact_replacement
stale != semantic_status
re_review_required != evidence_conflict
```

Historical EvidenceRecords and Fact instances remain immutable. Revalidation is operational lifecycle state until a new governed Evidence/Fusion/Review/Confirmation path proves a semantic change.

## 3. Revalidation triggers

A future controlled revalidation path may be entered only from a bounded trigger:

1. `source_content_changed` — a later observation has a different content digest.
2. `source_unavailable` — the source cannot currently be verified.
3. `new_evidence` — new governed Evidence targets the same proposition or its lineage.
4. `subject_or_formulation_changed` — product identity/formulation lineage may have changed.
5. `registry_changed` — the governing Fact definition/serializer/effective authority changed.

A trigger is evidence for re-review, not authority to rewrite semantic truth.

## 4. Operational state contract

The existing assignment vocabulary already permits:

```text
confirmed
→ stale
→ re_review_required
→ under_review
→ ready_for_confirm
→ confirmed
```

A later implementation must reject invalid transitions and stale pre-state.

When a trigger occurs:

- the current Fact instance is not edited;
- `product_fact_current` is not moved automatically;
- no semantic status is fabricated;
- no negative Fact is inferred from missing/unavailable evidence;
- the trigger is recorded with source/current/pre-state lineage.

## 5. Outcome contract

### Unchanged source / unchanged semantic value

```text
verification = unchanged
current pointer delta = 0
Fact instance delta = 0
confirmation delta = 0
```

A re-review may return the assignment to `confirmed` without manufacturing a new Fact version.

### Changed source, semantic result not yet established

```text
confirmed → stale → re_review_required
current Fact remains readable
automatic semantic mutation = 0
automatic confirmation = 0
```

### Changed semantic value

A new immutable Fact instance may be proposed only through the existing governed Evidence → fusion → review → preflight path.

Before explicit Admin confirmation:

```text
old current pointer remains
new current pointer = forbidden
automatic confirmation = false
```

After explicit confirmation only:

```text
new_fact.supersedes_fact_instance_id = old_fact.fact_instance_id
product_fact_current → new_fact
old_fact remains historical
```

### Source unavailable

Source unavailability must not become a negative Product Fact. The existing current Fact may remain current while operational state records re-review/source blockage according to later policy.

## 6. Subject / formulation boundary

A changed claim must first determine whether it belongs to the same semantic Subject.

```text
same Subject/formulation
→ same proposition lifecycle may supersede old Fact

different formulation/market/variant Subject
→ new Subject/proposition lineage
→ do not overwrite the old Subject's Fact
```

The revalidation layer must preserve `valid_from`, `valid_to`, formulation lineage and parent proposition constraints.

## 7. Source verification ledger requirements for Phase 8B

The next implementation phase may introduce an append-only source verification ledger. Minimum required identity:

```text
verification_id
source_id
previous_content_digest
observed_content_digest
verification_result = unchanged | changed | unavailable | ambiguous
trigger_kind
checked_at
request_id
created_at
```

Requirements:

- append-only verification history;
- no mutation of historical `product_evidence_sources` or `product_evidence_records`;
- exact retry idempotency;
- source verification cannot call final Product Fact confirmation;
- browser roles receive no direct write authority;
- changed/unavailable outcomes only create bounded revalidation work.

The Production audit shows `observed_at` is absent on part of the current source corpus. Phase 8B therefore must not require historical `observed_at` as a prerequisite for the first revalidation. Existing `content_digest` plus source identity and the later verification observation form the initial comparison boundary.

## 8. Phase 8C controlled transition requirements

A later Admin/service-role transition must bind at minimum:

```text
source_id
verification_id
proposition_key
current fact_instance_id
current confirmation_id
assignment_id
prestate_digest
reason_code
```

The transition must fail closed if the current pointer, Subject, Registry, Evidence lineage, assignment or verification pre-state no longer matches.

## 9. Production lifecycle audit snapshot

The machine-readable snapshot is:

```text
evidence/product-fact-revalidation-v1/trust-phase8a-lifecycle-audit-v1.json
```

Observed read-only Production state at Phase 8A start:

- 71 current Product Facts;
- 71 Fact instances;
- 71 confirmations;
- 71 Evidence records;
- 38 Evidence sources;
- 71 assignments, all `confirmed`;
- 309 Product Fact review events;
- 0 current Facts without Evidence links;
- 0 current Facts without an assignment;
- 0 current Facts without a confirmed assignment;
- 0 Evidence records without Source;
- 0 Evidence records without Subject binding;
- 0 current superseding Fact instances;
- 26/38 linked sources have no historical `observed_at`;
- 59/71 current Facts are linked to at least one source with no historical `observed_at`.

The absence of superseding current Facts is the concrete lifecycle gap Phase 8 targets.

## 10. Non-authority

Phase 8A does not authorize:

- Production schema mutation;
- automatic source crawling;
- automatic stale marking;
- automatic Fact replacement;
- automatic final confirmation;
- Recommendation authority cutover;
- legacy metadata mutation;
- Subject auto-creation.

## 11. Acceptance

```text
TRUST_PHASE8A_REVALIDATION_CONTRACT_FROZEN = YES
PRODUCTION_FACT_MUTATION = 0
PRODUCTION_RECOMMENDATION_MUTATION = 0
NEXT = TRUST_PHASE8B_SOURCE_VERIFICATION_LEDGER
```
