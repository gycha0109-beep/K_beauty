# CI Workflow Responsibility Map

This document separates **workflow technical responsibility** from **CI Watchtower run attribution**.

## Non-negotiable rule

CI Watchtower v0.3.2 separates workflow responsibility from run attribution.

- **Project-wide CI** is unassigned by design and must not emit a static `[WT:*]` prefix.
- **Dedicated Track CI** emits a static canonical `run-name: "[WT:<track-key>] <display name>"`.
- **Shared technical CI** is not permanently assigned to one Track Key; its run attribution follows explicit producer evidence. For manual dispatch, `watchtower_track` must be surfaced through the run name as `[WT:<track-key>]` rather than remaining an event input that Watchtower cannot observe.

Dynamic attribution precedence is Project-wide rule, run-name `[WT:<track-key>]`, PR `Watchtower-Track`, commit footer `Watchtower-Track`, branch Track Key, then learned workflow fingerprint. A `workflow_dispatch.watchtower_track` value becomes explicit evidence only when the producer surfaces it through run-name.

Canonical Track Keys are exactly:

- `ops`
- `taxonomy-ai`
- `trust`
- `face-research`
- `full-report`
- `mobile`

The responsibility map therefore answers both **what the workflow verifies** and whether its Watchtower producer mode is project-wide, dedicated-static, or shared-dynamic.

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
| `catalog-taxonomy` | 2 |
| `face-lab` | 0 |
| `global-governance` | 2 |
| `security-boundary` | 1 |
| `mobile` | 11 |
| `product-data-pipeline` | 4 |
| `product-evidence` | 0 |
| `product-offer-runtime` | 1 |
| `product-query-ai` | 9 |
| `recommendation-admission` | 1 |
| `trust-data-governance` | 18 |

Total: **51 workflows**.

## Watchtower producer classification

| Producer class | Workflow count | Attribution |
| --- | ---: | --- |
| Project-wide | 2 | no Track tag |
| Dedicated `taxonomy-ai` | 11 | static `[WT:taxonomy-ai]` |
| Dedicated `trust` | 18 | static `[WT:trust]` |
| Dedicated `mobile` | 11 | static `[WT:mobile]` |
| Shared technical | 9 | PR/commit/dispatch evidence |

There are currently no standalone workflows dedicated to `ops`, `face-research`, or `full-report`; those Tracks remain valid producer identities through PR/commit markers.

The machine-readable authority is `docs/ci/workflow-responsibility-map.json`. Its provenance is bound to the exact sorted workflow inventory by `workflowInventoryDigest`; commit-SHA provenance is intentionally not used because a PR cannot know its future merge SHA.

## Cross-cutting responsibilities that are easy to miss

### Security

`security-boundary.yml` is the canonical shared technical owner for application security contracts. It runs the complete static boundary suite for analysis RLS, anonymous-write grants, SEC-06 through SEC-12 coverage, provider-runtime log sanitization, admin access and repository secret/authority hygiene, plus the SEC-12 mutation-resistance harness. `current-main-health` keeps its existing overlapping checks until equivalence is proven; removal from global health is a later consolidation step. Isolated runtime security harnesses remain under `security-tests/`.

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
4. Keep dedicated Track workflows statically tagged with their canonical Watchtower Track Key.
5. Keep shared workflows dynamically attributable to explicit producer evidence.
6. Reject workflow additions/deletions or producer-class drift that do not update the responsibility map.
7. Only after this map is stable, review phase-coded names and true duplicate workflows.
