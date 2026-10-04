# V2.1-ADMISSION-G4-F1-D2 — Production Migration Apply Closeout

## Decision

`V21_ADMISSION_G4_F1_D2_PRODUCTION_MIGRATION_APPLIED_PASS`

The G4-F1 category-authority infrastructure migration is now deployed in Production.

## Applied migration

Repository source:

`supabase/migrations/20261003160200_v21_admission_g4_f1_category_authority_v1.sql`

Production migration history:

```text
version = 20261004122609
name    = v21_admission_g4_f1_category_authority_v1
```

## Deployed objects

- `public.recommendation_category_authority_reviews`
- `admin_register_recommendation_category_authority_review_v1(uuid,text,jsonb)`
- `read_recommendation_category_authority_v1(uuid)`

## Production semantic state

Infrastructure deployment created **zero reviewed category grants**.

FATION remains:

```text
products.category          = NULL
taxonomy                   = shadow / shadow_only
assignment snapshot digest = eaed6cb9dd58b0f1e08bc5b35da817a72887b81ee497e0d144fcb5018b108d39
reviewed category rows      = 0
```

The protected reader was executed under the real `recommendation_admission_runtime` role via rollback-only role switching and returned:

```json
{
  "read_contract_version": "recommendation-category-authority-read-v1",
  "status": "NO_AUTHORITY",
  "reason": "CURRENT_CATEGORY_REVIEW_MISSING"
}
```

Therefore infrastructure exists, but **Recommendation category authority is still absent**.

## ACL boundary

### Runtime

`recommendation_admission_runtime`:

- no ledger SELECT
- no taxonomy-assignment SELECT
- no taxonomy-version SELECT
- no writer EXECUTE
- protected reader EXECUTE allowed

### service_role

- no direct ledger SELECT/INSERT
- Admin writer EXECUTE allowed
- protected reader EXECUTE denied

### public / anon / authenticated

Neither G4-F1 SECURITY DEFINER function is executable by public, anon, or authenticated roles.

## Reader-owner transfer

The protected reader owner is:

`recommendation_admission_reader_owner`

Post-apply verification:

```text
postgres SET ROLE capability after migration = false
temporary postgres-grant residue             = 0
base supabase_admin membership count          = 1
base membership ADMIN                         = true
base membership INHERIT                       = false
base membership SET                           = false
```

The temporary PostgreSQL 17 owner-transfer privilege left no residue.

## RLS

Ledger RLS is enabled.

Policies:

- ledger: `g4_f1_admission_reader_category_review_select_v1`
- taxonomy assignments: `data_ai29c_d5c_admission_reader_taxonomy_select_v1`
- taxonomy version: `g4_f1_admission_reader_taxonomy_version_select_v1`

The taxonomy reader policy remains a single exact four-Product union: the existing three D5C canaries plus FATION.

## Advisor delta

### Security

```text
rls_enabled_no_policy                         71 -> 70
authenticated_security_definer_function       2 -> 2
new G4-specific security warnings              0
```

### Performance

```text
unindexed_foreign_keys                       104 -> 104
multiple_permissive_policies                   1 -> 1
unused_index                                  30 -> 35
```

The five new unused-index INFO results are expected immediately after deploying an empty ledger and are not an authority/security blocker.

No G4 object appears in security advisor findings.

## Failed-apply recovery

Three earlier D2 apply attempts failed before the final successful deployment:

1. malformed anonymous DO delimiter;
2. PostgreSQL 17 owner transfer without SET-role capability;
3. use of `pg_has_role(..., 'USAGE')` instead of `'SET'`.

Every failed attempt was transactionally rolled back and verified to leave:

- no G4 object;
- no migration-history row;
- no temporary membership residue.

## Authority closure

D2 does **not** create semantic authority.

```text
reviewed category grant = NOT CREATED
products.category       = UNCHANGED
taxonomy assignment     = UNCHANGED
Product Fact            = UNCHANGED
G3 runtime wiring       = UNCHANGED
Recommendation admission= UNCHANGED
cutover authorization   = FALSE
```

## Next gate

`V2.1-ADMISSION-G4-F1-D3_FATION_CATEGORY_AUTHORITY_REVIEW_PREFLIGHT`

D3 must review the exact FATION taxonomy binding and reviewer identity before any reviewed category grant write occurs.
