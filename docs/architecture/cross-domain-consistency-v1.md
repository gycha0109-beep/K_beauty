# Cross-domain Consistency v1

## Purpose

FunctionalPolicy, RoutinePolicy, and ConditionPolicy remain sibling policies that read the same SharedSkinDecisionContext. This layer runs after all three raw policies and before any Premium projection. It detects contradictions and prevents a critical conflict from reaching storage or UI.

## Inputs

- SharedSkinDecisionContext
- raw FunctionalPolicy
- raw RoutinePolicy
- raw ConditionPolicy

It does not read functionalPlan, routineStructure, currentProductVerdicts, conditionResponses, or localized UI copy.

## Output

`cross-domain-consistency-v1` records deterministic violations, verdict, severity, confidence, and an optional stabilization fallback. Warning-only results keep raw policies. Critical or insufficient-context results select a complete stabilization policy set.

## Storage meaning

Decision Bundle v5 stores `rawPolicies`, `consistency`, and `effectivePolicySource`. Existing top-level functional/routine/condition policies and projections remain compatibility fields and represent the effective policy set actually shown to the user.

## Fail-closed fallback

The fallback blocks new active expansion, sets active frequency to zero, keeps cleansing/hydration/barrier support/sun protection, forbids unknown-product replacement, and preserves actual condition signals without inventing product causation.

## Projection boundaries

- suppressed or held functional policies expose no product candidates or budget alternatives;
- omitted or held routine steps receive no recommended product attachment;
- consistency fallback disables legacy condition-response carryover.

## Legacy behavior

Saved historical snapshots are not rewritten by this module. Rebuild paths create a new context and a new Bundle v5; direct reentry continues to display the stored snapshot.
