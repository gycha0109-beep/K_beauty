# Skin Precision P0/P1 evidence intake

This folder has **no face photos, no model weights, and no legally approved commercial image datasets**.

- \`asset-candidate-register-v1.json\` is an **unapproved candidate inventory** only. An asset marked \`candidate\` is not commercially cleared. The presence of a public URL, CC badge, MIT/Apache code license or rightsEvidenceId **cannot independently establish underlying photograph or personality rights**.
- The implementation plan and concern-specific success criteria live in \`docs/architecture/skin-precision-localization-roadmap-v1.md\`.
- Before collecting real images, approve consent, access control, retention, withdrawal, original-image rights and the reviewer protocol. **Never commit face photos or personal identifying details to this directory.**

## Preflight (read-only)

\`\`\`text
node scripts/verify-skin-precision-evidence-manifest.mjs --self-test
node scripts/verify-skin-precision-evidence-manifest.mjs /private/path/manifest.json
\`\`\`

The second command defaults to the candidate rights register in this folder. Since there are currently **zero approved commercial datasets**, candidate real-image manifests should fail closed until a documented human rights review approves the exact source. A PASS only verifies manifest-internal conditions, **not legal validity or model accuracy**.

Manifest draft:
- \`schemaVersion\`: \`skin-precision-evidence-v1\`; \`corpusId\` opaque; \`samples\` array.
- Each sample: \`sampleId\`, \`subjectGroupId\`, \`originalGroupId\`, \`sha256\` (original image bytes), \`split\` (\`train\`/\`validation\`/\`holdout\`), \`assetId\`, \`rightsScope=commercial_train_eval\`, \`rightsEvidenceId\`, \`consentBasis\` (\`explicit_opt_in\`/\`upstream_license_reviewed\`), \`consentEvidenceId\`, \`image: {width,height,orientationNormalized:true}\`, and \`annotations\`.
- Annotation: \`concern\` (acne, redness, pores, uneven_tone, oiliness, dehydration), \`status\` (positive, negative, uncertain, not_assessed), \`type\` (point, bbox, polygon, mask, zone_grade or none), \`taxonomyVersion\`, \`reviewerIds\`, \`adjudicated\`.
- Positive must include actual normalized \`geometry\`: \`{x,y}\` point, \`{x,y,w,h}\` bbox, \`{vertices:[{x,y},...]}\` polygon, \`{maskEvidenceId}\` mask or \`{zoneId,grade}\` ordinal zone.
- Negative / uncertain / not_assessed **must not carry synthetic locations**. Their \`type\` is \`none\`. Holdout positive/negative needs >=2 distinct blinded human reviewer IDs and adjudicated=true.

The preflight rejects same subject/original family/image hash leaking across protected splits, unapproved commercial rights, missing consent-source evidence, incomplete/invalid geometry and unsupported classes. Reviewers' ID tokens are anonymous, not names or emails. The script never loads image bytes. Near-duplicate perceptual hashing, review independence and actual legal verification are **future checks**, not satisfied by this preflight.

No samples have been promoted. This is a blocking intake tool and documentation, not a completed data acquisition or medical accuracy evaluation.
