# Premium Functional Decision Contract v1

## Purpose

`premiumReport.functionalDecisions` explains functional skin-care goals in the paid full report.

It is not a product recommendation engine, ingredient prescription, medical diagnosis, or purchase flow. The unit of judgment is a functional goal, not an individual product.

## Data Shape

Each item must use this shape:

```js
{
  goalKey: string,
  status: "now" | "later" | "pause",
  title: string,
  summary: string,
  reasons: string[],
  nextAction: string | null
}
```

Only these keys are allowed through the premium report sanitizer.

## Status Definitions

| Status | Meaning | Product implication |
| --- | --- | --- |
| `now` | The goal is directly aligned with the current priority and can be handled within the current routine burden. | Does not mean buying a new product. |
| `later` | The goal is valid, but should be reviewed after the current priority or routine burden is steadier. | Default when confidence is limited. |
| `pause` | Active expansion of the goal is not advised for now because current condition and burden signals clearly conflict. | Temporary routine guidance, not an absolute prohibition. |

## Input Evidence

The helper may read:

- premium priority axis and score
- Decision Bundle concern scores or the internal score card
- routineStructure mode and role context
- survey answers that already participate in the existing Decision Bundle
- currentProductVerdicts as supporting evidence only

The helper must not change:

- Top Pick
- supportingProducts
- product ranking
- score formula
- sunscreen score or hard filter
- currentProducts input or slot-building rules
- routineStructure generation

## Goal Set

The paid report shows at most five goals:

- `barrier_soothing`: calming and barrier support
- `hydration`: hydration support
- `sebum_pore`: sebum, pore, and texture balance
- `tone_spot`: tone and spot care
- `texture_exfoliation`: texture and exfoliation review

Goal keys are stable domain keys for UI and saved report compatibility.

## Decision Priority

1. If a goal directly matches the priority axis and does not add strong burden, it may be `now`.
2. If the goal is useful but the current priority should stabilize first, use `later`.
3. Use `pause` only when both are true:
   - barrier, redness, or acne burden is currently leading or high
   - a clear active-burden signal exists, such as a conservative `hold` current product verdict
4. If evidence is weak or incomplete, prefer `later` over `pause`.

## Current Product Verdict Boundary

`currentProductVerdicts` and `functionalDecisions` have different responsibilities.

- `currentProductVerdicts`: how to handle a specific product the user already uses.
- `functionalDecisions`: whether a functional goal should be handled now, later, or paused.

A `hold` or `adjust` verdict must not automatically pause every functional goal. It can only support a `pause` decision when the current priority and goal conflict are also clear.

## Pause Guardrails

`pause` must not be triggered by:

- product names
- brand names
- generic sensitive-skin wording alone
- unsupported ingredient guesses
- a single `adjust` verdict

`pause` copy should avoid fear language. It means "do not actively expand this goal right now," not "never use this."

## Free / Premium Boundary

Functional decisions are paid-report-only data.

- Stored at `premiumReport.functionalDecisions`.
- Returned through the full report session path.
- Not exposed in the public/free `/api/analyze` response.
- Not rendered in free result screens.

## Sanitizer and Storage

The premium sanitizer keeps only:

- `goalKey`
- `status`
- `title`
- `summary`
- `reasons`
- `nextAction`

Unknown statuses, empty goal keys, invalid arrays, `undefined`, and non-finite values must not be persisted.

The saved `premium_report_sessions.premium_report` payload carries `functionalDecisions` with the rest of the premium report. Requery should return the saved field unchanged after sanitization.

## Legacy Report Fallback

If a saved premium report does not include `functionalDecisions`, the full report must still render. The functional decision section may show a quiet unavailable state, and routine/currentProducts sections must remain unaffected.

## Out of Scope

This feature must not add:

- product recommendation changes
- alternative product automation
- product purchase CTA
- ingredient concentration advice
- medical diagnosis
- condition-response implementation beyond linking to the existing next section
