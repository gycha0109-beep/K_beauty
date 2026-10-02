# Face Lab V2 G-E2C Pilot Closeout v1

> Track: Face Lab / face-research  
> Gate: G-E2C  
> Scope: G-E2B 4-intent × 2-generation pilot closeout

## Purpose

G-E2C closes the private pilot without converting a legitimate Human Review `not_assessable` response into a fabricated PASS, REVIEW, or FAIL judgment.

The calibration contract remains strict:

- a case containing `not_evaluated` does not become a Calibration Case,
- an admissible Calibration Case still requires all required checks to be evaluated,
- a valid `not_assessable` Human Review observation is retained separately in the pilot closeout,
- hard failures are never hidden by the not-assessable path.

## Closeout accounting

The closeout requires exact accounting:

`reviewed cases = admitted Calibration Cases + accepted not-assessable cases`

It also requires the original pilot intent-group coverage to remain complete.

For accepted not-assessable cases, the closeout retains:

- intent group and generation,
- incomplete Gate G axis,
- all four check statuses,
- non-hard review finding codes.

Raw images, image hashes, and reviewer references are not added to the closeout.

## Hard-failure boundary

A case can enter the accepted not-assessable path only when:

- calibration admission failed because a required check remained `not_evaluated`,
- the evidence verdict is `not_evaluated`,
- no hard failure code exists.

If a hard failure exists, the case remains a blocker and the pilot cannot use the not-assessable exception to continue.

After aggregation:

- hard failure count > 0 → stop for failure attribution,
- hard failure count = 0 → ready for protocol freeze.

Failure attribution order remains:

1. Render Spec,
2. instruction builder,
3. repeat-generation variance,
4. provider.

No numeric production threshold is introduced from this pilot.

## Private output

The existing private campaign command writes:

- `campaign.aggregate-input.json`
- `campaign.aggregate.json`
- `campaign.closeout.json`

The closeout file is the G-E2C decision artifact for the local pilot.
