# Face Lab V2 Recommendation Human Pairwise Calibration Contract v1

> Track: Face Lab post-16L / Human Calibration foundation
> Status: contract-only foundation
> Production authority: none
> Human judgments collected by this change: 0
> LLM judge calls made by this change: 0

## 1. Purpose

Deterministic evaluation through Face Lab 16L established contract correctness and exposed recommendation repetition, but it does not establish aesthetic quality or real-user usefulness.

The next authority layer is Human calibration.

This contract freezes the smallest valid review flow:

~~~text
same input
+ vCurrent recommendation
+ vCandidate recommendation
→ blind A/B projection
→ independent Human judgment
→ Human judgment sealed
→ private A/B mapping reveal
~~~

The LLM judge is intentionally not implemented or activated in this stage.

## 2. Why a separate contract is required

Existing Human contracts in the repository evaluate Archetype labels and visible face cues.

Recommendation quality is a different question.

This contract therefore does not reuse Archetype label semantics such as top-1, taxonomy consensus, or visual-cue ground truth.

It reuses only the governance principles:

- independent reviewer identity
- explicit blind state
- uncertainty preservation
- sealed judgment
- reveal after Human seal
- versioned provenance
- no Production activation from evaluation data alone

## 3. Pairwise dimensions

The first calibration contract evaluates exactly three dimensions.

### target_fit

Which recommendation better reflects the confirmed Target Style?

### specificity

Which recommendation is more specific to this input instead of reading like a generic styling answer?

### evidence_action_linkage

Which recommendation more clearly connects current-face evidence to the proposed action?

There is deliberately no single aggregate winner field.

Human disagreement across dimensions is valid evidence.

## 4. Reviewer-visible context

A review item may contain only the context needed to judge recommendation semantics:

- Target label
- six-axis Target vector
- CurrentFaceProfile feature projection
- Styling Scope
- Constraints
- anonymous Option A
- anonymous Option B

Each option exposes:

- selected route strategy
- route actions
- action reason
- action evidence
- action explanation

The reviewer-visible object contains no current/candidate role or engine-version mapping.

## 5. Required blind state

Every valid review item freezes all fields below to true.

~~~text
engineRoleHidden
engineVersionHidden
pairMappingHidden
priorHumanJudgmentsHidden
llmJudgmentHidden
aggregateResultHidden
~~~

A review item that exposes which side is current or candidate is invalid Human calibration evidence.

## 6. Assessability and uncertainty

Assessability is explicit:

- assessable
- uncertain_assessability
- not_assessable

Allowed pairwise verdict per dimension:

- A
- B
- tie
- uncertain
- not_assessable

A not-assessable judgment forces every dimension to not_assessable.

An uncertain-assessability judgment must preserve at least one uncertain dimension.

The contract never forces an A/B winner.

## 7. Sealing and reveal

A Human judgment must be sealed.

Only after at least one sealed Human judgment may a private reveal artifact be valid.

The reveal binds:

~~~text
Option A → current or candidate
Option B → the other role
engine versions
recommendation digests
sealed Human judgment digests
~~~

The reveal timestamp must be after each bound Human judgment submission time.

## 8. LLM Judge activation boundary

The post-16L transfer contract requires:

~~~text
Human Calibration
+
Bounded Pairwise LLM Judge
~~~

in that order.

Therefore this v1 does not create a valid LLM-judge artifact schema and does not call any provider.

Before a bounded LLM judge can be used operationally, a later contract must prove all of the following:

1. a non-empty sealed Human calibration set exists,
2. the LLM sees the same blind A/B information boundary,
3. LLM outputs use the same bounded dimensions,
4. Human-to-LLM agreement/disagreement is measured by dimension,
5. disagreement is preserved rather than overwritten,
6. the judge remains diagnostic-only and cannot authorize Production changes.

## 9. Relationship to 16L findings

16L measured 96 deterministic Target-Sweep cases.

The initial baseline found:

~~~text
targetFullyCollapsedCount = 6 / 12
averageTargetUniqueActionSignatureCount = 1.667
averageFaceUniqueActionSignatureCount = 10
routeConcentration = 1.0
~~~

The fully collapsed Targets were:

- classic
- mature_calm
- minimal
- natural
- sophisticated
- trendy

These numbers motivate Human review but do not themselves prove that the repeated recommendations are aesthetically wrong.

## 10. Non-goals

This stage does not:

- collect Human responses
- recruit reviewers
- call an LLM judge
- add new styling heuristics
- choose a winning candidate engine
- change Style Delta rules
- change route generation
- set arbitrary preference thresholds
- authorize Production activation
