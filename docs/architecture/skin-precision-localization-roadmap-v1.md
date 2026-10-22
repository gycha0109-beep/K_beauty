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


## 8. P0 concrete acquisition plan — verified public leads (2026-10-21)

### Source A — priority: AI-Hub Korean Skin Status Measurement Data (dataSetSn=71645)

- Official page: https://aihub.or.kr/aihubdata/data/view.do?aihubDataSe=data&currMenu=120&dataSetSn=71645&topMenu=
- Official counts: **13,936 original face photos, 84,688 skin measurement observations, 125,424 annotation entries** (the last count is **not** an independent image count).
- Published columns: image filename, subject/record ID, dimensions, camera/device, angle, face region & \`face_box\`, measured moisture/pore/pigmentation/elasticity and optional expert score. Verify exact join coverage and original-subject grouping in acquired CSV/JSON before assuming uniqueness.
- **Acquire**: applicant completes AI-Hub login and dataset access request; access may be reviewed/approved or restricted to safe-zone for sensitive content. The public web page cannot be treated as already-downloaded or pre-authorized. Confirm the exact access arrangement, required consents and use terms in the approval.
- General AI-Hub FAQ explicitly permits commercial uses of derived AI models/services with source attribution, while prohibiting raw source re-sharing; dataset-specific terms, privacy and safe-zone restrictions prevail.
- **Fit**: first priority for calibrated skin-state baseline (pore prominence, pigmentation and moisture measured with instruments) and spatial face/region supervision.
- **Gap**: \`face_box\` is a face bounding box, not acne lesion bbox. No acne-by-acne boxes or pixel-level redness masks are advertised. No universal gold for the three requested spatial outputs.
- **Immediate bounded audit after authorized access**: inspect 20 metadata/image pairs (no photos in Git), validate image↔measure IDs, units, missingness, device/angle distribution, eligibility, original-group count and per-concern available label types; report any unfilled gaps explicitly.

### Source B — secondary: AI-Hub Skincare Ingredient–Effect Recommendation (dataSetSn=71886)

- Official page: https://aihub.or.kr/aihubdata/data/view.do?aihubDataSe=data&currMenu=115&dataSetSn=71886&topMenu=
- Official: 10,000 face images + 10,000 surveys + 10,000 CoT entries. Consent-based de-identified facial sources are stated, but annotations are **survey/recommendation**, not dermatology-verified lesion positions or region-mask ground truth.
- **Use only as supplementary domain/context/capture distribution study after rights approval**, not substitute for expert per-pixel labels.

### Source C — study methods, not raw face acquisition

- 2026 Scientific Reports 3,203 selfie study: https://www.nature.com/articles/s41598-026-65514-4
- GitHub Apache code: https://github.com/frankkramer-lab/GRANDAID
- The paper explicitly states public/raw face distribution is prohibited due to GDPR. **Do not download/redistribute training images from this study.** Methodology may inform a multi-label rubric, but independent expert correctness must be assessed.

### P1 targeted independent annotation: how to create real localization gold

1. From Source A (only if permitted to create further annotations), select an initial independent-face pilot of **roughly 100–200 distinct subjects** balanced across visible concerns, negatives, ambiguous lookalikes, lighting and camera. This is a **workflow pilot target, not an asserted sufficient training or accuracy sample size**. Include eligible users recruited separately under explicit training/evaluation permission if Source A lacks relevant positives.
2. Write a short visual rubric for dermatologists: acne lesions require a point/bbox per actual distinguishable lesion, uncertain comedones and lookalikes explicitly separated; redness/pigment require polygons or masks; pores require coarse *visibility grade per qualified cheek/nose patch*. Instrument measures/clinical assessment cannot be replaced by RGB pixel contrast. Dehydration/UV/barrier never become measured physical quantities from one RGB image.
3. Assign two independent human reviewers for **locked evaluation subjects** and a stratified proportion of pilot positives, negatives and borderline cases. Add a third adjudicator for disputes; record each independent label and consensus rather than modifying original labels in place.
4. Use the existing Draft PR #1358 labeler only if it supports the final multi-concern spatial schema and isolated storage; otherwise use a mature locally/self-hosted MIT/Apache annotation tool (CVAT or Label Studio) in a non-production secure environment. Do not send identifying face images to public workspace.
5. Enforce same-subject/near-duplicate/augmentation-family segregation **before** train/validation/holdout. Published counts of images, angles and per-region records must not be multiplied into independent person counts.
6. Gate: after first 100–200-subject annotation feasibility test, inspect inter-rater agreement and missed class coverage. Only then calculate acquisition/training sample requirements from pilot variance and target confidence intervals. If insufficient quality, revise photography protocol or annotation rubric rather than blindly collecting thousands of images.

### How to contact/acquire/verify without inventing cleared rights

- Applicant: open the source A page → login → dataset sample/guide → click download and complete data access request → retain approval/license record; use safe-zone only if the platform requires it. Raw data stay within approved environment.
- Source A publicly lists the construction consortium: KairosLab (data lead), IEC Korea (collection), Dankook University (expert assessment/model). Contact them through the official dataset page if specific annotation provenance and permitted derivative labeling are unclear; do not assume their implementation weights are ready for commercial production.
- This task has **not** logged in, accepted terms, retrieved restricted images, obtained personal consent, or contracted a physician. No dataset/model can be promoted to commercial approval by this document alone.


## 9. Acquisition work executed 2026-10-22

- Official AI-Hub data page (71645), download FAQ and published dataset usage policy verified. Consumer-facing commercial derivative model usage is not permission to share source photographs with an external annotator; domestic-only application and separate outbound transfer constraints recorded.
- Cross-tab camera angles/facepart publication totals appear mixed; no independent subject count established. Official face_box is a face rectangle, not a lesion box.
- Added approved-access workflow and source-rights inquiry template in `data/skin-precision/aihub-71645-acquisition-runbook-v1.md`.
- Added JSON-only, no-photo read metadata audit `scripts/audit-aihub-71645-metadata.mjs`. Its synthetic V8 self-test covers repeated image filenames, missing measures and invalid face bounds; Node repo runtime and real downloaded JSON are still untested.
- **Next human dependency:** AI-Hub login / phone verification / exact dataset approval; these have not occurred. No training, real skin annotations, or model evaluation should start before permission and actual schema audit.
