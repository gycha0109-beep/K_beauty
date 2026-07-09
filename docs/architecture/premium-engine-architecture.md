# Premium Engine Architecture

Date: 2026-07-09
Branch: `codex/survey-input-contract-refactor`
Status: Architecture documentation only. No runtime integration.

This document fixes the long-term boundary for the premium Skin Match engine after the functional ranking, guard, exposure, and candidate-audit work. The current functional recommendation work is not a standalone premium sector. It becomes part of a shared judgment layer called `SkinMatchPremiumCore`.

## 1. System Shape

Skin Match Premium is structured as:

- a common judgment core
- sector-specific routers
- a separate Face Lab direction engine

Target flow:

```text
/api/analyze
-> buildSkinMatchDecisionBundle()
-> baseRecommendationResult
-> buildSkinMatchPremiumCore()
-> sharedSkinMatchContext
   -> buildRoutineConsultationSection()
   -> buildFunctionalDecisionSection()
   -> buildConditionResponseSection()

Face image / face analysis signals
+ skinStyleSignals from SkinMatchPremiumCore
-> buildFaceLabDirectionSection()
```

Face Lab is not a Skin Match Core sub-router. It is a separate engine. It may reference only `skinStyleSignals` from `SkinMatchPremiumCore`, plus its own face-image and face-analysis signals. It must not directly consume product ranking state, routine decisions, guard flags, or functional recommendation internals.

## 2. SkinMatchPremiumCore Responsibility

`SkinMatchPremiumCore` produces shared judgment material. It does not produce UI copy, cards, section layout, product slot wording, or user-facing explanations.

The core can produce:

- `skinProfile`: normalized skin type, sensitivity, recent change, hydration/oil/redness state, and survey/photo evidence summaries.
- `productContext`: normalized product snapshots, functional profiles, and candidate-source context already available to the caller.
- `slotContext`: category and routine-slot occupancy signals, including missing, duplicated, occupied, optional, and holdable slots.
- `riskFlags`: sensitivity, dryness, redness, recent instability, sunscreen-preference conflict, and evidence-completeness flags.
- `functionalContext`: primary concern, secondary concerns, ranking goal, safety goal, priority tension, product functional axes, and duplicate functional axes.
- `guardContext`: stabilize-first state, hard-block candidates, recent-instability guard output, and safety-review candidates.
- `exposureContext`: primary, contextual, collapsed, hidden, and insufficient-evidence exposure signals for future CandidatePolicy use.
- `currentRoutineContext`: current product findings, duplicate axis, supports-goal, not-using, not-in-db, and unanswered states.
- `skinStyleSignals`: skin-style-safe signals for Face Lab, such as visible finish direction, tone/texture impression, makeup compatibility, and style constraints derived from Skin Match evidence.

Core output is an internal context contract. It is not an API response contract and must not be exposed directly to UI.

## 3. Module Placement

| Module | Placement | Role | Runtime status |
| --- | --- | --- | --- |
| `survey-input-contract` | Core input layer | Normalizes survey/form inputs into a stable decision contract. | Internal runtime audit/input contract; not exposed in API response. |
| `functional-goal-policy` | Core judgment layer | Separates requested `primaryConcern` from detected `priority.axis`, ranking goal, safety goal, guard, and tension. | Pure helper; future core input. |
| `product-functional-profile` | Core product context | Converts product snapshots into functional axes, category role, caution tags, and evaluability. | Pure helper; product-name/brand inference remains forbidden. |
| `current-product-findings` | Core current routine context | Summarizes current products as duplicate, supports-goal, not-using, not-in-db, or unanswered context. | Pure helper; no replacement decision. |
| `functional-ranking-contract` | Core evaluator contract | Evaluates a single candidate with hard filter, score breakdown, reasons, penalties, confidence, and ranking context. | Shadow/new engine contract; does not replace existing recommendations. |
| `functional-candidate-audit` | Audit layer | Applies the single-candidate evaluator to arrays and produces ranked, blocked, and insufficient-data audit groups. | Shadow-only audit. |
| `recent-instability-guard-policy` | Core guard policy draft | Classifies recent-instability guard decisions into hard block, collapsed exposure candidate, soft/context candidate, or insufficient data. | Pure policy helper; not wired to evaluator runtime. |
| `functional-guard-exposure-policy` | Future integration boundary | Maps guard decisions to candidate exposure states for future CandidatePolicy interpretation. | Pure policy helper; no CandidatePolicy runtime integration. |
| `functional-candidate-exposure-audit` | Audit layer | Applies evaluator, guard policy, and exposure policy to candidate arrays and creates primary/contextual/collapsed/hidden/insufficient evidence audit groups. | Shadow-only audit artifact. |
| `functional-exposure-readiness-review` | Audit/readiness layer | Reviews exposure audit artifacts for integration readiness and evidence gaps. | Shadow-only review. |
| `functional-evaluator-hard-block-review` | Audit/policy review layer | Reviews safe-low-risk hidden candidates and evaluator hard-block boundaries. | Analysis only; no hard-filter changes. |
| `functional-divergence-policy-review` | Audit/policy review layer | Classifies shadow divergences into observation, policy-review candidate, safety-review required, or comparison limit. | Analysis only. |
| `functional-shadow-capture / comparison` | Audit infrastructure | Captures sanitized dev-only fixtures and compares existing recommendation snapshots with functional audit output. | Dev-only/shadow-only; no production behavior. |

## 4. Sector Router Boundaries

### RoutineConsultationRouter

The routine router decides how the routine is arranged.

Responsibilities:

- execution order
- AM/PM placement
- slot keep, hold, add, omit, or optional state
- current product and recommended product routine position
- routine-level compatibility and sequencing

Non-responsibilities:

- deep functional ingredient judgment
- deciding whether a retinol, vitamin C, AHA/BHA, acne-care, or tone-care axis is functionally appropriate
- overriding safety guard output
- generating Face Lab style direction

### FunctionalDecisionRouter

The functional router decides whether functional action should be added, held, duplicated, compared later, or treated with caution.

Responsibilities:

- functional add/hold/duplicate/caution decisions
- retinol, vitamin C, AHA/BHA, acne care, tone care, pore/texture, hydration, barrier, and soothing axes
- interpreting `functionalContext`, `guardContext`, `exposureContext`, and `currentRoutineContext`
- sending routine-facing signals such as `hold`, `occasional`, `night-only`, `stabilize-first`, or `compare-later`

Non-responsibilities:

- rebuilding the whole AM/PM routine
- deciding final routine slot order
- producing condition-day keep/reduce/pause/avoid changes
- driving Face Lab style or mood output

### ConditionResponseRouter

The condition router adapts the routine for today's condition.

Responsibilities:

- condition-specific keep, reduce, pause, avoid, or resume rules
- dryness, stinging, breakout, flaking, makeup pilling, excess oil, redness, barrier stress, and recent irritation states
- short-term routine variation based on current condition

Non-responsibilities:

- new product discovery as its primary purpose
- full functional candidate ranking
- permanent routine rebuild
- Face Lab direction

### FaceLabDirectionEngine

Face Lab is a separate engine, not a Skin Match Core router.

Responsibilities:

- face impression and mood direction
- style direction
- base finish direction
- makeup, hair, and color direction
- use of face image / face analysis signals
- optional use of `skinStyleSignals` from `SkinMatchPremiumCore`

Non-responsibilities:

- product recommendation
- routine sequencing
- functional ingredient decisions
- guard or hard-filter decisions
- direct access to internal Skin Match Core contexts except `skinStyleSignals`

## 5. Relationship To Current Functional Ranking Work

The current functional ranking, guard, exposure, candidate audit, shadow capture, and divergence review work should be treated as the early form of the `SkinMatchPremiumCore` common judgment layer.

It is not a standalone premium sector and should not become a separate user-facing engine beside Routine, Functional, and Condition. Instead:

- single-candidate evaluation belongs to core functional judgment
- guard policy belongs to core safety judgment
- exposure policy is a future boundary between core judgment and CandidatePolicy
- candidate exposure audit remains a shadow/readiness tool
- divergence and hard-block reviews remain policy-review tools

Phase 16 resumes after this documentation task. Phase 16 remains a shadow policy review task, not a runtime behavior change.

## 6. Guardrails

- Core produces judgment material.
- Routers produce only their own sector outputs.
- Routers must not invade each other's responsibilities.
- Face Lab must not be moved inside Skin Match Core.
- Face Lab may consume only `skinStyleSignals` from Skin Match Core.
- Core internals must not be exposed directly to UI or API responses.
- Shadow and audit modules are separate from runtime policy.
- Audit artifacts are evidence, not product-quality judgments.
- Hidden, collapsed, and insufficient-evidence states are exposure-policy states, not user-facing claims.
- Runtime integration requires a separately approved task.
- API response, stored payload, DB schema, Supabase queries, existing recommendations, `topPick`, `supportingProducts`, and `budgetAlternatives` stay unchanged until explicitly approved.

## 7. Non-goals

This document does not implement:

- `SkinMatchPremiumCore`
- Routine engine
- Condition engine
- Face Lab engine
- CandidatePolicy runtime integration
- evaluator hard-filter changes
- score or weight changes
- UI sections
- API response fields
- DB schema or migration work
- Supabase queries
- existing recommendation replacement

## 8. Resume Point

After Premium Engine Architecture documentation, return to Phase 16.

Resume work name:

`Evaluator Recent-Instability Hard Block Boundary Shadow Policy`

Resume goal:

Validate a shadow policy that virtually reclassifies low-risk / sensitivity-safe mixed-profile candidates currently hard-blocked by `recent_instability_active_limited` into:

- `preserve_hard_block`
- `downgrade_to_collapsed_candidate`

This Phase 16 work remains shadow-only. It must not change evaluator runtime hard filters, ranking score, CandidatePolicy runtime behavior, UI, API response, DB schema, Supabase queries, existing recommendations, or product data without a separate approval.
