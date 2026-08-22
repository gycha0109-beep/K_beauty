# NEXT-BOUNDED-CONTROLLED-RUN v1

## Stage

`NEXT-BOUNDED-CONTROLLED-RUN`

Purpose:

```text
real observation
-> legitimate distinct-date persistence
-> ranking-review-v2 reevaluation
-> bounded identity review
-> at most one structural canonical adoption only if genuinely novel and resolved
```

This Stage never authorizes scheduler, cron, auto-adoption, bulk promotion, automatic Product Fact creation, or unbounded crawling.

## Starting authority

```text
main = a9d3883d130a29facaa58c665ec7fe7bdafd7b70
Production SHA = a9d3883d130a29facaa58c665ec7fe7bdafd7b70
Production deployment = dpl_CvrZeDxdoLW6eiLsfVw5egAEhvQg
Production = READY
PR #298 = MERGED / CLOSED
```

No crawler/PF/G3/Recommendation related drift existed before the controlled run.

## Run selection

KST date: `2026-08-22`

The previous controlled toner popularity run had already occurred on the same KST date, so it was not reused. The selected job had prior legitimate KST observations on `2026-06-22` and `2026-06-23`.

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

One Top10 run on `2026-08-22` therefore provided a real third observation date without same-day persistence inflation.

## Frozen review authority

`refresh_candidate_promotion_reviews` is used only with `ranking-review-v2`.

Persistence is based on distinct `Asia/Seoul` observation dates.

```text
latest concern rank <= 15 -> immediate
latest rank 16-30 + >=2 KST dates -> persistent
latest rank 31-50 + >=3 KST dates + reinforcement -> reinforced
```

Popularity-only evidence does not independently queue a candidate.

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
version = LEGACY_FROZEN_RECOMMENDATION_CORPUS_V1
count = 164
SHA256 = b6577d95353c4151152cf82e1705131516d5a2558cb68241a8f9fd48d9047a05
```

## Real source execution

Two preliminary credential-harness attempts terminated before any external source request and produced zero Hosted delta. The successful source execution occurred exactly once.

```text
successful run HEAD = 879c63b54d193ee9e277de74a664eb03f7752d85
GitHub Actions run = 32564016568
GitHub Actions job = 97009847037
real external request = YES
jobs crawled = 1
source failures = 0
observed rows = 10
snapshots written = 1
source rankings written = 10
new candidates = 8
reobserved candidates = 2
products written = 0
```

Authoritative snapshot:

```text
snapshot_id = a12d6543-b5fe-46d0-96d5-2cb8b5c121d5
collected_at = 2026-08-22T18:06:51.506+09:00
snapshot_hash = 71a0e9e75046d28ba0fd9e71a9db60a373413ded806bc44fa9f412184e7aaab4
ingest_key = 5dcabe934765d2dbfbe297a546dfa0e7c6149f22eee5eba967697d5af22d5dda
```

## ranking-review-v2 progression

The review refresh executed exactly once after the real source run.

```text
candidates examined = 38
reviews inserted = 8
reviews updated = 30
reviews deferred = 0
protected/skipped = 0
products written = 0
```

Post-refresh queue:

```text
queued = 38
deferred = 20
rule_version = ranking-review-v2
```

Run-touched progression:

```text
run-touched candidates = 10
newly review eligible = 8
new eligibility reason = top_15_immediate
legitimate distinct-date progressions = 2
same-day persistence inflation = 0
```

The two reobserved candidates have exactly these KST observation-date sets:

```text
65bdd501-c9a1-4dc4-8691-2053bba6eb4d
2026-06-22 / 2026-06-23 / 2026-08-22

6421d559-65bd-42d6-9799-d36847127889
2026-06-22 / 2026-06-23 / 2026-08-22
```

## Identity review

The Stage reviewed the maximum authorized five candidates and did not force any identity resolution.

```text
reviewed = 5
resolved = 0
identity ambiguous = 2
variant scope conflict = 3
formulation scope conflict = 0
reformulation candidate = 0
blocked = 5
selected for promotion = 0
contract = crawler-identity-resolution-v1
audit events recorded = 5
```

Observed conflicts included bundle, two-pack, planning-set, and changed external-identity semantics on otherwise related source locators. These were preserved as uncertainty instead of being normalized into false canonical identity.

## Structural promotion and G3

```text
promotion preflight entered = NO
promotion attempted = 0
promotion succeeded = 0
new canonical UUID = NONE
structural adoption requests = 0
products delta = 0
semantic authority written = NO
```

Because no safe resolved novel candidate existed, Success Case B applied. No Product Fact was created and no new-product G3 runtime probe was applicable.

```text
Recommendation authority separation = PRESERVED
PF authority delta = 0
new non-legacy products = 0
```

## Post-run Hosted state

```text
ranking_snapshots = 29          (+1)
source_rankings = 800           (+10)
product_candidates = 176        (+8)
candidate_promotion_reviews = 58 (+8)
identity audit events = +5
crawler_canonical_adoption_requests = 0
products = 164                  (+0)
registry_versions = 1           (+0)
definition_snapshots = 20       (+0)
subjects = 16                   (+0)
fact_instances = 41             (+0)
evidence_links = 41             (+0)
review_assignments = 41         (+0)
review_events = 180             (+0)
confirmations = 41              (+0)
current_facts = 41              (+0)
```

Unauthorized Hosted delta: `0`.

## Legacy and Recommendation invariance

The repository freezes exactly 164 Legacy Recommendation product UUIDs with corpus SHA256:

```text
b6577d95353c4151152cf82e1705131516d5a2558cb68241a8f9fd48d9047a05
```

The closeout CI must compare the live Hosted `products.id` set exactly against that frozen corpus. Count-only equality is insufficient.

Historical Recommendation behavior, G3/G3A authority boundaries, CandidatePolicy, and crawler denial of Product Fact authority must also be revalidated on the exact closeout head and merged-main SHA.

## Final automation state

```text
manual bounded crawler = VALIDATED
scheduler = OFF
cron = OFF
auto-adoption = OFF
bulk promotion = OFF
unbounded crawler = NOT AUTHORIZED
```

The real crawler and review refresh must not run again during repository closeout. Closeout is read-only against Hosted state.

## Repository closeout contract

The remaining closeout is limited to:

```text
1. deterministic evidence verification
2. read-only Hosted state verification
3. exact Legacy UUID set equality
4. G3/G3A/PDA/CandidatePolicy/Recommendation invariance
5. exact-head CI
6. PR merge
7. merged-main exact-SHA CI
8. Production READY at the exact merged-main SHA
9. final read-only Hosted confirmation
```

No new crawl, review refresh, identity resolution, canonical promotion, Product Fact write, migration, scheduler activation, or Recommendation mutation is authorized by closeout.

## Terminal operational outcome

```text
NEXT-BOUNDED-CONTROLLED-RUN =
OPERATIONAL_SUCCESS_CASE_B

PRIMARY OUTCOME =
BOUNDED_CRAWLER_RUN_VALIDATED__NO_SAFE_CANONICAL_ADOPTION_CANDIDATE

REVIEW_ELIGIBILITY_PROGRESSION = VALIDATED
CANONICAL_ADOPTION = 0
RECOMMENDATION_AUTHORITY_SEPARATION = PRESERVED
SCHEDULER = OFF
AUTO_ADOPTION = OFF
```

Repository state is a `STRICT_SUCCESS_PENDING_MERGED_MAIN_CLOSEOUT` candidate until the exact merged-main CI and Production exact-SHA readback complete.
