# ADR 0005 — Observation Contract Snapshot and Blind Execution

- Status: Accepted for Toolkit Track `#T4` design
- Date: 2026-08-02
- Scope: Synthetic Evaluation Toolkit observation boundary only
- Source observation commit: `f050b1d5f72588a1ce6a0a8e5fa42b92d0a8a893`

## Context

#T3 already exposes a blind candidate projection containing only the candidate ID and canonical asset reference. The current Bejewely production observation pipeline exists on a different branch lineage and provides:

- `vision-observation-v1`
- `vision-observation-prompt-v1`
- `face-lab-observation-v1`
- eligibility, skin, and Face Lab observation normalization
- one bounded OpenAI image request
- no source-image or raw-response persistence

The #T3 implementation branch does not contain the current observation modules and is 127 commits behind the observation source branch at design time. Direct cross-branch imports are impossible, while copying code without source identity would make later results unauditable.

Additional risks:

1. Passing a full candidate manifest to observation would leak generation intent.
2. Importing the production server service would pull Next.js, API-key resolution, runtime logging, and application concerns into the Toolkit.
3. Treating a normalized fallback bundle as a successful observation would convert Provider or contract failures into apparent data.
4. Automatic retry would hide independent model variance and spend an unbounded image-attempt budget.
5. Mutating the candidate manifest would mix import provenance with later observations.
6. A conventional `dry-run` label is ambiguous when Provider execution itself is the costly side effect.

## Decisions

### 1. Use the #T3 blind candidate projection as the only image input contract

The observation process receives only:

```text
candidateId
canonical asset SHA-256
canonical object-relative path
canonical transform policy version
```

Generation spec, prompt, condition, campaign, Provider provenance, and operator hints are unavailable to T4 execution.

### 2. Pin a versioned observation contract snapshot

T4 does not import production `lib/**` at runtime.

A snapshot records:

- source repository and exact commit
- required source file paths and blob SHAs
- Vision and Face Lab schema/prompt versions
- exported capabilities
- canonical snapshot digest

The first approved source is:

```text
gycha0109-beep/K_beauty
f050b1d5f72588a1ce6a0a8e5fa42b92d0a8a893
```

A changed source requires a new snapshot ID and drift review. Existing observation runs remain bound to their original snapshot.

### 3. Separate contract, transport, and registration

```text
contract snapshot
→ prompt/schema/normalizer

transport adapter
→ bounded Provider request and response extraction

registrar
→ immutable observation object and run manifest
```

The shared contract may later be extracted into `@bejewely/face-contracts`. The production application must never depend on `@bejewely/synthetic-evaluation`.

### 4. Publish only canonical successful bundles as observations

An observation object is published only when the pinned normalizer returns:

```text
schemaVersion = vision-observation-v1
status = available
privacy.sourceImagePersisted = false
privacy.rawProviderResponsePersisted = false
```

A valid bundle may report image ineligibility or insufficient Face Lab/Skin Match evidence. That remains a successful observation of an unsuitable image.

Provider failure, parse failure, schema mismatch, or contract-invalid normalization produces no observation object. A sanitized failure run may be registered after an actual Provider attempt.

### 5. Keep candidate and observation artifacts separate

T4 never changes the #T3 candidate manifest or state.

Observation runs are append-only artifacts keyed by candidate ID. Candidate grade, consensus, and promotion are derived by later tracks.

### 6. Use explicit replicate ordinals instead of retry

Each Provider execution has a maximum of one image-bearing attempt and no automatic retry.

```text
same replicate ordinal
→ idempotent retry of the same logical run

higher replicate ordinal
→ intentional independent observation run
```

Timestamps and usage telemetry do not participate in run identity.

### 7. Use `preflight` and `execute`, not ambiguous Provider dry-run

`preflight` performs:

- zero Provider calls
- zero persistent writes
- candidate, asset, snapshot, profile, model, and identity validation

`execute` performs:

- at most one image-bearing Provider attempt
- success or sanitized bounded-failure registration

### 8. Preserve the production privacy boundary

T4 references the existing #T3 canonical asset and does not create another image copy.

It stores no raw Provider body, raw model prose, authorization data, base64 image, or absolute local path. Normalized observations and allowlisted telemetry only are permitted.

## Consequences

### Positive

- generation intent cannot bias observation execution;
- observation results are traceable to exact source contract bytes;
- branch divergence does not create hidden runtime coupling;
- invalid Provider output cannot masquerade as observed data;
- repeated model measurements are explicit and auditable;
- candidate import history remains immutable;
- future judgment and consensus can consume stable observation artifacts.

### Costs

- a snapshot/export and drift-verification step is required;
- schema updates create new snapshot versions instead of silently updating old runs;
- Provider transport must be implemented separately from the existing production service;
- cross-snapshot result comparison requires explicit compatibility policy;
- batch execution remains deferred.

## Rejected alternatives

### Import production observation modules directly

Rejected because the relevant branches are not linearly aligned and production modules use application aliases and server-only concerns.

### Copy prompt and normalizer without source metadata

Rejected because results could not be tied to an exact source contract or reviewed for drift.

### Pass the full candidate manifest and promise not to read intent

Rejected because process-level blindness is stronger and testable; convention-only blindness is not.

### Store raw Provider responses for debugging

Rejected for v1 because it conflicts with the existing privacy/logging boundary and may retain unexpected model content or sensitive request context.

### Convert fallback bundles into observation artifacts

Rejected because a Provider or contract failure is not an observation.

### Retry automatically on timeout or invalid response

Rejected because it hides attempt count, changes cost, and conflates recovery with independent replicate measurement.

### Update candidate state to `G2_OBSERVED`

Rejected because import provenance and observation history are separate append-only domains. A later registry may derive an effective grade.

## Implementation gates

1. contract snapshot manifest and drift verifier;
2. exact request/result schemas with unknown-field rejection;
3. blind-input-only source audit;
4. canonical asset hash and path preflight;
5. provider-free fixture replay;
6. immutable object plus manifest-last registration;
7. bounded OpenAI adapter with attempt count 1;
8. blind judgment projection;
9. provider-free full contract suite;
10. separately approved one-image synthetic Provider smoke.

Until gates 1–9 pass, no Provider image execution is authorized by this ADR.
