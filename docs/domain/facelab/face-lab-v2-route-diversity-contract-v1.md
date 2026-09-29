# Face Lab V2 — Route Diversity Contract v1

> Track: face-research
> Scope: audit only; Production Route Generator semantics unchanged
> Cohort: deterministic 8 faces × 12 targets = 96 target-sweep cases

## 1. Purpose

Face Lab must not manufacture visually different route names around the same execution plan.

This contract separates three questions that were previously conflated:

1. Does the generator emit more than one route?
2. Are emitted routes actually different in styling actions?
3. Does the default selected route still collapse onto one strategy?

The audit measures all emitted routes, not only the default selected route.

## 2. Route comparison units

### Action identity

~~~text
domain : parameter : direction
~~~

Example:

~~~text
eyewear : curvature : increase
~~~

### Action semantic

~~~text
domain : parameter : direction : strength
~~~

Strength is part of the user-visible execution semantics.

### Route profile

~~~text
changeMagnitude
dailyEffort
maintenance
costBand
reversibility
~~~

Route profile metadata alone does not make two routes meaningfully different if their action semantics are identical.

## 3. Pairwise classifications

### Cosmetic duplicate

Two routes are cosmetic duplicates when their complete action-semantic signatures are identical.

Different route IDs, titles, why-copy, or profile metadata do not rescue a cosmetic duplicate.

### Meaningfully distinct

Two routes are meaningfully distinct when their action-semantic signatures differ.

This includes:

- a different styling lever;
- a different direction;
- a different action strength.

### Strong choice distinct

A pair is strongly distinct when it is meaningfully distinct and at least one of these is true:

- dominant execution domain differs;
- action-identity Jaccard overlap is 0.50 or lower.

This is a diagnostic tier, not yet a launch gate.

## 4. Case classifications

Every 96-case row is classified as exactly one of:

~~~text
NO_ROUTE
SINGLE_ROUTE
MULTI_ROUTE_COSMETIC_ONLY
MULTI_ROUTE_MEANINGFUL
~~~

The audit must preserve full case accounting.

## 5. What this PR is allowed to change

This PR may add:

- deterministic evaluation code;
- audit output;
- CI verification;
- documentation.

It must not change:

- Route Generator candidate generation;
- route ordering;
- defaultRouteId;
- selectedRouteId;
- Style Delta;
- Target Intent authority;
- execution engines;
- persistence.

## 6. Interpretation rules

Selected-route concentration and emitted-route diversity are different metrics.

A result such as:

~~~text
selected strategy concentration = 1.0
cases with 3 emitted meaningful routes = high
~~~

means the generator has candidate diversity but default selection is collapsed.

A result such as:

~~~text
cases with at least 2 emitted routes = high
cases with at least 2 meaningful routes = low
~~~

means the generator is producing route labels rather than genuine execution choices.

These two failures require different fixes.

## 7. Next implementation decision

The following PR must use this audit baseline before changing Route Generator v6.

Possible interventions depend on the observed baseline:

- candidate generation redesign when meaningful route diversity is low;
- default ranking redesign when emitted diversity is healthy but selection concentration is excessive;
- comparator/UI work when route semantics are healthy but differences are poorly exposed.

No diversity metric may be improved by route-ID multiplication or copy-only variation.
