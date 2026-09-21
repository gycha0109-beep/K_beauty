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
