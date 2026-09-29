# Face Lab V2 — Route Choice Evidence v1

> Track: face-research
> Authority: server-derived observation of the current Route decision
> Preference learning: not active in v1

## 1. Purpose

Face Lab now distinguishes a system default preview from an explicit user-selected Route.

Persisting only `selectedRouteId` is insufficient for future analysis because Route Generator semantics can change over time. Route Choice Evidence freezes the semantic meaning of the accepted decision at the time the server persists it.

## 2. Authority boundary

The browser may submit:

~~~text
selectedRouteId
~~~

The browser must not author Route Choice Evidence.

The server:

1. normalizes the user state;
2. recomputes the canonical Face Lab V2 result;
3. validates the route through canonical selection authority;
4. derives Route Choice Evidence from that canonical result;
5. persists the evidence beside the current Face Lab V2 user state.

## 3. Schema

~~~text
face-lab-route-choice-evidence-v1
~~~

Fields:

~~~text
selectionState
choiceType
preferenceEligible
routeId
strategy
routeGeneratorVersion
recommendationPriority
targetLabels
domains
changeTolerance
changeMagnitude
dailyEffort
maintenance
costBand
reversibility
actions[]
capturedAt
~~~

Each action contains only:

~~~text
domain
parameter
direction
strength
~~~

The evidence intentionally excludes:

- photo data;
- raw Face Lab analysis;
- Current Face Profile;
- face-feature evidence strings;
- natural-language execution explanations;
- product data.

## 4. Preference eligibility

### Explicit user choice

~~~text
selectionState = user_selected
choiceType = explicit_user
preferenceEligible = true
~~~

This is a genuine user choice between alternatives and may become a future preference-learning signal.

### Single-route auto resolution

~~~text
selectionState = single_route_auto
choiceType = single_option_auto
preferenceEligible = false
~~~

A user who was given only one route did not express a preference between alternatives. This must never be counted as positive preference evidence.

### Default preview / no route

No Route Choice Evidence is persisted.

## 5. Rehydration

Persisted evidence is returned only when its `routeId` still matches the currently valid committed Route after canonical rehydration.

If a historical Route ID is no longer valid under the current generator:

~~~text
selectedRouteId = null
routeChoiceEvidence = null
~~~

for the active response.

The stored historical JSON is not silently rewritten during GET.

## 6. v1 non-goals

This contract does not:

- personalize future recommendations;
- create a Preference Fit engine;
- aggregate choices across users;
- infer aesthetic correctness;
- change Route Generator ranking;
- change Target Fit or Face Fit authority;
- create a historical event log.

It only makes the current accepted Route decision semantically inspectable and future-safe.

## 7. Future use

A later, separately versioned learning layer may consume only evidence rows where:

~~~text
preferenceEligible = true
~~~

Any such learning system must preserve the explicit Target authority and must not reinterpret automatic single-option resolution as user preference.
