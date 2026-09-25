# TRUST Phase 8H-3 — Governed Relocation Revalidation v1

## Purpose

Phase 8H-3 closes the gap between a confirmed official-source relocation and the existing Product Fact revalidation authorities.

The relocation ledger proves only that a replacement locator belongs to the same Product/Subject identity. It does not prove that the relocated page still supports the historical Product Fact semantics.

```text
confirmed relocation
-> fresh replacement observation
-> Phase 8G comparable fresh-recovery profile
-> unchanged verification against the fresh baseline
-> relocation-authorized revalidation transition
-> existing Phase 8D research bridge
-> governed research candidate
-> Phase 8E semantic adjudication
-> SAME: reaffirm
-> CHANGED: explicit Phase 8F replacement
-> insufficient/ambiguous: HOLD
```

## Non-negotiable invariants

- Historical `product_evidence_sources.canonical_locator` and `content_digest` are immutable.
- A relocation does not imply semantic equality.
- A redirect or HTTP 200 does not imply semantic equality.
- A fresh-recovery profile is a new comparison baseline, not a reconstructed historical replay.
- No synthetic `changed` verification is created to force Phase 8C.
- The existing normal Phase 8C Admin RPC remains restricted to `changed|unavailable|ambiguous`.
- The relocation bridge may use a real Phase 8G `unchanged` verification only after the replacement resource is frozen by the confirmed relocation lineage.
- Current, Fact and confirmation are not changed by relocation, baseline registration, verification, transition creation, or research enqueue.
- Missing claims are `EVIDENCE_INSUFFICIENT`, never negative Evidence.
- BOJ and Dr.G are outside the Derma canary.

## Minimal database extension

Do not create a parallel revalidation authority.

Extend `product_fact_revalidation_transitions` with nullable `relocation_id`.

A relocation transition is valid only when all are true:

1. relocation row is `confirmed`;
2. relocation Product/Subject matches the assignment and Current;
3. historical source is linked to the current Fact;
4. old binding is `retired`;
5. replacement binding is `resolved`;
6. replacement review matches the relocation/Product/Subject/binding;
7. verification is v2, bound to the current `COMPARABLE` `fresh_recovery` profile for the historical source;
8. verification result is `unchanged`;
9. profile uses the governed semantic basis and the profile baseline `final_url` resolves to the relocation replacement locator;
10. verification metadata `final_url` resolves to the same replacement locator;
11. assignment is still `confirmed` and the Current fact/confirmation prestate is exact.

The relocation Admin preflight/mark RPC freezes this lineage into the normal transition table with:

```text
verification_result = unchanged
reason_code = source_relocated
relocation_id = <confirmed relocation>
confirmed -> stale -> re_review_required
```

The normal `admin_mark_product_fact_revalidation_v1` continues to reject `unchanged`.

## Phase 8D research seed

For a transition with `reason_code = source_relocated`, `claim_trust_research_tasks_v1` must expose exactly the confirmed relocation's `replacement_binding_id` as the official source seed.

It must never reactivate or seed the retired binding.

For normal transitions, the existing source-seed behavior is unchanged.

The claimed task also exposes immutable Current context:

- current proposition key and typed value;
- parent proposition key/fact instance when present;
- parent entity identifier when the parent is `contains_active`.

## Strict extraction

### contains_active

A relocation revalidation of `contains_active` is expected-value-bound.

The worker may emit a positive candidate only when the current `value_entity_identifier` occurs on a strong product identity surface:

- document title;
- meta/OG title;
- structured Product name.

An arbitrary body occurrence is insufficient. The extractor is generic and must not hard-code Derma or niacinamide.

### active_concentration

The existing parent-bound concentration extractor is retained, but the claimed task must actually supply `parent_propositions`.

The candidate must freeze `parent_proposition_key`.

## Relationship-aware Phase 8E adjudication

Semantic equality is not proposition-key equality alone.

For definitions whose proposition identity excludes the value, Phase 8E must compare the candidate typed value with the current Fact typed value.

For `active_concentration`:

- candidate parent proposition must equal the current parent proposition;
- candidate proposition must preserve the parent proposition;
- `20 percent -> 20 percent` is SAME;
- `20 percent -> 10 percent` is CHANGED even though the proposition identity remains the same.

The evidence payload must preserve the parent proposition key.

## Relationship-aware Phase 8F replacement

Phase 8F must support a changed semantic whose proposition key remains the same.

The existing controlled confirmation primitive already supports:

- parent fact/proposition validation;
- replacing `product_fact_current` for the same proposition;
- `supersedes_fact_instance_id`.

The Phase 8F wrapper must therefore distinguish:

- cross-proposition replacement: existing behavior;
- same-proposition value replacement: confirmation preflight must require the expected previous Current, then controlled confirmation replaces Current and the old assignment is superseded without deleting the new Current.

There is no direct Fact/Current UPDATE path outside the controlled confirmation primitive.

## Derma canary

Product: `fa5b1f6b-1e55-47b0-bfa1-494be512df07`

Subject: `5a9ff33e-68c3-4ad7-ad60-7931c3478ca1`

Historical source: `f5eb21f8-4829-4c9b-b927-ccdfb43cdd1b`

Relocation: `463e6a5a-781d-4e8c-be36-918b01e423fc`

Replacement binding: `3d74a7bf-3a8d-407f-89c6-e2c398ddfc7f`

Replacement locator:

`https://dermafactory.net/products/niacinamide-20-serum-30ml?variant=46478659616933`

The canary revalidates both:

- `contains_active = niacinamide`
- `active_concentration = 20 percent`

No semantic result is assumed before the governed observation/candidate/adjudication path completes.
