# TRUST Phase 8H-2A — Governed Official Source Relocation Preflight Contract v1

## 1. Purpose

Phase 8H-2A turns a Phase 8H-1 `QUALIFIED_EXACT` result into a deterministic, read-only Admin relocation preflight.

It answers one question:

> Is the exact governed historical source lineage, reviewed official binding, Product/Subject scope, and qualified replacement locator still coherent enough to permit an explicit relocation confirmation?

This slice does not relocate anything. It produces a stale-detectable prestate digest and relocation plan digest for the later database confirmation boundary.

## 2. Contract

Implementation contract:

`trust-phase8h-governed-relocation-preflight-v1`

Successful status:

`READY_FOR_ADMIN_RELOCATION_CONFIRMATION`

Hold status:

`HOLD`

A successful preflight is not authority to mutate Product Fact, Current, Confirmation, Recommendation, Evidence Source, or source bindings. It only authorizes a later explicit Admin confirmation attempt.

## 3. Required lineage

A ready preflight must prove all of the following at the same time:

1. The qualification contract is exactly `trust-phase8h-source-identity-qualification-v1`.
2. The qualification disposition is `QUALIFIED_EXACT`.
3. The qualification digest is a 64-character lowercase SHA-256 digest.
4. Qualification historical Source/Product/Subject/candidate fields match the relocation request.
5. The historical Evidence Source remains immutable and its exact Product/Subject binding is still `exact_subject_match`.
6. The governed Subject is still `resolved/current` with the same market, variant, and formulation lineage.
7. The current official source binding is still `resolved`, `product` scoped, and created under `trust_official_source_review_v1`.
8. The current review still matches the exact Subject, market relation, variant, formulation, and source kind.
9. The replacement locator is HTTPS, differs from the historical locator, and exactly matches the qualified candidate.
10. Replacement source name, source kind, market, and locale preserve the reviewed binding scope.

Any failed dimension produces `HOLD`.

## 4. Historical provenance is immutable

The later confirmation boundary must never update:

- `product_evidence_sources.canonical_locator`
- historical Evidence Source content digest
- historical Evidence Source Subject binding
- Product Fact instance
- Product Fact Current pointer
- existing confirmation
- recommendation authority or recommendation logs

The historical source remains the provenance that supported the original Evidence.

## 5. Replacement binding semantics

The later 8H-2B database confirmation is designed to:

1. lock and revalidate the exact prestate,
2. create or reuse a replacement `product_source_bindings` row for the qualified locator,
3. preserve `source_name`, `external_type`, market, locale, and product scope,
4. keep `binding_method='trust_official_source_review_v1'` so existing Phase 7-C / Phase 8D controlled official-source gates continue to recognize the replacement,
5. create the corresponding `trust_official_source_binding_reviews` row with the same exact Subject/market/variant/formulation lineage,
6. retire the superseded reviewed binding only inside the same transaction,
7. write an immutable relocation ledger linking historical Evidence Source, old binding/review, replacement binding/review, qualification digest, prestate digest, actor, request, and result.

No in-place URL patch is allowed.

## 6. Qualification digest role

The Phase 8H-1 qualification digest is an immutable external evidence reference.

8H-2A validates:
- exact qualification contract,
- `QUALIFIED_EXACT` disposition,
- digest shape,
- all identity fields that the database can independently cross-check.

The later database boundary must store the exact qualification digest. It must not fabricate a new qualification digest or treat the digest alone as proof. Admin confirmation plus direct database prestate validation is the mutation authority.

## 7. Prestate digest

8H-2A computes a SHA-256 `prestate_digest` over:

- qualification digest,
- historical Evidence Source,
- historical exact Subject binding,
- governed Subject identity,
- current reviewed official binding and review.

8H-2B must reject confirmation when the current database prestate no longer matches the preflight.

This prevents a stale preflight from retiring or replacing a binding after concurrent governance changes.

## 8. Relocation plan digest

The `relocation_plan_digest` binds:

- contract,
- prestate digest,
- historical source and old binding/review,
- replacement locator and derived `official-url-sha256:...` external identity,
- qualification contract/digest,
- mutation and authority boundary.

A changed replacement URL or changed prestate therefore produces a different plan digest.

## 9. Derma Factory canary

The first positive preflight fixture is the already qualified Derma Factory relocation:

- historical Evidence Source: `f5eb21f8-4829-4c9b-b927-ccdfb43cdd1b`
- Product: `fa5b1f6b-1e55-47b0-bfa1-494be512df07`
- Subject: `5a9ff33e-68c3-4ad7-ad60-7931c3478ca1`
- old reviewed binding: `fd3ddecc-c09a-4b12-bc96-6e6ef2b2e97c`
- qualification digest: `0a34c3413b7431bc7ecdf8f623eef5d0d49c7afcf370e2b5025ad78cc143627f`
- old locator: `https://www.dermafactory.net/products/niacinamide-20-serum-30ml?variant=46478659616933`
- qualified replacement: `https://dermafactory.net/products/niacinamide-20-serum-30ml?variant=46478659616933`

This is a relocation canary only. No Production binding is changed in 8H-2A.

## 10. BOJ and Dr.G remain held

Beauty of Joseon remains `NO_SAFE_OFFICIAL_CANDIDATE`; no relocation preflight may be created from the homepage redirect or current external search seeds.

Dr.G HTTP 429 observations remain retry-only and cannot enter relocation preflight.

## 11. Revalidation handoff remains separate

Relocation is operational source maintenance, not a semantic verdict.

Phase 8H-2B will only establish governed replacement lineage. The later revalidation trigger boundary must then hand the affected current proposition into the existing Phase 8D research path and from there:

- same semantic -> Phase 8E reaffirmation
- changed semantic -> Phase 8F replacement review

Phase 8H must not synthesize a Phase 8G verification or weaken the Phase 8G COMPARABLE requirement merely to reuse Phase 8C.

## 12. Security and exposure

Any later table created in `public` must explicitly enable RLS and revoke client access. Any Admin function must keep a pinned/empty search path, require `admin.products.review`, revoke execute from `public`, `anon`, and `authenticated`, and grant only the required server-side role.

## 13. Migration boundary

8H-2A intentionally contains no migration and performs no Production write.

The 8H-2B migration must be created through the repository's normal Supabase CLI migration workflow rather than by inventing a migration timestamp. Production application must preserve repository/Production provenance and be followed by exact readback.

## 14. Exit criteria

8H-2A is complete when:

1. the generic preflight engine contains no brand or Source-ID branching,
2. the Derma canary is ready,
3. stale/ambiguous/wrong-scope cases fail closed,
4. the engine has no database write client or RPC path,
5. BOJ and Dr.G cannot enter relocation,
6. exact-head CI passes,
7. no Production data changes occur.
