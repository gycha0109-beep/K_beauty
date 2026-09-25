# Phase A — Workflow Overlap Audit Baseline

Authority: `62a36f93e2a8e2316593f35cce8619991868a169`

The repository contains **63 GitHub Actions workflows** at this authority. Phase A changes no workflow files.

## First audit findings

1. **DATA-AI3 → 4 → 5 is cumulative.** DATA-AI4 repeats DATA-AI1/2/3 plus build/architecture work before adding DATA-AI4 coverage; DATA-AI5 repeats DATA-AI1/2/3/4 plus the same build/architecture work before adding DATA-AI5 coverage.
2. **PRELAUNCH-01 repeats DATA-AI25 readiness.** The prelaunch workflow directly executes both its own verifier and `verify-data-ai25-product-query-operational-readiness.mjs`.
3. **Mobile 13/14/15 repeats native preflight work**, but MOBILE-15 has unique signing secrets and signed distribution artifact authority. It cannot be collapsed from script overlap alone.
4. **TRUST has cumulative verifier chains** around 5B/6A/7C/7D and repeated replay-baseline materialization across 8B–8G.
5. **Current Main Health is itself an overlap hotspot.** `npm run verify:current` transitively executes broad DATA-AI and TRUST phase contracts that also have dedicated workflows. Consolidation therefore must compare dedicated workflows against project-wide health, not only phase workflow against phase workflow.
6. **Mobile Native Shell / 20A / 20B are excluded from retirement.** They are lightweight fail-closed compatibility gates and classic branch-protection requirements remain unreadable.

## Recent Actions timing sample

A repository-wide sample of the most recent **500 Actions runs** was captured before implementation. Selected wall-clock averages:

| Workflow | Sample runs | Avg |
| --- | ---: | ---: |
| Mobile Android Runtime | 6 | 21.16 min |
| Mobile 20A compatibility gate | 5 | 20.15 min |
| Mobile Native Shell compatibility gate | 5 | 20.09 min |
| Mobile 20B compatibility gate | 5 | 19.99 min |
| Supply Chain Security | 79 | 1.92 min |
| DATA-AI3 | 1 | 1.70 min |
| DATA-AI4 | 1 | 1.58 min |
| Current Main Health | 81 | 1.27 min |

The three Mobile compatibility gates spend wall-clock time waiting for the canonical runtime. Their duration must **not** be interpreted as duplicate emulator/build compute.

## Phase A output

The audit engine builds a coverage graph for all workflows from triggers/jobs, directly executed scripts, transitive verifier-driver scripts, root npm scripts, GitHub Actions, secrets, runtime/build/artifact capabilities, and responsibility registry metadata.

Pairwise containment/Jaccard overlap is evidence only. No workflow is automatically retired.
