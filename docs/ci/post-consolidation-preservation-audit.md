# CI Post-Consolidation Preservation Audit

## Scope

This audit records the safe stopping point after the OPS CI equivalence-consolidation pass through PR #706.

- Current topology: **50 workflows**
- Mobile: **11 workflows**, excluded from deletion/consolidation in this track; only Watchtower Track Key alignment was allowed
- Non-mobile: **39 workflows**
- Governing rule: **preserve until equivalence is proven**
- Result: **no further non-mobile workflow deletion is currently justified by equivalence evidence**

## Preservation inventory

| Responsibility | Workflow | Preservation reason |
| --- | --- | --- |
| `admin` | `admin-access-foundation.yml` | Isolated Supabase runtime/database integration authority. |
| `admin` | `admin-product-current-main-integration.yml` | Isolated Supabase runtime/database integration authority. |
| `catalog-taxonomy` | `data-taxonomy13-catalog-only-candidate-approval.yml` | Isolated Supabase runtime and database-reset taxonomy authority. |
| `catalog-taxonomy` | `data-taxonomy15-catalog-only-trust-intake.yml` | Isolated Supabase runtime and database-reset taxonomy authority. |
| `global-governance` | `current-main-health.yml` | Canonical static-contract, build, hygiene and topology authority. |
| `global-governance` | `pie-prospective.yml` | Independent prospective/global governance shadow authority. |
| `mobile` | `mobile-13-store-release-preflight.yml` | Mobile deletion/consolidation excluded from this audit; retained as-is except Watchtower Track Key alignment. |
| `mobile` | `mobile-14-auth-app-links.yml` | Mobile deletion/consolidation excluded from this audit; retained as-is except Watchtower Track Key alignment. |
| `mobile` | `mobile-15-distribution-authority.yml` | Mobile deletion/consolidation excluded from this audit; retained as-is except Watchtower Track Key alignment. |
| `mobile` | `mobile-20a-store-capture.yml` | Mobile deletion/consolidation excluded from this audit; retained as-is except Watchtower Track Key alignment. |
| `mobile` | `mobile-20b-store-capture.yml` | Mobile deletion/consolidation excluded from this audit; retained as-is except Watchtower Track Key alignment. |
| `mobile` | `mobile-20c-feature-graphic.yml` | Mobile deletion/consolidation excluded from this audit; retained as-is except Watchtower Track Key alignment. |
| `mobile` | `mobile-20d-app-store-screenshots.yml` | Mobile deletion/consolidation excluded from this audit; retained as-is except Watchtower Track Key alignment. |
| `mobile` | `mobile-ci.yml` | Mobile deletion/consolidation excluded from this audit; retained as-is except Watchtower Track Key alignment. |
| `mobile` | `mobile-ios-shell.yml` | Mobile deletion/consolidation excluded from this audit; retained as-is except Watchtower Track Key alignment. |
| `mobile` | `mobile-native-shell.yml` | Mobile deletion/consolidation excluded from this audit; retained as-is except Watchtower Track Key alignment. |
| `mobile` | `mobile-store-readiness.yml` | Mobile deletion/consolidation excluded from this audit; retained as-is except Watchtower Track Key alignment. |
| `product-data-pipeline` | `hwahae-review-capture-provenance-non-main-pr.yml` | Residual path-scoped non-main PR trigger authority required to preserve the retired Hwahae wrapper's original trigger surface. |
| `product-data-pipeline` | `product-identity-key-repair-confirm.yml` | Independent Supabase-backed product-data runtime authority. |
| `product-data-pipeline` | `product-offers.yml` | Independent Supabase-backed product-data runtime authority. |
| `product-data-pipeline` | `product-source-bindings.yml` | Independent Supabase-backed product-data runtime authority. |
| `product-offer-runtime` | `data-offer17-controlled-offer-rpc-diagnostic.yml` | Controlled deployed RPC diagnostic with credential/OIDC/runtime HTTP authority. |
| `product-query-ai` | `data-ai16-production-canary-closure.yml` | Production canary with Supabase/provider/runtime HTTP authority. |
| `product-query-ai` | `data-ai18-authenticated-beta-runtime.yml` | Authenticated beta Supabase/provider runtime authority. |
| `product-query-ai` | `data-ai20-authenticated-beta-controlled-activation.yml` | Controlled authenticated activation with Supabase/provider runtime authority. |
| `product-query-ai` | `data-ai21-limited-beta-evidence-closure.yml` | Limited-beta provider authority and evidence closure. |
| `product-query-ai` | `data-ai22-live-provider-acceptance.yml` | Live-provider acceptance authority with retained artifact evidence. |
| `product-query-ai` | `data-ai3-product-query-shadow.yml` | Exact deployed Vercel/OIDC real-corpus runtime probe. |
| `product-query-ai` | `data-ai4-provider-shadow.yml` | Hosted provider-backed runtime shadow probe. |
| `product-query-ai` | `data-ai5-activation-readiness.yml` | Hosted activation-readiness runtime probe. |
| `product-query-ai` | `data-ai7-production-fail-closed.yml` | Production fail-closed provider/secret authority. |
| `recommendation-admission` | `v21-admission-g3a-pf-authority-read.yml` | Supabase CLI runtime/database-reset recommendation admission authority. |
| `trust-data-governance` | `trust-phase1-intake-foundation.yml` | Independent TRUST Supabase runtime/database-reset and/or relational SQL authority; phase semantics remain distinct. |
| `trust-data-governance` | `trust-phase2-subject-resolution.yml` | Independent TRUST Supabase runtime/database-reset and/or relational SQL authority; phase semantics remain distinct. |
| `trust-data-governance` | `trust-phase3-research-worker.yml` | Independent TRUST Supabase runtime/database-reset and/or relational SQL authority; phase semantics remain distinct. |
| `trust-data-governance` | `trust-phase4-controlled-evidence-adoption.yml` | Independent TRUST Supabase runtime/database-reset and/or relational SQL authority; phase semantics remain distinct. |
| `trust-data-governance` | `trust-phase5b-subject-registration.yml` | Independent TRUST Supabase runtime/database-reset and/or relational SQL authority; phase semantics remain distinct. |
| `trust-data-governance` | `trust-phase6a-reentry.yml` | Independent TRUST Supabase runtime/database-reset and/or relational SQL authority; phase semantics remain distinct. |
| `trust-data-governance` | `trust-phase6b-reentry.yml` | Independent TRUST Supabase runtime/database-reset and/or relational SQL authority; phase semantics remain distinct. |
| `trust-data-governance` | `trust-phase7a-backfill.yml` | Independent TRUST Supabase runtime/database-reset and/or relational SQL authority; phase semantics remain distinct. |
| `trust-data-governance` | `trust-phase7b-backfill.yml` | Independent TRUST Supabase runtime/database-reset and/or relational SQL authority; phase semantics remain distinct. |
| `trust-data-governance` | `trust-phase7c-phase4-compat.yml` | Independent TRUST Supabase runtime/database-reset and/or relational SQL authority; phase semantics remain distinct. |
| `trust-data-governance` | `trust-phase7c-readiness.yml` | Independent TRUST Supabase runtime/database-reset and/or relational SQL authority; phase semantics remain distinct. |
| `trust-data-governance` | `trust-phase7d-relational-adoption.yml` | Independent TRUST Supabase runtime/database-reset and/or relational SQL authority; phase semantics remain distinct. |
| `trust-data-governance` | `trust-phase8b-source-verification.yml` | Independent TRUST Supabase runtime/database-reset and/or relational SQL authority; phase semantics remain distinct. |
| `trust-data-governance` | `trust-phase8c-revalidation.yml` | Independent TRUST Supabase runtime/database-reset and/or relational SQL authority; phase semantics remain distinct. |
| `trust-data-governance` | `trust-phase8d-revalidation.yml` | Independent TRUST Supabase runtime/database-reset and/or relational SQL authority; phase semantics remain distinct. |
| `trust-data-governance` | `trust-phase8e-revalidation-adjudication.yml` | Independent TRUST Supabase runtime/database-reset and/or relational SQL authority; phase semantics remain distinct. |
| `trust-data-governance` | `trust-phase8f-changed-semantic-replacement.yml` | Independent TRUST Supabase runtime/database-reset and/or relational SQL authority; phase semantics remain distinct. |
| `trust-data-governance` | `trust-phase8g-source-verification.yml` | Independent TRUST Supabase runtime/database-reset and/or relational SQL authority; phase semantics remain distinct. |

## Consolidation boundary

Static wrappers whose unique deterministic checks could be moved into Current Main Health were retired only after command, trigger, exact-head and side-effect equivalence review.

The remaining non-mobile workflows retain at least one independent authority that should not be erased by naming similarity or repeated setup boilerplate: database/runtime isolation, provider or credential authority, deployed probes, artifact evidence, relational SQL, residual trigger coverage, or global governance.

The Hwahae provenance audit found one trigger-surface gap in the earlier retirement record: the retired workflow had path-scoped pull-request coverage regardless of base branch, while Current Main Health covers pull requests targeting `main`. The residual `hwahae-review-capture-provenance-non-main-pr.yml` guard restores the non-main PR portion without expanding the full Current Main Health suite to every non-main integration branch.

## Cost and structure review

Repeated checkout, Node setup, dependency installation and Supabase bootstrap are not by themselves evidence of duplicate responsibility. Converting those steps into shared abstractions can be considered later, but only if exact tool versions, permissions, environment, candidate-SHA semantics, database isolation and failure behavior remain unchanged.

No additional workflow merge or deletion is authorized by this audit. Future optimization should target execution cost or shared setup only after measuring runtime savings, not workflow-count reduction as an objective.

## Closure condition

The OPS CI cleanup track can be considered structurally closed when:

1. this audit and the corrected retirement ledger are green on canonical CI;
2. the restored Hwahae non-main PR guard is present in the responsibility map and topology guard;
3. the main branch is green after merge;
4. mobile remains outside workflow-consolidation scope beyond Track Key alignment.
