# Product Decision Axis Cleanser v1

> V2.1-5 offline deterministic interpretation layer. Product Fact creation, Hosted Current mutation, recommendation consumption, scoring, and production activation are out of scope.

## Authority

- main authority: `4dce99057ca44adb14dac549e8df6d468cf7f5e2`
- V2.1-4 fusion artifact SHA-256: `86332b78ec38d79f8dfa12c5879cee46f4a22979d69945ee2f5a9dcc7038b802`
- historical cleanser POC: `e371d5bc037fb80d1edd3876f0c7d1d94a2c1461` (regression oracle only)

## Resolver boundary

- production resolver: `product-fact-current-resolver-v1`
- offline fixture adapter: `product-fact-current-resolver-v1-fixture-adapter`
- the frozen fusion artifact is adapted as Current Fact-like offline input; it is not Hosted Current and does not imply catalog adoption.
- missing Current is preserved as missing, never false; reviewed_not_established, evidence_insufficient, evidence_conflict, and supported(false) remain distinct.
- no legacy catalog fallback, scoring, evidence re-fusion, confidence increase, or authority increase occurs in the resolver.

## Cleanser axes

- cleansing_burden: deep_cleansing is only a qualitative claim signal; no burden magnitude is invented.
- hydration_preservation: low_ph is indirect relevance only; no hydration magnitude is invented.
- irritation_burden: the current cleanser Fact registry has no irritation Fact, so output is no_relevant_fact.
- sebum_pore_control: deep_cleansing is relevant claim evidence only; no effect magnitude is invented.

## Frozen output

- products: 26
- unique Fact inputs: 52
- axis outputs: 104
- numeric estimates: 0
- null estimates: 104
- authority-limited outputs: 2
- conflict-blocked outputs: 0
- missing-fact outputs: 0

## Lifecycle

```text
PRODUCT_DECISION_AXIS_MAPPER_V1_OFFLINE_VERIFIED = YES
PRODUCT_DECISION_AXIS_PRODUCTION_CALIBRATED = NO
PRODUCT_FACT_CATALOG_ADOPTED = NO
CATALOG_ADOPTED = NO
DECISION_AXIS_CONSUMPTION = NO
RECOMMENDATION_ACTIVATED = NO
HOSTED_PRODUCT_FACT_WRITES = 0
```
