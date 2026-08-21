# V2.1-9P ENFORCE Reassessment Normative Acceptance Objectives Governance Contract Freeze

## 1. Stage boundary

Stage: `V2.1-9P`.

Primary purpose: freeze the normative acceptance objectives, authority lineage, hard-blocker boundary, non-promotable evidence ceiling, precedence, compensation policy, and promotion semantics that future empirical calibration must obey before evidence can ever be promoted into `READY_FOR_SEPARATE_ENFORCE_REASSESSMENT`.

This Stage does not calibrate numeric thresholds, perform ENFORCE reassessment, authorize or activate ENFORCE, generate Production traffic, run a controlled Production probe, mutate Product Fact, alter Recommendation/CandidatePolicy semantics, change SHADOW runtime-control semantics, add a Supabase migration, or add a Production API.

Core distinction:

```text
WHAT WAS OBSERVED?
!=
WHAT IS ACCEPTABLE?
```

Measured prevalence is not risk tolerance. Observed frequency is not permission.

## 2. Starting repository authority and drift

Live starting `main` at 9P entry:

```text
a4772e3cd44d68f67fe4bbf25926ba0942f353b3
```

V2.1-9O merged authority:

```text
7806d6956d5d82743d176eb4c58959ee84b698c5
```

9O PR #277 exact head:

```text
356742aab4076a99ca7524a828facd4a494c3e80
```

The live `main` is one merge beyond 9O. The intervening merge is EVAL-P4 / PR #278 and changes only a Persona evaluation workflow, Persona evidence document, Persona cohort fixture manifest, and Persona verifier.

No Recommendation scoring, CandidatePolicy, Product Fact, Product Decision Axis, SHADOW observer, durable evidence store/readback, sufficiency governance, calibration methodology, runtime-control, ENFORCE governance, related API, or Supabase migration changed.

```text
DRIFT = UNRELATED_DRIFT
```

Persona Track is outside the remainder of this Stage.

## 3. Frozen predecessor authority preserved

### V2.1-9N

```text
Status = STRICT SUCCESS / CLOSED
Primary outcome = ENFORCE_REASSESSMENT_SUFFICIENCY_CALIBRATION_REQUIRED
Policy = enforce-reassessment-sufficiency-governance-v1
Calibration contract = enforce-reassessment-sufficiency-calibration-contract-v1
Calibration status = FROZEN_PARAMETERS_VALUES_UNCALIBRATED
```

All nine 9N calibration parameters remain unchanged.

### V2.1-9O

```text
Status = SUCCESS / CLOSED
Primary outcome = ENFORCE_REASSESSMENT_SUFFICIENCY_CALIBRATION_DESIGN_REQUIRES_FURTHER_GOVERNANCE
Methodology = enforce-reassessment-sufficiency-calibration-methodology-v1
Methodology status = PARTIAL_METHODOLOGY_FROZEN_NORMATIVE_TARGET_GOVERNANCE_REQUIRED
```

9P does not reopen either predecessor.

## 4. 9O unresolved governance accounted for exactly

The 9P objective registry accounts for exactly these six 9O unresolved governance items:

1. `SAFETY_RELEVANT_BRANCH_COVERAGE_ACCEPTANCE_OBJECTIVE`
2. `UNKNOWN_SOURCE_ACCEPTABILITY_OBJECTIVE`
3. `RUNTIME_ERROR_RISK_ACCEPTANCE_OBJECTIVE`
4. `FALLBACK_RISK_ACCEPTANCE_OBJECTIVE`
5. `EMPIRICAL_OUTCOME_DRIFT_ACCEPTANCE_OBJECTIVE`
6. `PROMOTION_ACCEPTANCE_RULE_CONNECTING_EMPIRICAL_DESCRIPTORS_TO_REASSESSMENT_SUFFICIENCY`

No item is deleted and no implicit numeric threshold is added.

## 5. Primary normative contract

```text
version = enforce-reassessment-normative-acceptance-objectives-v1
status = NORMATIVE_OBJECTIVES_FROZEN_VALUES_UNCALIBRATED
primary outcome = ENFORCE_REASSESSMENT_NORMATIVE_ACCEPTANCE_OBJECTIVES_FROZEN
```

This means the qualitative governance objective and promotion semantics are complete enough to govern future parameter derivation. It does not mean any numeric tolerance is known, current Production evidence is sufficient, or ENFORCE is ready.

## 6. Normative objective taxonomy

### HARD_INTEGRITY_OR_SAFETY_INVARIANT

A condition whose occurrence is incompatible with the current governed SHADOW/ENFORCE boundary. Its acceptability is not calibrated by frequency.

### CALIBRATABLE_RISK_TOLERANCE_DOMAIN

A behavior that is not required to be identically zero, but whose prevalence, recurrence, clustering, or distribution must be characterized and later evaluated against a versioned governed acceptance value.

### CALIBRATABLE_COVERAGE_OR_REPRESENTATIVENESS_OBJECTIVE

An evidence-maturity question where natural incidence, recurrence, context breadth, or safety-relevant branch observation requires future calibrated criteria.

### NON_PROMOTABLE_EVIDENCE_DOMAIN

Evidence useful for mechanisms, stress, regression, or diagnosis but unable to establish organic Production maturity regardless of volume.

### PROMOTION_GOVERNANCE_GATE

The non-compensatory rule controlling when future calibrated/validated/holdout evidence may become `READY_FOR_SEPARATE_ENFORCE_REASSESSMENT`.

## 7. Hard blocker contract

Hard blockers:

- frozen 9N integrity prerequisite failure;
- unauthorized ENFORCE activation;
- ENFORCE active without authority;
- SHADOW actual exclusion nonzero;
- controlled evidence attributed as organic;
- UNKNOWN evidence promoted as organic;
- incompatible version regimes silently pooled;
- unexpected Product Fact mutation;
- canonical Recommendation mutation caused by SHADOW policy;
- invalid evidence schema or broken provenance;
- `stopRequired` integrity failure.

Hard blockers dominate evidence maturity. No volume, horizon, context breadth, low average error, or apparently stable distribution compensates for them.

## 8. Safety-relevant branch coverage objective

Safety-relevant family:

```text
CAUTION
RESTRICT
DEFER
```

9P does not freeze a requirement that every action must occur organically. Such a rule would embed an incidence/count assumption and could make naturally rare branches impossible to mature.

Instead:

- controlled/synthetic evidence establishes reachability and deterministic path behavior only;
- organic evidence is authority for natural incidence and recurrence;
- absence of RESTRICT/DEFER/CAUTION is never proof of safety;
- an organically unobserved but reachable safety branch remains explicit residual uncertainty;
- future `required_safety_relevant_branch_coverage` calibration must operationalize the maturity requirement without turning controlled/synthetic reachability into organic evidence.

## 9. UNKNOWN source objective

Correctly separated UNKNOWN is a calibratable risk-tolerance domain, not an integrity failure by existence alone.

Normative concern:

1. UNKNOWN has no organic maturity authority.
2. Material UNKNOWN prevalence/clustering can dilute confidence that observed Production maturity is attributable to known organic traffic.

Therefore:

- UNKNOWN remains separate from ORGANIC;
- UNKNOWN cannot count toward organic maturity;
- UNKNOWN → ORGANIC promotion is a hard blocker;
- correctly separated UNKNOWN prevalence/clustering/dilution are future calibration inputs;
- future tolerance is versioned through `unknown_source_tolerance` and cannot be inferred from whatever prevalence Production happens to exhibit.

## 10. Runtime error risk objective

Runtime classes:

```text
INTEGRITY_AFFECTING_RUNTIME_ERROR
CONTAINED_OBSERVABLE_RUNTIME_ERROR
UNCLASSIFIED_RUNTIME_ERROR
```

An integrity-affecting error is a hard blocker when it causes or implies actual exclusion, canonical Recommendation mutation, provenance/evidence corruption, or stop-required integrity failure.

A contained observable runtime error is a calibratable risk domain.

Normative semantics:

- one isolated contained error is not automatically systematic instability;
- one isolated contained error is also not automatically acceptable;
- recurrence/clustering is stronger descriptive risk evidence but does not create acceptance authority;
- unclassified runtime error cannot be promoted;
- characterized zero requires actual organic exposure and valid instrumentation;
- zero under no organic exposure is unobserved, not healthy.

Future acceptance is governed through `runtime_error_tolerance`, later validation, and sequestered holdout.

## 11. Fallback risk objective

Fallback is not equivalent to runtime failure.

Classification:

```text
INTENDED_SAFETY_FALLBACK
EXPECTED_GRACEFUL_DEGRADATION
UNEXPECTED_FALLBACK
FAILURE_MASKING_FALLBACK
UNCLASSIFIED_FALLBACK
```

Semantics:

- fallback existence is not automatic failure;
- intended safety fallback and expected graceful degradation remain calibratable operational behavior;
- unexpected fallback requires empirical characterization and future governed tolerance;
- unclassified fallback cannot be accepted for promotion;
- fallback masking a hard integrity failure inherits hard-blocker precedence.

Future value derivation belongs to `fallback_tolerance`.

## 12. Empirical outcome drift objective

Hard identity stability and empirical outcome-distribution stability remain separate.

Hard identity/version incompatibility or silent cross-regime pooling is an integrity blocker.

Within one compatible version regime, changes in action/context/error/fallback distributions are not automatically failure. They may reflect traffic-mix variation, natural incidence, or instability.

Normative objective:

- preserve exact version/collection identity;
- characterize drift within governed privacy-safe marginals;
- require later-window replication;
- require a future calibrated acceptance envelope tied to the exact normative contract and version regime;
- observations outside the governed envelope block promotion and require investigation or recalibration under a new governed candidate.

No drift percentage is frozen in 9P.

## 13. Non-promotable evidence

The following cannot establish reassessment maturity regardless of apparent strength or volume:

- synthetic-only maturity claim;
- controlled-only maturity claim;
- UNKNOWN treated as organic maturity;
- cross-marginal reconstructed pseudo-user evidence;
- external numeric threshold directly imported as BEJEWELY authority;
- operator-invented tolerance selected to make current evidence pass.

## 14. Promotion acceptance rule

Promotion model:

```text
NON_COMPENSATORY_CONJUNCTIVE_GATE
```

A future theoretical READY requires:

- exact normative contract version referenced;
- no hard blocker;
- genuine organic maturity evidence;
- all nine 9N calibration parameter values versioned and locked;
- calibrated candidate values governance-adopted against this normative contract before validation;
- calibration window/version-regime lineage retained;
- every mandatory objective evaluated non-compensatorily;
- independent later validation passed without retuning;
- sequestered later holdout passed without retuning;
- successor sufficiency policy frozen.

`READY_FOR_SEPARATE_ENFORCE_REASSESSMENT` remains only permission to open a separate reassessment. It does not authorize or activate ENFORCE.

## 15. Calibrated value adoption policy

A critical anti-circularity rule is frozen:

```text
empirical derivation
!=
permission
```

Future empirical calibration may derive candidate values. It may not automatically declare those values acceptable because they describe observed Production.

Candidate values require a separate versioned governance adoption step against the frozen 9P normative objectives before validation evidence is used.

Forbidden:

- adopting a threshold retroactively because it makes current evidence pass;
- using a Production quantile or historical prevalence as permission by itself;
- importing an external number directly as BEJEWELY acceptance authority.

## 16. Precedence and compensation policy

Precedence:

```text
BLOCKED_INTEGRITY_FAILURE
>
NOT_READY_FOR_MISSING_UNOBSERVED_OR_NON_PROMOTABLE_EVIDENCE
>
SUFFICIENCY_CALIBRATION_REQUIRED
>
READY_FOR_SEPARATE_ENFORCE_REASSESSMENT
```

Compensation model:

```text
NON_COMPENSATORY_GATE
```

Specifically:

- high execution volume cannot compensate poor context breadth;
- broad contexts cannot compensate unresolved runtime risk;
- long horizon cannot compensate UNKNOWN attribution risk;
- action coverage cannot compensate integrity failure;
- weighted total score is forbidden;
- a strong average cannot override a hard safety/integrity violation.

Any future exception requires an explicit domain-specific governance contract.

## 17. Missing / zero / unobserved semantics

9N semantics are preserved:

```text
ZERO != MISSING
CHARACTERIZED_ZERO != UNOBSERVED
```

Example:

```text
organic execution observed
+ valid runtime-error instrumentation
+ runtime_error = zero
→ characterized zero candidate
```

but:

```text
organic execution absent
+ runtime_error = zero
→ unobserved
```

Unobserved cannot be promoted as healthy and cannot be compensated by another metric.

## 18. Authority lineage

### Frozen BEJEWELY safety/governance invariants

Authority for hard boundaries and fail-closed integrity semantics.

### Existing Recommendation semantic commitments

Authority for the requirement that SHADOW not mutate canonical Recommendation behavior.

### Organic Production evidence

Authority to describe natural behavior, prevalence, recurrence, diversity, and stability. It does not create permission by itself.

### Controlled Production evidence

Authority for wiring, provenance, instrumentation, and explicit branch reachability only.

### Synthetic / Persona evidence

Authority for contracts, edge scenarios, metamorphic/regression tests, and reachability only.

### External scientific / industry guidance

May inform methodology and risk framing. It does not automatically create a BEJEWELY threshold.

### Operator governance

May enact a documented prospective policy under frozen authority lineage. Pure preference or retroactive threshold selection is insufficient authority.

## 19. External conceptual cross-check and authority ceiling

Current external references were used only as conceptual cross-checks.

### NIST AI Risk Management Framework / AIRC

Supports:

- organizational risk tolerance is a governance matter;
- measurement/monitoring are distinct from governance/permission;
- risk tolerance is context- and organization-dependent;
- governance establishes repeatable policies and authority.

Does not support any particular BEJEWELY error, fallback, UNKNOWN, coverage, or drift number.

```text
Authority ceiling = METHODOLOGY_AND_RISK_FRAMING_REFERENCE_ONLY
```

### Google SRE error-budget / SLO governance examples

Supports the conceptual separation of measured operational behavior from a separately established reliability objective/policy and stakeholder-approved consequence policy.

Does not support importing a Google SLO/error-budget percentage into BEJEWELY.

```text
Authority ceiling = CONCEPTUAL_OPERATIONAL_GOVERNANCE_REFERENCE_ONLY
```

## 20. Privacy boundary

9O privacy constraints remain unchanged:

- no unique-user reconstruction;
- no composite context fingerprint;
- no cross-marginal join;
- privacy-safe aggregates only.

A normative objective cannot authorize a privacy-unsafe calibration method.

## 21. Synthetic / controlled authority ceiling

Synthetic can support contract verification, edge scenarios, metamorphic tests, rare-path reachability, and regression.

Controlled Production can support wiring validation, provenance validation, explicit branch reachability, and instrumentation validation.

Neither can establish natural prevalence, natural recurrence, natural diversity, natural runtime stability, organic maturity, risk tolerance calibration, or reassessment readiness.

## 22. Current Production and durable evidence snapshot at 9P entry

Latest live Production deployment at Stage start:

```text
dpl_7VoWyfiQS261S17KzibvhHkxtY79
SHA = a4772e3cd44d68f67fe4bbf25926ba0942f353b3
```

Runtime readback:

```text
requestedMode = SHADOW
effectiveMode = SHADOW
enabledRequested = true
killSwitchRequested = false
runtimeAllowed = true
runtimeActive = true
authorizedMode = SHADOW
enforcementAllowed = false
enforceActive = false
restrictCanonicalExclusionActive = false
versionCompatible = true
scopeValid = true
reasonCodes = ["staged_shadow_runtime_allowed"]
```

Fresh durable evidence read window:

```text
[2026-08-20, 2026-08-22)
```

Result:

```text
durable rows = 0
observed_days = 0
ORGANIC_PRODUCTION = 0
CONTROLLED_PRODUCTION_PROBE = 0
UNKNOWN_PRODUCTION_SOURCE = 0
actual_exclusion = 0
context_marginals = []
version_groups = []
stop_reason_distribution = []
```

Therefore:

```text
CALIBRATION_EXECUTABLE_NOW = NO
CURRENT_REASSESSMENT_TRIGGER = NOT_READY
reason = organic_traffic_absent
```

These zeros are unobserved, not healthy acceptance evidence.

## 23. Product Fact baseline at 9P entry

Fresh Hosted read-only counts:

```text
Catalog                     = 164
Registry versions           = 1
Definitions                 = 20
Subjects                    = 16
Sources                     = 16
Bindings                    = 16
Evidence                    = 41
Fact Instances              = 41
Evidence Links              = 41
Assignments                 = 41
Review Events               = 180
Confirmations               = 41
Current                     = 41
Adopted distinct products   = 16
Populated Current Fact keys = 12
```

9P permits no Product Fact write.

## 24. Fixture contract

The focused verifier contains F1-F16 and freezes semantics for:

- zero organic evidence;
- one-event category-complete evidence not becoming READY;
- isolated vs repeated contained runtime errors;
- isolated vs repeated/unexpected fallbacks;
- correctly separated UNKNOWN;
- UNKNOWN promoted as organic;
- SHADOW actual exclusion;
- controlled/synthetic reachability without organic maturity;
- volume unable to compensate context breadth;
- context breadth unable to compensate unresolved runtime risk;
- calibrated descriptors without promotion rule;
- complete normative contract with numeric values absent;
- operator-invented tolerance;
- direct external numeric threshold import.

## 25. Determinism

The contract uses canonical recursive key ordering. The focused verifier serializes Build A and Build B independently and requires byte-identical output and equal SHA-256 semantic hashes.

Volatile deployment IDs, timestamps, and run IDs are not part of the contract semantic hash.

## 26. Implementation scope

Expected additive scope only:

```text
.github/workflows/v21-9p-enforce-reassessment-normative-acceptance.yml
lib/exfoliation-normative-policy-reassessment-normative-acceptance.js
scripts/fixtures/exfoliation-normative-reassessment-normative-acceptance-fixtures-v1.json
scripts/product-evidence/verify-v21-9p-enforce-reassessment-normative-acceptance-v1.mjs
docs/evidence/v21-9p-enforce-reassessment-normative-acceptance-v1.md
```

Expected semantic deltas:

```text
Supabase migration = 0
Hosted write = 0
Production API delta = 0
Recommendation delta = 0
CandidatePolicy delta = 0
Product Fact delta = 0
runtime-control delta = 0
```

## 27. Current and future readiness semantics

```text
NORMATIVE GOVERNANCE COMPLETE
!=
CALIBRATION COMPLETE
!=
READY_FOR_SEPARATE_ENFORCE_REASSESSMENT
!=
ENFORCE_AUTHORIZED
!=
ENFORCE_ACTIVE
```

At 9P entry, current Production evidence remains organic-zero, so the genuine trigger remains `NOT_READY`.

## 28. Final principle

More data can improve measurement. It cannot manufacture governance authority.

Future calibration can derive candidate values only under a pre-frozen method and normative objective. Those values must receive prospective, versioned governance adoption and survive independent validation and sequestered holdout before contributing to reassessment sufficiency.
