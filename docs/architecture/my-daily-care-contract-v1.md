# My Daily Care Contract v1

## Purpose

My Skin is the personal skin diary home. It records today's skin state, stores the user's note, and helps the user review recent changes over time.

Premium full report remains the reasoning surface. It explains product-level verdicts, functional goal decisions, condition responses, and Face Lab context.

## Boundary

My Skin must not recreate or display detailed premium judgments:

- no product-level `keep / adjust / hold` verdicts
- no functional `now / later / pause` decisions
- no long condition response explanations
- no Face Lab result replay
- no purchase CTA or premium access gate changes
- no single numeric skin score such as 68 or 72
- no causal claim such as "outdoor activity caused redness"

## Daily Check-in Data

The check-in API stores:

- `daily_checkins.memo`
- daily levels for dryness, oiliness, redness, breakout, and irritation
- makeup and outdoor context
- lightweight check-in events in `daily_checkins.context.checkinEvents`

Existing `makeup_today` and `outdoor_today` remain first-class columns. New event tags are stored inside `context.checkinEvents`:

- `newProductUsed`
- `activeProductUsed`
- `exfoliationUsed`
- `moisturizerSkipped`
- `sleepDeprived`
- `workoutOrSweat`

These events are observation records only. They are not proof of cause and must not be rendered as causal explanation.

When saving a check-in, existing object-shaped `context` values are merged rather than replaced. Missing keys, null context, arrays, and invalid types normalize to `false` for every event key.

The dashboard also reads check-ins from the latest 7-day window for home previews. The query remains scoped by `user_id`.

## Today's Care Compression

The routine generator may continue storing the original `keep_items`, `reduce_items`, and `avoid_items` arrays for compatibility.

The My UI compresses those arrays into:

- Today's adjustments: at most 2 actions
- Today's caution: at most 1 action
- Total visible care actions: at most 3

The display priority is:

1. irritation, redness, breakout, and active-step caution
2. dryness and cleansing load
3. oiliness and heavy layering
4. makeup or outdoor context

If no specific rule matches, My shows one basic action to keep moisture and sunscreen steady.

AM/PM routine details are not repeated on the My home. The home keeps only the compressed care actions and a short reminder that the basic routine can be revisited when needed.

If there is no safe saved-result URL in the current My payload, My must not render a fake routine CTA.

## Trend Preview

My home may show a single-metric preview from recent `daily_checkins`.

- source: `daily_checkins` in the latest 7-day window
- allowed metrics: dryness, oiliness, redness, breakout, irritation
- display: one metric at a time
- default selection: the metric with the highest aggregate value across the latest 7-day window, with the fixed metric order used as a tie-breaker
- interaction: the user can switch between the five metrics in-session with compact tabs
- implementation: CSS/SVG preview, no chart library required

If fewer than two check-ins exist, My shows a quiet empty state instead of an empty chart.

If every recent value is zero, the preview keeps the stable redness fallback for UI consistency, but it must not describe the metric as a cause, worsening, or diagnosis.

## Diary Preview

My home may show recent check-ins as a compact calendar preview plus a short recent-entry summary.

Each calendar day with a check-in can include:

- date
- a simple state label
- a compact event tag preview
- a memo marker when a memo exists

On pointer devices, memo markers may expose the memo through a native hover tooltip. Mobile layouts should not depend on hover-only access.

The state label is only a UI summary:

- stable
- slightly sensitive
- recovery needed

It is not a medical judgment, diagnosis, score, or cause analysis.

Diary metric display rules:

- ignore zero values
- sort by highest value
- for ties, use irritation, redness, breakout, dryness, then oiliness
- show at most two metrics

Diary event display rules:

- tag priority: new product, active product, exfoliation, skipped moisturizer, short sleep, workout/sweat, makeup, outdoor
- show at most three tags on the My home preview
- if more than three tags exist, show `+N`
- if there is no event and no memo, do not render an empty tag/memo area
- `context.checkinEvents` may arrive as object-shaped JSON, null, or a stringified JSON value; all dashboard and form displays must normalize through the shared check-in event helper
- product replacement history and detailed product event timelines are later work, not this home preview contract

## Memo Display

Memo is not used for scoring, recommendations, or AI logic. It is displayed inside diary preview rows as the user's own record with a date.

Empty memo values do not render a standalone memo area or empty memo label.

## Routine Log Compatibility

Existing AM/PM routine steps and routine log save/query behavior stay in place. The compressed care display is a presentation layer over the existing routine log fields.

## Report Boundary

My may keep a recent analysis baseline and recent report entry point. It should not copy full free result or premium report detail into the home.

The analysis baseline should stay compact: skin type, sensitivity, core concerns, and a real saved/profile date when available. Long skin summaries, photo summaries, recommendation direction, full report history, and detailed report replay belong to separate report surfaces.

Premium report can later interpret accumulated diary records. My must not duplicate premium product verdicts, functional decisions, or long-term adjustment reasoning.
