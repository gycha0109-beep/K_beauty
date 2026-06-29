# Result Storage Policy

This document defines the source-of-truth policy for analysis result storage.
It is intended to prevent drift between client storage, Supabase rows, shared
results, and premium report sessions.

## Core Principles

1. `sessionStorage` is a temporary transport used immediately after analysis to move data between pages.
2. `localStorage` is reserved for UX metadata and Supabase auth session persistence.
3. `premium_report_sessions.premium_report` is the current temporary canonical source for paid full reports.
4. `analysis_results.result_json` is the canonical source for saved and shared free results.
5. Denormalized `analysis_results` columns are projections for lookup, share cards, lists, and lightweight display. They are not the original result source.
6. `skinTestShare` is not a source of truth. It is a cache used only to prevent duplicate saves for the same in-tab result.
7. Shared result pages should, long term, prefer `result_json.result` over denormalized columns when reconstructing the result.
8. Paid full reports should, long term, be linked to an `analysis_result_id` or `resultId`.
9. Starting a new analysis must have a clear cleanup policy for old share cache and full-report metadata.
10. The long-term goal is to unify all result pages around server-side lookup by `resultId`.
11. Saved free reports create an `analysis_results` row with a stable `share_id` at save time; `is_public=false` means owner-only access and `is_public=true` means external share access.

## Storage Roles

| Storage location | Role | Source of truth |
| --- | --- | --- |
| `sessionStorage.skinTestResult` | Immediate result-page transport after analysis | No |
| `sessionStorage.skinTestSubmission` | Immediate submission transport after analysis | No |
| `sessionStorage.skinTestFaceLabFull` | Immediate Face Lab transport for full report rendering | No |
| `sessionStorage.skinTestWriteAccessToken` | Temporary write-access proof for save and tracking requests | No |
| `localStorage.lastReportUrl` | UX metadata for the last full-report URL | No |
| `localStorage.lastViewedAt` | UX metadata for last full-report view time | No |
| `localStorage.lastFullReportTab` | UX metadata for restoring the last full-report tab | No |
| Supabase auth session in `localStorage` | Browser auth/session persistence | No |
| `premium_report_sessions.premium_report` | Current paid full-report payload store | Temporary yes |
| `analysis_results.result_json` | Saved/shared free result payload | Yes |
| `analysis_results` denormalized columns | Query, share-card, list, and lightweight display projection | No |
| `skinTestShare` | Duplicate-save prevention cache | No |

## Current Policy

- Free results are first transported through `sessionStorage` for the immediate post-analysis result page.
- A free result becomes durable when it is saved into `analysis_results`; sharing later only flips the existing row to public.
- For saved/shared free results, `analysis_results.result_json` is the canonical payload.
- `/r/{shareId}` is the single report URL. Owners may open their own saved result even when `is_public=false`; external and signed-out viewers require `is_public=true`.
- `/r/{shareId}` and `/api/results/{shareId}` must use the same owner/public access policy.
- Publishing an already-saved result must update the existing `analysis_results.is_public` flag and must not create a new `share_id` or duplicate result row.
- `saved_reports.source_type='share'` and `saved_reports.source_session_id=<share_id>` link My Skin's latest report action to the durable `analysis_results` row without duplicating the share id in another column.
- Denormalized columns must be treated as derived projections from `result_json`, not as independently authoritative fields.
- Paid full reports currently use `premium_report_sessions.premium_report` as their temporary canonical source.
- The premium cookie should be treated as an access/session pointer, not as the paid report source itself.
- Client-side caches must never override newer server-side data.

## Long-Term Direction

- Introduce a stable `resultId` or `analysis_result_id` as the identifier for result reconstruction.
- Make `/result`, `/result/full-report`, and `/r/[shareId]` converge on server-side lookup by `resultId`.
- Link paid report data to the same result identity used by saved/shared free results.
- Keep denormalized columns as projections generated from canonical JSON.
- Define a versioned result schema, for example `schemaVersion`, so older saved results can be migrated or rendered safely.

## Cleanup Policy

When a new analysis starts, the app should clear stale data that belongs to the previous analysis:

- `skinTestShare`
- old full-report UX metadata when it points to a previous result
- stale Face Lab full payload
- stale write-access token before the new analysis response issues a fresh one

The cleanup policy should preserve only cross-result preferences, such as theme and stable auth session data.

## Implementation Guardrails

- Do not introduce a new client-side storage key for result payloads without updating this document.
- New analysis startup must clear stale analysis-scoped cache before issuing the next analysis request.
- New analysis startup must remove `skinTestShare`, stale `skinTestFaceLabFull`, stale write-access token data, and previous full-report UX metadata.
- Cross-result preferences such as theme and Supabase auth session data must not be cleared by analysis startup cleanup.
- Any code that reads shared results must prefer `analysis_results.result_json.result` before denormalized columns.
- Denormalized columns may be used as fallback projections only when canonical JSON fields are missing.
- Any saved `analysis_results.result_json` payload must include `schemaVersion`, `generatedAt`, `source`, and `locale`.
- Any schema change to `result_json` must include a `schemaVersion` handling plan.
- Do not remove `premium_report_sessions.premium_report` until paid reports are linked to a durable `analysis_result_id` or `resultId`.
- Do not introduce Zustand, TanStack Query, or other client state layers to solve result persistence unless this policy is revised first.
