# Skin Decision Engine current-main Closeout v1

## Baseline and source lineage

- current-main base: `6604ca37087eb063e793218d0b734e89c36f228d`
- SharedSkinDecisionContext v4 source: #91 `3f697f3e5c2ae607c9d86af3f16bdfe2cdb43037`
- Integrated Evaluation Pack v2 source: #92 `697c7314ff52e16b9254bc8693e2f5fce7030009`
- Unified Vision / Face source: #133 `c88d3c89801d5de73c307a925bf811f21c5198ff`
- #133 merge base used for three-way semantic integration: `a2b67db32239278c1b8d23658fefadc902f1fac2`
- frozen recommendation reference: #167 `783afb91a964f5d762f46846f9ef854902b48e95`

The stale branches are not merged. Durable semantics are rebuilt on current main.

## Durable-source classification

### A. Production runtime

- v4 context and Premium caller;
- single Unified Vision provider service;
- eligibility contract and Skin/Face Lab projectors;
- analyze route projection, bounded failure state, and compatibility face-reading route;
- direct result consumers needed for the response contract;
- bounded Premium/anonymous persistence fields.

### B. Tests and verifiers

- v4 verifier;
- Integrated Evaluation Pack v2;
- Unified Vision, eligibility, Face Lab, persistence/reentry, recommendation invariance, and closeout verifiers;
- exact-head workflow.

### C. Architecture contracts

This document, the v4 contract, Evaluation Pack v2 contract, and Unified Vision observation contract.

### D. One-time evidence excluded

Historical provider run packages, screenshots, raw responses, local replay output, and old Preview evidence are not imported.

### E. Obsolete or superseded code excluded

- #92 CandidatePolicy goal/safety/current-findings modules;
- duplicate provider calls from the client;
- temporary diagnostic/deployment workflows;
- stale stacked-branch implementation details.

### F. Current-main authority preserved

CandidateExposurePolicy durable shadow, Premium auth/session/storage, security closeout, Admin, Synthetic Toolkit, Vercel main-only policy, and recommendation scorer remain current-main authority.

### G. Semantic conflicts resolved

- #133 analyze route was three-way integrated rather than overwritten;
- CandidateExposurePolicy shadow invocation and production hard-disable remain intact;
- provider/input failure is represented as evidence state, not skin condition;
- v2 evaluation uses current CandidateExposurePolicy;
- sunscreen completeness remains audit-only;
- null context additions are omitted from direct legacy engine output so #167 hashes remain stable.

## Runtime contract

A single image-provider attempt produces one normalized Vision observation bundle. Skin and Face Lab are projections of that bundle. The original image is processed through the existing upload boundary and is not committed or persisted by this closeout.

Provider absent, provider error, timeout/technical failure, ineligible input, and insufficient evidence receive bounded state codes. The decision engine applies photo weights only when `skinAnalysisEligible === true`.

## Public response and persistence

Analyze response schema v2 adds bounded `imageEligibility`, `photoEvidenceState`, Face Lab result, and aggregate Vision version metadata. Existing recommendation fields remain compatible.

Premium session and saved snapshots retain bounded photo state and normalized eligibility. Legacy reports rebuild into v4. Anonymous persistence rejects unknown top-level fields and strips raw provider material.

## Recommendation boundary

The closeout does not merge or edit #167. Exact-head CI checks the current engine against #167’s 164-product, 12-scenario frozen baseline for ranking, score breakdown, explanation, persistence projection, public response snapshot, and CandidatePolicy fingerprint invariance.

## Admin boundary

No Admin route/parser/RPC/migration or catalog review is changed. #170 remains a separate prerequisite for recommendation roadmap R6 and activation work.

## Deployment boundary

`vercel.json` remains main-only automatic deployment. No helper deployment workflow is retained. When a formal Preview is unavailable, status is reported as `PREVIEW_NOT_AVAILABLE_BY_POLICY` rather than inferred from Production.
