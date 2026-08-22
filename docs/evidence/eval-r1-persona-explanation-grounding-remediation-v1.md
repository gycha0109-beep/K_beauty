# EVAL-R1 Persona Findings → Production Remediation

## Stage

`EVAL-R1 — P8 Explanation Grounding Defect Inventory, Fix & Regression Closure`

## Starting authority

- Repository: `gycha0109-beep/K_beauty`
- Original R1 base main: `5409a5913107064c214733f967ea0f61bc1edfa8`
- Final continuation current main: `6fdff47f3c41a4e90dace8b8f7281b51a92d7c3f`
- Final continuation Production SHA: `6fdff47f3c41a4e90dace8b8f7281b51a92d7c3f`
- P10 merged ancestor: `8d43a30497a310a1d5a64c5c593fc786e3281d12`
- Drift classification: `UNRELATED_DRIFT`

The final-continuation drift is the merged G3A protected Product Fact authority read surface. It does not mutate `lib/skin-match-decision-engine.js`, Persona P6/P8/P10, CandidatePolicy, Recommendation scoring/ranking/eligibility, or explanation generation, so EVAL-R1 may safely rebase its six-file scope onto this authority before final verification.

## Frozen Persona authority

- P6 LOCKED regression cohort: 37 Personas; cohort hash `c774fc52ae1494c5a4fc39d11d2e7564a196460db391bb94f41d0510b7ae59f8`.
- P8 bounded judge remains `DIAGNOSTIC_ONLY`; its observations are synthetic diagnostic evidence, not real-user or Product Fact truth.
- P10 deterministic multi-step journey remains the journey regression authority.
- `P8-GROUNDING-005` is classified `NON_AUTHORITATIVE_HANDOFF_ARTIFACT`; it is not part of EVAL-R1 and no prior-use tri-state remediation is authorized by this stage.

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

`buildSurveyEvidence()` branches on high sensitivity or a barrier-score threshold in the baseline implementation, but the shared prose says `민감도가 높아 장벽 우선 가중치를 더했습니다.` Low/medium inputs can therefore be narrated as high sensitivity when only barrier weighting is high.

### RC04 — composite sensitive state → current redness copy

The serum branch renders the composite `sensitiveState` as `예민함이나 붉은기가 같이 잡힌 피부`. A high-sensitivity input can therefore be promoted into affirmative current redness even when redness exists only as a downstream scoring axis.

## Over-remediation audit

The original `f9f9ae59bcf0fb7b0793159e4f92f9bb60c0859f` candidate changed 9 of the 16 authoritative P8 materialized explanations.

- In frozen R1 scope: `C02`, `C03`, `C06`, `A02`, `A05`.
- Outside frozen R1 scope: `C01`, `A01`, `A06`, `A08`.

R1 therefore requires zero explanation delta for `C01`, `A01`, `A06`, and `A08`. The inventory must not be widened to legitimize those collateral copy changes.

## Remediation contract

The fix is explanation-only.

Allowed delta:

- grounded reason wording required to close F01–F06,
- survey evidence wording/selection required to close F01–F06,
- premium detailed explanation derived from those authorized strings.

Forbidden delta:

- Product score,
- engine score,
- ranking,
- Top1/Top3 identity,
- eligible candidate set,
- CandidatePolicy decision semantics,
- survey-derived safety state,
- Product Fact/PDA/Admission/ENFORCE semantics,
- unrelated explanation copy outside the five frozen P8 cases.

Grounding invariant:

`Explanation claim must be supported by explicit user input OR an authoritative derived state.`

Specific guards:

- missing != affirmative state,
- medium != high,
- low != high,
- comfortable != tight,
- still_oily != tight,
- derived redness weighting != affirmative current redness.

## CandidatePolicy invariance measurement correction

P6's legacy field named `candidate_policy_fingerprint` is a SHA-256 of the broader `publicSnapshot()` and therefore contains presentation/explanation state. It is retained as a frozen P6 snapshot field but is not interpreted by EVAL-R1 as CandidatePolicy semantic authority.

EVAL-R1 instead evaluates the actual `candidate-exposure-policy.js` implementation on the repository's deterministic isolated-canary manifest and canonicalizes only CandidatePolicy decision authority:

- top-level `policyVersion`, `status`;
- decision `policyVersion`, `candidateRef`, `exposure`, `reasonCodes`, `currentProductRelation`, `evidenceState`, `laneEligibility`, and `provenance`.

Presentation fields such as explanation text, recommendation reason copy, `comparison_reason`, premium copy, survey evidence prose, routine explanation, summary, and UI strings are excluded.

The comparator is fail-closed in both directions:

- a controlled explanation-only mutation must preserve the semantic projection;
- a controlled policy-semantic mutation must change the projection and be detected.

Frozen P6 harness code and CandidatePolicy implementation code are not modified by this correction.

## Regression contract

Blocking:

- explicit input contradiction,
- deterministic grounding invariant failure,
- unauthorized P8 explanation delta,
- hard-reject violation,
- reproducibility failure,
- Recommendation semantic/ranking/score/eligibility delta,
- actual CandidatePolicy semantic projection delta.

Review required, not automatically blocking:

- intentional product/ranking changes in future stages,
- stylistic explanation changes authorized by a future stage,
- cohort-level utility movement.

EVAL-R1 itself permits only explanation changes required by the six frozen findings.

Required validation:

1. focused E1–E6 and locale E10 probes;
2. exact P8 baseline/candidate offending-case comparison plus zero out-of-scope explanation delta;
3. P6 37-Persona baseline/candidate replay with projection/ranking/score/survey-derived zero-delta;
4. actual CandidatePolicy baseline/candidate semantic projection equality plus comparator V1/V2 self-tests;
5. P10 deterministic journey replay A/B;
6. existing P3 deterministic harness;
7. historical 164×12 Recommendation invariance;
8. Production build;
9. repository-only scope and Hosted read-only zero-delta verification.

## Authority ceiling

EVAL-R1 output remains `SYNTHETIC_SIMULATION_EVIDENCE` for defect reproduction and regression validation. It is not organic Production evidence, real-user efficacy evidence, Product Fact authority, or ENFORCE authorization evidence.
