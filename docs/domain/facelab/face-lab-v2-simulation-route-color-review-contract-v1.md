# Face Lab V2 Route & Color Human Review Contract v1

> Track: Face Lab / Gate G-D
> Status: calibration evidence producer
> Visual authority: Human review only
> Provider invocation: none
> Production authority: none

## 1. Purpose

Gate G-D supplies the two quality checks not produced by Gate G-C:

- Route Adherence
- Color Fidelity

The review is bound to the exact server-authoritative Render Spec digest used by Gate G-B.

## 2. Route operation targets

Every Render Spec operation becomes one review target identified by its operationId.

The template exposes only evaluation-relevant intent:

- slot key
- source mode
- target regions
- application placement/direction/intensity/notes
- required/preferred/excluded criteria

Allowed responses:

- executed
- partial
- missed
- contradicted
- not_assessable

Mapping:

- contradicted -> REVIEW / ROUTE_OPERATION_CONTRADICTED
- missed -> REVIEW / ROUTE_OPERATION_MISSED
- partial -> REVIEW / UNDER_EDITED
- issue-free but any not_assessable -> NOT_EVALUATED
- all executed -> PASS

Observed route issues take precedence over not_assessable targets because an observed contradiction/miss is sufficient to block PASS.

## 3. Color targets

Only Render Spec operations containing color authority or color-semantic intent become color targets.

The template may expose:

- fidelity state
- target regions
- primary color anchor without evidence references
- candidate/requested/preferred semantic color attributes

Allowed responses:

- on_target
- near_target
- off_target
- not_assessable

V1 mapping:

- off_target -> REVIEW / COLOR_OFF_TARGET
- no off-target but any not_assessable -> NOT_EVALUATED
- on_target and near_target are acceptable for the first calibration baseline -> PASS
- no color target -> NOT_APPLICABLE

Near-target is intentionally diagnostic-only in v1. A later version may promote a stricter threshold after real calibration evidence exists.

## 4. Exact target-set requirement

The submitted routeOperations keys must exactly equal the authoritative Render Spec operation IDs.

The submitted colorTargets keys must exactly equal the authoritative color-target operation IDs.

Missing, added, or stale operation IDs invalidate the review.

## 5. Render Spec binding

The completed review must carry the exact renderSpecSha256 from the generated review template.

The core reconstructs Render Authority again from analysis, Face Lab V2 state, and locale.

A stale or mismatched digest invalidates the review.

## 6. Causal attribution

Human review observes a visible mismatch but does not prove its root cause.

All Gate G-D findings therefore use failureSource = evaluation_uncertain.

## 7. Reviewer identity

reviewerRef must be pseudonymous identifier syntax such as operator-01.

Email-style or free-text personal identifiers are rejected.

## 8. Response sealing

The completed normalized response receives a deterministic responseDigest over:

- contract version
- case ID
- pseudonymous reviewer reference
- Render Spec digest
- all route operation responses
- all color responses

The evidence packet later retains only review version, digest, and contributed check IDs.

## 9. Template CLI

Run the private analysis/state input through:

node scripts/build-face-lab-v2-simulation-route-color-template.mjs ./private/G-001.json

The output contains no raw image bytes and no provider payload.

Fill every null route/color response before review compilation.

## 10. Review CLI

Run a completed private review through:

node scripts/build-face-lab-v2-simulation-route-color-review.mjs ./private/G-001.route-color.json

The resulting artifact exposes only Route/Color checks plus bounded diagnostics and trace metadata.

## 11. Gate closure

Gate G-C and G-D review artifacts can both be supplied to Gate G-B through checkEvidencePaths.

When Identity, Edit Scope, Route, and every applicable Color check are evaluated, Gate G-A can finally resolve the packet to PASS or REVIEW/FAIL instead of NOT_EVALUATED.

## 12. Interpretation boundary

This gate does not measure attractiveness, user satisfaction, demographic fairness, or actual real-world styling outcomes.

It only evaluates whether the generated image appears to execute the committed Render Spec and remain within its color intent.