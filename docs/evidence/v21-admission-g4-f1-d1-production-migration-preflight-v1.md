# V2.1-ADMISSION-G4-F1-D1 — Production Migration Preflight

## Decision

`V21_ADMISSION_G4_F1_D1_PRODUCTION_MIGRATION_PREFLIGHT_PASS`

This was a read-only Production preflight. No schema or business-data write was executed.

## Production state

The G4-F1 migration is not present in Production migration history.

The following objects do not exist yet:

- `recommendation_category_authority_reviews`
- `admin_register_recommendation_category_authority_review_v1`
- `read_recommendation_category_authority_v1`

FATION remains exactly on the frozen taxonomy snapshot:

```text
products.category          = NULL
taxonomy_version           = catalog-taxonomy-v1
category                   = treatment
assignment_state           = shadow
assignment_method          = source_classification
legacy_projection_key      = NULL
candidate_id               = 6a9627b6-a5da-458f-84f7-3a40f91453be
source_rule                = catalog-taxonomy-v1:source:hwahae:treatment
assignment snapshot digest = eaed6cb9dd58b0f1e08bc5b35da817a72887b81ee497e0d144fcb5018b108d39
taxonomy lifecycle         = shadow
taxonomy authority         = shadow_only
```

## Security prestate

`recommendation_admission_runtime` remains:

- LOGIN
- NOINHERIT
- BYPASSRLS=false
- no raw taxonomy SELECT
- no raw taxonomy-version SELECT

`recommendation_admission_reader_owner` remains:

- NOLOGIN
- NOINHERIT
- BYPASSRLS=false
- no CREATE on public schema

The existing Product Fact protected reader remains owned by that reader-owner.

## D1/D2 correction 1 — preserve existing role membership and satisfy PostgreSQL 17 SET-role semantics

Production has the following base membership:

```text
member       = postgres
role         = recommendation_admission_reader_owner
grantor      = supabase_admin
admin_option = true
inherit      = false
set_option   = false
```

PostgreSQL 17 requires the current session user to have **SET TRUE** on the destination role before `ALTER ... OWNER TO`. Mere membership is insufficient.

The migration therefore:

1. verifies the existing `supabase_admin` grant is exactly `ADMIN=true / INHERIT=false / SET=false`;
2. creates a separate, grantor-scoped temporary grant from `postgres` to itself with `INHERIT=false / SET=true / ADMIN=false`;
3. verifies SET ROLE is temporarily available;
4. grants temporary schema `CREATE` to the reader-owner;
5. transfers the reader function owner;
6. revokes temporary schema `CREATE`;
7. revokes **only the postgres-grantor temporary membership** using `GRANTED BY CURRENT_USER`;
8. verifies the original `supabase_admin` membership remains unchanged and no postgres-grantor membership residue exists.

A rollback-only Production probe confirmed that the temporary grant/revoke leaves the original membership intact.

## D1 correction 2 — one bounded taxonomy reader policy

Production currently has one Recommendation reader SELECT policy on taxonomy assignments for the exact three D5C sunscreen products.

Creating a second permissive policy for FATION would add a same-role/action permissive-policy pair.

The migration now replaces the policy definition under the **same policy name** with the exact union:

```text
existing D5C product 1
existing D5C product 2
existing D5C product 3
FATION
```

Total scope = exactly four Product IDs.

No `USING (true)`, category-wide, or dynamic Product predicate is introduced.

## D1 correction 3 — foreign-key indexes

The new ledger adds full indexes for:

- product_id
- candidate_id
- supersedes_review_id
- reviewed_by

This prevents the migration from deliberately introducing new unindexed-FK debt.

## Advisor baseline

Before apply:

```text
security:
  rls_enabled_no_policy                         71 INFO
  authenticated_security_definer_function       2 WARN
  G4-specific finding                           0

performance:
  unindexed_foreign_keys                       104 INFO
  multiple_permissive_policies                   1 WARN
  unused_index                                  30 INFO
```

The existing findings are baseline debt and are not caused by G4.

After apply, the acceptance condition is **no new G4 security warning**, no new taxonomy-reader multiple-policy warning, and no new ledger unindexed-FK finding.

An unused-index INFO finding may appear immediately because the new ledger begins empty; that is not an authority or security blocker.

## Expected state immediately after migration

The migration itself must create no reviewed grant.

Therefore the protected reader must initially return:

```text
status = NO_AUTHORITY
reason = CURRENT_CATEGORY_REVIEW_MISSING
```

and all of these must remain unchanged:

- `products.category = NULL`
- taxonomy assignment
- taxonomy global lifecycle/authority
- Product Fact
- G3 runtime wiring
- Recommendation admission

## D1 authority closure

```text
Production migration apply = NOT AUTHORIZED
reviewed grant write        = NOT AUTHORIZED
G3 runtime wiring           = NOT AUTHORIZED
Recommendation cutover      = NOT AUTHORIZED
```

Next gate:

`V2.1-ADMISSION-G4-F1-D2_PRODUCTION_MIGRATION_APPLY`
