# Face Lab V2 G-E3 Full Calibration Aggregate v1

After all three G-E3 waves have completed Human Review and wave closeout, run:

```bash
npm run run:face-lab-v2-g-e3-full-calibration -- private/face-lab-g-e3/<campaign-id>
```

The command requires:

- wave 1 intents 01-04,
- wave 2 intents 05-08,
- wave 3 intents 09-12,
- two generations for every intent,
- 24 reviewed outputs total,
- zero hard failures,
- one compatible runtime binding across all calibration-admitted cases.

Legitimate `not_assessable` cases remain outside Calibration Case admission but still count toward the exact 24-output Human Review coverage.

The command writes only under the ignored private campaign directory:

- `full-calibration.aggregate-input.json`
- `full-calibration.aggregate.json`
- `full-calibration.closeout.json`

No numeric production threshold is promoted automatically. The 24-output distribution must be interpreted before any later threshold decision.
