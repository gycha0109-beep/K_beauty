begin;

-- DATA-AI29C-WATER-C-R1
--
-- A concurrent WATER-C confirmation exposed that Product Fact definitions with
-- cardinality=one could temporarily hold two different Current propositions for
-- the same Subject / registry / fact_key. Generic confirmation serializes only
-- by proposition_key, so two distinct propositions do not block each other.
--
-- Enforce the invariant at the Product Fact Current storage boundary. The
-- semantic slot is serialized by Subject + registry + fact_key. A second
-- proposition is rejected unless it is the explicit Phase 8F governed
-- revalidation-replacement path, where the old assignment is already
-- re_review_required and the new assignment is ready_for_confirm.

create or replace function public.product_fact_current_cardinality_guard_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_registry_version text;
  v_fact_key text;
  v_cardinality text;
  v_conflict_count integer := 0;
  v_replacement_allowed boolean := false;
begin
  select
    fi.registry_version,
    fi.fact_key
  into
    v_registry_version,
    v_fact_key
  from public.product_fact_instances as fi
  where fi.fact_instance_id = new.fact_instance_id
    and fi.subject_id = new.subject_id
    and fi.proposition_key = new.proposition_key;

  if not found then
    raise exception 'product_fact_current_fact_identity_invalid'
      using errcode = '23514';
  end if;

  select coalesce(definition.definition ->> 'cardinality', 'one')
  into v_cardinality
  from public.product_fact_definition_snapshots as definition
  where definition.registry_version = v_registry_version
    and definition.fact_key = v_fact_key
    and definition.deprecated = false;

  if not found then
    raise exception 'product_fact_current_definition_missing'
      using errcode = 'P0002';
  end if;

  if v_cardinality <> 'one' then
    return new;
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(
      'bejewely_product_fact_current_cardinality:' ||
      new.subject_id::text || ':' ||
      v_registry_version || ':' ||
      v_fact_key,
      0
    )
  );

  select count(*)::integer
  into v_conflict_count
  from public.product_fact_current as current_row
  join public.product_fact_instances as current_fact
    on current_fact.fact_instance_id = current_row.fact_instance_id
  where current_row.subject_id = new.subject_id
    and current_fact.registry_version = v_registry_version
    and current_fact.fact_key = v_fact_key
    and current_row.proposition_key <> new.proposition_key;

  if v_conflict_count = 0 then
    return new;
  end if;

  if v_conflict_count > 1 then
    raise exception 'product_fact_current_cardinality_one_preexisting_conflict'
      using errcode = '23514';
  end if;

  -- Explicit governed replacement is the only bounded exception. The new
  -- proposition must be in the Phase 8F replacement review policy and ready
  -- for confirm, while the conflicting old proposition must already be marked
  -- re_review_required. The replacement function removes the old Current row
  -- in the same transaction after the new confirmation succeeds.
  select (
    exists (
      select 1
      from public.product_fact_review_assignments as new_assignment
      where new_assignment.subject_id = new.subject_id
        and new_assignment.registry_version = v_registry_version
        and new_assignment.fact_key = v_fact_key
        and new_assignment.proposition_key = new.proposition_key
        and new_assignment.operational_state = 'ready_for_confirm'
        and new_assignment.review_policy_version =
          'trust-phase8f-revalidation-replacement-v1'
    )
    and exists (
      select 1
      from public.product_fact_current as current_row
      join public.product_fact_instances as current_fact
        on current_fact.fact_instance_id = current_row.fact_instance_id
      join public.product_fact_review_assignments as old_assignment
        on old_assignment.subject_id = current_row.subject_id
       and old_assignment.registry_version = current_fact.registry_version
       and old_assignment.fact_key = current_fact.fact_key
       and old_assignment.proposition_key = current_row.proposition_key
      where current_row.subject_id = new.subject_id
        and current_fact.registry_version = v_registry_version
        and current_fact.fact_key = v_fact_key
        and current_row.proposition_key <> new.proposition_key
        and old_assignment.operational_state = 're_review_required'
    )
  )
  into v_replacement_allowed;

  if not coalesce(v_replacement_allowed, false) then
    raise exception 'product_fact_current_cardinality_one_conflict'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all on function public.product_fact_current_cardinality_guard_v1()
  from public, anon, authenticated, service_role;

drop trigger if exists product_fact_current_cardinality_guard_v1
  on public.product_fact_current;

create trigger product_fact_current_cardinality_guard_v1
before insert or update of fact_instance_id, subject_id, proposition_key
on public.product_fact_current
for each row
execute function public.product_fact_current_cardinality_guard_v1();

comment on function public.product_fact_current_cardinality_guard_v1() is
  'Serializes cardinality-one Product Fact Current semantic slots and rejects parallel different-proposition confirmation except explicit governed Phase 8F replacement.';

commit;
