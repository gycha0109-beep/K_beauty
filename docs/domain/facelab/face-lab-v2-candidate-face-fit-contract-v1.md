# Face Lab V2 — vCandidate-1 Face Fit Foundation Contract v1

> Track: Face Lab post-16L / PR B
> Status: evaluation-only candidate foundation
> Production authority: none
> Human judgments collected by this change: 0
> LLM judge calls made by this change: 0

## 1. Purpose

PR A froze the current Style Delta semantics and split Target Action Pool from current face modifiers.

PR B adds a parallel candidate path without changing production buildStyleDelta().

The candidate question is deliberately narrow:

> When the current visible straight/curve language already aligns with a softSharp Target action, does reducing the strength of an additional eyewear geometry change improve specificity and evidence-to-action linkage?

This is a candidate hypothesis, not a production styling rule.

## 2. Candidate path

~~~text
production current path

Target Style
→ Target Action Pool
→ CURRENT_CONTRACT modifiers
→ Scope / Constraints
→ buildStyleDelta()


evaluation-only candidate path

buildStyleDelta()
→ Face Fit Planner
→ CANDIDATE_HYPOTHESIS strength cap
→ buildCandidateStyleDelta()
~~~

The candidate therefore inherits current Target, Scope, Constraint, current-modifier, rank, and blocked-action authority before candidate policy is applied.

## 3. Why candidate policy is applied after current constraints

vCandidate-1 does not create, delete, redirect, unblock, or reorder actions.

It can only lower strength on an already-allowed action.

Applying it after current Style Delta assembly guarantees:

- blocked actions are not rewritten,
- Scope remains authoritative,
- hard exclusions remain authoritative,
- Target action identity remains unchanged,
- current production logic remains untouched.

A later candidate that requires redirect or priority reordering must introduce a new contract rather than silently extending this one.

## 4. Candidate relation set

Exactly two candidate relations are active in v1.

### FL-CAND-001

~~~text
Current cue:
straightCurveBalance = curved

Target action:
eyewear:curvature
direction = increase
reason = target_softSharp_low

Candidate operation:
strength_cap → light
~~~

Rationale:

The current engine already uses straightCurveBalance=curved as an over-amplification guard for hair curvature. vCandidate-1 tests whether the same visible geometry evidence is useful for bounding an adjacent eyewear-curvature action.

The candidate explanation is:

~~~text
현재 얼굴의 곡선 흐름이 이미 분명하게 읽히므로
안경 프레임의 곡률은 크게 더하기보다
가볍게 보태는 수준으로 제한합니다.
~~~

### FL-CAND-002

~~~text
Current cue:
straightCurveBalance = straight

Target action:
eyewear:angularity
direction = increase
reason = target_softSharp_high

Candidate operation:
strength_cap → light
~~~

This is the symmetric straight-geometry hypothesis.

The candidate explanation is:

~~~text
현재 얼굴의 직선 흐름이 이미 분명하게 읽히므로
안경 프레임의 각은 크게 더하기보다
가볍게 보태는 수준으로 제한합니다.
~~~

## 5. Why only straightCurveBalance is used

The operational-definition contract marks straightCurveBalance as ready for blind Human cue audit.

PR B does not expand candidate authority to:

- featureContrast
- contourDefinition
- eyeLength
- faceShape
- faceLengthBalance
- featureConcentration

featureContrast requires decomposition.
contourDefinition and eyeLength require additional validation.
The remaining fields may be observable, but PR B has no sufficiently direct action-family hypothesis that justifies adding a styling rule.

The absence of a candidate rule is intentional.

## 6. Candidate authority

Every candidate relation is:

~~~text
authorityClass = CANDIDATE_HYPOTHESIS
humanCalibrationRequired = true
productionActive = false
~~~

No candidate relation is CURRENT_CONTRACT.

No production caller imports buildCandidateStyleDelta().

## 7. Allowed semantic change

For a matching allowed action, vCandidate-1 may change only:

- strength: moderate → light
- expectedEffect
- reason
- action evidence
- candidatePersonalization metadata

It may not change:

- action count
- domain
- parameter
- direction
- rank
- constraintState
- blockedBy
- Target vector
- Styling Scope
- Constraints

## 8. Evidence lineage

A modified candidate action keeps Target evidence and appends:

~~~text
face_feature:straightCurveBalance=<value>
candidate_relation:<relationId>
~~~

candidatePersonalization also preserves:

- baseReason
- relationId
- sourceFeatureKey
- sourceValue
- authorityClass
- operation
- planner version
- relation registry version

## 9. Candidate result lineage

buildCandidateStyleDelta() exposes:

~~~text
candidatePolicy.productionActive = false
candidatePolicy.currentStyleDeltaVersion
candidatePolicy.targetActionPoolVersion
candidatePolicy.currentFaceModifierVersion
candidatePolicy.candidateRelationRegistryVersion
candidatePolicy.faceFitPlannerVersion
personalizationLedger
~~~

This metadata is evaluation provenance.

It is not added to the production canonical result.

## 10. Deterministic hard gates

The PR B verifier requires:

1. exactly two candidate relations;
2. both are CANDIDATE_HYPOTHESIS;
3. both use only straightCurveBalance;
4. both use only strength_cap to light;
5. no candidate relation uses blocked or unreviewed cue expansion;
6. candidate action count equals current;
7. domain/parameter/direction/rank/constraint state remain equal;
8. blocked actions are byte-equivalent to current actions;
9. non-matching faces preserve current action semantics;
10. candidate result remains executable by the current Route Generator;
11. current PR A golden equivalence verifier remains green.

## 11. Relationship to 16L

vCandidate-1 is not intended to solve all six fully collapsed Targets.

In particular, classic/trendy/natural/polished-style gaps still require a Current Styling Baseline rather than face-structure heuristics.

The purpose of this candidate is to establish a safe, inspectable vCurrent-vCandidate comparison path and test one bounded face-fit hypothesis before broader expansion.

## 12. Human and LLM boundary

This PR collects no Human judgments and calls no LLM judge.

The next stages remain:

~~~text
PR C
candidate deterministic side-by-side diagnostics

PR D
blind Human pair builder

PR E
sealed Human pilot

later only
bounded LLM judge calibration
~~~

No candidate rule gains production authority from deterministic metrics alone.
