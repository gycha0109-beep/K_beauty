# Product Evidence & Decision Axis Architecture v1

Status: Phase 1 architecture + offline cleanser POC specification
Production status: not implemented, not activated
Baseline: `main@b7c7275317b72df14835f2ed1da8c1e9737cb7d3`
Frozen cleanser input: `cleanser-catalog-field-review-v1` / `9c2472cecc720e420467d2bef0808dc47cdbcff31dad118c2d28933ca7bbde9f`

## 1. Purpose and non-goals

This architecture replaces the assumption that a product must be represented by one mutually exclusive profile with a layered evidence model:

```text
Raw Evidence
→ Product Facts
→ Evidence Fusion
→ Product Decision Axes
→ existing User Concern / Condition
→ Constraint + Utility
→ Recommendation
```

Phase 1 defines contracts and an offline cleanser POC specification only. It does **not** change Production scoring, ranking, Top Pick/Top3, `isDeepCleanser()`, `getHardPenalty()`, the current `-18` behavior, CandidatePolicy, Admin v2 runtime, the `products` schema, Hosted Supabase, catalog rows, PR #167, or PR #177.

The existing eight concern axes remain user-side concern semantics:

```text
barrier
dehydation
oiliness
redness
acne
pores
uneven_tone
uv
```

They are not Product Decision Axes and are not rewritten by this design.

## 2. Existing architecture audit

### 2.1 Recommendation engine

Current `lib/skin-match-decision-engine.js` consumes the existing concern model and combines multiple product-side pathways, including product concerns, review signals, market signals, ingredient signals, irritation risk, boosts, and penalties. It also contains active cleanser/deep-clean behavior that is explicitly outside this phase.

Current `lib/recommendation-scoring.ts` is the canonical scoring module present on `main` even though earlier design references sometimes use the `.js` suffix. The existing scorer is concern-oriented and additive. Phase 1 does not modify it.

### 2.2 Review signals

`lib/review-signals.js` currently maps review observations into tags and then scores them. Its confidence baseline is a step multiplier based on each normalized review-signal entry count:

| signal entry count | multiplier |
|---:|---:|
| `< 300` | `0.8` |
| `>= 300` | `1.0` |
| `>= 1000` | `1.2` |
| `>= 5000` | `1.4` |

The current implementation therefore does not represent a posterior distribution. More importantly, the count attached to a signal entry is not automatically a trustworthy denominator for prevalence, and overall `review_count` must not be substituted as the extraction population without provenance proving that equivalence.

### 2.3 Product source and schema boundary

`lib/product-source.js` transports product fields used by the current runtime, including `concerns`, `ingredient_signals`, `review_signals`, `market_signals`, `irritation_risk`, and cleanser metadata. Existing source normalization also contains fallback/default behavior for missing legacy fields; this makes absence semantics unsuitable as a Product Fact authority layer.

The current Admin v2 cleanser migration (`supabase/migrations/20260805220000_admin_product_review_cleanser_metadata_v2.sql`) confirms a field-level review contract centered on the existing `products.cleansing_profile` column. Its review values are the scalar enum-like set `low_ph | balanced | deep_clean`, with review states such as `reviewed_valid`, `reviewed_unknown`, and `reviewed_conflict`.

That contract remains intact and parked. It is not generalized into the Product Fact model in this phase.

### 2.4 Frozen 26-cleanser corpus

The immutable offline input is:

```text
version: cleanser-catalog-field-review-v1
canonical SHA-256:
9c2472cecc720e420467d2bef0808dc47cdbcff31dad118c2d28933ca7bbde9f
products: 26
```

The corpus is evidence for this POC; it is not a Production import bundle and is not modified.

## 3. Layer authority and responsibility

| Layer | Owns | Must not own |
|---|---|---|
| Raw Evidence | source-observed material and provenance | inferred product truth, recommendation score |
| Product Facts | atomic product attributes and per-fact state | user preference, one whole-product class |
| Evidence Fusion | support/opposition, authority, uncertainty, provenance-aware aggregation | arbitrary score stacking, user utility |
| Product Decision Axes | decision-relevant product estimates with uncertainty/coverage | raw claim storage, user concern state |
| User Concern / Condition | the existing user-side need/risk state | product evidence truth |
| Constraint + Utility | hard/soft eligibility boundaries and user-specific trade-offs | evidence provenance mutation |
| Recommendation | final ordering/explanation after constraints and utility | rewriting upstream evidence |

Authority flows downward. A lower layer may consume but must not silently rewrite the semantics of an upstream layer.

## 4. Product Fact contract

A product is not one profile. A product can have any number of independent facts at the same time.

Minimum fact contract:

```json
{
  "fact_key": "low_ph",
  "value": true,
  "value_type": "boolean",
  "domain": "cleanser"
}
```

POC extension:

```json
{
  "fact_key": "low_ph",
  "value": true,
  "value_type": "boolean",
  "domain": "cleanser",
  "status": "supported",
  "support_evidence_ids": ["..."]
}
```

`fact_key` is semantic and stable. `value_type` prevents stringly typed ambiguity. `domain` scopes interpretation without requiring a new `products` column for every future attribute.

Facts that appear mutually exclusive in a legacy scalar field are not conflicts unless they are semantically contradictory facts. For example:

```text
low_ph = true
deep_cleansing = true
```

is a valid two-fact state.

No Production Fact table or migration is defined in Phase 1.

## 5. Evidence contract

Fact and Evidence are separate records. Evidence describes what a source supports; Product Facts describe the current fused state.

Supported evidence type candidates:

```text
official_claim
official_measurement
clinical_or_human_test
ingredient_basis
review_observation
manual_adjudication
```

Minimum evidence contract:

```json
{
  "evidence_type": "official_claim",
  "source": "brand_official",
  "source_reference": "https://...",
  "support_direction": "supports",
  "numeric_value": null,
  "unit": null,
  "sample_size": null,
  "analyzed_sample_size": null,
  "evidence_authority": "product_specific_primary",
  "confidence": "high",
  "evidence_digest": "sha256:..."
}
```

Rules:

1. `source` preserves platform/provider provenance, for example `hwahae`. Future platforms remain separate evidence records.
2. `source_reference` identifies the reviewed source, not an inferred source family.
3. `support_direction` is one of `supports`, `opposes`, `context_only`, or `does_not_establish`.
4. `numeric_value` and `unit` are stored only when the source provides a meaningful numeric value.
5. `sample_size` means the sample size actually associated with that evidence.
6. `analyzed_sample_size` means the population actually processed by signal extraction when known.
7. `evidence_authority` represents source authority separately from whether the observation supports a fact.
8. `confidence` is evidence confidence, not a recommendation score.
9. `evidence_digest` locks the normalized evidence record for audit/replay.

An `official_claim` remains a claim. It does not become an `official_measurement`, a measured effect size, or a clinical strength estimate merely because the language is strong or contains a product benefit statement.

A numeric value stated on an official page may be retained as a stated numeric claim while its evidence type remains `official_claim` unless the source establishes that it is a measurement/test result.

`manual_adjudication` can resolve mapping or semantic disputes but cannot, by itself, prove a physical product attribute.

## 6. Unknown and absence semantics

The model rejects a single state such as:

```text
product = unknown
```

Fact state is per fact:

| State | Meaning |
|---|---|
| `supported` | evidence establishes the fact at the current authority threshold |
| `reviewed_not_established` | relevant evidence was reviewed but did not establish the fact |
| `not_reviewed` | the fact has not been reviewed |
| `evidence_insufficient` | evidence exists but is insufficient to establish or reject the fact |

Therefore:

```text
absence of a fact != false
absence of a fact != unknown product
```

`false` is allowed only when evidence establishes the negative proposition or the fact contract defines an explicit negative value. Missing evidence is never converted to `false`.

## 7. Evidence Fusion contract

Evidence Fusion operates per `fact_key`, not per whole product.

Fusion responsibilities:

- retain every evidence record and its provenance;
- group evidence by semantic fact;
- distinguish support from opposition and non-establishing evidence;
- weight source authority without erasing lower-authority corroboration;
- keep qualitative claims separate from measurements/tests;
- surface conflicts only inside the same semantic proposition;
- output fact status plus reasons and uncertainty.

Independent facts are never collapsed to force a legacy enum.

A recommended fused-fact output is:

```json
{
  "fact_key": "deep_cleansing",
  "status": "supported",
  "value": true,
  "authority_ceiling": "product_specific_primary",
  "confidence": "high",
  "supporting_evidence": ["..."],
  "opposing_evidence": [],
  "reason_codes": ["official_product_claim"]
}
```

The `authority_ceiling` is the strongest valid authority present; it is not inferred upward from multiple weak sources.

## 8. Review reliability architecture

### 8.1 Baseline

The existing runtime step multiplier is preserved as the documented baseline only:

```text
count < 300   → 0.8
count >= 300  → 1.0
count >= 1000 → 1.2
count >= 5000 → 1.4
```

It is not treated as a calibrated probability.

### 8.2 Proposed model

Future review fusion separates:

```text
observation
+ analyzed sample size
+ prior
+ uncertainty
```

A Beta-Binomial posterior is a valid initial POC candidate for binary observations:

```text
prior: Beta(alpha0, beta0)
observed positives: k
analyzed population: n

posterior:
Beta(alpha0 + k, beta0 + n - k)
```

This is a candidate statistical contract, not a calibrated Production prior.

Illustrative acceptance fixture with `Beta(1,1)`:

- `3 / 5` and `3000 / 5000` have the same observed ratio `0.6`.
- Small sample posterior: `Beta(4,3)`, much wider uncertainty.
- Large sample posterior: `Beta(3001,2001)`, much narrower uncertainty.

The POC verifier checks the variance ordering; it does not claim these priors are calibrated for skincare reviews.

### 8.3 Missing denominator

If a signal count exists but `analyzed_sample_size` is unavailable:

```text
signal_count = 27
review_count = 10000
analyzed_sample_size = null
```

then:

```text
prevalence estimate = forbidden
review_count as denominator = forbidden
confidence = capped/limited
reason = denominator_unavailable
```

The raw count can still be preserved as an observation.

### 8.4 Source provenance

Review observations are stored per source:

```text
source = hwahae
source = future_source_x
```

Cross-platform fusion occurs after storage. Two platforms are not merged into one synthetic population unless their sampling/extraction contracts justify it.

## 9. Product Decision Axis model

Product Facts are not directly added to recommendation score.

The axis mapper converts fused evidence into decision-relevant product estimates.

POC cleanser axes:

### `cleansing_burden`

Estimated cleansing/removal intensity or burden. `deep_cleansing = true` can be evidence for the axis, but a qualitative deep-cleansing claim does not by itself establish a numeric magnitude.

### `hydration_preservation`

Estimated preservation of hydration/comfort after cleansing. `low_ph = true` is not equivalent to measured hydration preservation and cannot be used as a one-step ground-truth label.

### `irritation_burden`

Estimated irritation/drying/stinging burden from available evidence. This is a recommendation decision axis, not a diagnosis or clinical adverse-event probability unless evidence supports that interpretation.

### `sebum_pore_control`

Estimated evidence-supported ability relevant to sebum/pore cleansing/control. A pore/deep-clean claim establishes claim presence, not effect size.

Axis output contract:

```json
{
  "estimate": null,
  "uncertainty": "high",
  "coverage": "claim_only",
  "evidence_reasons": [
    "official claim exists",
    "no corroborating measured/review denominator"
  ],
  "mapper_version": "cleanser-axis-mapper-poc-v1"
}
```

`estimate` may be `null`. Lack of enough evidence is represented through `uncertainty` and `coverage`; the mapper must not invent separation between products.

If a future numeric estimate is used, it is a model estimate, not a manually entered low/medium/high ground-truth product label.

## 10. Constraints vs utility

Long-term recommendation composition is:

```text
constraints
+
utility
```

Constraints determine whether a product is ineligible, conditionally eligible, or requires caution. Utility then ranks eligible candidates by user fit.

Risk and benefit are not assumed to be symmetric. A sufficiently strong risk/constraint signal must not be completely canceled by unrelated positive utility through unrestricted arithmetic addition.

Phase 1 defines only the boundary. It changes no Production constraint or penalty.

## 11. 26-cleanser offline mapping specification

The immutable source corpus remains the source of truth for the POC. The mapping fixture references original `product_id` and `catalog_evidence_id` values instead of rewriting the frozen corpus.

Mapping rules:

1. Preserve source evidence records.
2. Translate supported scalar values into independent fact keys where semantics allow:
   - `low_ph` → `fact_key=low_ph, value=true`
   - `deep_clean` → `fact_key=deep_cleansing, value=true`
3. A legacy `reviewed_conflict` caused only by `low_ph + deep_clean` becomes two supported facts, not a Product Fact conflict.
4. `reviewed_unknown` is not copied as whole-product unknown; candidate facts become `reviewed_not_established` when the frozen evidence review covered them without establishment.
5. Evidence authority limits survive mapping.
6. Manual conflict records remain adjudication provenance and do not prove physical facts.
7. Decision-axis estimates remain nullable when the corpus lacks sufficient evidence for magnitude.

POC fixture:

```text
evidence/product-evidence-decision-axis-v1/cleanser-poc-fixtures.json
```

## 12. Mandatory cleanser acceptance cases

### beplain

Frozen evidence supports both `low_ph` and `deep_clean` on the exact official product page. New representation:

```text
low_ph = supported(true)
deep_cleansing = supported(true)
```

No conflict exists at Product Fact layer.

### BRMUD

Official evidence supports `low_ph`; Hwahae review-corpus evidence supports `deep_clean`. New representation preserves both source records and both supported facts. The two sources are not collapsed into one platform.

### Jumiso

The exact official page independently supports both `low_ph` and `deep_clean`. Both facts coexist.

### La Roche-Posay

The exact official product source was reviewed but did not establish an allowed legacy cleansing profile. The product is not globally unknown.

POC representation can simultaneously hold:

```text
product_identity_match = supported(exact_official_product)
low_ph = reviewed_not_established
deep_cleansing = reviewed_not_established
```

### Mediheal

Deep/pore-cleansing evidence is preserved. The frozen corpus explicitly limits authority because the official evidence is a brand-site root listing and corroboration is an exact-product retailer page rather than a frozen product-specific official/manufacturer evidence address.

The Fact can therefore be supported while its authority ceiling prevents promotion to high product-specific authority.

### beplain vs Senka Perfect Whip

Both can carry a `deep_cleansing` fact. That fact does not force equal `sebum_pore_control` or `cleansing_burden` estimates.

If future product-specific measured evidence or denominator-valid review evidence differs, the axis estimate may differ.

With the current frozen claim-level evidence alone, the POC does **not** invent a numeric difference. It carries the limitation in `uncertainty` and `coverage`.

## 13. Signal duplication and aggregation boundary

Current or near-current recommendation inputs can semantically overlap:

```text
product.concerns
ingredient_signals
review_signals
market_signals
hero boost
hard penalty
derived metadata
```

Future Product Decision Axis mapping must not let the same underlying signal family produce unlimited additive reinforcement simply because it appears through several transports.

Required aggregation contract:

1. Assign evidence to a semantic `signal_family`.
2. Deduplicate exact evidence by `evidence_digest`.
3. Preserve independent provenance but detect derivative evidence lineage.
4. Aggregate within a family before combining families.
5. Apply family saturation/cap or an equivalent bounded transform.
6. Cross-family corroboration may increase coverage/confidence, but duplicated claims must not multiply effect size.
7. Market popularity is not physical efficacy evidence.
8. Hero policy and hard penalties are recommendation policy, not Product Facts.

Candidate families include:

```text
official_efficacy_claim
measured_outcome
human_test
ingredient_mechanism
review_observation
concern_tag
market_popularity
derived_metadata
recommendation_policy
```

No Production score weights or caps are selected in Phase 1.

## 14. Cross-category extension plan

The contract must generalize without adding one `products` column per new capability.

Follow-up POCs should sample a small number of products, not migrate the whole catalog.

Candidate facts:

### Sunscreen
- labeled SPF/UVA values
- filter identity/type
- water-resistance claim/test
- white-cast observation
- eye-sting review observation

### Serum / treatment
- active identity
- stated active strength
- treatment claim
- usage/frequency constraints
- human-test outcome when available

### Moisturizer
- occlusive/richness observations
- barrier-support claim/test
- fragrance presence
- hydration measurement/test when available

### Toner / pad
- wipe-off/pad format
- physical friction/exfoliation characteristics
- active/exfoliation claims
- hydration/irritation observations

The same `fact_key/value/value_type/domain + evidence` model must represent these without a schema migration for every fact.

## 15. Parked lineage and adoption boundary

PR #167 remains a recommendation metadata transport shadow. It is not modified or activated.

PR #177 remains the parked scalar Catalog Review Adoption design. It is not modified, readied, or merged by this phase.

Any later catalog adoption proposal must be re-evaluated against this evidence/fact/axis architecture rather than assuming `cleansing_profile` is the long-term product truth model.

## 16. Phase 1 acceptance and verification

Required verifier:

```text
node scripts/verify-product-evidence-decision-axis-v1.mjs
```

It must verify:

- architecture contract markers;
- frozen corpus verifier still passes;
- frozen canonical SHA remains `9c2472...`;
- six mandatory cleanser cases reference real frozen product/evidence IDs;
- beplain, BRMUD, and Jumiso hold simultaneous `low_ph` and `deep_cleansing` facts;
- La Roche-Posay demonstrates partial knowledge rather than whole-product unknown;
- Mediheal preserves support with authority limitation;
- beplain and Senka do not receive invented numeric axis separation from claim presence alone;
- Beta-Binomial illustrative uncertainty for `n=5` is wider than for `n=5000`;
- missing denominator forbids prevalence;
- fixture files do not import or mutate Production paths.

Phase 1 success is architecture/specification success only. It must not be reported as Production Product Fact implementation or statistical calibration.
