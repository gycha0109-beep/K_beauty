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

The dashboard reads today's check-in and the latest check-in so a saved memo can be shown as a user record.

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
- default selection: the highest value in the latest check-in, falling back to redness
- implementation: CSS/SVG preview, no chart library required

If fewer than two check-ins exist, My shows a quiet empty state instead of an empty chart.

## Diary Preview

My home may show the latest 2-3 check-ins as diary rows.

Each row can include:

- date
- a simple state label
- up to two highest non-zero check-in values
- event tags such as makeup or outdoor activity
- memo preview

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

## Memo Display

Memo is not used for scoring, recommendations, or AI logic. It is displayed inside diary preview rows as the user's own record with a date.

Empty memo values do not render a standalone memo area or empty memo label.

## Routine Log Compatibility

Existing AM/PM routine steps and routine log save/query behavior stay in place. The compressed care display is a presentation layer over the existing routine log fields.

## Report Boundary

My may keep a recent analysis baseline and recent report entry point. It should not copy full free result or premium report detail into the home.

The analysis baseline should stay compact: skin type, sensitivity, core concerns, and a real saved/profile date when available. Long skin summaries, photo summaries, recommendation direction, full report history, and detailed report replay belong to separate report surfaces.
