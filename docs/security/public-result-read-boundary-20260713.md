# Public Result Read Boundary

## Scope

This document records the application-layer response boundary for shared analysis results. It does not reuse the existing OWASP audit `SEC-06` identifier, which covers the separate My save-report premium payload finding.

The affected read paths are:

- `/api/results/[shareId]`
- `/r/[shareId]`
- `lib/analysis-result-access.js`

No migration, RLS policy, grant, Supabase client, save route, publish route, remote system, or production data change is part of this boundary.

## Access Contract

`analysis_results` remains server-read through the service-role client. The server resolves the audience before serialization:

- A row with `is_public === true` returns the public DTO for every requester, including the owner.
- A non-public row returns the owner DTO only when the authenticated user ID exactly equals `analysis_results.user_id`.
- A non-owner, unauthenticated requester, or non-public row with `user_id = null` receives the existing not-found outcome.

The application contract assumes the deployed analysis-table RLS/grant boundary remains service-role-only. Deployment verification for that separate database boundary is still required before hosted rollout.

## Response Contract

The public DTO has exactly these top-level fields:

- `shareId`, `schemaVersion`, `locale`, `skinType`, `mainConcerns`, `summary`
- `routineAm`, `routinePm`
- `topPick`: `id`, `name`, `brand`, `step`, `reason`
- `categoryPicks[]`: `id`, `name`, `brand`, `step`
- `routineStructure`: `type`, `label`, `title`, `body`, `am`, `pm`, and `cards[]`

`routineStructure.am` and `.pm` contain only `mode`, `label`, and `strategyLine`. Each card contains only `key`, `label`, `body`, and `mode`.

The private-owner DTO is the same public DTO plus `isPublic`.

The serializer drops internal row identifiers, owner IDs, image paths, timestamps, source/provider metadata, raw result JSON, score and decision metadata, and unknown top-level or nested fields. Legacy rows without `result_json` use the same allowlisted column fallback and never expose raw stored objects.

## Verification

`node scripts/verify-analysis-result-response-boundary.mjs` executes the serializer against public, owner, legacy, null, and malformed nested fixtures. It verifies exact key sets, unknown-key removal, the public/private access matrix, and the generic API error response.

`scripts/verify-analysis-rls-contract.mjs` retains the server-only service-role and owner/public access checks, while the Playwright live share flow asserts the public DTO key set. The live flow requires a separately approved local or non-production runtime because it invokes the analysis provider and Supabase-backed save path.
