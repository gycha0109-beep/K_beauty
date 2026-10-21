# BEJEWELY Skin Precision / Localized Concern Analysis Roadmap v1

> Date: 2026-10-21
> Status: active **execution plan**, not an approved production architecture.
> Scope: acne lesion localization; redness, pore visibility, pigment/uneven-tone, shine, visible flaking/texture; mapping verified predictions onto a face photograph.
> Explicit non-target: reimplementing the style Face Lab track, rewriting the Skin Match decision engine, promising clinical diagnosis, changing production/API/DB/security behavior in this phase.

## 0. Goal and starting state

User target: **one face photo → real skin-related evidence localized on the same face → tap a location to understand a concern.** Decorative scan effects alone do not fulfill this requirement.

Current main (directly verified):
- \`lib/vision-observation-contract.js\` accepts 0–5 skin signals for \`barrier\`, \`dehydration\`, \`oiliness\`, \`redness\`, \`acne\`, \`pores\`, \`uneven_tone\`, \`uv\`, plus up to four qualitative observations at coarse \`area\` tokens.
- \`lib/skin-observation-projector.js\` renders those observations into explanatory evidence. This **does not** provide image coordinates, lesion counts, masks or clinically calibrated 0–5 scores.
- \`docs/domain/facelab/unified-vision-observation-contract-v1.md\` documents the canonical single-provider call, separate skin/Face Lab projections, failure and privacy boundaries.
- \`docs/architecture/shared-skin-decision-context-v4.md\` establishes null/unknown and persistence/reentry semantics. Proposed future localization is **not** authorized to silently affect recommendation scores.
- Draft PR #1384 is a **UI/heuristic feasibility experiment only**. It is not accurate skin-disease detection; do not merge into this program, reuse core primitives only after comparing with existing work and validating rights.
- Draft PR #1358 contains browser-only image labeler candidates, not a licensed real-image ground-truth registry; inspect and reconcile **before** creating yet another labeler.
- Prior Roboflow acneClassification2 review: 1,200 photographs checked, ~30 potential KEEP; many augmented relatives. KEEP is **photo suitability**, not a dermatologist-gold label. Fifth batch has no confirmed results. Do not call these ~30 independent positive cases.

### Source-of-truth boundaries

\`\`\`text
style Face Lab                 → styling/appearance assessment (leave alone)
Vision canonical observations → general photo cues / existing product decisions
Skin Precision (new, shadow)   → per-concern grounded spatial detections
Spatial presentation          → only show model-backed locations with provenance
\`\`\`

All integrations between existing services and a new spatial payload are future **design proposals**, not implemented or authorized by this roadmap.

## 1. Per-concern target and evidence semantics

| concern | image-observable target | correct result representation | false promise to avoid |
|---|---|---|---|
| acne | qualified acne-like lesions, with labeled subtype only if annotators can reliably distinguish it | instance bbox/point, optional validated instance mask | small dark pixel = acne; precise count from generic Vision |
| redness | visible diffuse redness/erythema appearance relative to surrounding skin and capture conditions | semantic region mask + area attribution | RGB red pixels = inflammatory disease |
| pores | **visible pore prominence** in sufficiently sharp/high-resolution eligible regions | ordinal region/patch grade; distribution overlay only if validated | every detected blob = true pore or measured pore size |
| uneven_tone | visible pigment-like spots / uneven tone appearance | region mask or separately annotated ordinal zone grade | shadow / makeup = melanin pathology |
| oiliness | surface specular appearance | shine region/ordinal photo cue, not physical sebum amount | direct sebum measurement |
| dehydration | visible flaking/tight-looking texture when actually observable | flaking mask or ordinal visible-cue label; otherwise abstain | actual hydration measurement |
| barrier | generally not observable as physical barrier integrity from a photo | survey/other measurement only | photo-derived barrier-function map |
| uv | UV exposure/damage not directly quantifiable from standard visible-light photo | no diagnostic image map | UV damage score from ordinary RGB |

No label is automatically inferred from an unrelated class. Multi-label observations with per-axis \`not_assessed\`, \`uncertain\`, \`absent\`, \`present\` are required; missing annotation != negative.

## 2. Dependency-ordered roadmap

| phase | status 2026-10-21 | exact deliverable | exit gate |
|---|---|---|---|
| P0 Baseline and rights | **In progress** | repository scope audit, source/license/consent register, exclusion list; previous acne images quarantined from training | license evidence and original-image rights documented for each candidate, or explicitly BLOCKED |
| P1 Gold protocol and data intake | **In progress: protocol** | multi-concern, per-location annotation contract, reviewer independence, split & duplicate check tool | at least one **consented and cleared** real candidate sample + independent human label + successful leakage check; none currently claimed |
| P2 Acne detector | Not started | compare existing zero-shot vision baseline against properly fine-tuned **Apache-designated RF-DETR** detection (or equivalent) | locked independent subject-level holdout, per-lesion precision/recall/F1 and localization mAP plus uncertainty/error review |
| P3 Redness/pigment segmentation | Not started | camera/white-balance control; qualified expert region masks; segmentation baseline and ablation | Dice/IoU and sensitivity to skin tone, camera, makeup, exposure and lighting, with uncertainty/abstain criteria |
| P4 Pores/shine/flaking | Not started | assess high-resolution eligible patches; visible grading and reviewer agreement; explicit unassessable handling | expert/consensus correlation or ordinal agreement, robustness and abstention; do not claim physical measurement |
| P5 Spatial projection | Not started | normalized orientation/crop/flip/scale coordinate transform; face/skin eligibility and overlay; reuse existing style-track primitives if actually compatible | pixel-level location correctness on original and mobile layouts, zero fabricated locations, overlays hide on unsupported modes |
| P6 Shadow integration | Not started | separately reviewed read-only spatial evidence sidecar that cannot modify canonical product decisions | API/persistence/privacy authority review, existing contract/verifiers invariant, feature off by default, independent negative-path tests |
| P7 Controlled activation | Not started | consent/retention/withdrawal policy, production gates, reviewer-approved claims, observability & rollback | benchmark thresholds set **before holdout reveal**, legal/security review, production explicit approval |

Parallel work allowed: rights verification, reviewer guide preparation, exploratory model comparison with **approved-use** assets. Not allowed: training on unclear data or inserting unvalidated colored marks into actual user reports.

### P0–P1 next execution steps (not vague backlog)

1. Fill asset candidate register with URL, upstream image creator/source, repository artifact type, exact license & version, allowed commercial activities, citation or authorization, and reviewer.
2. Inspect existing labeler Draft PR #1358 against this taxonomy; adapt instead of building another from scratch.
3. Receive or legally acquire **independent**, consented real images: positive, negative, ambiguity and confounder scenes per concern; count original groups and subjects, not augmented copies.
4. Blind independent annotators label per task (acne instance points/boxes; red/pigment regions; pore ordinal zones; non-assessable conditions). Record disagreement; do not accept AI-predicted masks as human gold.
5. Run the manifest verifier against candidate metadata before evaluation; reject disallowed-rights or cross-split related samples. Work with only pseudonymous IDs in repository; raw faces remain out of Git.
6. Create per-task untouched holdout; measure model baseline only after the dataset and denominator freeze.

## 3. Training/data rights decision gate

Rights are assessed separately for **code**, **weights**, **image data**, **labels**, **personality/privacy/image likeness and consent**. MIT/Apache code license does not automatically license a face dataset or a third-party trained checkpoint.

- Candidate **RF-DETR code and Apache-designated detection/segmentation weights**: research/implementation evaluation eligible; inspect exact model family and artifact version; RF-DETR-XL/2XL detection or Plus/PML assets must not be silently substituted. Segmentation variant claims conflict among product pages, so confirm chosen checkpoint's repository card/license before use.
- **ACNE04**: research/academic-only original rights per official redistribution terms → **BLOCK commercial model training / commercial evaluation** without written additional authorization.
- **Fitzpatrick17k**: original repo declares CC BY-NC-SA 3.0 and upstream atlas photo provenance → **BLOCK commercial incorporation** without written rights; also mostly clinical disease taxonomy, not cosmetic pore/erythema maps.
- **Roboflow acneClassification2 / 1,500-image pool**: provenance, unique subject count, original creator rights and purpose scope not established → **HOLD**, including prior KEEP 30; no direct training.
- **SCIN**: special SCIN data-use license, non-identification and privacy restrictions; purpose/label suitability require separate review → **REVIEW**, not implicitly commercial-cleared or a facial localization gold set.
- **First-party collected images**: an upload/analysis consent is not training/evaluation consent; require explicit purpose, authorized rights, withdrawal/deletion, secure storage and reviewer governance before use.

Do not use an unrestricted public URL, model-card license badge or dataset host's general Terms alone as a proof of original image rights.

Primary references (reviewed 2026-10-21):
- https://github.com/roboflow/rf-detr
- https://roboflow.com/licensing
- https://huggingface.co/datasets/Layered-Labs/ACNE04
- https://github.com/mattgroh/fitzpatrick17k
- https://github.com/google-research-datasets/scin/blob/main/LICENSE
- https://developers.google.com/edge/mediapipe/solutions/vision/image_segmenter

## 4. Human gold, split and metrics

Minimum evaluation record (future intake; no face images in Git):
- opaque \`sampleId\`, opaque \`subjectGroupId\`, \`originalGroupId\`, file SHA-256 and acquisition rights record ID;
- capture conditions, image size, face visibility/occlusion/quality, consent purpose and rights status;
- \`annotationTask\`, \`labelStatus\`, annotation geometry or ordinal zone grade where applicable, independent reviewer IDs, adjudication status, taxonomy version;
- \`train\` / \`validation\` / **sealed \`holdout\`** split with same subject/source original/augmentation family kept together.

Before evaluation: fix positive/negative/ambiguous denominator, quality eligibility rules and intended claim. Use bootstrapped confidence intervals, class and subgroup breakdown and miss-vs-false-mark tradeoff. Holdout is not a hyperparameter tuning set.

Per-task metrics:
- acne: per-lesion precision/recall/F1, detection mAP at appropriate scales, false markers per face, missed lesions per face, localization error, abstention, dermatologist disagreement.
- redness and pigment: Dice/IoU against region masks; false overlay area; skin-tone/camera/lighting subgroup distribution.
- pore visibility and flaking: ordinal weighted-kappa/MAE with expert consensus, not fake physical measurement accuracy.
- overlay: geometry IoU or pixel error after rotation, cropping, mirroring, resize and device-scale transforms.
- all: subject-level duplicate rate, number of eligible originals, reviewer agreement, per-slice failures, latency, and unsupported-case abstention.

Exact deployment thresholds must be set against a representative pilot **before** the locked holdout, then approved. Do not fabricate 95% accuracy or use COCO benchmark as acne accuracy.

## 5. Output contract sketch — design only

\`\`\`json
{
  "schemaVersion": "skin-spatial-evidence-proposal-v1",
  "status": "available | insufficient_evidence | not_assessed",
  "imageCoordinateSpace": { "orientationNormalized": true, "width": 0, "height": 0 },
  "items": [
    {
      "concern": "acne | redness | pores | uneven_tone | oiliness | dehydration",
      "status": "present | absent | uncertain | not_assessed",
      "geometry": "bbox | point | mask | zone_grade | none",
      "source": "exact model/checkpoint + preprocessing version",
      "confidenceCalibration": "version or null",
      "humanGold": false
    }
  ]
}
\`\`\`

This is a vocabulary and separation sketch, NOT a drop-in modification to the existing API response or storage shape. Exact schema requires separate product/security review. Never include raw face images, user IDs or identities in telemetry.

## 6. Integration stop conditions

- No legal source grant or uncertain consent → **do not ingest**.
- Unreviewed AI labels / augmented clones as gold → **do not promote**.
- No independent data and no validated localization → **do not render a precise lesion dot or diagnostic mask**.
- Face count/quality/skin visibility insufficient → **abstain** rather than invent.
- Existing Face Lab already supplies equivalent geometry → reuse; do not duplicate processing.
- Requires existing provider call, auth, DB, persisted payload, privacy or production changes → stop and request bounded approval.

## 7. Audit and change log

- 2026-10-21: v1 scoped to genuine skin detection; rights and gold-data first, overlay later; old scan-only prototype not accepted as delivery.
- P0 rights inventory + P1 preflight checks tracked separately; no production feature activated in this commit.
