# ADR 0023: Current G4 authority and dataset source snapshot

## Status

Accepted for Toolkit Track `#T9` design.

## Context

T7 closeout and T8 report preserve historical `as-of-closeout` G4 references. T6 promotion status is append-only, so a previously active G4 may later be revoked or superseded because of rights, provenance, visible-mark, duplicate, leakage, integrity, or evidence conflicts.

Using T7/T8 counts directly for dataset placement would therefore allow stale or inactive grade records into a locked dataset. Conversely, copying all upstream payloads into T9 would duplicate authority and expand the tamper surface.

## Decision

### 1. T9 resolves current T6 authority directly

T9 re-reads and verifies:

- the G4 grade record;
- the complete T6 promotion status event chain;
- the current event head;
- the promotion source snapshot and evidence bundle;
- the T3 canonical asset and SHA-256 relation;
- the referenced T4/T5 evidence relation;
- the T6 leakage review and coupling-key digest.

Only a valid current `activated` G4 that is neither revoked nor superseded can enter the source pool.

### 2. T7 and T8 remain historical/audit inputs

T7 closeout and T8 report may be used to locate campaign references and explain historical outcomes. They are not current G4 authority.

A T8 report saying that a record was G4 at closeout does not make that record currently dataset-eligible.

### 3. T9 freezes verified references, not copied authority

`DatasetSourceSnapshotV1` stores exact digests and current status heads for every member. It does not create new observation, consensus, alignment, or promotion values.

The snapshot binds:

- candidate and canonical asset identity;
- G4 record and current status head;
- promotion source/evidence/leakage digests;
- purpose and label-schema digest;
- prior exposure registry head.

### 4. Purpose and label schema are version-scoped

A dataset version has one explicit purpose and one compatible label-schema digest. Incompatible G4 claim scopes are excluded or quarantined rather than silently coerced into a common schema.

### 5. Current verification remains required after lock

A historical dataset manifest remains intrinsically readable. Active use requires `verify-current`, which re-resolves every member's current T6 status.

If one member becomes inactive, the dataset version cannot remain active without an append-only invalidation or supersession event.

## Consequences

### Positive

- Revoked or superseded Gold cannot silently enter or remain in active datasets.
- T8 historical reporting remains stable without becoming current authority.
- T9 receives a small, digest-addressed source surface.
- Label provenance remains T4/T5/T6-owned.

### Negative

- Dataset verification must traverse T6 status chains.
- A later G4 revocation can invalidate an already locked active dataset.
- Mixed-purpose datasets require separate versions or a future explicit multi-task design.

## Rejected alternatives

### Trust the T7 closeout active-G4 list

Rejected because it is an as-of-closeout snapshot.

### Trust a T8 current-status appendix

Rejected because T8 explicitly does not own T9 split/G5 authority.

### Copy complete T2–T6 payloads into the dataset manifest

Rejected because it duplicates authority and increases mutation/tamper surface.

### Allow inactive G4 as a training-only member

Rejected for v1 because T9's source contract is active purpose-scoped G4 only. Historical or non-Gold controls remain outside the locked Gold dataset.

## Verification implications

Implementation tests must prove:

- revoked and superseded G4 records are excluded;
- stale T7/T8 references cannot override current T6 state;
- source snapshot identity binds current status heads;
- purpose/label-schema mismatch fails closed;
- post-lock G4 revocation makes current dataset verification fail;
- historical dataset artifacts remain immutable and readable.
