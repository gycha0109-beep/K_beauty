# Security Checklist

## Immediate Secret Rotation

- `crawler/.env` previously contained Supabase service-role credentials and was tracked by Git.
- If that file was ever committed or pushed, rotate the Supabase service role key before launch.
- After rotation, update every runtime that uses the key:
  - Vercel environment variables
  - Supabase-side jobs or scripts, if any
  - local `.env` / `.env.local` files
  - crawler or import utility environments

Deleting the file from the repository is not enough once a service-role key has been exposed in Git history.

## Repository Hygiene

- Keep local environment files untracked: `.env`, `.env.*`, `.env.local`, `crawler/.env`.
- Keep generated Next.js outputs untracked: `.next/`, `.next-dev/`.
- Keep debug outputs and temporary scraper/import files untracked: `tmp/`, `.tmp-*`, `debug.png`, `*headers*.txt`.

## Public Product Read Surface

The current app reads products through Supabase and should not rely on public access to every `products` column long term.

Follow-up before adding internal score, sourcing, cost, or raw review fields:

- Replace broad product reads with an explicit public column list or a `public_products` view.
- Keep internal columns such as raw review signals, source evidence, margin/cost, QA notes, and debug scoring outside the anon-readable surface.
- Prefer an `active` / `recommendable` flag for public recommendation candidates.
- Avoid `.select("*")` for recommendation reads once the product table expands.

## Security Definer RPC

`public.promote_product_candidate(uuid, text)` is a privileged promotion helper and should not be executable by public API roles.

- A migration revokes execute from `public`, `anon`, and `authenticated`.
- Service role can still call the RPC for controlled crawler/admin workflows.
- Keep future privileged RPCs in a private schema when possible.
