# CandidateExposurePolicy Isolated Canary Fixtures

This directory contains deterministic, synthetic fixtures for Stage 11F validate-only replay.

## Contract

- Four exact scenarios are present.
- Each scenario is replayed in `ko` and `en`.
- Each locale/scenario pair has a control and canary plan entry.
- The total matrix is exactly 16 entries.
- No real user image, product history, account, report, cookie, provider payload, or Production catalog mutation is used.
- Candidate identifiers are synthetic fixture-local references. They remain in memory and are never serialized into telemetry or implementation-readiness evidence.

## Scenarios

- `standard_goal_alignment`
- `stabilization_active_block`
- `current_product_semantics`
- `metadata_incomplete`

## Execution boundary

The Stage 11F runner supports only:

```text
--mode validate-only
```

It performs no HTTP request, Vercel operation, deployment, bypass, project environment mutation, or Production action.
