# Face Lab V2 G-E3 Local Wave Runner v1

> Track: Face Lab / face-research
> Stage: G-E3 Full Calibration
> Shape: 12 intents × 2 generations = 24 outputs
> Execution: 3 waves × 8 outputs

## Why waves exist

The simulation-test production guard allows 8 requests per IP per hour.

G-E3 does not weaken that limit.

The full calibration therefore runs as:

- wave 1: intents 01-04,
- wave 2: intents 05-08,
- wave 3: intents 09-12.

Each intent still receives exactly two generations.

## Commands

Wave 1:

```bash
npm run run:face-lab-v2-g-e3-wave -- 1
```

The launcher creates a G-E3 campaign ID and stores local continuation state under the ignored private directory.

After the hourly simulation budget has reset, wave 2 and wave 3 reuse the same campaign automatically:

```bash
npm run run:face-lab-v2-g-e3-wave -- 2
npm run run:face-lab-v2-g-e3-wave -- 3
```

A specific campaign ID may be supplied as the second argument when necessary.

## Frozen bindings

The launcher fails closed if a later wave changes:

- source image hash,
- simulation version,
- instruction version,
- Render Spec version,
- provider config version,
- provider config fingerprint.

The three waves therefore remain one calibration campaign rather than three unrelated experiments.

## Human Review

Each wave persists eight outputs under:

`private/face-lab-g-e3/<campaign-id>/wave-0N`

Use the existing local Review Board for each wave. The images remain local and ignored by Git.
