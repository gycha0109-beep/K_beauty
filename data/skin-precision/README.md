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
