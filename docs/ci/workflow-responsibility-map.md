# CI Workflow Responsibility Map

This document separates **workflow technical responsibility** from **CI Watchtower run attribution**.

## Non-negotiable rule

A shared GitHub Actions workflow is **not** permanently assigned to one development Track Key.

Run attribution follows CI Watchtower evidence: explicit `workflow_dispatch.watchtower_track`, PR `Watchtower-Track`, branch Track Key, commit footer, GitHub PR/SHA/run relationship, then workflow/path heuristics.

The responsibility map therefore answers **what the workflow verifies**, not **which active development track owns every future run**.

## Safety boundary

This normalization does **not** authorize deleting or merging workflows.

Before consolidation, the replacement must prove equivalence for all unique behavior, including:

- isolated Supabase/runtime database verification
- RLS and security boundary checks
- hosted/browser E2E
- Vercel exact-deployment/OIDC probes
- production fail-closed probes
- Android/iOS/native builds
- store/release jobs
- artifacts and operational diagnostics

All current workflows remain `preserve-until-equivalence-proven`.

## Primary responsibility inventory

| Responsibility | Workflow count |
| --- | ---: |
| `admin` | 2 |
| `catalog-taxonomy` | 3 |
| `face-lab` | 5 |
| `global-governance` | 2 |
| `mobile` | 11 |
| `product-data-pipeline` | 6 |
| `product-evidence` | 4 |
| `product-offer-runtime` | 2 |
| `product-query-ai` | 15 |
| `recommendation-admission` | 1 |
| `trust-data-governance` | 21 |

Total: **72 workflows**.

The machine-readable authority is `docs/ci/workflow-responsibility-map.json`.

## Cross-cutting responsibilities that are easy to miss

### Security

Security is intentionally not represented by one historical phase workflow. Canonical main health directly checks RLS, anonymous-write grants, image-upload boundaries, public-result reads, security headers/purchase anchors, admin/security boundaries and origin normalization. Additional isolated security harnesses remain under `security-tests/`.

### Site E2E

The repository still contains real Playwright/browser harnesses. `current-main-health` verifies the My adversarial E2E contract, while hosted/runtime runners remain separate executable capabilities. A static contract pass must never be interpreted as proof that every hosted E2E scenario ran.

### Backend

Backend responsibility is cross-cutting: Admin APIs, product-query runtime probes, TRUST admin endpoints, offer RPC/read services and internal recommendation probes are verified by their owning technical workflows rather than a single generic `backend-ci`.

### Database

Database verification is also cross-cutting. Supabase migrations, isolated runtime projects, RLS, RPC, TRUST persistence, identity repair, taxonomy and offer data checks remain under their owning technical responsibilities.

## Current normalization target

1. Preserve all existing verification behavior.
2. Make every workflow belong to exactly one primary technical responsibility.
3. Keep global governance workflows unassigned by design.
4. Keep shared workflows dynamically attributable to the current Watchtower Track Key.
5. Reject workflow additions/deletions that do not update the responsibility map.
6. Only after this map is stable, review phase-coded names and true duplicate workflows.

