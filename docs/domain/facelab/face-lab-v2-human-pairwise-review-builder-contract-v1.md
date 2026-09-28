# Face Lab V2 — Human Pairwise Review Builder Contract v1

> Track: Face Lab post-16L / PR D
> Status: deterministic blind packet builder
> Human judgments collected by this change: 0
> LLM judge calls made by this change: 0
> Production authority: none

## 1. Purpose

This stage turns the frozen vCurrent-vCandidate deterministic comparison into reviewer-ready blind A/B artifacts.

It does not collect a Human judgment.
It does not reveal engine identity.
It does not aggregate Human results.
It does not call an LLM judge.

## 2. Output separation

The builder exposes two separate artifacts.

### Reviewer packet

~~~text
face-lab-v2-human-pairwise-review-packet-v1
~~~

Contains only:

- frozen Human Pairwise Contract version
- rubric dimensions
- blind review items
- reviewer-visible current-face context
- reviewer-visible Target context
- A/B recommendations
- packet digest

### Operator manifest

~~~text
face-lab-v2-human-pairwise-operator-manifest-v1
~~~

Contains:

- A/B → current/candidate role mapping
- engine versions
- sample bucket
- candidate relation IDs
- route-mutation diagnostic
- sampling seed and counts
- manifest digest

The operator manifest must never be presented to the reviewer before sealed Human judgment.

## 3. Reviewer-safe projection

Candidate implementation metadata would break blinding if copied directly.

The builder therefore removes:

~~~text
candidate_relation:FL-CAND-*
candidate engine version
candidatePersonalization
personalizationLedger
sample bucket
selectedRouteChanged
A/B role mapping
~~~

Candidate reason tokens are projected to role-neutral visible tokens:

~~~text
candidate_face_fit_curve_alignment
→ face_fit_curve_alignment

candidate_face_fit_straight_alignment
→ face_fit_straight_alignment
~~~

Visible recommendation semantics remain reviewable:

- domain
- parameter
- direction
- strength
- explanation
- Target evidence
- face evidence

## 4. Fixed packet composition

The v1 packet contains exactly 14 pairs.

### A — route mutation

All 5 fixed Target Sweep cases where vCandidate-1 changes the selected-route recommendation semantics.

~~~text
count = 5
~~~

### B — activation boundary

All 3 fixed Target Sweep cases where candidate relations activate in Style Delta but the selected route remains recommendation-identical.

~~~text
count = 3
~~~

These cases help calibrate indistinguishable/tie behavior without fabricating a recommendation difference.

### C — high repetition

One deterministic representative for each fully-collapsed 16L Target:

~~~text
classic
mature_calm
minimal
natural
sophisticated
trendy
~~~

~~~text
count = 6
~~~

The representative face is selected by deterministic hash ranking, not manual preference.

Total:

~~~text
5 + 3 + 6 = 14
~~~

## 5. Why identical A/B pairs are preserved

For activation-boundary and high-repetition cases, the reviewer-visible recommendations may be identical.

The builder must not invent wording or mutate a recommendation merely to create an A/B difference.

These pairs are valid calibration material for:

- tie
- recommendations_indistinguishable
- uncertain/not-assessable decisions when appropriate under the frozen Human contract

## 6. Deterministic A/B assignment

All 14 sampled cases are deterministically shuffled using:

~~~text
face-lab-v2-human-pairwise-sample-v1
~~~

After ordering, role placement alternates.

Result:

~~~text
A=current   7
A=candidate 7
~~~

This gives exact role balance without random runtime state.

The seed and mapping are operator-only.

## 7. Pair IDs and digests

Each pair receives a deterministic contract-compliant ID:

~~~text
flhp_<24 lowercase hex>
~~~

Every review item is sealed with the existing Human Pairwise item digest contract.

The review packet and operator manifest also carry independent SHA-256 digests.

## 8. Review context

Each item exposes the same input context used by both recommendation options:

- Target label
- six-axis Target vector
- current-face key features
- Styling Scope
- bounded constraints

No engine-specific context exists in the reviewer packet.

## 9. Recommendation digest

Each A/B option receives a digest over its reviewer-visible representation only:

~~~text
routeStrategy
actions[
  domain
  parameter
  direction
  strength
  reason
  evidence
  explanation
]
~~~

Therefore identical visible recommendations produce identical recommendation digests.

## 10. Blind-state hard gates

The reviewer packet must not contain any of:

~~~text
FL-CAND-
candidate_relation:
candidate_face_fit_
face-lab-style-delta-candidate-v1
sampleBucket
selectedRouteChanged
candidateRelationIds
operator role mapping
~~~

It must still preserve role-neutral face evidence such as:

~~~text
face_feature:straightCurveBalance=curved
~~~

when that evidence is part of the recommendation shown for review.

## 11. Review-item contract

Every item must pass:

~~~text
validateFaceLabV2HumanPairwiseReviewItem()
verifyFaceLabV2HumanPairwiseDigest()
~~~

The existing blind state remains:

~~~text
engineRoleHidden = true
engineVersionHidden = true
pairMappingHidden = true
priorHumanJudgmentsHidden = true
llmJudgmentHidden = true
aggregateResultHidden = true
~~~

## 12. Human rubric

The builder does not change the three Human dimensions:

- target_fit
- specificity
- evidence_action_linkage

No aggregate winner is created.

## 13. CLI boundary

Reviewer-safe output is the default:

~~~bash
node scripts/build-face-lab-v2-human-pairwise-packet.mjs
~~~

Operator-only mapping requires explicit mode:

~~~bash
FACE_LAB_HUMAN_PAIRWISE_OUTPUT=operator node scripts/build-face-lab-v2-human-pairwise-packet.mjs
~~~

A combined output mode does not exist.

## 14. Next gate

After this builder is frozen and verified, the next stage is Human pilot execution:

1. provide reviewer packet only;
2. collect independent Human judgments;
3. seal judgments;
4. only then create reveal artifacts from the operator mapping;
5. report descriptive dimension-level results;
6. do not activate an LLM judge until non-empty Human calibration evidence exists.
