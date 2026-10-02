# Face Lab V2 G-E3 Private Wave Closeout v1

After one G-E3 wave has eight completed Human Reviews, run:

```bash
npm run run:face-lab-v2-g-e3-private-wave -- private/face-lab-g-e3/<campaign-id>/wave-0N
```

The command reuses the canonical private case runner in `G-E3_WAVE` mode.

It writes:

- calibration-admissible case files,
- `campaign.aggregate-input.json`,
- `campaign.aggregate.json`,
- `wave.closeout.json`.

A legitimate `not_assessable` observation is retained separately and does not require a fabricated substitute judgment.

Any hard failure stops G-E3 progression for failure attribution.
