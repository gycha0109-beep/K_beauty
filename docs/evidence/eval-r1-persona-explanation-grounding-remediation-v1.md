# EVAL-R1 Persona Findings → Production Remediation

## Stage

`EVAL-R1 — P8 Explanation Grounding Defect Inventory, Fix & Regression Closure`

## Starting authority

- Repository: `gycha0109-beep/K_beauty`
- Starting main: `5409a5913107064c214733f967ea0f61bc1edfa8`
- Starting Production SHA: `5409a5913107064c214733f967ea0f61bc1edfa8`
- P10 merged ancestor: `8d43a30497a310a1d5a64c5c593fc786e3281d12`
- Drift classification: `UNRELATED_DRIFT`

The intervening G2 change freezes initial non-legacy candidate admission authority and does not mutate Persona fixtures, Recommendation scoring/ranking, Product Fact/PDA semantics, CandidatePolicy/ENFORCE, or explanation generation.

## Frozen Persona authority

- P6 LOCKED regression cohort: 37 Personas; cohort hash `c774fc52ae1494c5a4fc39d11d2e7564a196460db391bb94f41d0510b7ae59f8`.
- P8 bounded judge remains `DIAGNOSTIC_ONLY`; its observations are synthetic diagnostic evidence, not real-user or Product Fact truth.
- P10 deterministic multi-step journey remains the journey regression authority.

## P8 authoritative grounding inventory

P8 contains five affected cases and six discrete unsupported grounding findings:

| Finding | Case | Exact relation | Taxonomy | Severity |
| --- | --- | --- | --- | --- |
| EVAL-R1-F01 | P3-C02 | `postWashFeeling=comfortable` → `세안 뒤 당김이 이어지는 피부` | DIRECT_INPUT_CONTRADICTION | CRITICAL |
| EVAL-R1-F02 | P3-C03 | `postWashFeeling=still_oily` → `세안 뒤 당김...` | DIRECT_INPUT_CONTRADICTION | CRITICAL |
| EVAL-R1-F03 | P3-C03 | `sensitivity=low` → `민감도가 높아...` | INPUT_SEVERITY_OVERSTATEMENT | CRITICAL |
| EVAL-R1-F04 | P3-C06 | `sensitivity=medium` → `민감도가 높아...` | INPUT_SEVERITY_OVERSTATEMENT | HIGH |
| EVAL-R1-F05 | P3-A02 | high sensitivity / no direct current redness → `붉은기가 같이 잡힌 피부` | USER_STATE_OVERGENERALIZATION | HIGH |
| EVAL-R1-F06 | P3-A05 | `sensitivity=medium` → `민감도가 높아...` | INPUT_SEVERITY_OVERSTATEMENT | HIGH |

The exact Persona inputs, output fragments, source case IDs and root-cause IDs are frozen in `fixtures/persona-evaluation/eval-r1-explanation-grounding-remediation-v1.json`.

## Root cause

### RC01 — composite dryness → post-wash tightness copy

`buildKoreanCategoryAwareReason()` computes `highDry` from multiple sources:

- dehydration score threshold,
- dry skin type,
- explicit post-wash tightness.

The moisturizer copy then renders all three sources as `세안 뒤 당김`. This collapses a derived dryness state into a specific user answer and contradicts `comfortable` in C02.

### RC02 — composite sensitive state → tightness copy

The same explanation builder computes `sensitiveState` from high sensitivity, barrier/redness score thresholds and photo axes. The cleanser branch renders that composite as `세안 뒤 당김이나 예민함`, inventing tightness when C03 explicitly says `still_oily`.

### RC03 — barrier score → high-sensitivity copy

`buildSurveyEvidence()` currently branches on:

`answers.sensitivity === "high" || scoreCard.barrier.total >= 18`

but the shared prose is `민감도가 높아 장벽 우선 가중치를 더했습니다.` Therefore low/medium inputs can be narrated as high sensitivity when barrier weighting is high.

### RC04 — composite sensitive state → current redness copy

The serum branch renders the composite `sensitiveState` as `예민함이나 붉은기가 같이 잡힌 피부`. A high-sensitivity input can therefore be promoted into affirmative current redness even when redness exists only as a downstream scoring axis.

## Remediation contract

The fix is explanation-only.

Allowed delta:

- grounded reason wording,
- survey evidence wording/selection,
- premium detailed explanation derived from those strings.

Forbidden delta:

- Product score,
- engine score,
- ranking,
- Top1/Top3 identity,
- eligible candidate set,
- CandidatePolicy fingerprint,
- survey-derived safety state,
- Product Fact/PDA/Admission/ENFORCE semantics.

Grounding invariant:

`Explanation claim must be supported by explicit user input OR an authoritative derived state.`

Specific guards:

- missing != affirmative state,
- medium != high,
- low != high,
- comfortable != tight,
- still_oily != tight,
- derived redness weighting != affirmative current redness.

## Regression contract

Blocking:

- explicit input contradiction,
- deterministic grounding invariant failure,
- hard-reject violation,
- reproducibility failure,
- Recommendation semantic/ranking/score/eligibility delta.

Review required, not automatically blocking:

- intentional product/ranking changes in future stages,
- stylistic explanation changes,
- cohort-level utility movement.

EVAL-R1 itself permits only explanation changes that correspond to a reproducible baseline grounding violation or an authoritative P8 finding.

Required validation:

1. focused E1–E6 and locale E10 probes;
2. exact P8 baseline/candidate offending-case comparison;
3. P6 37-Persona baseline/candidate replay with projection/ranking/score/CandidatePolicy/survey-derived zero-delta;
4. P10 deterministic journey replay A/B;
5. existing P3 deterministic harness;
6. historical 164×12 Recommendation invariance;
7. Production build;
8. repository-only scope and Hosted read-only zero-delta verification.

## Authority ceiling

EVAL-R1 output remains `SYNTHETIC_SIMULATION_EVIDENCE` for defect reproduction and regression validation. It is not organic Production evidence, real-user efficacy evidence, Product Fact authority, or ENFORCE authorization evidence.

<!-- one-shot bounded correction trigger; replaced by final evidence update -->
