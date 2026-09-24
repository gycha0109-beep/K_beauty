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

Phase 8G preserves explicit adapter provenance. Historical profiles keep their original adapter contract. New fresh-recovery profiles use a semantic adapter only after a no-mutation live canary proves repeatability:

```text
digest_basis = canonical-official-product-semantics-v1
adapter_key = official-product-semantic
adapter_version = v1
```

`live-page-bytes / v1` and `canonical-html-text / v1` remain compatibility adapters; neither is silently substituted when semantic parsing fails.

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

`baseline` captures a fresh observation through the shared bounded official-source fetch transport and the explicitly selected profile adapter.

`verify` uses the exact adapter key/version and digest basis frozen by the current COMPARABLE profile. Adapter mismatch, unsupported semantic extraction, or a missing required evidence anchor fails closed; there is no raw-byte fallback. It does not automatically call Phase 8C.

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

## Production canary capture

The initial Production canary uses a repository-pinned target manifest and the same bounded `fetchOfficialBytes` transport as the verification worker.

On the main-branch push that changes the target manifest, the Phase 8G workflow performs three independent semantic live fetches and emits:

```text
TRUST_PHASE8G_CANARY_CAPTURE_JSON={...}
```

The capture contains the exact live-byte digest, final URL, content type, byte length, fetch time, and immediate second-fetch digest. It performs no database or authority mutation.

A Production baseline profile may be registered only when:

```text
stable = true
baseline.digest == verification.digest
baseline.digest == confirmation.digest
source_id == reviewed canary source
canonical_locator == reviewed source locator
```

The three captures are a no-database activation gate. Only after all three semantic digests match may a fresh baseline be registered through the governed Phase 8G RPC; the later verification must use a new HTTP fetch rather than reusing any canary capture. A mismatched immediate digest is treated as an unstable adapter/source combination and is not promoted to a COMPARABLE baseline.

Expected fetch outcomes such as `TRANSIENT_FAILURE:*` and `SOURCE_BLOCKED:*` are emitted as structured canary results with `stable=false` and `authority_mutation=false`. They block baseline registration but do not turn the deterministic TRUST contract red. Unexpected implementation/runtime failures still fail CI.

### Canonical HTML text adapter

Dynamic storefronts can emit request-specific HTML while presenting unchanged product text. Production canary attempts on independent storefronts demonstrated that equal-length responses can still have different raw SHA256 digests seconds apart.

`canonical-html-text / v1` therefore provides a second explicit adapter. It removes comments and non-content script/style/noscript/template/svg blocks, removes tag attributes/markup, normalizes a small stable entity set, applies Unicode NFKC normalization, and collapses whitespace before hashing.

The adapter remains fail-closed:

- a visible canonical text change changes the digest;
- an unsupported adapter or digest-basis mismatch is an implementation error, not an ambiguous source result;
- raw `live-page-bytes / v1` remains supported for already-profiled sources;
- `canonical-html-text / v1` remains an explicit compatibility adapter; new Product Fact fresh-recovery baselines default to `official-product-semantic / v1` only after a stable semantic Production canary;
- no adapter result can itself confirm a Product Fact or mutate Recommendation authority.

### Production semantic profile contract provenance

The Production migration ledger version for the semantic fresh-recovery contract is:

```text
20260924104150_trust_phase8g_semantic_profile_contract_v1.sql
```

The repository migration filename must use that exact Production version. The SQL body is the exact statement already recorded in Production migration history; this is provenance alignment, not a second schema application.

### Product Fact semantic adapter

`official-product-semantic / v1` is the fresh-recovery adapter for Product Fact source verification. It does not hash the whole storefront or treat commerce telemetry as Product Fact authority.

The canonical observation is limited to:

- reviewed evidence claim anchors carried by immutable source metadata (`observed_claim`, `current_direct_claim`, `direct_claim`);
- current product identity metadata when present;
- stable document title/description;
- structured `Product` JSON-LD projected to Product Fact-relevant fields.

Commerce/runtime fields such as offers, prices, aggregate ratings, reviews, request scripts, and storefront counters do not own the semantic digest.

Fail-closed rules:

```text
required reviewed claim missing -> AMBIGUOUS / no silent fallback
no reviewed claim and no sufficiently descriptive Product JSON-LD -> UNSUPPORTED
adapter key/version mismatch -> reject
semantic extraction failure -> never fall back to raw SHA
```

The initial five-observation Torriden diagnostic isolated the visible-text instability to the product view counter while title and description remained stable. That diagnostic is evidence for excluding storefront telemetry, not a site-specific string rewrite rule.
