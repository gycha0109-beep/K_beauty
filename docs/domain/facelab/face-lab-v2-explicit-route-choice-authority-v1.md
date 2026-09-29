# Face Lab V2 — Explicit Route Choice Authority v1

> Track: face-research
> Production intent: default route is a preview, not a user decision

## 1. Problem

The Route Diversity v1 audit established that the target-sweep cohort already emits three materially distinct routes in all 96 cases, while the computed default strategy is `balanced` in 96/96 cases.

The product must therefore distinguish:

- a system-computed starting point;
- an explicit user-selected route.

Without that distinction, the default route is silently promoted into a decision the user never made.

## 2. Selection states

Canonical route state uses exactly these meanings:

~~~text
no_route
default_preview
single_route_auto
user_selected
~~~

### default_preview

Used when two or more routes exist and the user has not selected one.

The generator may still compute `defaultRouteId` and the composer may internally materialize that route for deterministic preview compatibility, but it is not a committed user choice.

### user_selected

Used only when the supplied `selectedRouteId` references an emitted route.

### single_route_auto

When exactly one route exists, Face Lab may auto-select it because there is no meaningful comparison decision for the user to make.

## 3. Product authority

For multi-route results:

~~~text
defaultRouteId       = system starting point
selectedRouteId      = internal preview route until selection
selectionState       = default_preview
persisted route ID   = null
presentation select  = none
execution / look UI  = hidden until explicit choice
~~~

After the user chooses:

~~~text
selectionState       = user_selected
persisted route ID   = chosen route
presentation select  = chosen route
execution / look UI  = visible
~~~

## 4. Persistence rule

`default_preview` and `no_route` must never be persisted as a user-selected route.

`user_selected` and `single_route_auto` may persist their resolved route IDs.

This applies both to browser-side persistence requests and server-side canonical rehydration.

## 5. Presentation rule

The default route may be marked only as a neutral starting point:

~~~text
시작 제안
Starting point
~~~

It must not render with the selected state before user action.

For `default_preview`:

- route cards remain comparable;
- a choice prompt is visible;
- no route card is selected;
- execution details are withheld;
- composed Look is withheld;
- route-specific product guidance is withheld;
- Style Delta level conflict guidance may remain visible.

## 6. Backward compatibility

Persisted legacy results that have a `selectedRouteId` but no `selectionState` continue to render as selected so previously saved decisions do not disappear.

Frozen recommendation and Route Diversity evaluations may continue to inspect the internally resolved preview route; the authority distinction is carried by `selectionState` and persistence/presentation boundaries.

## 7. Non-goals

This change does not:

- modify candidate route generation;
- alter route action semantics;
- change Route Generator v6 ranking;
- claim the starting route is objectively best;
- add preference learning;
- activate vCandidate personalization;
- remove deterministic defaultRouteId computation.

## 8. Required verification

The contract requires deterministic verification that:

1. multiple routes + no choice => `default_preview`;
2. preview does not render or persist as selected;
3. explicit valid choice => `user_selected` and unlocks execution;
4. invalid route ID falls back to preview, not an invented selection;
5. exactly one route => `single_route_auto`;
6. server and client persistence exclude uncommitted previews.
