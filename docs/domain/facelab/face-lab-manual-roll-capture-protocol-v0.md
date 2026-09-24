# Face Lab manual head-roll capture protocol v0

## Purpose

This protocol exists only to close the remaining real-photo `head_roll`
evidence gap after expression, head-yaw, and head-pitch evidence have been
collected. It does not activate Production Face Space, normalization,
thresholds, or adequacy.

## Capture unit

Each consented subject contributes one same-session unit:

1. neutral frontal reference;
2. natural roll-left view;
3. natural roll-right view.

The subject tilts the head toward the shoulder for roll views. The protocol
does not ask the subject to turn left/right (yaw) or look up/down (pitch).

No numeric roll target or pass threshold is defined in v0. The capture is
structural evidence collection, not a calibration authority.

## Required provenance

The external capture spec records:

- opaque subject ID;
- session reference;
- explicit consent flag;
- consent evidence reference;
- usage scope;
- explicit authorization for commercial research use;
- paths to the three transient local images.

The local paths are execution inputs only. They must not be frozen into
evidence packets.

## Prohibited substitutions

- synthetic 2D rotation;
- warp augmentation;
- mirrored-image substitution;
- identity embeddings;
- biometric identity matching;
- raw image or raw landmark persistence in the repository.

## Runtime bridge

`scripts/build-face-lab-manual-roll-measurement-manifest.mjs` converts a
local consented capture spec into the existing governed real-photo stability
manifest. The resulting pairs use `manual_same_subject_pair` linkage and
`head_roll` as the nuisance class.

Actual roll evidence remains absent until consented real photos are supplied
and the existing actual-image Face Landmarker runner is executed.


## Local execution bridge

The repository includes a local-only orchestration command for the point at
which consented photos are available:

```bash
node scripts/run-face-lab-manual-roll-local.mjs \
  <capture-spec.json> \
  <output-dir>
```

Start from
`docs/domain/facelab/face-lab-manual-roll-capture-spec.example.json`.
The capture spec must explicitly authorize commercial research use for the
BEJEWELY Face Lab validation scope.

The command creates a governed manifest, runs the existing actual-image Face
Landmarker stability runner, builds a descriptive review packet, and verifies
that raw images, raw landmarks, identity embeddings, biometric identity
matching, and local image paths are absent from the evidence outputs.

The command also composes the new roll evidence with the frozen expression,
yaw, and pitch run outputs and emits a local four-axis review packet plus a
local updated adequacy contract. Those two files are review candidates only;
the command never writes them into the repository evidence directory.

The output remains descriptive evidence only. Completing the roll capture
closes structural nuisance coverage; it does not itself grant adequacy,
normalization, threshold, or production authority.

## Post-review expansion status

The first governed roll capture produced two observations from one consented
subject. The frozen adequacy decision is
`ADDITIONAL_EVIDENCE_REQUIRED`: this evidence demonstrates technical
measurability, but it does not grant the provisional normalization-research
gate.

The existing capture-spec format already accepts multiple entries in
`subjects`. Additional evidence therefore reuses the same capture unit for
additional consented subjects:

1. neutral frontal reference;
2. natural roll-left view;
3. natural roll-right view.

No exact minimum subject count is defined here, and no count automatically
grants adequacy. Added subject diversity must be reviewed again against the
same descriptive drift, provenance, privacy, and no-threshold rules.

Synthetic rotation, warping, mirroring, identity matching, and repository
persistence of raw photos or landmarks remain prohibited.
