# TRUST Phase 8H-2B — Governed Relocation DB Implementation Blueprint v1

## 1. Status

This is the implementation-ready blueprint for the deployable Phase 8H-2B migration.

It is deliberately **not** a migration file. The deployable SQL must first be created through the normal Supabase CLI migration workflow so the repository filename/version is not invented and can remain identical to Production migration provenance.

Current frozen request contract:

`trust-phase8h-governed-relocation-confirmation-request-v1`

Current frozen RPC:

`public.admin_confirm_trust_official_source_relocation_v1(p_actor_user_id uuid, p_request_id text, p_payload jsonb) returns jsonb`

## 2. Production compatibility readback

The current Production schema supports the design without modifying existing TRUST tables.

### product_source_bindings

Required existing fields are present:

- `binding_id uuid`
- `product_id uuid`
- `source_name text`
- `external_type text`
- `external_id text`
- `source_url text`
- `market_code text`
- `locale text`
- `binding_state text` with `resolved|retired`
- `binding_method text`
- `product_scope_state text`
- `first_observed_at`
- `last_observed_at`
- `created_at`
- `updated_at`

The existing partial unique index protects resolved source identity:

`(source_name, external_type, external_id) where binding_state='resolved'`.

### trust_official_source_binding_reviews

The current review table already stores the exact governed lineage needed for replacement review creation:

- binding/product/subject IDs
- subject/source market
- scope relation
- variant key
- formulation revision key
- source kind
- actor/request
- `review_version='trust-official-source-review-v1'`

### Existing Admin boundary

`public.admin_register_trust_official_source_binding_v1` confirms the adjacent conventions that Phase 8H-2B must preserve:

- capability `admin.products.review`
- `binding_method='trust_official_source_review_v1'`
- `product_scope_state='product'`
- `review_version='trust-official-source-review-v1'`
- official URL external ID = `official-url-sha256:<sha256(url)>`
- Admin audit through `public.record_admin_audit_event`

The relocation RPC must not call the Phase 7-C registration RPC because the replacement locator intentionally has no new governed Evidence row yet.

## 3. New immutable ledger

Create:

`public.trust_official_source_relocations`

Required columns from the frozen contract remain mandatory. The deployable implementation should additionally freeze the confirmation-time snapshots:

- `replacement_external_id text not null`
- `prestate_snapshot jsonb not null`
- `replacement_snapshot jsonb not null`

These snapshots do not become semantic authority. They preserve the exact operational state that was confirmed so later retirement of the replacement binding cannot erase relocation provenance.

Required uniqueness:

- unique `old_binding_id`
- unique `relocation_plan_digest`

Required checks:

- old/replacement locator are HTTPS, non-empty, <= 2048, and distinct
- replacement external ID matches `^official-url-sha256:[0-9a-f]{64}$`
- qualification/prestate/plan digests are lowercase SHA-256
- `qualification_contract='trust-phase8h-source-identity-qualification-v1'`
- `relocation_version='trust-official-source-relocation-v1'`
- `result='confirmed'`
- request ID follows the existing Admin boundary length discipline

## 4. Ledger security

The migration must:

1. create a trigger function with `set search_path=''`
2. attach a `BEFORE UPDATE OR DELETE` trigger that always raises
3. enable RLS
4. revoke all table privileges from `PUBLIC`, `anon`, `authenticated`, and `service_role`
5. grant only `SELECT` on the ledger to `service_role`
6. keep INSERT authority inside the SECURITY DEFINER Admin RPC

No RLS policy is required for public/authenticated access because those roles have no table grant and no direct ledger access is intended.

## 5. Canonical digest helper

The DB must reproduce the exact JavaScript digest contract used by Phase 8H-2A:

`SHA256(JSON.stringify(stableValue(value)))`

A private/internal SQL helper must recursively serialize JSONB with:

- object keys sorted lexicographically
- no whitespace between JSON tokens
- array order preserved
- scalar JSON encoding preserved

The helper must be `IMMUTABLE`, use an empty search path, and have direct EXECUTE revoked from API roles.

It is used only to recompute:

1. the Phase 8H prestate digest
2. the Phase 8H relocation-plan digest

Derma Factory acceptance values remain:

- prestate: `70aae88369b09d87e9a9a7153ad04af662f7fc069445204f2eafee0b6d5a745b`
- plan: `9cc3c864fdeea7dde6545b607f33a30654284e6d9fef86b958e07eb012805567`
- replacement external ID: `official-url-sha256:fd53d973c3e55d592b6244c2770c715196991b3105d1bfd1d88c656eab6b29d9`

The migration is not deployable until a DB-side canary reproduces all three values exactly.

## 6. RPC validation boundary

The Admin RPC must reject anything except the exact request shape.

Required top-level fields:

- contract
- expected_prestate_digest
- relocation_plan_digest
- qualification_contract
- qualification_digest
- historical_source_id
- product_id
- subject_id
- old_binding_id
- old_review_id
- old_locator
- replacement
- authority
- mutation_scope
- forbidden_mutations

Unknown extra top-level keys fail closed.

The replacement object must contain exactly:

- source_name
- external_type
- external_id
- source_url
- market_code
- locale

The RPC independently recomputes the replacement external ID from the replacement URL and rejects any mismatch.

## 7. Transaction algorithm

The deployable function must execute in this order:

1. validate Admin actor with `public.admin_require_product_review_actor(..., 'admin.products.review')`
2. exact-validate request and replacement payload
3. recompute replacement URL SHA-256
4. acquire deterministic transaction advisory lock on relocation plan
5. check existing ledger row for exact idempotent replay
6. reject conflicting prior relocation of the old binding
7. lock old `product_source_bindings` row `FOR UPDATE`
8. re-read old review
9. re-read historical `product_evidence_sources`
10. require exactly one historical exact source-subject binding
11. re-read current resolved governed Subject
12. verify old review/binding/Subject scope, variant, formulation, market, locale, source kind and method
13. reconstruct canonical prestate and recompute `prestate_digest`
14. reconstruct the exact Phase 8H-2A result preimage and recompute `relocation_plan_digest`
15. create or exact-reuse replacement `product_source_bindings`
16. create or exact-reuse replacement `trust_official_source_binding_reviews`
17. retire old binding only after replacement review exists
18. append immutable relocation ledger
19. write Admin audit event
20. return confirmed IDs

Any error rolls back the entire transaction.

## 8. Idempotency

A replay is idempotent only when the existing ledger row matches:

- actor
- request ID
- Product/Subject
- historical source
- old binding/review
- old/replacement locators
- replacement external ID
- qualification contract/digest
- prestate digest
- relocation plan digest
- relocation version/result

Then return the existing IDs with `idempotent=true`.

A reused old binding with a different plan or a reused plan with different lineage is a hard conflict.

## 9. Retirement semantics

The old binding update is intentionally minimal:

- `binding_state: resolved -> retired`
- `updated_at=now()`

Do **not** modify:

- old `source_url`
- old `external_id`
- `first_observed_at`
- `last_observed_at`

Admin confirmation is a governance event, not a new source observation.

## 10. Forbidden writes

The migration/RPC must contain no INSERT/UPDATE/DELETE path for:

- `product_evidence_sources`
- `product_evidence_source_subject_bindings`
- Product Fact rows
- Product Fact Current
- Product Fact confirmations
- recommendation authority
- recommendation logs
- Phase 8C verification transitions
- Phase 8D research bridges

Phase 8H-2B changes only operational official-source authority and its immutable relocation provenance.

## 11. Derma Factory post-confirmation acceptance

After the real migration is deployed and an authorized Admin confirmation is executed:

- replacement binding count = 1 and state = resolved
- replacement review count = 1
- old binding state = retired
- old review remains unchanged
- relocation ledger count = 1
- historical Evidence Source locator remains the old www URL
- historical Evidence content digest remains unchanged
- historical source-subject binding remains unchanged
- Product Fact/Current/confirmation/recommendation counts and semantics remain unchanged
- second identical RPC call returns `idempotent=true` without creating rows
- invalid prestate/plan/external-ID requests make zero writes

## 12. Deployment gate

The repository currently must contain **zero** deployable Phase 8H-2B migration files.

The next deployable step is permitted only after a real Supabase CLI environment runs:

`supabase migration new trust_phase8h_governed_official_source_relocation_v1`

The generated filename/version becomes authoritative. Only then may the reviewed SQL be placed under `supabase/migrations/`, tested, applied to Production, and reconciled against `supabase migration list`.

Do not invent or hand-author the migration timestamp.
