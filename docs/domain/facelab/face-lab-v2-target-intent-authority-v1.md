# Face Lab V2 — Target Intent Authority v1

> Track: Face Lab recommendation completion
> Status: Production-bounded intent authority
> Production default: face_harmony
> New explicit mode: target_forward

## 1. Problem

Face Lab must not treat a face-based styling heuristic as an objective aesthetic truth.

A user may explicitly prefer a stronger Target expression even when Face Fit would normally soften, cap, preserve, or redirect that styling action.

The existing Product definition already gives the user authority over the Target. This contract makes that authority executable.

## 2. Recommendation priority

The survey now carries:

~~~text
recommendationPriority
~~~

Allowed values:

~~~text
face_harmony
target_forward
~~~

### face_harmony

Default and legacy behavior.

~~~text
Target Action Pool
→ Current Face modifier
→ Scope / hard constraints
→ Route
~~~

This preserves the current Production Face Fit semantics.

### target_forward

Explicit user authority.

~~~text
Target Action Pool
→ no soft Current Face modifier
→ Scope / hard constraints
→ Route
~~~

The Target action remains intact when the only opposing signal is a Face Fit styling heuristic.

## 3. Authority hierarchy

~~~text
Hard exclusion / Styling Scope
        >
Explicit recommendation priority
        >
Face Fit styling heuristic
        >
generic default
~~~

target_forward therefore does not bypass:

- Styling Scope
- disabled domains
- makeup exclusions
- hard exclusions
- route-level lifestyle constraints

It only prevents the Current Face modifier from silently overriding a user-confirmed Target direction.

## 4. Legacy compatibility

When recommendationPriority is absent, invalid, or from an older persisted survey, face_harmony is used.

The legacy Target preference evidence is not modified merely because the default was inferred.

This is required so the frozen PR A / 16K / 16L baselines remain valid for historical fixtures that do not contain the new field.

## 5. User-facing control

The setup screen exposes two choices:

~~~text
얼굴과 자연스럽게
추구미를 더 확실하게
~~~

The first is selected by default.

No separate Preference Fit engine is introduced.

The value becomes part of Target intent and is persisted with the existing survey payload.

## 6. Example

~~~text
Current Face:
straightCurveBalance = curved

Target:
soft

Face Fit action:
hair curvature → maintain / light

Target action:
hair curvature → increase / moderate
~~~

With face_harmony the Face Fit action is used.

With target_forward the Target action is preserved.

## 7. Non-goals

This change does not:

- create an aesthetic winner score;
- claim Target-forward is objectively better;
- activate the evaluation-only vCandidate engine;
- add a separate Preference Fit engine;
- bypass practical or hard constraints;
- change the default semantics of existing saved Face Lab results.

## 8. Next completion work

This authority field is the minimum foundation for later route diversification and explicit user choice.

Future work can use actual user route selections as preference evidence without creating a separate recommendation authority layer.
