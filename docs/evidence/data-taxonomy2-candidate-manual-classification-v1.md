# DATA-TAXONOMY2 — candidate/manual catalog taxonomy classification v1

## Decision

DATA-TAXONOMY2 extends `catalog-taxonomy-v1` only as a **shadow candidate classification plane**.

It does not replace or weaken any current authority:

```text
product_candidates.service_category / product_form
→ promote_product_candidate(...)
→ products.category / products.product_form
→ existing Recommendation admission/runtime
```

The legacy path above remains the Product-promotion and Recommendation authority. The new classification is sidecar metadata only.

## Fresh baseline

Repository baseline before DATA-TAXONOMY2 implementation:

```text
main = d0fcf6e36984053a621df74aa1a63e46e0581dea
DATA-TAXONOMY1 = merged
catalog taxonomy version = catalog-taxonomy-v1
catalog taxonomy lifecycle = shadow
catalog taxonomy authority_mode = shadow_only
```

Fresh read-only Production observations before DATA-TAXONOMY2 Production application:

```text
Production Product count: `165`
Production Product shadow assignments: `165`
Production candidate count: `190`

Hwahae `cleanser`: `25`
Hwahae `sunscreen`: `37`
Hwahae `toner_essence`: `26`
Hwahae `treatment`: `102`

candidate service_category/product_form:
- null / null: 189
- sunscreen / null: 1

Production full-row Product digest MD5: `c7ec481493af9075f891d4a089b53302`

Protected function definition MD5 baselines:
- map_product_category(text): `364282a34496ed047c74bf7d354d443f`
- promote_product_candidate(uuid,text): `88096291b54e626615dc81ce679baa79`
- admin_enqueue_product_candidate_structural_review_v1(...): `6363c54ab4cfc2a4662ec489218fd843`
- admin_confirm_product_review_import_batch(...): `f228d90b5dcd85e3a7dbf7163d60fa46`
```

The Product digest is calculated as:

```sql
md5(string_agg(to_jsonb(p)::text, E'\n' order by p.id::text))
```

This serialization definition matters because `row_to_json(p)::text` produces a different digest for the same rows.

## Current promotion gap discovered

The governed candidate approval/promotion contract currently permits legacy candidate combinations that DATA-TAXONOMY1 did not need for its current-Product backfill:

```text
moisturizer / null
treatment / booster
treatment / peeling_solution
```

DATA-TAXONOMY1 had 11 active legacy projections because those were sufficient for the 165 current Products. Without a shadow bridge for the three combinations above, a future candidate that is valid under the existing promotion contract could become a Product while lacking an exact taxonomy projection.

DATA-TAXONOMY2 therefore adds exactly three shadow legacy projections. This does **not** add a new legacy enum value and does not change what `promote_product_candidate` accepts.

## Candidate classification model

Two classification sources are deliberately distinct.

### 1. Exact raw-source classification

New candidates with no governed legacy review classification use exact source rules:

```text
source_name + category_path
→ exact catalog_taxonomy_candidate_source_rules row
→ registry term IDs
→ product_candidate_catalog_taxonomy_classifications
```

Current governed source rules are intentionally narrow:

| Source | Raw category | Family | Category | Form |
| --- | --- | --- | --- | --- |
| hwahae | cleanser | cleanser | cleanser | null |
| hwahae | sunscreen | sunscreen | sunscreen | null |
| hwahae | toner_essence | toner | toner | null |
| hwahae | treatment | treatment | treatment | null |

`toner_essence` does **not** manufacture an `essence` form fact.

`treatment` does **not** manufacture serum/ampoule/essence/booster/peeling form identity. Form remains null until a separate governed review classification exists.

### 2. Governed manual legacy projection

Once a candidate already has `service_category` / `product_form` from the existing governed review path, candidate shadow classification prefers an exact `catalog_taxonomy_legacy_projections` row:

```text
candidate.service_category + candidate.product_form
→ exact legacy projection
→ registry term IDs
```

There is no fallback from a missing manual legacy projection back to raw source classification. A missing exact projection becomes `unresolved`.

That rule prevents a reviewer-selected category/form from being silently replaced by weaker source-path inference.

## Fail-closed states

Candidate classification states are:

```text
active_shadow
reserved_shadow
blocked_deprecated
unresolved
```

Rules:

- all referenced registry terms active → `active_shadow`
- one or more referenced terms reserved → `reserved_shadow`
- one or more referenced terms deprecated → `blocked_deprecated`
- unknown/unmapped raw category, missing exact manual projection, invalid version, or invalid registry term contract → `unresolved`

An unknown/unmapped raw category is never coerced to toner, treatment, moisturizer, or another nearby category.

Reserved future vocabulary is representable by the same registry-bound rule structure, but `reserved_shadow` is explicitly non-admissible.

## Authority firewall

Every candidate classification row permanently carries:

```text
product_write_allowed = false
product_promotion_allowed = false
recommendation_admission_allowed = false
```

The table also enforces those values with a CHECK constraint.

Recommendation runtime cutover: `false`

The migration does not create or replace:

```text
public.map_product_category(text)
public.promote_product_candidate(uuid,text)
public.admin_confirm_product_candidate_review(...)
public.admin_confirm_product_review_import_batch(...)
```

It does not mutate `public.products`, Product Fact tables, Product Offers, recommendation scoring, or ranking inputs.

## Continuous shadow synchronization

The classification sidecar refreshes only after candidate fields that can change taxonomy interpretation change:

```text
source_name
category_path
service_category
product_form
```

The Production trigger is:

```text
product_candidates_catalog_taxonomy_shadow_sync_v1
```

It executes `sync_product_candidate_catalog_taxonomy_classification_v1()` and writes only `product_candidate_catalog_taxonomy_classifications` through the bounded refresh path.

Existing candidates are backfilled once. Unknown categories remain as explicit `unresolved` rows rather than blocking ingestion or being coerced.

## Security boundary

Both new tables:

```text
catalog_taxonomy_candidate_source_rules
product_candidate_catalog_taxonomy_classifications
```

have RLS enabled.

Privileges:

```text
anon          = none
authenticated = none
service_role  = SELECT only on tables
```

Function EXECUTE boundary after Production readback:

```text
resolve_catalog_taxonomy_source_category_v1(...)      service_role = yes; anon/authenticated = no
refresh_product_candidate_catalog_taxonomy_classification_v1(...) service_role = yes; anon/authenticated = no
sync_product_candidate_catalog_taxonomy_classification_v1()       service_role = no; anon/authenticated = no
catalog_taxonomy_shadow_term_set_state_v1(...)                     service_role = no
```

No browser/client role gains direct taxonomy read or write authority.

## Production application and reconciliation

Production application was explicitly authorized by the user on 2026-09-13.

During controlled application, two concurrency defects were isolated without forcing ad-hoc Product writes:

1. the repository migration initially hit a PostgreSQL 63-byte identifier truncation collision;
2. while that repair was being merged, another DATA-TAXONOMY2 worker split and applied the projection/table shell and later the source-rule/backfill portions.

The repository-owned closure path was therefore:

```text
PR #470 → implementation
merge `804f2657468fac19dc14f9818f936bf1fd0cbef0`

PR #471 → PostgreSQL constraint-identifier collision repair
merge `6783f2ae3f0ec2cdafe41cfc790f040821ada3e5`

PR #472 → split-Production adoption reconciliation
merge `78ad75a259196f75da29071b5c4f0a3ab71ede21`
```

The final repository-owned reconciliation migration is present in the Production migration ledger as:

```text
20260913210822  data_taxonomy2_production_adoption_reconcile_v1
```

Production migration applied: `true`.

## Production readback

Exact post-application readback:

```text
Product count = 165
candidate count = 190
candidate taxonomy classifications = 190
source rules = 4
active legacy projections = 14
sync trigger = present
catalog taxonomy lifecycle = shadow
catalog taxonomy authority_mode = shadow_only
```

Classification distribution:

```text
active_shadow / source_rule_v1 = 189
active_shadow / manual_legacy_projection_v1 = 1
other states = 0
```

Authority-firewall violations:

```text
product_write_allowed = true rows: 0
product_promotion_allowed = true rows: 0
recommendation_admission_allowed = true rows: 0
```

Forbidden raw-form inference:

```text
toner_essence inferred form rows = 0
treatment inferred form rows = 0
```

Runtime fail-closed probes:

```text
unknown source/category → classification_state = unresolved
unknown source/category → failure_reason = exact_source_category_rule_missing
unknown source/category → all authority booleans = false
reserved registry term set → reserved_shadow
```

Product identity/ranking authority proof using the baseline serialization:

```text
pre-application Product digest  = c7ec481493af9075f891d4a089b53302
post-application Product digest = c7ec481493af9075f891d4a089b53302
Product count                    = 165 → 165
```

Protected function definitions remain byte-equivalent by MD5:

```text
map_product_category(text) = 364282a34496ed047c74bf7d354d443f
promote_product_candidate(uuid,text) = 88096291b54e626615dc81ce679baa79
admin_enqueue_product_candidate_structural_review_v1(...) = 6363c54ab4cfc2a4662ec489218fd843
admin_confirm_product_review_import_batch(...) = f228d90b5dcd85e3a7dbf7163d60fa46
```

Therefore observed Product identity drift = `0` and protected legacy promotion-function drift = `0`.

## Advisor review

Supabase Security Advisor was run after the Production DDL.

DATA-TAXONOMY2-specific result:

```text
no DATA-TAXONOMY2 WARN-level security finding
new shadow tables: RLS enabled/no policy = INFO
```

The no-policy finding is intentional for these two service-only tables: direct `anon` / `authenticated` table privileges are absent, `service_role` receives SELECT only, and mutation is bounded through the refresh function.

Other Security Advisor WARN findings concern pre-existing admin/auth surfaces and are outside DATA-TAXONOMY2 scope.

Supabase Performance Advisor was also run. The new shadow tables have INFO-level unindexed-FK findings. With four rule rows and 190 candidate-classification rows at closure, these are recorded as non-blocking performance follow-up rather than an authority or correctness failure. No advisor result justifies changing Recommendation/Product/Offer authority in this closure.

## Exact merged-main / Production runtime evidence

Exact merged-main SHA:

```text
78ad75a259196f75da29071b5c4f0a3ab71ede21
```

Merged-main verification on that SHA passed:

```text
DATA-TAXONOMY2 Candidate Manual Taxonomy Classification = SUCCESS
BEJEWELY Current Main Health = SUCCESS
G3A controlled probe contract = SUCCESS
G3A deployed runtime authority probe = SUCCESS
DATA-OFFER17 controlled Offer probe contract = SUCCESS
DATA-OFFER17 deployed controlled Offer RPC diagnostic = SUCCESS
```

Exact Vercel Production deployment:

```text
deployment = dpl_9kBGM7V3ewYWEwUQJXyXtusHC6rp
url = k-beauty-1wh9it3j6-johnny-self.vercel.app
state = READY
target = production
GitHub SHA = 78ad75a259196f75da29071b5c4f0a3ab71ede21
branch = main
```

The deployed recommendation-admission authority probe and controlled Offer diagnostic both remained green on the exact merged SHA after the taxonomy reconciliation code merge.

## Acceptance disposition

```text
candidate raw category → shadow registry classification = PASS
current four Production raw categories → exact active rules = PASS
manual reviewed legacy category/form → exact legacy projection = PASS
unknown/unmapped raw category → unresolved fail-closed = PASS
reserved registry term → reserved_shadow, non-admissible = PASS
Product writes from taxonomy classification = 0
Recommendation semantic writes = 0
legacy promotion authority unchanged = PASS
Recommendation runtime unchanged = PASS
Product Fact authority unchanged = PASS
Offer authority unchanged = PASS
RLS / table privilege boundary = PASS
bounded function EXECUTE boundary = PASS
Production migration applied = true
Production readback = PASS
security advisor review = PASS WITH NON-BLOCKING PRE-EXISTING/INFO FINDINGS
performance advisor review = PASS WITH NON-BLOCKING INFO FINDINGS
exact merged-main runtime probes = PASS
```

DATA-TAXONOMY2 is ready for issue closure.

The next authority gate remains a **separate exact-equivalence decision** before any Recommendation runtime consumer may read the shadow taxonomy. This closure does not authorize or perform that cutover.
