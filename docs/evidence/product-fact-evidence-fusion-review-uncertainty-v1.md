# Product Fact Evidence Fusion / Review Uncertainty v1

> V2.1-4 offline contract. No Product Fact Hosted writes, Decision Axis consumption, or recommendation activation.

## Authority

- version: `product-fact-evidence-fusion-review-uncertainty-v1`
- main authority: `a38df682ebc686cb076dfc40b432ae714fdfd6da`
- frozen cleanser corpus: `cleanser-catalog-field-review-v1`
- corpus SHA-256: `9c2472cecc720e420467d2bef0808dc47cdbcff31dad118c2d28933ca7bbde9f`
- historical cleanser POC oracle: `e371d5bc037fb80d1edd3876f0c7d1d94a2c1461`
- V2.1-4 official authority upgrade: `cleanser-fusion-authority-upgrade-v1` (1 record)

## Fusion contract

- policy: `product-fact-evidence-fusion-v1`
- semantic states remain fact-specific: supported / reviewed_not_established / not_reviewed / evidence_insufficient / evidence_conflict
- Boolean supported(false) requires explicit negative evidence and is not reviewed_not_established.
- authority_ceiling never exceeds admissible evidence authority.
- review_corpus and ingredient_list cannot establish low_ph/deep_cleansing when the current Registry does not permit those evidence classes.
- manual conflict records remain adjudication context and cannot select physical truth.
- BRMUD deep_cleansing uses one separately frozen current official-product claim with equivalent-presentation binding; its historical review observation remains context-only.

## Real cleanser replay

- products: 26
- fact propositions: 52
- supported: 27
- reviewed_not_established: 2
- evidence_insufficient: 2
- evidence_conflict: 0
- not_reviewed: 21
- review-corpus evidence records: 3
- supplemental official product-claim evidence: 1
- review observations promoted into Fact authority: 0
- real review prevalence estimates emitted: 0

## Review uncertainty acceptance

The prevalence denominator is analyzed_review_count only. raw_source_review_count is never substituted.

- 3/5 estimate=0.6, posterior variance POC=0.030612244897959183
- 3000/5000 estimate=0.6, posterior variance POC=0.00004797281535130096
- analyzed n=5000 but explicit effective n=100: estimate=0.6, posterior variance POC=0.002333867108617671
- missing analyzed denominator: estimate=null, prevalence_allowed=false

Beta-Binomial is retained only as an explicit-effective-N POC. No Production effective-N formula or calibrated Bayesian prior is approved here.

## Lifecycle

```text
EVIDENCE_FUSION_V1_OFFLINE_VERIFIED = YES
EVIDENCE_FUSION_PRODUCTION_CALIBRATED = NO
REVIEW_BAYESIAN_MODEL_CALIBRATED = NO
EFFECTIVE_SAMPLE_MODEL_CALIBRATED = NO
PRODUCT_FACT_CATALOG_ADOPTED = NO
DECISION_AXIS_CONSUMPTION = NO
RECOMMENDATION_ACTIVATED = NO
```
