# Face Lab real head-roll source decision v0

## Decision

The remaining real-photo `head_roll` gap will be closed with direct,
same-session, explicitly consented capture under the existing manual-roll
protocol.

No public candidate reviewed in this pass satisfies all of the current
requirements at once:

1. real photographs rather than rendered or synthetically rotated faces;
2. same-subject provenance that does not require biometric identity matching;
3. natural head-roll variation;
4. terms compatible with BEJEWELY commercial research use;
5. no raw-image persistence in the repository.

This decision is an acquisition decision only. It does not grant adequacy,
normalization, threshold, population, or production authority.

## Candidate review

### BIWI Kinect Head Pose Database

- Source: https://vision.ee.ethz.ch/datsets.html
- Dataset card: https://huggingface.co/datasets/ETHZurich/biwi_kinect_head_pose
- Strength: real RGB/depth sequences with same-subject temporal provenance and
  3D head rotation.
- Blocking term: the dataset card states that the database is made available
  for non-commercial use such as university research and education.
- Decision: not adopted into BEJEWELY commercial research evidence.

### FRHT / Full Rotation Head Tracking

- Source: https://vipl.ict.ac.cn/en/resources/databases/201901/t20190104_34799.html
- Strength: explicitly targets full head rotation.
- Blocking term: the source page states research-only/non-commercial use and
  directs commercial users to contact the authors.
- Decision: not adopted without a separate commercial permission grant.

### Bengal-HP_RU

- Source: https://data.mendeley.com/datasets/xbw9kr37jb/2
- Strength: CC BY 4.0 and continuous yaw/pitch/roll labels on real images.
- Blocking evidence issue: images originate from Wikimedia Commons and the
  published split is organized around uploaders, not a controlled
  same-subject capture protocol. Establishing identity linkage from the images
  would violate the current no-biometric-matching boundary.
- Decision: useful as external head-pose context, not accepted as the
  same-subject roll-stability source.

### Synthetic head-pose datasets

- Example: https://data.mendeley.com/datasets/jd4jm3jpp2/2
- Strength: permissive CC BY 4.0 and explicit pose labels.
- Blocking evidence issue: rendered synthetic identities/poses do not satisfy
  the current real-photo stability requirement.
- Decision: not substituted for real roll evidence.

### Pointing'04

- Already adopted for real `head_pitch` evidence under its pinned Figshare
  source contract.
- Its discrete pose design covers yaw/pitch markers, not the missing natural
  roll axis.
- Decision: retain for pitch only.

## Selected acquisition path

Use `docs/domain/facelab/face-lab-manual-roll-capture-protocol-v0.md` and
`docs/domain/facelab/face-lab-manual-roll-capture-spec.example.json`.

Each subject supplies, in one session:

1. neutral frontal reference;
2. natural roll-left view;
3. natural roll-right view.

The capture spec must record explicit consent and explicit authorization for
the BEJEWELY commercial research validation scope. The measurement bridge
creates structural evidence and a descriptive review packet only; raw images,
raw landmarks, identity embeddings, biometric matching, and local image paths
remain outside frozen evidence.
