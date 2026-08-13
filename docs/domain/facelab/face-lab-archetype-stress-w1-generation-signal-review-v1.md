# Face Lab Archetype Stress W1 Generation Signal Review v1

## 0. Status

- Gate: `FACE-EVAL-CX1G`
- Source campaign: `face-eval-c-archetype-stress-pilot-v1`
- Source wave: `W1`
- Classification: `W1_GENERATION_SIGNAL_REVIEW_REQUIRED`
- Next diagnostic: `moderate_strength_required_axis_rerun`
- Provider calls in this freeze: `0`
- W2: locked

This document freezes a diagnostic interpretation. It is not Human Gold, Real calibration, production validation, or production activation.

## 1. W1 Result

W1 produced seven imported candidates and seven valid blind observations. All seven face analyses were available. After blind scoring was sealed, intent reveal found:

- exact generation-intent cue recovery: `0 / 14`
- available-but-mismatched exact cues: `14 / 14`
- unavailable cues: `0 / 14`
- current rubric required-indicator matches: `1 / 14`
- target at blind top: `1 / 7`
- blind-top distribution: `puppy = 7 / 7`

All 14 W1 feature cues were compiled at `subtle` strength.

## 2. What Was Observed

The observation layer returned available analysis for every candidate and available evidence for every target-required field. The visible values did not exactly recover any of the 14 intended generation values. One observed value, puppy `eyeOpenness=medium`, matched the current rubric's broader `medium|wide` indicator while not matching the exact generation target `wide`.

## 3. What Is Supported

The evidence supports these diagnostic hypotheses:

- `generation-side signal weak possible`
- `ambiguous visual cue`

The broad pattern justifies reviewing generation signal strength before executing W2. It does not identify a single causal layer.

## 4. What Is NOT Proven

W1 does not prove:

- generator failure;
- observation failure;
- rubric failure;
- taxonomy validity;
- calibrated weights or thresholds;
- Real-world accuracy, fairness, or production readiness.

Generation intent is not visible truth. No independent blind Human annotation or Human consensus exists for W1.

## 5. Why W2 Is Blocked

W2 is a negative-contradiction experiment. If the positive required-axis signals are not separable in W1, contradiction results may be uninterpretable. W2 therefore remains locked until the moderate-strength diagnostic is reviewed.

## 6. Generation Strength Contract

The current generation contract already supports `subtle` and `moderate`. The current compiler appends `at subtle strength` only for `subtle`; a `moderate` cue uses the normal versioned cue phrase without that attenuation qualifier.

No compiler, cue registry, provider profile, Archetype rubric, scorer, or observation change is required for this diagnostic.

## 7. Moderate-Strength Diagnostic Design

The diagnostic preserves the seven W1 target/value pairs and subject strata. For every cue, only the feature cue strength changes:

```text
subtle -> moderate
```

The following remain fixed at the slot-contract level:

- cue keys and values;
- target Archetype metadata;
- age band, presentation, and regional appearance hint;
- capture, appearance, skin baseline, variation, and exclusion policy;
- feature cue profile and Archetype taxonomy versions;
- `gpt-image-manual-v1@1.0.0`;
- one independently generated candidate per slot.

Administrative provenance identifiers differ to keep the diagnostic distinguishable. They are not experimental visual variables.

## 8. Identity-Matching Limitation

Reference-image structural editing is not supported by the selected profile. The moderate candidates will be independent new synthetic people. W1 subtle and moderate candidates are therefore not identity-matched causal pairs.

The valid future claim is limited to cohort/slot-level contract comparison: under otherwise matched generation contracts, moderate-strength prompting produced a particular observed diagnostic pattern. It cannot establish within-face causality.

## 9. Execution Budget

- primary slots authorized by the frozen preflight: `7`
- provider calls used: `0`
- generation attempts used: `0`
- technical retry reserve invented: `0`
- synthetic assets written: `0`
- authoritative observation runs used: `0`

Any future technical retry remains failure-only. Cue mismatch or quality preference does not authorize regeneration.

## 10. Blind Evaluation Sequence

Future execution must preserve:

```text
exact prompt generation
-> candidate import
-> target-withheld observation
-> blind scoring seal
-> intent reveal
-> subtle/moderate diagnostic comparison
```

Target metadata must not influence observation or scoring before the blind artifacts are sealed.

## 11. Decision Outcomes

The later diagnostic may produce one of:

- `MODERATE_SIGNAL_RECOVERED`
- `MODERATE_SIGNAL_STILL_NOT_RECOVERED`
- `MIXED_AXIS_RESPONSE`
- `OBSERVATION_LAYER_REVIEW_NEEDED`, only with later independent evidence

No numerical pass threshold is frozen here. None of these states means production calibration is complete.

## 12. Non-Goals

- image generation or Provider calls;
- observation execution or recovery;
- Human judgment or consensus;
- W2 or W3 execution;
- scorer, weight, threshold, taxonomy, or lifecycle changes;
- Synthetic/Real Gold promotion;
- production activation.

## 13. Next Gate

The next gate is coordinator review of the Draft PR and its exact manual packet. Seven moderate images must not be generated until separate explicit Provider execution approval is given.
