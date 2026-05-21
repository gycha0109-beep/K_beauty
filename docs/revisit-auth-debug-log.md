# Revisit Auth Debug Log

Date: 2026-05-21

## Scope

This file records the Google OAuth, callback, profile upsert, and `/my` dashboard errors observed during the Revisit Phase 1 work.

## Error History

1. `/?auth_error=profile_upsert_failed`
   - Stage: `/auth/callback` after Google OAuth.
   - Initial behavior: callback exchanged the OAuth code, then tried `public.profiles` upsert using the session client.
   - Risk: profile upsert failure made the whole login flow look failed.
   - Action taken: callback logging was expanded and callback profile upsert was changed to prefer server-only service-role upsert, with fallback to session upsert.

2. `/?auth_error=exchange_failed`
   - Stage: `supabase.auth.exchangeCodeForSession(code)`.
   - Suspected cause: PKCE `code_verifier` cookie/origin mismatch or middleware interference during `/auth/callback`.
   - Action taken: login redirect origin now uses the current browser origin, `/auth/callback` bypasses middleware refresh, and callback logs code-verifier cookie presence without logging cookie values.

3. `/my?auth_warning=profile_upsert_failed`
   - Stage: `/my` dashboard profile correction.
   - Runtime log:
     `profile_upsert_failed: Could not find the 'avatar_url' column of 'profiles' in the schema cache`
   - Direct schema check result:
     `public.profiles` currently exposes `id` and `created_at`; `nickname`, `avatar_url`, `provider`, and `updated_at` are missing.
   - Direct table check result:
     `public.skin_profiles`, `public.saved_reports`, `public.daily_checkins`, and `public.routine_logs` are not currently found in the remote PostgREST schema cache.
   - Interpretation: the local migration file exists, but the remote Supabase database has not been brought to the same Phase 1 schema yet, or the REST schema cache has not picked it up.

## Current Fix Record

1. Added a server-only profile upsert helper with schema-tolerant fallback payloads:
   - full payload: `id`, `nickname`, `avatar_url`, `provider`
   - reduced payload: `id`, `nickname`
   - minimal payload: `id`
2. Updated auth callback to use the shared helper and keep service-role usage server-only.
3. Updated `/my` dashboard profile correction to use the shared helper.
4. Updated `/my` dashboard reads to tolerate missing Phase 1 tables by returning an empty dashboard state instead of a fatal dashboard error.

## Follow-Up

Apply `supabase/migrations/20260520170737_add_revisit_core_tables.sql` to the target Supabase project, then refresh the PostgREST schema cache if needed. After that, profile rows can carry `nickname`, `avatar_url`, and `provider`, and `/my` can read `skin_profiles`, `saved_reports`, `daily_checkins`, and `routine_logs`.
