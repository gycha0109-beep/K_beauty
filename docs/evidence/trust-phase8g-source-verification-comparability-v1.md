# TRUST Phase 8G — Source Verification Comparability v1

## Goal

Phase 8G prevents Product Fact revalidation from treating incomparable historical source digests as if they were live-page byte hashes.

A source verification may enter Phase 8C only when it is bound to an immutable current profile with:

- `comparability_state = COMPARABLE`
- an explicit baseline digest
- an explicit digest basis
- an explicit adapter key/version
- exact source/profile/verification lineage

## Production motivation

The Production corpus contains historical `product_evidence_sources.content_digest` values created under multiple observation contracts. Some sources have no `digest_basis`, no frozen observation, and no `observed_at`. Therefore:

```text
historical content_digest != assumed live HTML digest
```

unless the comparison contract is explicitly proven.

Failing to preserve that distinction can manufacture false `changed` results and incorrectly move a confirmed assignment into re-review.

## Profile states

```text
COMPARABLE
BASELINE_RECOVERY_REQUIRED
MANUAL_ONLY
```

`BASELINE_RECOVERY_REQUIRED` and `MANUAL_ONLY` profiles cannot record v2 verification and cannot trigger Phase 8C.

## Baseline kinds

### historical_replay

May become `COMPARABLE` only when the historical digest is explicitly replay-proven and matches the stored source digest.

### fresh_recovery

Creates a new comparison baseline without rewriting historical Evidence Source rows.

Phase 8G v1 uses:

```text
digest_basis = live-page-bytes-v1
adapter_key = live-page-bytes
adapter_version = v1
```

Fresh baseline capture is operational metadata only:

```text
Fact delta = 0
Current delta = 0
confirmation delta = 0
review assignment state delta = 0
Recommendation authority delta = 0
```

### legacy_unresolved

Used when the historical digest contract cannot be replay-proven. State is `BASELINE_RECOVERY_REQUIRED`.

### manual_only

Used when no safe automatic adapter exists. State is `MANUAL_ONLY`.

## Immutable profile chain

Profiles are append-only. A new profile may supersede the current profile, but existing profiles cannot be updated or deleted.

A verification bound to a superseded profile is not actionable.

## Phase 8B v2 verification

`record_product_evidence_source_verification_v2` requires a current `COMPARABLE` profile and freezes:

- profile ID
- source ID
- profile baseline digest
- observed digest
- digest basis
- adapter version
- profile digest
- result
- trigger
- checked time
- metadata

The v1 recorder remains available for historical compatibility, but an unprofiled v1 verification cannot pass the Phase 8G Phase 8C gate.

## Phase 8C gate

Both revalidation preflight and transition execution fail closed unless the verification is bound to the current immutable `COMPARABLE` profile.

Required failure:

```text
product_fact_revalidation_verification_not_comparable
```

The gate validates:

```text
verification.profile_id exists
profile.comparability_state == COMPARABLE
profile is not superseded
profile.source_id == verification.source_id
profile.baseline_digest == verification.baseline_digest
profile.digest_basis == verification.observation_digest_basis
profile.adapter_version == verification.adapter_version
profile.profile_digest == verification.profile_digest
```

## Worker boundary

`trust-source-verification-worker.mjs` supports two explicit modes:

```text
baseline
verify
```

`baseline` captures a fresh live-page-byte baseline through the shared bounded official-source fetch transport.

`verify` compares current live-page bytes only against a compatible `live-page-bytes-v1` profile and records the observation. It does not automatically call Phase 8C.

Network transport is shared with the existing research worker and preserves:

- HTTPS only
- private host/IP rejection
- private DNS rejection
- bounded redirects
- 10 second fetch timeout
- 2 MiB response cap
- text/HTML content-type boundary

## Authority invariants

Phase 8G must never by itself:

- create or mutate Product Fact instances
- mutate Product Fact Current
- create confirmations
- change review assignment state
- confirm a Product Fact
- mutate Recommendation authority
- infer negative facts from missing/unavailable sources

## Production canary gate

After migration rollout, the first Production exercise is an unchanged canary:

```text
fresh baseline
→ second fetch
→ unchanged verification
```

Expected authority deltas:

```text
Facts = 0
Current = 0
Confirmations = 0
Assignments = 0
Transitions = 0
Recommendation = 0
```

No synthetic `changed` result may be inserted merely to exercise the Production transition path.
