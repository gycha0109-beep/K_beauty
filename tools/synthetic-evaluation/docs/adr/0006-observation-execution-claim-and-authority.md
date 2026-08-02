# ADR 0006 — Observation Execution Claim and Authority

- Status: Accepted for Toolkit Track `#T4`
- Date: 2026-08-02
- Scope: implementation corrections discovered during pre-implementation review

## Findings

### 1. A manifest-last run alone cannot guarantee a single Provider attempt

If the process calls the Provider and crashes before publishing the run manifest, repeating the same `replicateOrdinal` could make a second hidden image-bearing request.

### 2. Fixture replay is not an authoritative observation for judgment

Fixture replay validates contract, normalization, storage, and identity behavior. It must not be passed to the later judgment pipeline as if it were an independently observed image result.

### 3. An arbitrary model string weakens the pinned adapter profile

The profile must own an explicit model allowlist. A caller cannot change the model while retaining the same profile/version contract.

## Decisions

### Execution claim

`--execute` creates an exclusive immutable execution claim before any Provider call.

```text
preflight: Provider 0 / write 0
execute:
  exclusive claim create
  → at most one Provider call
  → observation object when valid
  → run manifest last
```

A claim contains only run identity, candidate ID, canonical hash, adapter/snapshot identity, mode, provider/model, replicate ordinal, and `claimedAt`. It contains no secret, image, prompt, generation intent, raw response, or absolute path.

If a claim already exists but no run manifest exists, the same run is treated as `execution_state_uncertain` and is never called again. Recovery requires a new `replicateOrdinal`; stale-claim deletion is not part of T4 v1.

### Fixture authority boundary

Fixture replay may publish a run with `authority = fixture_only`, but `createBlindJudgmentInput()` must reject it. Only a successful `provider_bounded` run with `authority = observed_image` can create judgment handoff data.

### Model allowlist

`bejewely-canonical-vision-v1@1.0.0` initially allows exactly `gpt-4o-mini` in `provider_bounded` mode. Fixture replay uses the fixed model token `fixture-canonical-v1`.

## Consequences

- hidden duplicate Provider attempts after a crash are prevented;
- incomplete claims are visible and fail closed;
- fixture data cannot silently influence scoring or promotion;
- model changes require an explicit profile version change;
- claim recovery and garbage collection are deferred operational concerns.
