# Face Lab / Skin Track S0 — Skin Engine read-only audit (2026-10-14)

> Status: S0 evidence ledger; **S0 implementation/real-photo accuracy NOT certified**. Classification: diagnosis/review. Baseline `main@1a82cf9961f4fbba30d1d59f1ec2de1a3c6dd7e2`; roadmap Draft #1307 `face-lab/docs-skin-track-roadmap-20261014@6f2cb9552d1a9a2b1f6b0576d0f7bd02fd3ddf0b`.
> Track key: `face-lab-skin`. No Style Track edits. This audit is not policy activation or approval for changing the score, saved report, API schema, provider, storage or production.

## 1. Audit scope, authority, and boundaries

- Audited **current main code**, not historical Face Lab implementation claims. Primary references: `AGENTS.md`, `.codex/README.md`, `.codex/AI_ROUTER.md`, `docs/architecture/skin-decision-engine-current-main-closeout-v1.md`, `docs/architecture/shared-skin-decision-context-v4.md`, `docs/architecture/premium-integrated-evaluation-pack-v2.md`, `docs/domain/facelab/unified-vision-observation-contract-v1.md`.
- This is the **S0** inventory and risk classification. Existing authoritatives are `skin-match-decision-engine-core.js`, `shared-skin-decision-context-v4.js`, `premium-decision-state.js` and the actual contracts. S1 human/real-image performance and S5 production launch evidence are separate.
- DB/Auth/RLS/Storage/Payment/Provider/Secret/Production delta: **N** for this audit's edits; observations of those boundaries are read-only. Image-processing reliability and downstream score contract may require a **future Y/approval**.
- At audit start: roadmap #1307 OPEN/Draft, no merge; #1208 OPEN supply-chain block. #1307 HEAD had `BEJEWELY Current Main Health` and `PIE Prospective Shadow` successful, but those two results are not a complete S0, SCA, device or real-image acceptance.

## 2. Canonical source → consumer → authority map (current main)

| Step | Canonical source / precise operations | What is passed downstream | Authority / limits |
| --- | --- | --- | --- |
| 1. Camera/input | `app/api/analyze/route.js` around 1400–1454; `canonicalizeImageFile`, `analyzeVisionObservation` | bounded image bytes, locale-independent Vision result | Shared image-processing boundary. No second Skin-specific Vision call; Style uses the same observation bundle. |
| 2. Provider observation | `lib/server/vision-observation-service.js` `createVisionObservationPrompt` → `executeVisionProviderWithRetry` → `normalizeVisionObservationBundle` | `bundle: {status, eligibility, skin, face, privacy}` | Visible cues only, not a skin diagnosis. Additional explanation generation later is **not** an independent image observation. |
| 3. Image eligibility | `lib/image-analysis-eligibility.js:68–145` | `skinAnalysisEligible`, failure reason, quality/face status, global confidence | One image-level gate; confidence is *not* a per-axis Skin score confidence. |
| 4. Skin field contract | `lib/vision-observation-contract.js:13–75, 99–109` | Eight integer 0–5 signals; ≤4 visible observations with `key,area,cue,level,confidence` | Provider contract instructs `0` for both unsupported and ineligible. No axis-level known/unknown in numeric signal map. |
| 5. Normalization | `lib/vision-observation-normalizer.js:24–36,67–104` | `skin.status`, normalized signal map, per-observation confidence | Missing/unparsable signal becomes 0; `available` if any observation or positive number. Ineligible: unavailable with zero map. |
| 6. Skin projection | `lib/skin-observation-projector.js:93–157` | `photoAnalysis.signals`, `evidence`, `photoObservations.summary/signals/surveyAlignment`, `imageEligibility` | Retains confidence only for display observations, not signal-axis weights; projection emits numeric scores as supplied even if skin status insufficient. |
| 7. Free priority and score | `lib/skin-match-decision-engine-core.js:568–725, 2799–2811` | Survey, environment, photo buckets → `priority.axis`, `scoring.concernScores` → product score/ranking/Top Pick | `applyPhotoWeights` gates solely on `skinAnalysisEligible`; no field-confidence/available-status test before adding 0–20 points (UV 0–15). **Scoring is frozen for this audit.** |
| 8. Premium source | `app/api/analyze/route.js:1511–1627` → `lib/premium-session-payload.js:1–40` | `freeResult`, `photoObservations`, `photoEvidenceState`, `imageEligibility`, current products and prior result | Explicit photo status is carried alongside observations. Anonymous canonical persistence is separate. |
| 9. Shared canonical context | `lib/shared-skin-decision-context.js:349–427` → `lib/shared-skin-decision-context-v4.js:108–210,295–478` | `skinState`, `concernState`, `photo`, `uncertaintyState`, evidence ledger, current-product exposure, safety/environment, hash/revision | v4 rebuilds from report+previous context. `concernState` supports null/unknown scores, but the upstream scoring may already have coerced unsupported photo to zero. |
| 10. Domain policies | `lib/premium-decision-state.js:115–193` → `functional-policy.js`, `routine-policy.js`, `condition-policy.js`, `cross-domain-consistency.js`, `effective-policy-set.js` | Raw policies → consistency → effective policies → `functionalPlan`, `routinePlan`, `conditionPlan` | Decision authority belongs to effective canonical policy; when critical cross-domain violation, stabilization fallback may suppress expansion. Do not infer photo-specific confidence from generic policy confidence. |
| 11. Premium presentation | `lib/premium-functional-projection.js`, `lib/premium-routine-projection.js`, `lib/premium-condition-projection.js` → `PremiumFunctionalDecisionSection.jsx`, `PremiumRoutineConsultSection.jsx`, `PremiumConditionResponseSection.jsx` | Functional direction, current products/routine steps, `maintain/reduce/avoid_for_now` condition display, notices | UI projection, not an independent diagnosis. Current four sections include problem tracking/next changes and existing Full Report shell; exact page-level rendered UAT NOT executed. |
| 12. Re-entry | `lib/premium-report-reentry.js:1–31` and snapshot/re-entry verification scripts | Saved snapshot/rebuild → same canonical decision bundle intended | Contract-level replay coverage exists, but live session/Android repeatability and propagation of fallback photo-state mismatch remain unverified. |

### Signal-to-cue audit

| Decision axis | Photo cue available | Important limitation |
| --- | --- | --- |
| `oiliness` | `surface_shine` | Surface gloss is not measured sebaceous secretion; light or product layer can mimic it. |
| `dehydration` | `dry_texture`, `visible_flaking` | Cannot diagnose hydration or deep water content. |
| `acne` | `active_spots` | Observable spot-like appearance, not a clinical acne diagnosis. |
| `uneven_tone` | `tone_variation` | White balance/shadows/makeup can distort visual variation; unrelated to Style color-season authority. |
| `pores` | `pore_visibility` | Magnification, resolution, smoothing and distance affect visibility. |
| `redness` | `red_appearance` | Light/white balance, cosmetics and photographic rendering confound redness. |
| `barrier` | `surface_stress` plus limited visible texture cues | Barrier function itself cannot be diagnosed from a photo. |
| `uv` | No `VISION_SKIN_OBSERVATION_KEYS` entry | Photo signal exists in 8-axis numeric schema but no explicit observation cue; do not interpret as measured UV damage. |

Capture/appearance modifiers in the prompt: makeup, filter, blur, lighting, occlusion → confidence reduction. Eligibility has explicit reasons for heavy filter/editing, lighting insufficiency, skin occlusion, too-small face, etc. **No verified per-axis confidence-to-score gate or actual camera-variation calibration.**

## 3. Source-confirmed risks (NOT clinical error-rate claims)

| ID | Priority | Static source evidence and causal pathway | Established / unproven |
| --- | --- | --- | --- |
| SKIN-S0-01 | P0 — score interpretation | `vision-observation-contract.js:104–105` asks 0 for unsupported; `vision-observation-normalizer.js:24–26,76–79` turns missing/non-numeric into 0; `applyPhotoWeights:712–725` reads `signals[axis] || 0`. Thus `unobserved` and `observed-low` are numerically indistinguishable once scored. | **Code path confirmed.** Whether a particular real photo changes Top Pick is not measured. |
| SKIN-S0-02 | P0 — evidence-gating | Normalizer retains `observation.confidence` in an observation list, projector displays it, but `applyPhotoWeights` uses only photo eligibility + numeric signals. An axis score of 5 can receive 20 photo points regardless of low/high observation confidence (3x for UV). | **Code path confirmed**; no assertion of real-world misclassification without labeled images. |
| SKIN-S0-03 | P0 — canonical status | `photo-evidence.js:176–185` creates fallback `photoObservations` object, route explicitly assigns `photoEvidenceState.status='unavailable'` on Provider failure, engine carries both to Premium. `shared-skin-decision-context.js:365` sets `context.photo.observations` to this non-null object, then v4 `buildPhotoState:177–179` uses `observations ? 'available' : explicitStatus`. This can override explicit failure with `available`. | **Source-to-source reachable path confirmed**, exact runtime fixture/CI characterization required. Historic verifier often supplies unavailable without fallback observations, so it does not exercise this compound state. |
| SKIN-S0-04 | P1 — state conversion | `skin-observation-projector.js:102–105` produces `surveyAlignment.status='mixed'` when score 2. `shared-skin-decision-context-v4.js:117–131` only admits `aligned/partial/conflict`. `mixed` becomes `unknown` without a dedicated mapping. | **Deterministic enum mismatch confirmed**; affected result frequency unknown. |
| SKIN-S0-05 | P1 — false disagreement copy | `skin-observation-projector.js:99–105` returns `conflict` for score 0 or 1 whenever overall skin status is available. A particular concern's absent observation is not tested, so `unsupported=0` can be narrated as survey-photo conflict. | **Source-confirmed contract mismatch**; response frequency unknown. |
| SKIN-S0-06 | P1 — confidence propagation | v4 `buildUncertaintyState:295–352` has explicit missing/failure uncertainty and confidence ceiling, but not an independent field-level skin observation confidence map. When #03 elevates availability, photo failure-related uncertainty can be concealed. | **Structural gap confirmed**; precise effective-policy/user-visible consequences need controlled fixtures. |
| SKIN-S0-07 | P2 — presentation | Normalizer accepts up to four skin observations (`slice(0,4)`), projector displays and emits only first three (`slice(0,3)`); fourth cue may be omitted from projected evidence. | **Static projection behavior confirmed**; whether order biases user-facing summary requires testing. |

**Cross-domain safe behavior already present:** v4 `concernState` distinguishes null score from zero when its **input is explicitly null**; `photo.factsMayBeInferred=false`; `condition-policy` has `unknown` triggers and unknown product guards; `cross-domain-consistency` and `effective-policy-set` provide stabilization fallback, sunscreen protection retention, unknown-product replacement restrictions. These safeguards **do not retroactively reconstruct** evidence lost before scoring.

## 4. Existing test evidence vs untested scenarios

| Existing coverage | What it proves in source | What it does NOT prove |
| --- | --- | --- |
| `scripts/verify-unified-vision-pipeline.mjs` | Single image-bearing provider path, route wiring, contract/sanitizer static assertions | Per-axis vision precision, bad-light hold quality, individual cue reliability |
| `scripts/verify-shared-skin-decision-context-v4.mjs` | Explicit `not_provided`, `unavailable`, `ineligible`, unknown products, null concern scores, context semantics in synthetic fixture | Compound case: explicit provider failure **plus non-null fallback photoObservations** |
| `scripts/verify-premium-integrated-evaluation-v2.mjs` | Named synthetic variants including S08 no photo, S09 unavailable, S10 ineligible, S11 conflict, S12 insufficient | Real image assessment; score-vs-confidence counterfactual; `mixed` alignment |
| `scripts/verify-skin-decision-recommendation-invariance.mjs` | Historical fixed 164-product × 12-scenario ranking/score/response semantic comparison contract | Skin cue validity; cannot authorize changes to scoring weights |
| `scripts/verify-skin-decision-persistence-reentry.mjs` and premium snapshot tests | Deterministic storage/re-entry behaviors under tested fixtures | Live Android camera, photometric repeatability, real user comprehension |

The 31 variants and 462 assertions are **historical reported synthetic coverage** until exact-head execution is observed. None is a real-photo accuracy measure.

### Focused S0 negative matrix (new diagnostic; no production change)

- D01 `ineligible` must add no photo score (known gate).
- D02 valid global eligibility plus low-confidence high-score redness versus high-confidence high-score redness: characterize current identical score; desired gate requires approved future decision.
- D03 missing `skin.signals.pores` versus explicitly 0: current normalization collapses both; a future contract must distinguish them.
- D04 explicit `photoEvidenceState.unavailable` + non-null fallback observations: characterize v4 promotion to `available`.
- D05 `surveyAlignment.mixed` → v4 `unknown`.
- D06 actual priority / Top Pick change under the above signals: **not yet established**.
- D07 no-photo, provider 429/timeout, partial cues and saved legacy report replay: expand in next controlled verifiers.
- D08 skin quality on makeup/white balance/lighting/angles/filters, same-person repeat: **S1 Human evidence HOLD**.

Read-only diagnostic script: `scripts/facelab/skin/diagnose-s0-photo-evidence.mjs`; it reproduces **present behavior** and outputs `RISKS_REPRODUCED`, not a correctness PASS or a stable future recommendation expectation. It is intentionally **not** added to CI or the product runtime; retire/rewrite after approved repairs.

## 5. Proposed narrow repair order (NOT executed)

1. **First independent decision-consistency PR (S0→S2)**: resolve canonical `photoEvidenceState` precedence over non-null fallback observations and normalize `mixed` to an agreed canonical state. Preserve legacy read/re-entry semantics, explicit statuses and snapshot compatibility. Run v4, integrated, re-entry and current-main verifier; avoid recalculating or upgrading historical snapshots silently.
2. **Separate score-policy contract RFC/PR (S1→S2, permission required)**: represent per-axis `observed-low / unsupported / unassessable / missing` and confidence without inventing absence-as-negative. Perform shadow scoring + frozen #167 recommendation invariance baseline comparisons, independent safety adjudication before activation. Do **not** apply ad hoc numeric confidence multipliers to production.
3. **Photo cue evaluation S1**: blind annotated, consented controlled images; stratified lighting, device, makeup, filter, skin appearance, capture variation, representativeness; cue precision/recall/abstain and test-retest. Synthetic cue fixture cannot certify human accuracy.
4. **Premium S4**: user-visible `unknown` / `HOLD` / evidence, current routine, problem tracking, next plan, situational response and explicit recapture suggestions; browser/Android actual acceptance.
5. **S5 protected owner**: security issue #1208 remediation without exception extension; real-photo consent, withdrawal, deletion, retention; device QA; release/rollback approval.

## 6. Scope completion / HOLD ledger

- **Recorded in this PR:** current-main source/consumer map, 8 signal/cue meanings, four primary confirmed contract risks, three further static concerns, test gap matrix, isolated next PR plan. No suggestion here is an approved production change.
- **Not established:** end-to-end behavioral tests on actual repo runtime until script/CI executed; real-photo confusion matrix, skin inference truth, user-facing consequence rates, consistency under lighting/different phones; no provider calls.
- **External/HOLD:** sample collection and Human annotation; Android/browser real-camera sign-off; protected API/score/schema/storage changes; release/production; supply-chain #1208. **Style #1277 untouched.**
- **S0 status:** evidence mapping materially complete; exact-head diagnostics and CI pending. S0 is not described as product-ready or release-ready.

Watchtower-Track: face-lab-skin
