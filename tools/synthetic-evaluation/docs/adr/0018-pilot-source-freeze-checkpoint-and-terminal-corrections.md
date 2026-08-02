# ADR 0018: Pilot Source-Freeze, Checkpoint, and Terminal Corrections

## Status

Accepted after independent self-review of the initial #T7 design.

This ADR supersedes the narrower wording in `pilot-campaign-runner-v1.md` where the main document is ambiguous.

## Context

The initial T7 design correctly separates campaign orchestration from T2–T6 authority, but review found four precision gaps:

1. `promptCompilerVersion` alone does not freeze the complete T2 compilation surface.
2. `valid_ineligible_observation` was described as terminal but omitted from the terminal outcome union.
3. Wave checkpoint readiness did not state the minimum completed stage.
4. A closeout-time active G4 snapshot can become stale after a later T6 revocation.

A fifth minor gap was that a slot exhausting generation attempts without any asset had no dedicated terminal outcome.

## Decision

### 1. Expanded source freeze

`PilotCampaignPlanV1.sourceFreeze` must include all of:

```ts
type PilotSourceFreezeV1 = {
  generationSpecSchemaVersion: "generation-spec-v1";
  compiledPromptSchemaVersion: "compiled-prompt-v1";
  promptCompilerVersion: "prompt-compiler-v1";
  fixtureSetId: "skin-control-abcd-v1";
  fixtureObjectDigests: Record<"A" | "B" | "C" | "D", string>;
  finalizedSpecDigests: Record<"A" | "B" | "C" | "D", string>;
  providerProfileId: "gemini-image-manual-v1" | "gpt-image-manual-v1";
  providerProfileVersion: "1.0.0";
  providerProfileDigest: string;
  providerTemplateVersion: string;
  t3ImportPolicyVersion: string;
  t4ObservationContractVersion: string;
  t4AdapterProfileId: string;
  t4AdapterProfileVersion: string;
  t5JudgmentPolicyVersion: string;
  t6PromotionPolicyId: "bejewely-promotion-policy-v1";
  t6PromotionPolicyVersion: "1.0.0";
  sourceFreezeDigest: string;
};
```

The expected output dimensions and formats in a work packet are a derived display projection from the frozen spec/T3 import contract. They are not an independent authority and must match the source artifacts exactly.

### 2. Exact terminal outcome set

The terminal union must include:

```ts
type PilotSlotTerminalOutcomeV1 =
  | "promoted_g4"
  | "retained_g3_negative_control"
  | "promotion_held"
  | "promotion_rejected"
  | "generation_failed_no_asset"
  | "candidate_import_failed"
  | "observation_valid_ineligible"
  | "observation_failed"
  | "judgment_incomplete"
  | "cancelled_budget_exhausted"
  | "cancelled_campaign_stop"
  | "cancelled_operator";
```

`observation_valid_ineligible` is a valid T4 outcome and must never be counted as `observation_failed`.

`generation_failed_no_asset` is used when the slot exhausts its allowlisted technical attempts without a registrable asset.

### 3. Wave checkpoint readiness

A wave is checkpoint-ready only when every issued slot in that wave is in one of these states:

- an authoritative T4 observation has been registered
- a valid T4 ineligible observation has been registered
- a pre-registration technical terminal outcome has been registered
- the campaign has already entered an immediate-stop state

T5/T6 completion is not required to issue the next wave. The wave checkpoint is an early generation/import/observation safety gate, not a campaign outcome interpretation.

The checkpoint may inspect T3 hints and the canonical images for a systemic continuation risk, but it cannot clear or replace T6 rights, visual, leakage, or promotion reviews.

### 4. G4 status freshness

`PilotCampaignCloseoutV1.activeG4Refs` is an immutable **as-of-closeout snapshot**.

T8 must label the status time boundary when reporting it.

T9 must reload and verify the current T6 status chain for every G4 before split or G5 lock. T9 may not trust closeout-time activity as current authority.

### 5. Observation recovery precision

Observation recovery may use a new T4 replicate ordinal only when the prior attempt produced a verifiable technical failure record and no authoritative observed/ineligible object was published.

A valid observation cannot be retried to seek a more favorable result.

## Consequences

### Positive

- T2 compilation drift is fully detectable.
- T4 valid-ineligible denominators remain exact.
- Wave progression has a deterministic readiness boundary.
- Later G4 revocations cannot be hidden by an old campaign closeout.
- no-asset generation exhaustion is distinct from import failure.

### Negative

- Source-freeze validation is more detailed.
- T9 must perform fresh T6 status verification even when T7 closeout appears complete.
- Checkpoint projection must understand T4 technical and valid-ineligible outcomes separately.

## Verification implications

Implementation tests must prove:

- compiled-prompt schema, compiler, provider profile, template, spec, T4 adapter, T5, and T6 drift each fail closed
- valid ineligible observation projects to its own terminal outcome
- no-asset exhaustion projects separately from import failure
- Wave 2/3 cannot issue before all prior-wave slots satisfy checkpoint readiness
- T5/T6 completion is not falsely required for wave continuation
- valid T4 outcomes cannot consume observation recovery budget
- T9 handoff performs fresh T6 active-status verification
