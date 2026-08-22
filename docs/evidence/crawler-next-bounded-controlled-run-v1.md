# NEXT-BOUNDED-CONTROLLED-RUN v1

## Stage

`NEXT-BOUNDED-CONTROLLED-RUN`

Purpose:

```text
real observation
-> legitimate distinct-date persistence
-> ranking-review-v2 reevaluation
-> review / identity only if eligible
-> at most one structural canonical adoption only if genuinely novel and resolved
```

This Stage does not authorize scheduler, cron, auto-adoption, bulk promotion, automatic Product Fact creation, or unbounded crawling.

## Starting authority

```text
main = a9d3883d130a29facaa58c665ec7fe7bdafd7b70
Production SHA = a9d3883d130a29facaa58c665ec7fe7bdafd7b70
Production deployment = dpl_CvrZeDxdoLW6eiLsfVw5egAEhvQg
Production = READY
PR #298 = MERGED / CLOSED
```

No crawler/PF/G3/Recommendation related drift exists after the accepted authority because `main` is still exactly the accepted PR #298 merge SHA.

## Same-day integrity and run selection

Current KST date is `2026-08-22`.

The prior controlled toner popularity run already occurred on this KST date, so repeating that job would not produce legitimate new distinct-date persistence.

Selected job:

```text
source = Hwahae
job = hwahae-essence-ampoule-serum-trouble
service_category = treatment
ranking_scope = concern
ranking_filter = trouble
canonical concern = acne
theme_id = 4181
controlled rank ceiling = 10
```

The current repository matrix marks this job enabled and uses the verified Hwahae gateway details API path. Existing Production snapshots for this job have KST dates:

```text
2026-06-22
2026-06-23
```

Therefore one and only one Top10 run on `2026-08-22` stays within the ten-candidate mutation ceiling while creating legitimate third-date progression rather than same-day inflation.

## Frozen review authority

Hosted `refresh_candidate_promotion_reviews` accepts only:

`ranking-review-v2`

The live evidence view counts persistence with:

`count(distinct observed_date_kst)`

where `observed_date_kst` is derived under `Asia/Seoul`.

Relevant frozen policy:

```text
latest concern rank <= 15 -> immediate
latest rank 16-30 + >=2 KST dates -> persistent
latest rank 31-50 + >=3 KST dates + reinforcement -> reinforced
```

Popularity-only observations do not independently queue candidates.

## Controlled manifest

```text
stage_version = crawler-next-bounded-controlled-run-v1
source jobs = 1
real crawl executions = 1
observed rows <= 10
new/updated candidates <= 10
review candidates examined <= 5
identity resolutions <= 5
canonical promotions <= 1
rate delay = 1500 ms
retries = 2
--all = forbidden
scheduler = OFF
cron = OFF
auto-adoption = OFF
bulk promotion = OFF
```

## Pre-run Hosted state

Captured `2026-08-22T17:56:21+09:00`:

```text
ranking_snapshots = 28
source_rankings = 790
product_candidates = 168
candidate_promotion_reviews = 50
crawler_canonical_adoption_requests = 0
products = 164
legacy = 164
non-legacy = 0
registry_versions = 1
definition_snapshots = 20
subjects = 16
fact_instances = 41
evidence_links = 41
review_assignments = 41
review_events = 180
confirmations = 41
current_facts = 41
ranking-review-v2 queued = 30
ranking-review-v2 deferred = 20
```

Frozen Legacy authority:

```text
count = 164
SHA256 = b6577d95353c4151152cf82e1705131516d5a2558cb68241a8f9fd48d9047a05
```

## Pre-run review progression opportunity

The previous Top-10 observations for the selected concern job were already review-eligible under `ranking-review-v2` and have two distinct KST dates. This run is still useful because it tests real third-date evidence progression and may surface rank/order or candidate-set changes. Any newly surfaced candidate must satisfy live policy after the one authorized refresh.

No identity state may be forced merely to create a promotion outcome.

## Stop conditions

Stop before promotion on any of:

```text
source contract drift
review rule-version mismatch
same-day persistence inflation
candidate identity corruption
identity ambiguity / variant conflict / formulation conflict / reformulation candidate
duplicate canonical risk
promotion authority regression
G3 regression
PF authority leakage
unauthorized Hosted delta
```

## Structural/PF/Recommendation authority

Frozen boundaries remain unchanged:

```text
crawler observation != canonical identity authority
canonical product != Recommendation admission
crawler != Product Fact authority
normalized comparison key != authoritative identity
```

If a safe novel resolved candidate exists, at most one structural adoption is allowed. The six crawler-denied Recommendation semantic fields remain NULL/not-established. No Product Fact is created in this Stage. If a new structural product is adopted, missing PF must be rejected by G3 before normalization/scoring.

## Run status

`PRE_RUN_FROZEN`
