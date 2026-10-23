# MEMI-DS partial dataset — human mask review assessment (2026-10-23)

## Evidence
Source: user-provided `MEMI-DS_review_2026-10-23.json` (131 assessments), original source images/masks retained on authorized local Windows machine. This research-note contains **only aggregate counts and selected existing mask IDs**, no face pixels, no source image copies, and no assertion of commercially cleared training rights. User confirmed this round as generally usable but reviewer criteria evolved during session; omissions are considered relatively dependable qualitative flags, while perfect human accuracy is NOT assumed.

## Group-level assessment

| Group | reviewed | pass | fail | unsure |
| -- | --: | --: | --: | --: |
| Flaky | 65 | 38 | 26 | 1 |
| Punctate | 66 | 41 | 25 | 0 |
| **Total** | **131** | **79** | **51** | **1** |

Pass is 79/131 (60.3%), fail 51/131 (38.9%) and unsure 1/131 (0.8%). **Do NOT report as pixel IoU, model accuracy, formal sensitivity or specificity.** It is a coarse visual reviewer judgment of annotation quality, not a benchmark over predictions or verified lesion ground truth.

- Flaky: 26 reviewer items contain note text, 26 note texts mention omission (two pass with omission notes, two fail with no note). Within 26 failed: **24** note omissions; 2 with blank notes.
- Punctate: 25 failed, **17** notes mention false positives (`오탐` or typo `모탐`), **8** notes mention omission (`누락`).
- Known inconsistent records: `Flaky/10_L` passed but note says `좌측 볼, 이마 누락`; `Flaky/28_L` passed but note says `이마 누락`. Preserve both original fields, classify `pass_with_negative_note` for data selection, do not silently flip verdicts.
- Unsure: `Flaky/13_R`; 2 failed Flaky masks lack explanatory notes: `Flaky/27_R`, `Flaky/31_L`.
- User interpretation: broad forehead highlight with bilateral falloff across uneven forehead leads to false pigment positives, especially Punctate; contralateral face shading causes lesion omissions. These are **observations/hypotheses, not measured causal attributions**; source notes specifically identify forehead `오탐(윤기 차이)` in seven Punctate records.
- Source annotation PNGs are per-pixel palette index masks with indices `0…5`. Official index semantics have not yet been confirmed; hand-written reviewer pass does not resolve that mapping.
- There are **131 image/mask pairs** in user-local Figshare partial release; the 716 images reported by the associated paper refer to the full research dataset, not proof of missing local downloads.

## Actionable dataset triage (never overwrite raw masks)

1. **Preserve all 131 raw pairs unchanged**. Maintain separate reviewer overlay / error labels. Don't silently convert a coarse pass into pixel-perfect golden segmentation.
2. Define **high-priority label repair** list from `Flaky` notes containing omission, and Punctate notes identifying forehead shine false positives; prioritize side face and illumination mismatch cases.
3. Use pass group for **manual visual reference only**, not trusted segmentation training by default: pass-with-omission notes are exceptions and other pass labels may still contain omissions given reviewer threshold drift.
4. Experimental train set should be explicitly noisy-label aware: do not label missing pigment as background-negative. Small-pilot pseudo-label model is possible only after checking palette semantics, rights and held-out splits; if unreliable areas are known, mask loss should exclude uncertain zones or be manually corrected.
5. **Error-slice evaluation** (after repaired true masks): front vs left vs right, forehead vs cheek, bright highlight vs shading, Flaky vs Punctate, subject ID holdout; report pixel IoU/Dice, lesion recall and false-positive region area by slice. No numerical model performance until actual inference.
6. **Capture-quality features** (BEJEWELY): local illumination compensation, highlight clipping/reflection detection, left-right asymmetry and face-region confidence; color normalization alone should not erase pigment signal. Emit concern-level reliability and don't force retakes for single uncertain concerns.
7. Preserve ambiguity and note fields in any reviewer feedback ingestion; revision date/status distinct from original published annotations. Do not import raw face data to public repo/ChatGPT or process commercially until rights cleared.

## Status

- Reviewer JSON: **analyzed** from user-provided source; 131/131 entries.
- Source mask structure: **checked separately**, image+mask matching/exif/empty.
- Individual human pass/fail pixel correctness: **not independently audited**.
- Dataset commercial source-face rights: **not verified**.
- Model trained/evaluated on these labels: **not done**.
- Proposed resolution: develop **corrected high-quality subset** with clear palette interpretation and split discipline before building pigment segmentation baseline.
