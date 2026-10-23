# Skin Precision P0/P1 evidence intake

This folder has **no face photos, no model weights, and no legally approved commercial image datasets**.

- `asset-candidate-register-v1.json` is an **unapproved candidate inventory** only. An asset marked `candidate` is not commercially cleared. The presence of a public URL, CC badge, MIT/Apache code license or rightsEvidenceId **cannot independently establish underlying photograph or personality rights**.
- The implementation plan and concern-specific success criteria live in `docs/architecture/skin-precision-localization-roadmap-v1.md`.
- Before collecting real images, approve consent, access control, retention, withdrawal, original-image rights and the reviewer protocol. **Never commit face photos or personal identifying details to this directory.**

## Preflight (read-only)

```text
node scripts/verify-skin-precision-evidence-manifest.mjs --self-test
node scripts/verify-skin-precision-evidence-manifest.mjs /private/path/manifest.json
```

The second command defaults to the candidate rights register in this folder. Since there are currently **zero approved commercial datasets**, candidate real-image manifests should fail closed until a documented human rights review approves the exact source. A PASS only verifies manifest-internal conditions, **not legal validity or model accuracy**.

Manifest draft:
- `schemaVersion`: `skin-precision-evidence-v1`; `corpusId` opaque; `samples` array.
- Each sample: `sampleId`, `subjectGroupId`, `originalGroupId`, `sha256` (original image bytes), `split` (`train`/`validation`/`holdout`), `assetId`, `rightsScope=commercial_train_eval`, `rightsEvidenceId`, `consentBasis` (`explicit_opt_in`/`upstream_license_reviewed`), `consentEvidenceId`, `image: {width,height,orientationNormalized:true}`, and `annotations`.
- Annotation: `concern` (acne, redness, pores, uneven_tone, oiliness, dehydration), `status` (positive, negative, uncertain, not_assessed), `type` (point, bbox, polygon, mask, zone_grade or none), `taxonomyVersion`, `reviewerIds`, `adjudicated`.
- Positive must include actual normalized `geometry`: `{x,y}` point, `{x,y,w,h}` bbox, `{vertices:[{x,y},...]}` polygon, `{maskEvidenceId}` mask or `{zoneId,grade}` ordinal zone.
- Negative / uncertain / not_assessed **must not carry synthetic locations**. Their `type` is `none`. Holdout positive/negative needs >=2 distinct blinded human reviewer IDs and adjudicated=true.

The preflight rejects same subject/original family/image hash leaking across protected splits, unapproved commercial rights, missing consent-source evidence, incomplete/invalid geometry and unsupported classes. Reviewers' ID tokens are anonymous, not names or emails. The script never loads image bytes. Near-duplicate perceptual hashing, review independence and actual legal verification are **future checks**, not satisfied by this preflight.

No samples have been promoted. This is a blocking intake tool and documentation, not a completed data acquisition or medical accuracy evaluation.

## AI-Hub priority acquisition (2026-10-22)

- [AI-Hub 71645 access, official rights, inquiry and metadata audit runbook](aihub-71645-acquisition-runbook-v1.md)
- Read-only JSON metadata audit (no photo reads, no PII in output): `node scripts/audit-aihub-71645-metadata.mjs --self-test`.
- Public source advertises 13,936 images and 125,424 label rows, but cross-tabulated camera-angle counts appear inconsistent. Distinct photos and distinct people must be resolved from the **authorized source files** before evaluation or split.
- AI-Hub usage FAQ allows commercial derived models but raw source images may not be redistributed or provided to external reviewers without separate authorization. Never infer third-party labeling permission from commercial model permission.
- No account login, use approval, original JSON, independent model results or clinician gold were obtained by adding these tools.

## Validation raw-image inventory and offline visual QA (2026-10-22)

- [VS 1,391-JPEG raw inventory and local acne lesion review instructions](aihub-71645-visual-review-v1.md)
- `node scripts/review-aihub-71645-acne-local.mjs --self-test` tests parsing and image-coordinate matching with synthetic data. Local end-to-end Node and actual VS/VL images are **not** tested yet.
- Local-only usage: unzip **VS.zip/VL.zip on the authorized Windows PC**; run script with `--labels`, `--images`, and `--out` arguments to create an offline HTML page with photo-linked acne-point overlays. The HTML has local file URLs and **must not be shared**.
- Subject identifier equivalence (107 groups) is not proof of 107 medically independent human participants; confirm label/guide provenance before training/holdout claims.

## Additional dataset leads and reliability UX (2026-10-23)

- [Supplementary datasets for pores, pigmentation/freckles, shine/sebum, texture, flaking](supplementary-dataset-research-2026-10-23.md) — actual official sources, class/annotation granularity, sample-access paths, reported rights and gaps. All external acquisitions remain pending; no commercial-cleared asset in [candidate register](asset-candidate-register-v1.json).
- [Skin Precision roadmap](../../docs/architecture/skin-precision-localization-roadmap-v1.md#11-confidence-aware-nonblocking-scan-ux--product-decision-2026-10-23) now specifies **nonblocking best-effort scoring**, photo-level + concern-level qualitative reliability, explanations and optional recapture. Do not confuse confidence output with calibrated correctness and do not fabricate unsupported scores.

## Dataset acquisition tool (2026-10-23)

- `node scripts/acquire-skin-open-dataset.mjs --inspect`: publisher Figshare API **metadata only** (no face-image download). See `supplementary-dataset-research-2026-10-23.md` for current status and licensing gates.
- After examining source/face photo terms on a permitted local computer, `node scripts/acquire-skin-open-dataset.mjs --download --license-reviewed --out "D:\\private\\skin-datasets\\memi-ds"` stores raw bytes and checksum **locally**. GitHub and connected cloud tools must not be raw-image destinations without explicit rights.
- The script was added to the draft research PR and read back via repository API; **Node runtime / live Figshare API / downloaded file hashes have NOT been executed or verified here**.


## MEMI-DS reviewer QC and capture-condition prototype (2026-10-24)

- `node scripts/audit-memi-review-qc.mjs --self-test`: synthetic regression of reviewer status preservation, pose grouping, conflict handling, suspected omission/false-positive flags and fail-closed schema/count guards.
- `node scripts/audit-memi-review-qc.mjs --input "C:\\PRIVATE\\MEMI-DS_review_2026-10-23.json" --out "C:\\PRIVATE\\MEMI-QC-v1.json" --expect-131`: generates a **private** additive QC file, preserves all original verdicts/notes, and outputs only aggregate counts to the console. `--out` refuses existing paths. **Never direct `--out` to a GitHub working tree.**
- `python scripts/audit-memi-palette-and-lighting.py --self-test`: synthetic-only palette-index/lighting-proxy checks (Pillow + NumPy required).
- `python scripts/audit-memi-palette-and-lighting.py --mask PRIVATE_MASK.png --photo PRIVATE_PHOTO.jpg --roi-json PRIVATE_HUMAN_DEFINED_ROI.json --out PRIVATE_AUDIT.json`: opt-in local exploratory ROI luminance, specular/dark proxies and uninterpreted palette index counts. ROI geometry must be independently human-defined; **no forehead/cheek identity is inferred**. Raw assets remain private and untouched. Without ROI JSON, prints palette counts but no anatomical claims.
- **Hard gate:** publisher annotation class mapping 0–5 not authenticated, no binary pigment segmentation decoder or model training is enabled. Image-mask overlap is not labelled false positives or missed lesions until independent corrected gold and class meaning exist.
- Synthetic Node and Python self-tests both passed on a separate Windows machine on 2026-10-24. **The user's `C:\Users\M\Downloads\Figshare` 131 original image/mask pairs were NOT accessible from that online machine.** No real-image lighting estimates, mask decoded semantics, real model training or accuracy metrics have been measured.
- Source user review was read in a private Library view (131 rows, 79/51/1, directional counts consistent with prior report). Full JSON source was not copied into GitHub or public artifacts. New QC CLI has not been run against its source bytes on the data-holding computer.


## Academy-PC MEMI original-pair batch audit (2026-10-24)

New local-only script: `scripts/audit-memi-dataset-local.py` (requires Python 3.10+, Pillow, NumPy). On the computer that actually stores the 131 original image/mask pairs:

1. `node scripts/audit-memi-review-qc.mjs --input "C:\\Users\\M\\Downloads\\Figshare\\_bejeweIy_audit\\MEMI-DS_review_2026-10-23.json" --out "C:\\Users\\M\\Downloads\\MEMI-QC-v1.json" --expect-131` (correct the `--input` path to the already-saved original reviewer JSON if stored elsewhere).
2. `python scripts/audit-memi-dataset-local.py --root "C:\\Users\\M\\Downloads\\Figshare" --qc "C:\\Users\\M\\Downloads\\MEMI-QC-v1.json" --out "C:\\Users\\M\\Downloads\\MEMI-batch-audit-v1.json" --expect-131`.
3. No transfer to home PC/GitHub required. Output is private, generated with exclusive-create, and contains per-sample source hashes, palette index frequencies, review flags, sizes, and any independently provided human ROIs **but no face pixels**. Do not upload the private audit, file hashes, per-image reviewer records or raw photos to a public PR.
4. Before running against original data, confirm actual source filenames and directories. The script requires each sample to be named like `15_L` and distinguishes paletted PNG masks from photos. It **fails closed** on ambiguity, duplicates and unexpected extra/missing samples rather than guessing or silently mapping. If the original publication has different filenames the layout mapping needs a bounded adjustment verified against real directory metadata first.
5. `--roi-json` is optional and must use a separately human-defined `memi-roi-by-sample-v1` file; if omitted, no anatomical forehead/shadow region is inferred. Lighting numbers are only capture proxies, not clinical measures or segmentation correctness.
6. `python scripts/audit-memi-dataset-local.py --self-test` completed successfully on a different authorized Windows machine using **synthetic** 2-pair source images and masks (matching, duplicate detection, ROI gate). The actual academic-PC MEMI originals were not present and remain **UNTESTED**.

Do not infer a subject-level split from numeric filename tokens; they are tentative family references. The official palette index/class meanings, portrait rights, image use, corrected independent gold and any real-world Dice/IoU are still unknown; commercial training and production overlay are blocked.
