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
| `ai-provider-runtime` | 1 |
| `catalog-taxonomy` | 2 |
| `database-integration` | 1 |
| `face-lab` | 0 |
| `global-governance` | 2 |
| `security-boundary` | 1 |
| `supply-chain-security` | 1 |
| `mobile` | 11 |
| `product-data-pipeline` | 4 |
| `product-evidence` | 0 |
| `product-offer-runtime` | 1 |
| `product-query-ai` | 9 |
| `recommendation-admission` | 1 |
| `trust-data-governance` | 18 |

Total: **54 workflows**.

## Watchtower producer classification

| Producer class | Workflow count | Attribution |
| --- | ---: | --- |
| Project-wide | 2 | no Track tag |
| Dedicated `taxonomy-ai` | 11 | static `[WT:taxonomy-ai]` |
| Dedicated `trust` | 18 | static `[WT:trust]` |
| Dedicated `mobile` | 11 | static `[WT:mobile]` |
| Shared technical | 12 | PR/commit/dispatch evidence |

There are currently no standalone workflows dedicated to `ops`, `face-research`, or `full-report`; those Tracks remain valid producer identities through PR/commit markers.

The machine-readable authority is `docs/ci/workflow-responsibility-map.json`. Its provenance is bound to the exact sorted workflow inventory by `workflowInventoryDigest`; commit-SHA provenance is intentionally not used because a PR cannot know its future merge SHA.

## Cross-cutting responsibilities that are easy to miss

### Security

`security-boundary.yml` is the canonical shared technical owner for application security contracts. It runs the complete static boundary suite for analysis RLS, anonymous-write grants, SEC-06 through SEC-12 coverage, provider-runtime log sanitization, admin access and repository secret/authority hygiene, plus the SEC-12 mutation-resistance harness. Equivalence was proven on the dedicated workflow before the duplicate analysis-RLS, anonymous-write, SEC-08, SEC-09, SEC-10 headers, admin-access, SEC-11 origin-normalization and repository-hygiene executions were removed from `current-main-health`; global health retains only non-duplicated cross-domain contracts. Isolated runtime security harnesses remain under `security-tests/`.

### Supply chain

`supply-chain-security.yml` is the canonical shared technical owner for dependency and source supply-chain checks. It proves the npm lockfile can install with lifecycle scripts disabled, records production and full dependency-audit severity counts, enforces a non-regression baseline, and runs CodeQL for JavaScript/TypeScript. The initial audit found 1 critical and 1 high direct-dependency finding; patching Next.js 15.5.22 → 15.5.26 and sharp 0.35.3 → 0.35.4 reduced the enforced baseline to 0 critical, 0 high, 13 moderate and 0 low findings for both production and full dependency graphs. Any increase fails closed while further remediation can ratchet the baseline downward. Dependabot is intentionally bounded to one weekly grouped npm minor/patch version-update PR; automatic npm major and GitHub Actions version-update PRs are disabled because workflow-file fanout caused repository-wide CI storms. GitHub Dependency Review was tested but is not supported until this repository's Dependency Graph is enabled, so it is not treated as active coverage. GitGuardian remains the existing secret-scanning layer and is not duplicated here.

### AI provider runtime

`ai-provider-runtime.yml` is the canonical shared technical owner for the server-side OpenAI transport used by the core Analyze path. The Vision observation service and product-explanation path share one bounded single-attempt runtime with timeout signaling, manual redirect rejection, response-size enforcement, safe failure telemetry and JSON parsing. PR/push runs execute the provider transport hermetically against injected responses, alongside the Unified Vision and provider-log contracts. An explicit `workflow_dispatch` live smoke can call OpenAI with a fixed non-user store graphic, run the canonical Vision prompt and normalizer, and assert non-persistent privacy flags when the repository `OPENAI_API_KEY` secret is available. Product Query DATA-AI22 remains a separate `taxonomy-ai` responsibility and is not absorbed by this workflow. Green equivalence was proven with the dedicated AI Provider Runtime workflow and `current-main-health` on the same PR head, after which the duplicate Unified Vision execution was removed from `current-main-health`.

### Site E2E

The repository still contains real Playwright/browser harnesses. `current-main-health` verifies the My adversarial E2E contract, while hosted/runtime runners remain separate executable capabilities. A static contract pass must never be interpreted as proof that every hosted E2E scenario ran.

### Backend

Backend responsibility is cross-cutting: Admin APIs, product-query runtime probes, TRUST admin endpoints, offer RPC/read services and internal recommendation probes are verified by their owning technical workflows rather than a single generic `backend-ci`.

### Database

`database-integration.yml` is the canonical shared technical owner for repository-level database integration authority. Phase 1 verifies migration filename/version/semantic-name integrity, freezes the currently observed repository-vs-Production migration-history divergence classes, proves the disposable local Supabase target guard remains fail-closed, and documents that the repository does **not yet** own a complete root `supabase/config.toml` + predecessor baseline that can honestly support a full blank-database replay claim. A read-only Production audit on 2026-09-24 observed 120 migration-ledger entries and 73 public tables, with RLS enabled on all 73 observed public tables; this observation is evidence, not a write-capable CI dependency.

The current repository has 92 migration files and 89 direct semantic-name matches against the observed Production ledger. Timestamp rewrites, the split DATA-TAXONOMY2 Production rollout, one Production-only emergency credential-revocation migration, and repository-only canonical replay/data migrations are recorded explicitly in `docs/ci/database-integration-authority.json` rather than being misclassified as generic drift. Supabase's documented `db reset` reproducibility model assumes a complete local project baseline; BEJEWELY does not claim that state yet.

Admin review, TRUST, taxonomy, offer and other domain-specific isolated Supabase runtime jobs remain with their owning workflows. They are not absorbed or deleted by Database Integration Authority until a canonical cross-domain predecessor baseline is built and equivalence is proven.

## Current normalization target

1. Preserve all existing verification behavior.
2. Make every workflow belong to exactly one primary technical responsibility.
3. Keep global governance workflows unassigned by design.
4. Keep dedicated Track workflows statically tagged with their canonical Watchtower Track Key.
5. Keep shared workflows dynamically attributable to explicit producer evidence.
6. Reject workflow additions/deletions or producer-class drift that do not update the responsibility map.
7. Only after this map is stable, review phase-coded names and true duplicate workflows.
