# TRUST Phase 8H-2B — Governed Official Source Relocation Confirmation Contract v1

## 1. Purpose

Phase 8H-2B is the explicit Admin write boundary that may turn a Phase 8H-2A ready preflight into a governed official-source relocation.

This contract freezes the database behavior before a migration is generated. It does not itself deploy schema or mutate Production.

## 2. Request contract

Request contract:

`trust-phase8h-governed-relocation-confirmation-request-v1`

The request is valid only when it was derived from a Phase 8H-2A result with:

- `status=READY_FOR_ADMIN_RELOCATION_CONFIRMATION`
- `authority=PREFLIGHT_ONLY_REQUIRES_EXPLICIT_ADMIN_CONFIRMATION`
- `mutation_policy=READ_ONLY_PREFLIGHT_NO_PRODUCTION_WRITE`
- exact 64-character qualification, prestate, and relocation-plan digests
- exact historical Source, Product, Subject, old binding/review, and qualified replacement locator

The request builder is deliberately database-free. The database function must independently revalidate every mutable prestate dimension.

## 3. Frozen database objects

The migration must create one append-only ledger table:

`public.trust_official_source_relocations`

Minimum columns:

- `relocation_id uuid primary key default gen_random_uuid()`
- `product_id uuid not null references public.products(id) on delete restrict`
- `subject_id uuid not null references public.product_fact_subjects(subject_id) on delete restrict`
- `historical_source_id uuid not null references public.product_evidence_sources(source_id) on delete restrict`
- `old_binding_id uuid not null references public.product_source_bindings(binding_id) on delete restrict`
- `old_review_id uuid not null references public.trust_official_source_binding_reviews(review_id) on delete restrict`
- `replacement_binding_id uuid not null references public.product_source_bindings(binding_id) on delete restrict`
- `replacement_review_id uuid not null references public.trust_official_source_binding_reviews(review_id) on delete restrict`
- `old_locator text not null`
- `replacement_locator text not null`
- `qualification_contract text not null`
- `qualification_digest text not null`
- `prestate_digest text not null`
- `relocation_plan_digest text not null`
- `actor_user_id uuid not null`
- `request_id text not null`
- `relocation_version text not null`
- `result text not null`
- `created_at timestamptz not null default now()`

Required invariants:

- a BEFORE UPDATE OR DELETE trigger rejects mutation even for privileged callers
- RLS is enabled on the ledger
- revoke all table privileges from `PUBLIC`, `anon`, `authenticated`, and `service_role`
- grant `SELECT` only to `service_role`; inserts occur only inside the privileged Admin confirmation function
- `relocation_version='trust-official-source-relocation-v1'`
- `result='confirmed'`
- qualification/prestate/plan digests are lowercase SHA-256
- old and replacement locators are HTTPS and distinct
- one old binding can be confirmed only once
- one relocation plan digest maps to only one ledger row
- replay of the same confirmed request is idempotent
- conflicting reuse fails closed

## 4. Admin RPC boundary

The migration must create:

`public.admin_confirm_trust_official_source_relocation_v1(p_actor_user_id uuid, p_request_id text, p_payload jsonb) returns jsonb`

Security contract:

- requires `admin.products.review` through the existing Admin actor boundary
- `SECURITY DEFINER`
- pinned or empty `search_path`; all privileged relations schema-qualified
- revoke EXECUTE from `PUBLIC`, `anon`, and `authenticated`
- grant only to the established server-side role used by adjacent TRUST Admin boundaries
- never trust a digest by itself; re-read and compare the exact database prestate

The current Supabase security guidance still requires explicit RLS/grants for exposed-schema tables and warns that SECURITY DEFINER functions must not retain default PUBLIC/authenticated EXECUTE.

## 5. Transaction order

One transaction must perform the following order:

1. Require the Admin actor and validate exact payload shape.
2. Acquire a deterministic transaction advisory lock for the relocation plan.
3. Lock and re-read the old `product_source_bindings` row.
4. Re-read the old official-source review, historical Evidence Source, historical exact source-subject binding, and current governed Subject.
5. Recompute the same prestate digest contract and reject stale input.
6. Recompute replacement `official-url-sha256:<sha256(url)>` and reject mismatch.
7. Create or reuse the replacement `product_source_bindings` row.
8. Preserve `binding_method='trust_official_source_review_v1'` and `product_scope_state='product'`.
9. Create or reuse the replacement `trust_official_source_binding_reviews` row with the exact Subject/market/variant/formulation lineage.
10. Retire the old binding only after the replacement review exists.
11. Append the immutable relocation ledger row.
12. Record an Admin audit event.
13. Return confirmed/idempotent status plus old/replacement binding and review IDs.

Any failure rolls back the entire transaction.

## 6. Historical Evidence immutability

The confirmation function must never update or replace:

- `product_evidence_sources.canonical_locator`
- historical Evidence Source content digest
- historical Evidence Source Subject binding
- Product Fact rows
- Product Fact Current pointer
- Product Fact confirmation
- recommendation authority
- recommendation logs

Relocation changes the controlled operational source binding only. It does not rewrite the provenance that supported historical Evidence.

## 7. Derma Factory frozen canary

Expected Phase 8H-2A prestate digest:

`70aae88369b09d87e9a9a7153ad04af662f7fc069445204f2eafee0b6d5a745b`

Expected relocation plan digest:

`9cc3c864fdeea7dde6545b607f33a30654284e6d9fef86b958e07eb012805567`

Qualified replacement locator:

`https://dermafactory.net/products/niacinamide-20-serum-30ml?variant=46478659616933`

Correct derived replacement external identity:

`official-url-sha256:fd53d973c3e55d592b6244c2770c715196991b3105d1bfd1d88c656eab6b29d9`

The earlier Phase 8H-2A merged-main log is the executable source of truth for this hash.

## 8. Revalidation remains separate

8H-2B only relocates the controlled official source.

It must not synthesize a Phase 8G verification or weaken the `COMPARABLE` gate. A later 8H-3 handoff must revalidate from the replacement official source:

- same semantic proposition -> Phase 8E reaffirmation path
- changed semantic proposition -> Phase 8F replacement path

## 9. Migration provenance rule

This contract intentionally does not create a migration file.

The deployable migration must be generated through the normal Supabase CLI migration workflow before SQL is committed under `supabase/migrations/`. Do not invent or hand-author a migration timestamp. Production mutation is prohibited until repository/Production migration provenance can be kept exact.
