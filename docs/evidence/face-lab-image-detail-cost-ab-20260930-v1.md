# Face Lab GPT-5.6 Luna image-detail cost A/B — 2026-09-30

Status: PASS / production decision evidence
Track: `face-research`

## Purpose

Validate whether explicitly using OpenAI vision `detail: high` can bound large-photo token cost without making Face Lab unusable.

Production baseline before this change omitted `detail`, which means `auto`. For GPT-5.6 Luna, OpenAI documents `auto` as using the same sizing behavior as `original`, while `high` fits within 2048 x 2048 pixels and a 2,500-patch budget.

Reference:
- https://developers.openai.com/api/docs/guides/images-vision

## Phase A — existing repository assets at native size

Source:
- GitHub Actions run `36703411883`
- job `109848034346`

Four neutral-review assets were compared with `auto` and `high`.

Result:
- canonical-valid pairs: 4 / 4
- face-eligible pairs: 2 / 4
- total input tokens, auto: 13,632
- total input tokens, high: 13,632
- input reduction: 0%

Interpretation:

The native evaluation assets were already within the high-detail sizing budget, so changing detail mode did not reduce image input tokens. One single-run face result also differed in availability, so no production decision was made from this phase alone.

## Phase B — high-resolution mobile-photo proxy

Source:
- GitHub Actions run `36703716798`
- job `109849027124`

Two existing face-eligible neutral-review assets were upscaled in-memory to a 4096px long edge. No generated image was committed and no provider response was persisted.

Each asset was evaluated twice under both modes.

Result:
- A/B pairs: 4
- canonical-valid pairs: 4 / 4
- face-eligible pairs: 4 / 4
- face available pairs: 4 / 4
- total input tokens, auto: 77,722
- total input tokens, high: 22,852
- input-token reduction: 70.6%
- total output tokens, auto: 4,376
- total output tokens, high: 4,520
- cross-mode available-field agreement by pair: 72.73% to 86.36%

Using the 2026-09-30 GPT-5.6 Luna standard pricing snapshot used by the runtime telemetry:
- input: $0.20 / 1M tokens
- output: $1.20 / 1M tokens

Estimated total cost for the four calls:
- auto: $0.0207956
- high: $0.0099944
- estimated total reduction: 51.94%
- mean auto call: $0.0051989
- mean high call: $0.0024986

## Decision

Set the shared production vision input detail to `high`.

Rationale:
1. Face Lab needs standard high-fidelity image understanding but not original-image pixel coordinates.
2. High-resolution A/B retained face eligibility and full Face Lab availability in every tested pair.
3. Large-photo input tokens fell by 70.6% in the controlled 4096px proxy.
4. Native-size assets showed no token penalty when already within the high-detail budget.
5. The downstream Target / Style Delta / Route / Product Specification pipeline remains deterministic and unchanged.

## Operational telemetry

Provider-reported `prompt_tokens` and `completion_tokens` remain the source for actual usage measurement.

Runtime telemetry adds:
- UTC usage day
- input/output tokens
- image detail
- versioned pricing snapshot
- estimated cost in nano-USD and USD

The cost field is an operational estimate, not a billing ledger. OpenAI pricing can change, so the pricing version must be updated when rates change.

## Privacy

The A/B and production telemetry do not persist:
- source image bytes
- base64 image data
- raw provider responses
- user identity

Only bounded operational usage numbers are logged.
