# Face Lab Independent Blind Human Cue Audit Protocol v1

## Purpose

This protocol prepares an independent, target-withheld Human review of visible Face Lab target-axis cues on the existing controlled synthetic stress candidates. It freezes the review vocabulary, response contract, blinding rules, reviewer-panel shape, packet projection, and later descriptive aggregation boundary. It does not collect a Human judgment.

The audit preserves the following separations:

`generation intent != generated visual fact != Vision observation != Human cue judgment != Archetype score != Human consensus != calibration truth != production activation`

## Authority

- Source main: `5fa0c661672502b9e49f2222e4eeb19bdc82ce15`
- Definition contract: `face-lab-target-axis-operational-definitions-20260814-v1`
- Definition contract digest: `8e630605ece0629da6a51e30829297688c27f10a3a92be6a3c8e3413f546bb46`
- Definition freeze digest: `cb7d3a0d60ce398dc9c76ee1aa4ff88ee94b0e001fa378f173367712ea279029`
- Protocol: `face-lab-independent-human-cue-audit-20260814-v1`
- Protocol digest: `a32dd94dfbd8e090363ae0d662d51174eeab05796ccad5a8b2ad4c303d886b77`

The protocol is evaluation-only. Production observation, generation, scoring, thresholds, weights, taxonomy, recommendations, and UI do not consume it.

## Canonical Image Input

The packet builder reads exactly fourteen existing canonical candidate assets: seven from the original stress cohort and seven from the moderate-strength diagnostic cohort. Candidate manifests, finalized specifications, compiled prompts, observation-run manifests, and observation objects must all pass their existing integrity and binding rules before an asset enters the review projection.

Reviewers inspect the same decoded pixel matrix bound to the authoritative Vision observation. Original downloads, screenshots, uploads to this conversation, and regenerated images are not valid sources.

Canonical source files remain immutable. If a canonical PNG has no semantic text or EXIF chunk, its reviewer asset may be a byte-identical copy. If semantic metadata exists, the builder removes only semantic metadata chunks and requires identical width, height, channel layout, and decoded pixel digest.

## Reviewer Panel

The planned diagnostic panel has three reviewer slots: `R01`, `R02`, and `R03`. These are slots, not identities. Actual pseudonymous identity binding and independence attestation occur only during D2D-X.

The current operator and this ChatGPT conversation are not eligible independent reviewers. A later valid reviewer must attest that generation target, prompt, strength condition, Archetype target, Vision output, shadow score, peer judgments, and consensus were not seen.

Three reviewers form a small diagnostic panel. This count does not establish population calibration, production validation, fairness coverage, or statistical power.

## Blinding

Reviewer-visible materials contain only an opaque review item, a packet-local image, cue definitions, allowed enum options, `uncertain`, `not_assessable`, confidence choices, evidence tags, and not-assessable reason codes.

Reviewer-visible materials exclude:

- candidate and observation identities;
- source cohort and ordinal;
- generation condition, prompt, specification, and intended cue;
- target Archetype;
- Vision observations and provider/model metadata;
- scorer output, rank, and score;
- peer responses, consensus, and historical diagnostic results;
- canonical hashes and the private review map.

Each reviewer receives all fourteen images in a deterministic opaque permutation. Reviewer permutations differ, while the image set remains identical. Matched source ordinals are not adjacent. Every image receives the same axis set within a part.

## Session Parts

Reviewer-facing labels are neutral:

- **Part A:** fourteen images and the eight axes currently marked `READY_FOR_BLIND_HUMAN_CUE_AUDIT`.
- **Part B:** fourteen images and the two axes marked `NOT_READY_REQUIRES_VALIDATION`.

Part B remains a separate validation denominator and does not become primary cue evidence without a later promotion decision. The direct-use-excluded `featureContrast` axis is not shown; its Human comparison state remains `NOT_COMPARABLE_CONTRACT_DECOMPOSITION`.

Part A axes:

1. `observations.outline.faceShape`
2. `observations.outline.jawlineAngularity`
3. `observations.vertical.faceLengthBalance`
4. `observations.eyes.eyeDirection`
5. `observations.eyes.eyeOpenness`
6. `observations.featureLayout.featureScale`
7. `observations.featureLayout.featureConcentration`
8. `observations.visualLanguage.straightCurveBalance`

Part B axes:

1. `observations.eyes.eyeLength`
2. `observations.visualLanguage.contourDefinition`

## Cue Response Contract

Each future submitted judgment binds one opaque review item and one axis. Its response is exactly one axis enum value, `uncertain`, or `not_assessable`.

- Concrete enum: confidence is `low`, `medium`, or `high`.
- `uncertain`: confidence is `low` or `medium`.
- `not_assessable`: confidence is `not_applicable` and at least one not-assessable reason is required.

Evidence tags are limited to the selected axis's operational-definition registry. They describe visible evidence, not a target, success, or failure. Concrete responses should normally include defensible evidence, but blank packet templates contain no selections.

The general not-assessable reason registry is:

- `pose`
- `occlusion`
- `crop`
- `image_quality`
- `expression`
- `lighting`
- `makeup`
- `perspective`
- `editing_or_filter`
- `axis_specific_limitation`
- `insufficient_visible_evidence`

No free-text essay is required. A blank D2D-P template contains null attestation fields and null response/confidence fields, empty evidence and reason arrays, and no `submittedAt` or response digest.

## Local Packet Boundary

The generated review package is local-only under `.synthetic-local/face-eval-c-w1m/cx1g-d2d-p`. It includes:

- a private review-item map and packet authority;
- opaque review assets;
- reviewer packet roots for R01, R02, and R03;
- Part A and Part B definition projections, manifests, and blank templates;
- deterministic file and asset inventories;
- a local packet-freeze report.

Images, private candidate mapping, packet contents, local response templates, and absolute paths are not tracked by Git. The tracked freeze records only the opaque local packet authority digest.

## Reviewer Workload

Per reviewer:

- Part A: `14 x 8 = 112` judgments
- Part B: `14 x 2 = 28` judgments
- Total if both parts later execute: `140`

Full three-reviewer plan: `420` judgments. This is workload accounting only.

## Aggregation and Reveal

D2D-P computes no consensus. The frozen future descriptive aggregate preserves every individual response, response frequencies, assessable count, uncertain count, not-assessable count, a concrete modal value only when unique, and one of:

- `unanimous_concrete`
- `majority_concrete`
- `all_uncertain_or_not_assessable`
- `no_unique_mode`
- `insufficient_completed_reviewers`

A modal value is not ground truth, gold evidence, or correctness. Part A and Part B denominators remain separate.

Generation intent stays hidden until every required Part A response is sealed and the Human aggregation artifact is sealed. Vision output also remains hidden from reviewers. A later D2D-R gate may then join Human evidence, Vision observation, and generation intent without rewriting any sealed Human response.

## Distribution Boundary

This gate prepares local packets only. It does not distribute them or bind reviewer identities. Before D2D-X, the operator must separately confirm that internal evaluation sharing of these synthetic images with selected independent reviewers is permitted.

## Integrity

The builder and verifier enforce:

- 7/7 plus 7/7 candidate, canonical asset, and observation bindings;
- fourteen unique candidate identities and canonical hashes;
- decoded pixel equality for every reviewer asset;
- deterministic opaque IDs and reviewer-specific order;
- exactly fourteen images and eight/two axes per packet part;
- blank response templates and zero Human judgments;
- recursive reviewer-visible leakage checks;
- separation of the private map from reviewer packet roots;
- deterministic semantic packet, inventory, private-map, authority, protocol, and freeze digests.

Filesystem timestamps and ZIP bytes are not semantic authority.

## Production Isolation

This protocol does not modify or activate:

- the canonical Vision prompt or observation schema;
- the generation compiler or provider profile;
- Archetype scorer behavior, registry weights, or thresholds;
- taxonomy, production decisions, recommendation behavior, or UI;
- W1/W1M, D1, D2C, or D2C-F historical artifacts.

## Non-Goals

This gate does not perform image generation, Vision calls, Human judgment, consensus, target reveal, comparison, calibration, production validation, dataset promotion, or hosted writes. It does not diagnose generator failure or observer failure.

## W2 Status

`W2_REMAINS_LOCKED`

## Next Gate

The next gate is `FACE-EVAL-CX1G-D2D-PM`, protocol and packet final review/merge. Only after merged authority and separate sharing approval may `FACE-EVAL-CX1G-D2D-X` bind independent reviewers, distribute packets, and collect sealed responses.
