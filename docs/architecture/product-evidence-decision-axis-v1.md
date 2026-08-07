# Product Evidence & Decision Axis Architecture v1

Status: Phase 1 architecture + offline cleanser POC specification
Finalization scope: same-fact conflict, review effective sample, product identity boundary
Production status: not implemented, not activated
Baseline: `main@b7c7275317b72df14835f2ed1da8c1e9737cb7d3`
Frozen cleanser input: `cleanser-catalog-field-review-v1` / `9c2472cecc720e420467d2bef0808dc47cdbcff31dad118c2d28933ca7bbde9f`

## 1. Direction and scope

Target architecture remains:

```text
Raw Evidence
→ Product Facts
→ Evidence Fusion
→ Product Decision Axes
→ existing User Concern / Condition
→ Constraint + Utility
→ Recommendation
```

`ProductIdentityState` is a separate provenance/entity-resolution boundary used to bind evidence to a canonical product entity. It is not inserted as a score-bearing Product Fact or Product Decision Axis.

Phase 1 defines architecture and an offline cleanser POC specification only.

Out of scope: Production scoring/ranking/Top Pick/Top3 changes, `isDeepCleanser()`, `getHardPenalty()`, the current `-18` behavior, CandidatePolicy activation, Admin v2 runtime, `products` schema migrations, Hosted migration, Production DB writes, catalog re-review/backfill, PR #167 changes, PR #177 changes, and frozen corpus changes.

The existing user concern axes remain exactly:

```text
barrier
dehydration
oiliness
redness
acne
pores
uneven_tone
uv
```

These are user-side need axes. They are not Product Decision Axes.

## 2. Existing architecture audit

### Runtime scoring

`lib/skin-match-decision-engine.js` consumes the existing concern model and combines multiple product-side pathways including `product.concerns`, review signals, market signals, ingredient signals, `irritation_risk`, hero/priority boosts, and hard penalties. Cleanser/deep-clean logic is active Production behavior and is frozen for this phase.

The current canonical scorer on `main` is `lib/recommendation-scoring.ts`. It remains unchanged.

### Review signals

`lib/review-signals.js` maps review observations to tags and scores them. The current confidence baseline is a step multiplier based on each normalized review-signal entry count:

| signal entry count | multiplier |
|---:|---:|
| `< 300` | `0.8` |
| `>= 300` | `1.0` |
| `>= 1000` | `1.2` |
| `>= 5000` | `1.4` |

This is a heuristic multiplier, not a calibrated posterior probability. A signal entry count is not automatically a valid prevalence denominator or an independent effective sample size.

### Product source and schema boundary

On current `main`, `lib/product-source.js` is the active product source file audited for this phase. `lib/product-source-core.js` is not present on current `main`; it belongs to parked PR #167 and is not consumed here.

The runtime transports legacy product metadata including `concerns`, `ingredient_signals`, `review_signals`, `market_signals`, `irritation_risk`, and cleanser metadata. Existing source normalization can also synthesize fallback values for missing legacy fields, so absence in the runtime object cannot be treated as Product Fact authority.

The current Admin v2 migration `supabase/migrations/20260805220000_admin_product_review_cleanser_metadata_v2.sql` confirms a field-level review contract centered on the pre-existing scalar `products.cleansing_profile` field. Its value space is `low_ph | balanced | deep_clean`, with review states such as `reviewed_valid`, `reviewed_unknown`, and `reviewed_conflict`.

That scalar contract is not the long-term Product Fact model.

### Frozen cleanser corpus

POC input is immutable:

```text
version: cleanser-catalog-field-review-v1
products: 26
canonical SHA-256:
9c2472cecc720e420467d2bef0808dc47cdbcff31dad118c2d28933ca7bbde9f
```

The corpus remains offline evidence and is not rewritten or imported.

## 3. Layer authority

| Layer | Authority / responsibility | Forbidden responsibility |
|---|---|---|
| Raw Evidence | source-observed material and provenance | inferred product truth or recommendation score |
| Product identity resolution | bind evidence to canonical product entity | recommendation scoring or physical Product Fact truth |
| Product Facts | atomic product attributes and per-fact state | one whole-product class or user preference |
| Evidence Fusion | support/opposition, authority, uncertainty, provenance-aware aggregation | arbitrary additive recommendation scoring |
| Product Decision Axes | decision-relevant product estimates with uncertainty/coverage | raw evidence storage or user concern state |
| User Concern / Condition | existing user-side need/risk state | product evidence truth |
| Constraint + Utility | eligibility boundaries and user-specific trade-offs | mutating evidence provenance |
| Recommendation | final ordering/explanation | rewriting upstream evidence |

Authority flows downward. Downstream layers may consume upstream output but must not silently upgrade evidence authority or reinterpret absence as truth.

Identity metadata only determines which canonical entity an evidence record belongs to. Identity resolution metadata is not directly scoreable recommendation evidence.

## 4. Product Fact contract

A product is a set of independent facts, not one profile.

Minimum contract:

```json
{
  "fact_key": "low_ph",
  "value": true,
  "value_type": "boolean",
  "domain": "cleanser"
}
```

POC state extension:

```json
{
  "fact_key": "low_ph",
  "value": true,
  "value_type": "boolean",
  "domain": "cleanser",
  "status": "supported",
  "support_evidence_ids": ["..."],
  "opposing_evidence_ids": []
}
```

Required semantics:

- `fact_key`: stable semantic identifier.
- `value`: atomic authoritative value when established.
- `value_type`: explicit type such as boolean/string/number.
- `domain`: category/domain scope without requiring a dedicated `products` column.
- `support_evidence_ids`: evidence supporting the proposition.
- `opposing_evidence_ids`: evidence opposing the same proposition when present.

Independent facts can coexist:

```text
low_ph = true
deep_cleansing = true
```

This is not a conflict.

A conflict exists only when meaningful support and meaningful opposition address the same semantic proposition.

No Production Fact table/migration is created in Phase 1.

## 5. Product Fact states and same-fact conflict

Fact status is per fact:

| status | meaning |
|---|---|
| `supported` | evidence establishes the fact at the current authority threshold |
| `reviewed_not_established` | relevant evidence was reviewed but did not establish the fact |
| `not_reviewed` | this fact has not been reviewed |
| `evidence_insufficient` | evidence exists but cannot establish/reject the fact |
| `evidence_conflict` | meaningful support and opposition coexist for the same semantic proposition and no authoritative scalar is selected |

### `evidence_conflict`

`evidence_conflict` is reserved for same-proposition contradiction.

Required semantics:

1. Independent attributes simultaneously being true are not conflict.
2. Same `fact_key` / proposition with credible `supports` and credible `opposes` evidence can become `evidence_conflict`.
3. `evidence_conflict` does not arbitrarily select an authoritative scalar.
4. Default authoritative `value` is `null`.
5. Supporting and opposing evidence provenance are both preserved.
6. A manual adjudication record can document handling but cannot by itself select physical truth.
7. A later resolved state requires additional authority or an explicit domain policy; it is not silently inferred from evidence count.

Positive example:

```text
low_ph.status = supported
low_ph.value = true

deep_cleansing.status = supported
deep_cleansing.value = true

result:
no conflict
```

Negative example:

```text
fact_key = low_ph
credible evidence A → supports low_ph=true
credible evidence B → opposes low_ph=true

result:
status = evidence_conflict
value = null
supporting_evidence = [A]
opposing_evidence = [B]
```

## 6. Evidence contract

Fact and Evidence are distinct. Evidence says what a source supports; Evidence Fusion determines fact state.

Supported evidence type candidates:

```text
official_claim
official_measurement
clinical_or_human_test
ingredient_basis
review_observation
manual_adjudication
```

Minimum evidence record:

```json
{
  "evidence_type": "official_claim",
  "source": "brand_official",
  "source_reference": "https://...",
  "support_direction": "supports",
  "numeric_value": null,
  "unit": null,
  "sample_size": null,
  "raw_source_sample_size": null,
  "analyzed_sample_size": null,
  "effective_sample_size": null,
  "evidence_authority": "product_specific_primary",
  "confidence": "high",
  "evidence_digest": "sha256:..."
}
```

Rules:

1. `source` preserves provider/platform provenance such as `hwahae`.
2. `source_reference` identifies the reviewed source.
3. `support_direction` is `supports`, `opposes`, `context_only`, or `does_not_establish`.
4. `numeric_value`/`unit` exist only when the source provides a meaningful numeric value.
5. `sample_size` belongs to the evidence itself when the source declares a study/test population.
6. `raw_source_sample_size` is the known source population potentially available for extraction.
7. `analyzed_sample_size` is the population actually processed by signal extraction when known.
8. `effective_sample_size` is the uncertainty-bearing independent-information equivalent after reliability/bias/dependence considerations; it is not assumed equal to analyzed sample size.
9. `evidence_authority` is separate from support direction.
10. `confidence` is evidence confidence, not recommendation utility.
11. `evidence_digest` supports dedupe, replay, and lineage audit.

When the sample-size values exist, the invariant is:

```text
effective_sample_size
<= analyzed_sample_size
<= raw_source_sample_size
```

An `official_claim` never becomes an `official_measurement` merely because wording is strong. A stated numeric claim can retain its numeric value while remaining `official_claim` unless the source establishes a measurement/test result.

`manual_adjudication` may record a mapping decision but does not itself prove a physical product attribute.

## 7. Unknown and absence semantics

Whole-product state is not modeled as:

```text
product = unknown
```

Therefore:

```text
absence of a fact != false
absence of a fact != unknown product
```

`false` is used only when evidence establishes the negative proposition or the fact contract explicitly models a negative value.

`evidence_conflict` also does not make the whole product unknown. It affects the disputed fact proposition only.

## 8. Product identity resolution boundary

Product identity/source binding is separate from Product Facts.

Architecture-level concept:

```json
{
  "ProductIdentityState": {
    "status": "resolved",
    "canonical_product_id": "uuid-or-stable-id",
    "confidence": "high",
    "identity_evidence": ["evidence-id"]
  }
}
```

The exact Production schema is intentionally not defined in Phase 1.

Required rules:

- Identity resolution binds evidence to the intended canonical product.
- Identity resolution metadata is provenance/entity-resolution state, not a physical Product Fact.
- `product_identity_match` must not appear as a Product Fact.
- Identity confidence must not be directly scored as Product Decision Axis magnitude or recommendation utility.
- A resolved identity can coexist with `reviewed_not_established`, `not_reviewed`, `evidence_insufficient`, or `evidence_conflict` Product Facts.
- Missing Product Facts do not undo resolved product identity and do not create an "unknown product".

No ProductIdentityState table/migration is created in Phase 1.

## 9. Evidence Fusion contract

Evidence Fusion operates per semantic fact proposition.

It must:

- retain all evidence and provenance;
- group evidence by semantic fact;
- distinguish support, opposition, context, and non-establishing review;
- preserve authority ceilings;
- keep claim evidence separate from measurement/test evidence;
- surface conflicts only within the same proposition;
- produce per-fact status, confidence, authority, and reason codes;
- emit `evidence_conflict` with `value=null` when meaningful same-proposition contradiction remains unresolved;
- preserve supporting and opposing provenance without selecting physical truth through manual adjudication alone.

Supported fused output:

```json
{
  "fact_key": "deep_cleansing",
  "value": true,
  "status": "supported",
  "authority_ceiling": "product_specific_primary",
  "confidence": "high",
  "supporting_evidence": ["..."],
  "opposing_evidence": [],
  "reason_codes": ["official_product_claim"]
}
```

Conflict fused output:

```json
{
  "fact_key": "low_ph",
  "value": null,
  "status": "evidence_conflict",
  "authority_ceiling": "unresolved",
  "confidence": "conflicted",
  "supporting_evidence": ["support-id"],
  "opposing_evidence": ["oppose-id"],
  "reason_codes": ["same_fact_support_and_opposition"]
}
```

Multiple weak sources do not automatically promote `authority_ceiling` to a stronger class.

## 10. Review reliability architecture

### Current baseline

The current entry-count step multiplier remains a documented baseline only:

```text
<300 → 0.8
>=300 → 1.0
>=1000 → 1.2
>=5000 → 1.4
```

### Proposed POC statistical contract

Future review fusion separates:

```text
observation
+ raw_source_sample_size
+ analyzed_sample_size
+ effective_sample_size
+ prior
+ uncertainty
+ source/extraction confidence floor
```

`analyzed_sample_size` is not assumed to be independent effective `n`.

The effective sample concept, or an equivalent uncertainty ceiling/floor contract, must be able to account for:

- source reliability;
- extraction/classifier reliability;
- sampling/selection bias;
- duplicate or clustered observations;
- evidence coverage.

The effective-n calculation is not calibrated or fixed in Phase 1.

Required invariant when values exist:

```text
effective_sample_size
<= analyzed_sample_size
<= raw_source_sample_size
```

### Pure statistical demonstration

Beta-Binomial is an acceptable initial POC candidate for binary observations:

```text
prior: Beta(alpha0, beta0)
positive observations: k
analyzed population: n
posterior: Beta(alpha0 + k, beta0 + n - k)
```

This is a statistical demonstration, not a calibrated Production confidence model.

Illustrative `Beta(1,1)` acceptance case:

```text
3 / 5
3000 / 5000
```

Both observed ratios are `0.6`, but the `n=5` posterior must be much wider than the `n=5000` posterior.

### Effective sample uncertainty floor

Large raw/analyzed `n` must not automatically imply near-zero real-world uncertainty.

Synthetic acceptance cases keep the same observed ratio and same analyzed population:

```text
Case A
raw_source_sample_size = 5000
analyzed_sample_size = 5000
effective_sample_size = 5000

Case B
raw_source_sample_size = 5000
analyzed_sample_size = 5000
effective_sample_size = 100
```

The POC may use effective `n` only as an uncertainty demonstration. Case B must have greater posterior uncertainty than Case A.

This does not approve any formula that converts reliability/bias/dependence into effective `n`. Production calibration remains future work.

A source/extraction uncertainty floor must remain available even when raw/analyzed counts are large; large count alone cannot erase model/source uncertainty.

### Denominator unavailable

Fixture:

```text
signal_count = 27
review_count = 10000
raw_source_sample_size = null
analyzed_sample_size = null
effective_sample_size = null
```

Required result:

```text
prevalence estimate = forbidden
review_count as extraction denominator = forbidden
confidence = capped/limited
```

The raw signal count can be preserved. It cannot be converted into fake prevalence.

### Provenance

Review evidence remains source-specific:

```text
source = hwahae
source = future_source_x
```

Storage does not merge platform populations. Cross-source fusion occurs only after provenance is retained and sampling/extraction compatibility is evaluated.

## 11. Product Decision Axis model

Product Facts are not directly added to recommendation score.

Cleanser POC axes:

### `cleansing_burden`

Estimated cleansing/removal intensity or burden. A `deep_cleansing` claim can support the axis qualitatively but does not establish numeric magnitude.

### `hydration_preservation`

Estimated preservation of hydration/comfort after cleansing. `low_ph = true` is not equivalent to measured hydration preservation.

### `irritation_burden`

Estimated irritation/drying/stinging burden from evidence. It is not a diagnosis or clinical adverse-event probability unless evidence supports that interpretation.

### `sebum_pore_control`

Estimated evidence-supported sebum/pore cleansing/control. Claim presence is not effect size.

Axis output contract:

```json
{
  "estimate": null,
  "uncertainty": "high",
  "coverage": "claim_only",
  "evidence_reasons": [
    "official claim exists",
    "no corroborating measurement or denominator-valid review evidence"
  ],
  "mapper_version": "cleanser-axis-mapper-poc-v1"
}
```

`estimate` may be null. Weak evidence is represented through uncertainty and coverage, not invented differences.

A future numeric estimate is a model output, never a manually entered low/medium/high Product DB ground-truth label.

Identity resolution metadata is not a Decision Axis input.

## 12. Constraint + Utility boundary

Long-term recommendation composition is:

```text
constraints
+
utility
```

Constraints determine eligibility/caution first; utility ranks eligible candidates by user fit.

Risk and benefit are not symmetric by default. A strong risk/constraint signal must not be fully canceled by unrelated positive utility through unrestricted addition.

No Production constraint or penalty is implemented in Phase 1.

## 13. Frozen 26-cleanser mapping specification

Mapping input remains the immutable frozen corpus. The POC fixture references original `product_id` and `catalog_evidence_id` values rather than editing the source corpus.

Rules:

1. Preserve source evidence.
2. Resolve source-to-product identity separately through ProductIdentityState/provenance.
3. `low_ph` support maps to independent `fact_key=low_ph`.
4. `deep_clean` support maps to independent `fact_key=deep_cleansing`.
5. Legacy `reviewed_conflict` caused only by simultaneous low-pH and deep-cleansing support becomes two supported facts.
6. Same-fact support/opposition remains `evidence_conflict`; it is not collapsed.
7. `reviewed_unknown` does not become whole-product unknown.
8. Evidence authority limitations survive mapping.
9. Manual conflict records remain adjudication-only evidence.
10. Decision-axis estimates remain nullable when magnitude evidence is insufficient.

Fixture:

```text
evidence/product-evidence-decision-axis-v1/cleanser-poc-fixtures.json
```

## 14. Mandatory cleanser acceptance cases

### beplain

Frozen `cfrv1-10-01` supports low pH and `cfrv1-10-02` supports deep cleansing for the exact official product page.

Required Fact state:

```text
low_ph = supported(true)
deep_cleansing = supported(true)
```

The independent facts are not conflict.

### BRMUD

Frozen official evidence supports low pH; frozen Hwahae review-corpus evidence supports deep cleansing. Both facts coexist and source provenance remains separate.

### Jumiso

The frozen exact official page supports both low pH and deep cleansing. Both facts coexist.

### La Roche-Posay

The exact official product source resolves canonical product identity, but did not establish the relevant cleanser facts.

POC state:

```text
ProductIdentityState.status = resolved
ProductIdentityState.canonical_product_id = cb04b777-9a57-4246-9431-3018638354db

low_ph = reviewed_not_established
deep_cleansing = reviewed_not_established
```

There is no `product_identity_match` Product Fact.

The canonical product is resolved even though relevant Product Facts are not established. The product is therefore not modeled as an "unknown product".

### Mediheal

Deep-cleansing support is preserved. The frozen corpus explicitly records that evidence authority is limited: an official brand-site root listing plus retailer corroboration, without a frozen product-specific high-authority official/manufacturer evidence address.

The Fact can be supported while its authority ceiling remains limited.

### beplain vs Senka Perfect Whip

Both may have `deep_cleansing = supported(true)`. That shared claim does not force the same Decision Axis estimate.

If future product-specific measurement or denominator-valid review evidence differs, axis estimates may differ. With current claim-level evidence alone, the POC must not invent a numeric difference; uncertainty/coverage carry the limitation.

## 15. Score duplication boundary

Potentially overlapping pathways include:

```text
product.concerns
ingredient_signals
review_signals
market_signals
hero boost
hard penalty
derived metadata
```

Future axis mapping forbids unlimited additive stacking of the same underlying signal family.

Aggregation contract:

1. assign evidence to a semantic `signal_family`;
2. deduplicate exact evidence by `evidence_digest`;
3. retain independent provenance and derivative lineage;
4. aggregate within a family before combining families;
5. use signal-family saturation/cap or an equivalent bounded transform;
6. let independent cross-family corroboration improve coverage/confidence without multiplying duplicate effect size;
7. never treat market popularity as physical efficacy;
8. keep hero boosts/hard penalties as recommendation policy, not Product Facts.

Candidate families:

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

No Production weight, cap, or score formula changes in Phase 1.

## 16. Cross-category extension plan

Validate the same Fact/Evidence contract on small later POCs only.

### Sunscreen
- labeled SPF/UVA values
- filter identity/type
- water-resistance claim/test
- white-cast/eye-sting observations

### Serum / treatment
- active identity
- stated active strength
- treatment claim
- usage/frequency constraints
- human-test outcome when available

### Moisturizer
- richness/occlusivity observations
- barrier-support claim/test
- fragrance presence
- hydration test/measurement when available

### Toner / pad
- wipe-off/pad format
- physical friction/exfoliation characteristics
- active/exfoliation claims
- hydration/irritation observations

The same `fact_key/value/value_type/domain + evidence` model must extend without adding a new `products` column for every product attribute.

## 17. Parked PR boundary

PR #167 remains Draft and unchanged. Its recommendation metadata transport shadow is not activated.

PR #177 remains Draft and unchanged. Its scalar Catalog Review Adoption design is not implemented or merged.

Any later catalog adoption proposal must be re-evaluated against this Evidence → Facts → Fusion → Axes architecture rather than assuming `cleansing_profile` is the long-term product truth model.

## 18. Verification contract

Verifier:

```text
node scripts/verify-product-evidence-decision-axis-v1.mjs
```

It validates:

1. independent facts are not conflict;
2. same-proposition contradictory evidence maps to `evidence_conflict`;
3. `evidence_conflict` authoritative `value=null`;
4. raw/analyzed/effective sample-size ordering;
5. same analyzed `n` and ratio with lower effective `n` produces higher uncertainty;
6. missing denominator forbids prevalence;
7. `ProductIdentityState` is separate from Product Facts;
8. La Roche-Posay does not use `product_identity_match` as a Product Fact;
9. frozen canonical SHA invariance;
10. Production runtime paths delta is zero and branch delta remains exactly the three architecture/fixture/verifier paths when the baseline commit is available;
11. real frozen product/evidence IDs for the six mandatory cleanser cases;
12. Mediheal authority limitation;
13. no invented beplain/Senka numeric axis split;
14. the pure `Beta(1,1)` `n=5` vs `n=5000` demonstration remains wider for small `n`.

Phase 1 finalization success is architecture/specification success only. It must not be reported as Product Fact Production implementation, Bayesian/effective-sample calibration, schema migration, Catalog Adoption readiness, or recommendation activation.
