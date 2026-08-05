# Admin Product Hosted Activation Rollback Runbook v1

## Status and scope

This is a reviewed operational runbook, not an executable migration. Do not run it blindly.

It covers only the Admin Product activation chain:

1. `20260730152900_admin_access_foundation.sql`
2. `20260804233000_admin_product_candidate_reviews.sql`
3. `20260804233100_admin_product_candidate_reviews_hardening.sql`
4. `20260804233200_admin_product_candidate_reviews_security_hardening.sql`
5. `20260804233300_admin_product_review_import_confirm.sql`

Production execution, migration-history repair, administrator mutation, and data compensation require separate explicit approval.

## Rollback classes

| Class | Purpose | Data handling |
| --- | --- | --- |
| R0 | Emergency disable | Preserve all schema and evidence |
| R1 | Remove callable Admin Product routines | Preserve ledgers, audit, and memberships |
| R2 | Full pre-data teardown | Allowed only when every Admin table is empty |
| R3 | Post-confirm data compensation | Case-specific; preserve historical evidence |

## Mandatory preflight

Record the following before any rollback action:

- project ref and environment
- executing operator
- application deployment SHA
- database migration ledger
- row counts for all four Admin tables
- function privilege snapshot
- reason and incident/change ticket
- UTC and Asia/Seoul timestamps

After activation, obtain row counts with a read-only query:

```sql
select jsonb_build_object(
  'admin_memberships', (select count(*) from public.admin_memberships),
  'admin_audit_logs', (select count(*) from public.admin_audit_logs),
  'admin_product_review_confirmations',
    (select count(*) from public.admin_product_review_confirmations),
  'admin_product_review_import_confirmations',
    (select count(*) from public.admin_product_review_import_confirmations)
) as admin_activation_counts;
```

If one of these relations is unexpectedly absent, stop and reconcile the physical schema before changing migration history.

# R0 — Emergency disable

Use R0 first when the application must stop invoking Admin Product operations while retaining forensic and rollback evidence.

1. Disable or roll back the application routes that invoke Admin Product RPCs.
2. Revoke database execution from all runtime roles.
3. Verify all confirmation and lookup calls fail closed.
4. Do not delete ledgers, memberships, or audit events.

```sql
begin;

revoke all on function public.admin_confirm_product_review_import_batch(
  uuid, text, jsonb, text
) from public, anon, authenticated, service_role;

revoke all on function public.admin_get_product_review_import_confirmation(
  uuid, text, uuid, text
) from public, anon, authenticated, service_role;

revoke all on function public.admin_confirm_product_candidate_review(
  uuid, uuid, text, text, text, text, text, text, text
) from public, anon, authenticated, service_role;

revoke all on function public.admin_preflight_product_candidate_review(
  uuid, uuid, text, text
) from public, anon, authenticated, service_role;

revoke all on function public.admin_require_product_review_actor(
  uuid, text
) from public, anon, authenticated, service_role;

revoke all on function public.record_admin_audit_event(
  uuid, text, text, text, text, jsonb, jsonb, text, text, jsonb
) from public, anon, authenticated, service_role;

revoke all on function public.bootstrap_first_admin_owner(uuid)
  from public, anon, authenticated, service_role;

commit;
```

R0 is reversible by reapplying the reviewed least-privilege grants after the root cause is corrected and staging verification passes.

# R1 — Routine removal with evidence preservation

R1 removes callable Admin Product routines while preserving:

- `admin_memberships`
- `admin_audit_logs`
- `admin_product_review_confirmations`
- `admin_product_review_import_confirmations`

Run only after the application no longer references the routines.

```sql
begin;

-- Import confirmation entry points and helpers.
drop function if exists public.admin_confirm_product_review_import_batch(
  uuid, text, jsonb, text
);
drop function if exists public.admin_get_product_review_import_confirmation(
  uuid, text, uuid, text
);
drop function if exists public.admin_product_review_sha256_json(jsonb);
drop function if exists public.admin_product_review_canonical_json(jsonb);

-- Current single-review entry points.
drop function if exists public.admin_confirm_product_candidate_review(
  uuid, uuid, text, text, text, text, text, text, text
);
drop function if exists public.admin_preflight_product_candidate_review(
  uuid, uuid, text, text
);

-- Internal one-shot predecessor implementations.
drop function if exists public.admin_confirm_product_candidate_review_unsafe_v1(
  uuid, uuid, text, text, text, text, text, text, text
);
drop function if exists public.admin_preflight_product_candidate_review_unsafe_v2(
  uuid, uuid, text, text
);
drop function if exists public.admin_preflight_product_candidate_review_unsafe_v1(
  uuid, uuid, text, text
);

-- Admin Product actor gate.
drop function if exists public.admin_require_product_review_actor(uuid, text);

-- Hardened audit wrapper and its private predecessor.
drop function if exists public.record_admin_audit_event(
  uuid, text, text, text, text, jsonb, jsonb, text, text, jsonb
);
drop function if exists public.record_admin_audit_event_unsafe_v1(
  uuid, text, text, text, text, jsonb, jsonb, text, text, jsonb
);
drop function if exists public.admin_audit_payload_has_forbidden_content(jsonb);

commit;
```

Do not run R1 when retained application code, policies, or scheduled jobs still depend on these functions.

# R2 — Full pre-data teardown

R2 is permitted only before any administrator bootstrap or Admin Product operation.

All four row counts must be exactly zero. The guard below aborts otherwise.

```sql
begin;

do $$
begin
  if (select count(*) from public.admin_memberships) <> 0
    or (select count(*) from public.admin_audit_logs) <> 0
    or (select count(*) from public.admin_product_review_confirmations) <> 0
    or (select count(*) from public.admin_product_review_import_confirmations) <> 0
  then
    raise exception 'admin_activation_teardown_blocked_nonempty_evidence';
  end if;
end $$;

-- Import layer.
drop function if exists public.admin_confirm_product_review_import_batch(
  uuid, text, jsonb, text
);
drop function if exists public.admin_get_product_review_import_confirmation(
  uuid, text, uuid, text
);
drop function if exists public.admin_product_review_sha256_json(jsonb);
drop function if exists public.admin_product_review_canonical_json(jsonb);
drop table if exists public.admin_product_review_import_confirmations;

-- Single-review layer.
drop function if exists public.admin_confirm_product_candidate_review(
  uuid, uuid, text, text, text, text, text, text, text
);
drop function if exists public.admin_preflight_product_candidate_review(
  uuid, uuid, text, text
);
drop function if exists public.admin_confirm_product_candidate_review_unsafe_v1(
  uuid, uuid, text, text, text, text, text, text, text
);
drop function if exists public.admin_preflight_product_candidate_review_unsafe_v2(
  uuid, uuid, text, text
);
drop function if exists public.admin_preflight_product_candidate_review_unsafe_v1(
  uuid, uuid, text, text
);
drop function if exists public.admin_require_product_review_actor(uuid, text);
drop table if exists public.admin_product_review_confirmations;

-- Audit hardening and audit layer.
drop function if exists public.record_admin_audit_event(
  uuid, text, text, text, text, jsonb, jsonb, text, text, jsonb
);
drop function if exists public.record_admin_audit_event_unsafe_v1(
  uuid, text, text, text, text, jsonb, jsonb, text, text, jsonb
);
drop function if exists public.admin_audit_payload_has_forbidden_content(jsonb);

drop policy if exists "Owners can read admin audit logs"
  on public.admin_audit_logs;
drop policy if exists "Admins can read own active membership"
  on public.admin_memberships;

drop function if exists public.bootstrap_first_admin_owner(uuid);
drop function if exists public.admin_has_capability(text);
drop function if exists public.get_current_admin_role();
drop function if exists public.admin_role_capabilities(text);

drop table if exists public.admin_audit_logs;
drop table if exists public.admin_memberships;

commit;
```

Do not drop the `pgcrypto` extension. It is a shared platform dependency and existed before this activation chain.

After R2, verify the physical schema is absent. Migration-history repair may be considered only after that verification and must use the reviewed Supabase migration-history workflow. History repair is not a substitute for schema rollback.

# R3 — Post-confirm data compensation

R3 applies when any of the following exists:

- an administrator membership
- an audit event
- a single-review confirmation
- a batch confirmation
- a product inserted or merged through a confirmation
- candidate or review-queue state changed through a confirmation

There is no safe generic SQL teardown for this state.

## Required evidence sources

- `admin_product_review_confirmations.result`
- `admin_product_review_import_confirmations.result`
- `admin_audit_logs.before_value`
- `admin_audit_logs.after_value`
- current `product_candidates`
- current `candidate_promotion_reviews`
- current `products`
- downstream foreign-key and application references to affected products

## Compensation rules

### Inserted product

Delete only when all conditions are proved:

- the confirmation created the product rather than merging it
- no recommendation, report, ranking, saved state, or other downstream record references it
- no later operation modified it
- candidate and review state can be restored consistently

Otherwise deactivate or quarantine it through a new reviewed mechanism rather than deleting it.

### Merged product

Never reverse a merge with a generic delete. Construct a field-level compensating update from pre-confirm evidence and prove that no later update would be overwritten.

### Candidate and review queue

Restore only the fields owned by the failed operation. Reconcile:

- review status
- reviewed timestamp and actor
- review notes
- matched and duplicate product IDs
- approved product ID
- queue status and note
- promotion payload fields introduced by import confirmation

Append-only notes and audit history must not be erased merely to make the state appear clean.

### Audit evidence

Do not delete historical audit or confirmation rows. Record the compensation as a new audit event with:

- original request and batch IDs
- incident/change ticket
- affected candidate and product IDs
- before and after values
- operator
- reason
- compensation request ID

R3 is a protected production data operation and requires a separate reviewed plan and explicit approval.

# Post-action verification

After any rollback class:

1. Confirm browser roles cannot execute Admin Product RPCs.
2. Confirm service-role grants match the intended disabled or restored state.
3. Run Supabase security advisors.
4. Verify migration history against the physical schema.
5. Verify the application fails closed when Admin Product operations are unavailable.
6. Preserve query output, timestamps, operator identity, and change-ticket references.
7. Do not resume activation until staging rehearsal passes again.
