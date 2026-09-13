# DATA-TAXONOMY3 — Product taxonomy exact-equivalence Production closure

## Repository

- issue: #474
- implementation PR: #475
- exact PR head: `679aaf1a0c8d3606ab538e9d93937d281332018b`
- squash merge SHA: `b12bbb089b943d3dfcaae77681f7cc2522a76d57`

Exact-head CI on PR #475:

- BEJEWELY Current Main Health: SUCCESS — run `34762648062`
- PIE Prospective Shadow: SUCCESS — run `34762648239`

Merged-main verification on `b12bbb089b943d3dfcaae77681f7cc2522a76d57`:

- BEJEWELY Current Main Health: SUCCESS — run `34762739139`
- V2.1 ADMISSION G3A PF Authority Read: SUCCESS — run `34762739205`
- DATA-OFFER17 Controlled Offer RPC Diagnostic: SUCCESS — run `34762739263`

## Production migration

Applied migration:

```text
data_taxonomy3_product_exact_equivalence_v1
```

Remote migration version observed after application:

```text
20260913233044
```

Created read-only view:

```text
public.catalog_taxonomy_product_exact_equivalence_v1
security_invoker = true
service_role = SELECT only
anon/authenticated = no grant
```

## Production exact-equivalence readback

```text
view rows = 165
exact_equivalent = 165
not exact_equivalent = 0
projection_present = 165
category_equivalent = 165
form_equivalent = 165
non-active assigned term references = 0
```

All 165 rows remain:

```text
taxonomy_lifecycle_state = shadow
taxonomy_authority_mode = shadow_only
assignment_state = shadow
```

Catalog/Product state after migration:

```text
Products = 165
Product taxonomy assignments = 165
candidate taxonomy classifications = 190
Product Fact Current = 58
Product full-row digest MD5 = c7ec481493af9075f891d4a089b53302
```

Protected legacy authority definitions remain unchanged:

```text
map_product_category(text)                            364282a34496ed047c74bf7d354d443f
promote_product_candidate(uuid,text)                 88096291b54e626615dc81ce679baa79
admin_enqueue_product_candidate_structural_review_v1 6363c54ab4cfc2a4662ec489218fd843
admin_confirm_product_review_import_batch            f228d90b5dcd85e3a7dbf7163d60fa46
```

## Advisors

Supabase security and performance advisors were executed after Production application.

No new DATA-TAXONOMY3-specific security warning was reported for the audit view. Existing project-wide warnings remain. Performance advisor findings remain existing FK/index and RLS-policy optimization items; the T3 audit view introduces no write-path or Recommendation authority.

References:
- Supabase RLS no-policy advisor: https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy
- Supabase unindexed-FK advisor: https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys

## Closure disposition

```text
Products = assignments = exact-equivalent rows = 165
missing Product assignment = 0
missing active projection = 0
category mismatch = 0
form mismatch = 0
non-active assigned term reference = 0
Recommendation runtime cutover = false
Product writes = 0
Product Fact writes = 0
Offer writes = 0
```

DATA-TAXONOMY3 establishes the exact-equivalence gate only. It does not authorize taxonomy runtime cutover. The next track is DATA-TAXONOMY4 Recommendation shadow parity.
