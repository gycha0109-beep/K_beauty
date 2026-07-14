# SEC-06 saved_reports premium write boundary

## Scope

This remediation closes the client-origin premium saved-report write path in the repository and isolated local database harness. It does not apply the migration to a hosted Supabase project.

## Write contract

- `/api/my/save-report` accepts only an exact `reportType` of `free` and rejects premium payload or provenance controls from the client.
- Authenticated direct writes can create only an owner, non-anonymous, free share row with an object `free_result`, no premium aliases, and a non-empty share source session id.
- Authenticated users can update only the `title` of their existing free rows. They cannot change report type, premium payload, provenance, owner linkage, profile linkage, or free payload.
- Owner SELECT and DELETE remain available for both existing free and premium rows.
- `/api/full-report` validates entitlement, signed session scope and expiry, session-row expiry, and server normalization before it persists the authoritative `premium_report_sessions` payload with the server-only admin client. No client premium snapshot is used as persistence input.

## Database boundary

Migration `20260714110252_sec_06_saved_reports_premium_write_boundary.sql` keeps RLS enabled, replaces broad authenticated INSERT/UPDATE policies with free-only policies, revokes table UPDATE from `authenticated`, and grants UPDATE only on `saved_reports.title`. `service_role` retains authoritative CRUD for the verified server path.

Migration SHA-256:

`EEC0F0FD2773EB9157D95C99D539746EA574544D11E98B84C970431BAC5403DC`

## Isolated role matrix

The local SEC-06 harness starts a disposable Supabase project, stages the source migration only after SHA equality, resets the local database, and runs pgTAP plan `56`.

- All 23 expected denial assertions require SQLSTATE `42501`, a NULL expected message, and their existing description.
- R26, R29, R30, R33, and R34 execute their data-modifying CTE at top level, capture the affected-row count transaction-locally, and retain their zero-row invariants.
- psql runs with `-X -A -t -q -P pager=off` and `ON_ERROR_STOP=1`. The runner requires exactly one `1..56` plan, exactly one assertion number for every integer from 1 through 56, no `not ok`, no bailout, no PostgreSQL ERROR/FATAL/PANIC row, and exit code zero.
- The observed run passed `56/56`, including anonymous and anonymous-Auth write denial, permanent owner free insert/title update, direct premium/provenance/linkage mutation denial, premium-row mutation denial, owner free/premium read-delete, non-owner denial, and service-role premium insert/update.
- Project-scoped cleanup passed with zero isolated containers, volumes, TEMP workdirs, and relevant processes.

## Verification

The isolated matrix, saved-report boundary verifier, analysis RLS verifier, premium release verifier, related JavaScript syntax checks, PowerShell parser check, production build, diff check, and credential-pattern scan passed. No remote/hosted Supabase access, hosted migration apply, provider call, commit, or push occurred.

## Residual and deployment boundary

This remediation does not address signing-secret fallback, premium session user/resource binding, session single-use or concurrent replay, or historical forged premium-row identification. Hosted migration status and hosted RLS metadata remain deployment verification work. An independent commit gate is still required before commit.
