# Face Lab V2 — Candidate Personalization Evaluation Contract v1

> Track: Face Lab post-16L / PR C
> Status: deterministic current-vs-candidate diagnostic
> Production authority: none
> Human judgments collected by this change: 0
> LLM judge calls made by this change: 0

## 1. Question

This stage asks:

- where vCandidate-1 actually activates on the fixed 8-face × 12-target Target Sweep;
- whether every candidate change is traceable to an allowed candidate relation;
- whether Target / Scope / Constraint / action identity authority remains intact;
- how selected-route specificity and repetition change relative to vCurrent.

It does not ask which engine is aesthetically better.

## 2. Fixed comparison surface

The evaluator reuses the existing Target Sweep cohort:

~~~text
8 structured faces
× 12 confirmed Targets
= 96 cases
~~~

For every case:

~~~text
same analysis
same confirmed Target
same Styling Scope
same Constraints

→ vCurrent Style Delta + Routes
→ vCandidate Style Delta + Routes
~~~

No population inference is allowed from this synthetic surface.

## 3. vCurrent construction

vCurrent uses the existing production path:

~~~text
buildFaceLabV2Canonical()
~~~

Therefore its currentFaceProfile, targetStyle, styleDelta, routes, and selected default route are the current production semantics.

The frozen PR A equivalence verifier remains a separate hard gate.

## 4. vCandidate construction

vCandidate reuses vCurrent currentFaceProfile and targetStyle:

~~~text
buildCandidateStyleDelta({
  currentFaceProfile,
  targetStyle
})

→ buildStyleRoutes(candidateStyleDelta)
→ candidate default route
~~~

No candidate canonical persistence or UI wiring exists.

## 5. Hard authority gates

Candidate evaluation fails only for deterministic authority violations.

### C1 — action count authority

Candidate may not create or delete Target actions.

### C2 — action identity authority

At each Style Delta priority position, candidate must preserve:

- rank
- domain
- parameter
- direction
- constraintState
- blockedBy

### C3 — blocked-action authority

A blocked action must remain byte-equivalent to current.

### C4 — relation-bounded change

If no candidate relation activates, candidate active Style Delta semantics must equal current.

### C5 — candidate relation lineage

Every personalization ledger entry must resolve to a candidate action containing:

~~~text
candidate_relation:<relationId>
~~~

### C6 — face evidence lineage

Every candidate relation action must include face_feature evidence.

### C7 — Target evidence lineage

Every candidate relation action must preserve:

~~~text
target_axis:softSharp
~~~

### C8 — case accounting

All 96 Target Sweep cases must be evaluated.

## 6. Diagnostics

The first candidate baseline records:

- candidateActivatedCaseCount
- styleDeltaChangedCaseCount
- selectedRouteChangedCaseCount
- relationActivationCounts
- targetActivationCounts
- faceActivationCounts
- faceEvidenceUtilizationRate
- humanVisibleRationaleMutationRate
- routeMutationRate

For both vCurrent and vCandidate it also records:

- unique route strategy count
- unique action signature count
- unique parameter signature count
- unique wording signature count
- route concentration
- action-signature concentration
- parameter-signature concentration
- wording concentration
- target-specific repetition
- face-specific repetition
- fully collapsed target count
- average target unique action-signature count
- average face unique action-signature count

## 7. Signature definition

Selected-route action signature:

~~~text
domain
+ parameter
+ direction
+ strength
+ reason
~~~

Parameter signature:

~~~text
domain
+ parameter
~~~

Wording signature:

~~~text
exact selected-route explanation strings
~~~

## 8. No diversity promotion threshold

This contract does not require:

- collapsed target count to decrease;
- unique action signatures to increase;
- route mutation rate to exceed a minimum;
- candidate activation to cover every Target;
- vCandidate to outperform vCurrent on any aggregate metric.

Those are diagnostic observations only.

A candidate could make recommendations more diverse but worse.

## 9. Current baseline lock

The current side must still reproduce the 16L baseline:

~~~text
currentTargetFullyCollapsedCount = 6
currentAverageTargetUniqueActionSignatureCount = 1.667
currentAverageFaceUniqueActionSignatureCount = 10
~~~

These are regression checks for vCurrent, not promotion criteria for vCandidate.

## 10. Candidate parameter boundary

vCandidate-1 only changes strength / rationale / evidence.

Therefore current and candidate must expose the same parameter-signature vocabulary.

A new parameter signature would indicate that the bounded PR B contract was exceeded.

## 11. Human calibration boundary

Deterministic diagnostics cannot establish aesthetic quality.

After this baseline, candidate cases may be sampled into the already-frozen Human Pairwise Contract.

Human dimensions remain:

- target_fit
- specificity
- evidence_action_linkage

No LLM judge is activated in this stage.

## 12. Manual execution

~~~bash
FACE_LAB_EVAL_COHORT=candidate-personalization npm run eval:face-lab-v2
~~~

The all-suite runner also includes the candidate report as diagnostic output.

## 13. First observed baseline

The first fixed 96-case run produced:

~~~text
candidateActivatedCaseCount = 8
styleDeltaChangedCaseCount = 8
selectedRouteChangedCaseCount = 5
routeMutationRate = 0.0521

candidateRelationActionCount = 5
faceEvidenceUtilizationRate = 1.0
humanVisibleRationaleMutationRate = 1.0

FL-CAND-001 activation = 6
FL-CAND-002 activation = 2
~~~

Target activation counts:

~~~text
clear_soft = 2
soft = 2
cute_playful = 2
chic = 1
defined = 1
~~~

Distribution comparison:

~~~text
                         vCurrent   vCandidate

unique action signatures     17          18
unique parameter signatures  11          11
unique wording signatures    17          18
unique route strategies       1           1

fully collapsed Targets       6           6
avg Target unique actions   1.667       1.75
avg Face unique actions       10          10
~~~

The candidate therefore has a deliberately bounded effect:

- it reaches only 8 / 96 Target Sweep cases;
- it changes selected-route semantics in 5 / 96 cases;
- it adds one additional action/wording signature on this synthetic surface;
- it does not change the parameter vocabulary;
- it does not reduce the six fully collapsed Targets.

These numbers are diagnostics, not a quality verdict.

The unchanged fully-collapsed Target count supports the existing design boundary: vCandidate-1 Face Fit alone is not expected to solve classic / trendy / natural / polished-style Current-gap problems. Those remain candidates for a separately authorized Current Styling Baseline rather than broader face-structure heuristics.

## 14. Interpretation

A changed selected route proves only that the candidate policy propagated to route semantics.

A lower collapsed-target count proves only that the synthetic action-signature distribution changed.

Neither result establishes that the candidate is better, more attractive, or suitable for Production.
