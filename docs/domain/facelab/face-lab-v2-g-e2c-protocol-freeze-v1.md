# Face Lab V2 G-E2C Protocol Freeze v1

> Track: Face Lab / face-research
> Gate: G-E2C
> Pilot campaign: `G-E-PILOT-20261002053556`
> Status: frozen for G-E3

## Pilot result used for the freeze

The private pilot completed Human Review for all 8 generated outputs.

- 6 cases were calibration-admissible.
- 2 cases were retained as accepted `not_assessable` Human Review observations.
- Both accepted cases had `route_adherence = not_evaluated` and `color_fidelity = not_evaluated`.
- No forced substitute judgment was created.
- Hard-failure case count was 0.
- The six admitted cases produced 4 PASS and 2 REVIEW verdicts.
- `OVER_EDITED` appeared 3 times with `evaluation_uncertain` attribution.
- Two repeat groups disagreed at verdict/check-vector level.
- Route-response and color-response repeat variance were both 0.

The repeat disagreement is therefore retained as an observed signal. It is not promoted into an automatic provider-cause claim.

## Frozen Gate G protocol

G-E3 uses the same four required axes:

1. `identity_preservation`
2. `route_adherence`
3. `color_fidelity`
4. `edit_scope`

The existing hard-failure taxonomy remains unchanged.

A legitimate `not_assessable` Human Review response:

- remains a completed Human Review observation,
- is never rewritten to PASS, REVIEW, or FAIL,
- prevents that case from becoming a Calibration Case,
- is carried separately into campaign closeout accounting,
- cannot hide a hard failure on another axis.

Review-only findings such as `OVER_EDITED` remain review signals. They do not become hard failures without a versioned protocol change.

## Failure attribution

When G-E3 exposes a problem, attribution order remains:

1. Render Spec,
2. instruction builder,
3. repeat-generation variance,
4. provider.

Provider attribution is not inferred merely from repeat disagreement.

## Threshold freeze

No numeric production threshold is introduced from the 8-output pilot.

G-E3 is an evidence-expansion stage, not a threshold-promotion shortcut.

## G-E3 execution shape

Full calibration is frozen at:

- 12 intents,
- 2 generations per intent,
- 24 outputs total.

The existing simulation endpoint is limited to 8 requests per IP per hour. The production guard is not weakened for calibration.

Therefore G-E3 executes as three bounded waves:

- wave 1: intents 01-04, 8 outputs,
- wave 2: intents 05-08, 8 outputs,
- wave 3: intents 09-12, 8 outputs.

All waves must preserve one simulation/instruction/render/provider runtime binding at final aggregation. A runtime mismatch invalidates the full campaign instead of being averaged away.
