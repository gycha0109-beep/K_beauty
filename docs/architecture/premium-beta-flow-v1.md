# Premium Beta Flow v1

## Scope

The beta premium flow connects the existing free result to a private premium report snapshot:

free result CTA -> login/access check -> current products selection -> `/api/full-report` -> `saved_reports` -> My latest report -> private reopen.

Payment provider integration, DB migrations, public premium sharing, Face Lab generation, recommendation scoring, and product ranking are out of scope.

## Access Contract

Server-side premium creation access uses two axes:

- release mode: `coming_soon | beta_open | paid_only`
- entitlement: `none | paid | admin_override`

`PREMIUM_RELEASE_MODE` is the server release-mode source. It must be explicitly set to an allowed value. Missing, empty, or unknown values are treated as configuration-invalid and resolve to the closed `coming_soon` state; they never default to `beta_open`.

Rules:

- `coming_soon` or configuration-invalid: creation and premium session preparation are blocked
- `beta_open`: signed-in non-anonymous users are allowed
- `paid_only`: only `paid` or `admin_override` users are allowed
- `admin_override`: allowed only when the release mode itself is open
- otherwise: creation is blocked

The resolver lives in `lib/premium-access.js`. Frontend checks are advisory only; `/api/full-report` rechecks access before creating or updating a premium session report. `/api/analyze` also skips premium-session creation when the release mode is closed or invalid; a valid `beta_open` analysis keeps the existing pre-login session preparation flow.

## Entitlement Source

No migration is introduced in this version. Entitlement is read from trusted Supabase `app_metadata` only:

- `premium_entitlement` or `premiumEntitlement`: `paid | admin_override`
- `premium_paid` or `is_paid`: `true`
- admin override via `role`, `roles`, `admin`, or `is_admin` in `app_metadata`

User-controlled `user_metadata` is not used for authorization.

## Current Products

The premium entry step uses the existing current-products selector states:

- `selected`
- `not_in_db`
- `not_using`

The selected values are sent to `/api/full-report`. The API builds a premium snapshot with DB product snapshots where available and updates only:

- `currentProducts`
- `currentProductVerdicts`

Other premium report fields are preserved by object merge.

`not_in_db` is not treated as a DB product. `not_using` remains distinct from an omitted selection.

## Premium Save

When `/api/full-report` successfully returns a newly opened premium session report for an authorized account user, it saves or updates one private `saved_reports` row keyed by:

- `user_id`
- `report_type = premium`
- `source_type = premium_report_session`
- `source_session_id = premium_report_sessions.session_id`

The stored `premium_report` is the sanitized session snapshot plus any current-products and Face Lab summary merges already applied in the API response.

Existing fields such as `functionalDecisions`, `conditionResponses`, `fullRoutine`, and `currentProductVerdicts` are preserved by merging into the existing report object, not by regenerating unrelated sections.

## My Reopen

My latest report opens the most recently saved report by `created_at`, without forcing free or premium priority.

Free reports use the existing `/r/{shareId}` path when linked to a private share row.

Premium reports use:

`/result/full-report?savedReportId={saved_reports.id}`

Reopening a saved premium report requires the owner account session and checks `saved_reports.user_id`. It does not require current premium creation entitlement. This means a user can reopen their own saved premium reports after the release mode changes from `beta_open` to `paid_only`.

## Boundaries

- Free `/api/analyze` public response must not expose `premiumReport`, `faceLab`, or `faceLabSummary` premium details.
- Premium reports are private account reports in this version.
- No payment CTA or external premium share link is created.
- Face Lab analysis logic and `/api/face-reading` input contract are unchanged.
- Recommendation scoring, product ranking, and current-products verdict policy are unchanged.
