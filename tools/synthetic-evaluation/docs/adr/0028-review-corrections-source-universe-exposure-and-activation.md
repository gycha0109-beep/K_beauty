# ADR 0028: Review corrections for source-universe, exposure, and activation semantics

## Status

Accepted for Toolkit Track `#T9` implementation.

## Context

The first T9 design established current-G4 revalidation, component-level splitting, sticky exposures, a lock basis, a locked dataset manifest, and a final activation manifest. Independent pre-implementation review found four remaining ambiguities:

1. a comparison-group request could claim completeness without proving which locally stored closed runs formed the source universe;
2. an exposure registry digest alone did not prove the registry head was linear and complete;
3. a locked dataset could be activated while one member's current G4 status changed between source capture and final publication;
4. a regression baseline contract could be mistaken for permission to execute a model or to expose holdout identities.

## Decision

### 1. Source-universe enumeration is derived from storage

The runtime enumerates stored campaign runs itself.

- `single_run` resolves exactly the named closed run.
- `comparison_group` enumerates every locally stored closed run matching the group and cutoff.
- caller-provided candidate or G4 allowlists are rejected.
- the source-universe digest commits to included and excluded run identities before member extraction.

### 2. Exposure history has a verifiable linear head

Exposure claims are append-only. A registry snapshot commits to:

- all verified claims in canonical order;
- one current head per `datasetLineageId + componentFingerprint`;
- exact predecessor linkage;
- no branch, cycle, duplicate split, or disconnected claim.

A sticky prior assignment is inherited from this verified head, not from an untrusted caller field.

### 3. Activation performs a second current-authority check

Dataset publication is two-stage.

1. lock basis and dataset version are written;
2. immediately before activation, every source G4 status head and canonical asset digest is re-read;
3. exposure claims, G5 records, initial status events, and indexes are written;
4. the activation manifest is published last.

Any authority drift produces `locked_incomplete`; it never silently activates.

### 4. Baseline registration is evidence locking only

T9 may register an externally produced result package only when:

- the dataset and all G5 records are currently active;
- the result package, model artifact, harness, and metric-contract digests are supplied and verified as immutable references;
- a separate reviewer explicitly approves the baseline registration.

T9 performs no training, inference, scoring, threshold tuning, network call, or holdout export while registering the baseline.

## Consequences

- Storage enumeration and status-chain verification are required for source preflight.
- Activation is intentionally more expensive than merely writing the locked manifest.
- A crash after lock but before activation leaves an auditable incomplete version.
- Baseline registration cannot be used as a hidden execution path.

## Verification requirements

Tests must prove:

- omitted comparison-group runs fail completeness checks;
- branched or cyclic exposure histories fail closed;
- G4 revocation between lock and activation prevents activation;
- activation manifest is written last;
- baseline code contains no Provider, model, browser, DB, shell, or network execution path.
