# Functional Shadow Capture

## Purpose

Functional Shadow Capture records sanitized development-only fixtures from the real `/api/analyze` free-result flow so the existing recommendation snapshot can be replayed against the new functional ranking audit later.

It exists to build evidence before any ranking replacement. It does not decide that the new engine is better, and it does not change what users see.

## Phase 3 Fixture Runner vs Phase 4 Capture

Phase 3 used local hand-written fixtures to test the snapshot adapter, candidate audit, and comparison logic.

Phase 4 captures the same comparison inputs from real development `/api/analyze` requests, but only when explicitly enabled. The captured data is still sanitized and replayed offline; no shadow comparison is exposed to the API response.

## Opt-In Gate

Capture is enabled only when both conditions are true:

```text
NODE_ENV === "development"
FUNCTIONAL_SHADOW_CAPTURE === "1"
```

If either condition is false, capture is a no-op. Production returns no-op even if `FUNCTIONAL_SHADOW_CAPTURE=1`.

## Production No-Op

Production runtime must never create tmp files, fixtures, or shadow comparison output. Capture failures are swallowed and may only produce development warnings; they must not block `/api/analyze`.

## Fixture Contract

Fixtures are written to:

```text
tmp/functional-shadow-captures/
```

Each capture writes a new append-only JSON file named like:

```text
YYYYMMDD-HHmmss-<random>.json
```

Top-level shape:

```js
{
  captureVersion: "v1",
  capturedAt: "ISO timestamp",
  source: "dev_api_analyze",
  captureId: "non-user random id",
  survey: {},
  freeResultContext: {},
  goalPolicy: {},
  existingRecommendationSnapshot: {},
  candidateSource: {},
  currentProductFindingSummary: {}
}
```

`survey` stores the sanitized `SurveyInputContract` axes needed by ranking: skin state, goals, safety, behavior, preferences, and sunscreen completion metadata. It does not store the raw form.

`freeResultContext` stores only priority/suppression context needed to understand the existing decision boundary.

`existingRecommendationSnapshot` stores product IDs, categories, rank/source buckets, category distribution, and notes from the legacy result snapshot adapter.

`candidateSource` stores sanitized product snapshots only when a candidate source is available. Otherwise it records final selected products or unavailability.

## Data Never Stored

Capture must not store:

- raw multipart form or request body
- uploaded image, base64, filename, or file path
- IP, user agent, cookies, session/account IDs
- email, name, or other PII
- raw current product text
- raw review text
- product purchase URLs
- product name or brand unless a future evaluator explicitly requires them
- full product DB rows when smaller evaluator snapshots are enough

## Candidate Source Completeness

`candidateSource.completeness` has four meanings:

- `complete`: the actual product candidate rows used by the existing flow were supplied to capture.
- `partial`: some candidate source is present but known to be incomplete.
- `final_results_only`: only final selected products are available, so replay can compare selected-result behavior but cannot compare the full candidate set.
- `unavailable`: no usable product source is available.

Low-completeness captures should not drive strong ranking policy changes.

## Replay

Run:

```bash
node scripts/replay-functional-shadow-captures.mjs
```

The replay runner reads sanitized fixtures, rebuilds a functional candidate audit from the fixture contract, compares it with the existing snapshot, and writes:

```text
tmp/functional-shadow-captures/replay-summary.json
tmp/functional-shadow-captures/replay-summary.md
```

Malformed fixtures are counted as failed and do not stop the replay run.

## Aggregate Summary

Run:

```bash
node scripts/summarize-functional-shadow-captures.mjs
```

The summarizer reads the replay summary and writes:

```text
tmp/functional-shadow-captures/aggregate-summary.json
tmp/functional-shadow-captures/aggregate-summary.md
```

It reports confidence distribution, top-pick match rate, overlap rate, divergence type distribution, blocked reason distribution, category comparison, policy signals, and limitations.

## Divergence Interpretation

Divergence is an observation, not an error.

Use high/medium-confidence comparisons first. Low-confidence captures often mean the source only had final selected products or too few product IDs for fair comparison. Repeated high-confidence divergence can become a policy review candidate; one-off divergence should remain an audit note.

## Limitations

Small sample counts must be treated as insufficient. The aggregate report records sample-size and low-confidence limitations so policy changes are not made from weak evidence.

## Non-Replacement Rule

Shadow capture does not replace:

- existing free-result recommendation logic
- `topPick`
- `supportingProducts`
- `budgetAlternatives`
- API response fields
- UI rendering
- stored payload shape

It is development-only evidence collection.

## Next-Step Conditions

Before any ranking policy change:

- collect multiple real development captures
- prioritize high/medium-confidence comparisons
- review repeated divergence by type and category
- promote only repeated signals to Phase 5 policy candidates
- keep UI and existing ranking replacement out of scope until separately approved
