# ADR 0017: Frozen Run Versions and T8/T9 Handoff

## Status

Accepted for #T7 design.

## Context

A campaign can span multiple operator sessions and human-review steps. During that time, generation fixtures, prompt templates, Provider profiles, import policy, observation contract, judgment rules, or promotion policy may change.

Silently applying newer rules to unfinished slots would make one campaign internally inconsistent. Conversely, reporting and dataset locking require richer downstream behavior that should not be embedded in the runner.

## Decision

Every `PilotCampaignPlanV1` freezes the exact T2–T6 version/digest set required by the run.

The runner revalidates this source freeze before:

- run creation
- wave issue
- slot advancement
- checkpoint approval
- resume
- closeout

A drifted source cannot be silently upgraded. The run is paused or stopped, and changed behavior requires a new campaign plan version and new campaign run.

T7 closeout is machine-readable only. It contains exact denominators, event heads, reason-code counts, active G4 references, non-Gold references, unresolved holds, and split-coupling digests.

T8 owns:

- review/export packages
- CSV or visual contact sheets
- outcome interpretation
- provider comparison
- failure-pattern analysis
- human-readable campaign reports

T9 owns:

- leakage-aware grouping
- train/development/validation/test placement
- holdout selection
- G5 creation
- dataset version lock
- regression baseline activation

## Consequences

### Positive

- Every run remains internally reproducible at the contract level.
- Policy drift cannot alter historical outcomes in place.
- T7 stays small and auditable.
- T8 and T9 receive explicit, bounded inputs.

### Negative

- A mid-run policy fix may require closing and restarting a campaign.
- Historical runs can remain incomplete under an obsolete source freeze.
- Human-readable interpretation is unavailable until T8.

## Rejected alternatives

### Always use the latest toolkit policy on resume

Rejected because it silently changes the experimental condition.

### Copy all T2–T6 payloads into the closeout

Rejected because it duplicates authority and increases tamper surface.

### Let T7 assign a provisional holdout split

Rejected because provisional placement can still leak coupled samples and preempt T9.

### Let T8 create or modify G4

Rejected because promotion authority belongs to T6.

## Verification implications

Implementation tests must prove:

- source freeze drift blocks issue/advance/resume/closeout
- changed policy requires a new plan/run identity
- closeout contains references and counts only
- no report renderer or export UI is present in T7
- no split/G5 contract is present in T7
- only active non-revoked G4 references can enter the T9 handoff candidate set
