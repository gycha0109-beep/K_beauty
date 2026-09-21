# Face Lab External Research Dependency Register v1

> Track: FACE LAB / Research Dependencies
> Reviewed: 2026-09-22
> Status: research inventory / not a legal approval / not Production activation

## 1. Purpose

GitHub / Hugging Face 조사에서 발견한 외부 모델·도구를 Face Lab architecture role에 따라 고정한다.

분류:

- PRIMARY_POC
- SECONDARY_POC
- RESEARCH_ONLY
- REFERENCE_ONLY
- DEFER

외부 프로젝트의 README/license 표기는 research triage 근거다. 실제 Production 도입 전에는 exact artifact digest, transitive dependency, model/data license와 redistribution boundary를 다시 검증한다.

## 2. 3D face / geometry

### Google GNM v3 — PRIMARY_POC

Role:

- primary face-specific parametric backend candidate
- Face Space target → latent fitting → mesh → round-trip measurement
- independent controlled head generation

Observed upstream characteristics:

- Google official GNM ecosystem
- reviewed code revision: `a424b5153eec9154f3dfa5ee7f214e5817918d54` (2026-09-18)
- exact official model artifact at reviewed GitHub revision: `gnm/shape/data/versions/v3_0/gnm_head.npz`
- Git blob SHA: `b49ac631e4d3388e42640555c0b25c4fd134b1b8`
- size: `53,305,389` bytes
- package: `gnm-shape` 3.0.0; official core dependency set currently includes TensorFlow, so runtime remains isolated from the web application
- GNM Head v3
- 170 head identity components inside 253 identity components
- 383 expression components
- head / eyeballs / teeth / tongue
- NumPy / JAX / PyTorch / TensorFlow implementations
- fitting utilities and landmark support
- upstream code/model card state Apache-2.0

Boundary:

- identity coefficients are not Face Space axes
- semantic demographic identity sampling is disabled for Face Lab
- no sensitive-attribute inference from appearance
- exact model artifact must be pinned before executable adoption
- GNM ships a native barycentric sparse-68 landmark set
- no official MediaPipe 468 ↔ GNM correspondence is currently frozen; community mappings remain reference-only until independently validated

Upstream:

- GitHub: https://github.com/google/GNM
- Hugging Face: https://huggingface.co/google/gnm-v3

### MPFB2 / MakeHuman — PRIMARY_POC

Role:

- Blender controlled experiment workbench
- interpretable modeling target families
- custom target support
- hair/material/asset experimentation
- batch generation/export support

Boundary:

- MPFB target / Blender Shape Key is not Face Space authority
- GPL code is isolated to offline research tooling
- generated artifacts/data require their own provenance
- exact asset/license boundary must be pinned before adoption

Upstream:

- https://github.com/makehumancommunity/mpfb2

### FLAME 2023 Open — SECONDARY_POC

Role:

- independent parametric face comparison/fallback backend
- latent fitting benchmark against GNM/MPFB adapters

Boundary:

- only the exact FLAME 2023 Open artifact under the reviewed open license is in scope
- other FLAME releases must not inherit that license assumption
- beta coefficients are not interpretable Face Space axes

Upstream:

- https://flame.is.tue.mpg.de/

### MediaPipe Face Geometry / Face Landmarker — PRIMARY_POC

Role:

- photo-side landmark / pose / geometry evidence
- canonical-face transform
- eyewear attachment geometry
- future measurement-source candidate

Observed upstream characteristics:

- reviewed repository revision: `20e8f2ae3365d46fa02037b54911b72e13494809`
- canonical 468-landmark topology
- Face Geometry metric 3D space
- default canonical face unit = centimeter
- canonical model blob: `0e666d1c4e75949d1639c2bcf347a38da4834164`
- upstream geometry pipeline converts screen landmarks to metric 3D and inverse-pose-aligns runtime geometry to canonical metric space
- Face Landmarker web result can expose facial transformation matrices
- repository dependency already includes `@mediapipe/tasks-vision`
- Face Lab v0 photo geometry bridge and canonical metric fixture are implemented on research branch

Boundary:

- normalized image landmarks are not automatically metric facial dimensions
- raw screen-normalized XYZ is rejected by the v0 measurement bridge
- camera/pose/perspective must be handled explicitly
- MediaPipe topology IDs are not treated as an official GNM correspondence
- MediaPipe observation does not become identity recognition

Upstream:

- https://github.com/google-ai-edge/mediapipe

## 3. Real-photo / reference-corpus source candidates

### Face Research Lab London Set v5 — PRIMARY_RESEARCH_DATA_CANDIDATE

Role:

- same-subject real-photo yaw stability candidate
- same-subject real-photo expression stability candidate
- general-face same-provider reference-corpus candidate
- subject-level reference/holdout split source candidate

Verified source facts:

- official Figshare dataset: `10.6084/m9.figshare.5047666.v5`
- 102 adult subjects, full-colour 1350×1350 images
- signed subject consent covers lab-based and web-based studies in original or altered forms and research illustration
- Figshare lists the dataset under CC BY 4.0
- each subject has neutral and smiling captures from five camera angles
- naming evidence used by the source ecosystem identifies neutral front as `*_03.jpg` and smiling front as `*_08.jpg`

Intended research mapping:

- general reference corpus: neutral-front `*_03.jpg`, with subject-level reference/holdout split
- head yaw: neutral front against genuine left/right three-quarter capture from the same subject
- expression: neutral-front `*_03.jpg` against smiling-front `*_08.jpg`
- dataset subject provenance supplies same-subject linkage; no biometric identity matching is permitted

Hard boundary:

- this source does **not** establish real head-pitch or head-roll evidence
- 2D image rotation must not be used as a substitute for genuine head roll
- pitch/roll therefore remain blocked until separately consented/licensed real same-subject captures exist
- the 102-person London sampling frame is not treated as population-representative
- ethnicity/age/gender metadata may describe coverage during manual adequacy review but must not become user-sensitive-attribute inference or Archetype ground truth
- raw images must not be committed to the repository or persisted in evidence packets
- derived packets may retain only governed structural measurements, source receipts/digests, and required attribution/provenance
- CC BY 4.0 and the documented consent make this a research-data candidate; they do not authorize Face Lab Production activation or end-user face matching

Current state:

- front-image research scope acquired through pinned mirror `debruine/webmorphR.stim@fa8b78fda2d659bb74ce62fcd99c4407551d2a77`
- exact SHA-256 receipts frozen for 204 front images: 102 neutral + 102 smiling
- deterministic subject-level split frozen before measurement: 82 reference + 20 holdout
- neutral-front structural measurement completed for all 102 subjects
- same-subject neutral-front ↔ smiling-front expression stability completed for all 102 subjects
- exact descriptive reference-corpus review packet frozen; adequacy authority remains absent
- exact descriptive expression-stability review packet frozen; overall stability adequacy remains blocked because pose coverage is incomplete
- current real-photo nuisance coverage: expression only
- current missing nuisance classes: `head_yaw`, `head_pitch`, `head_roll`
- the current pinned mirror exposes the governed front-image subset only; London multi-angle yaw images are not yet acquired, receipted, or measured in this track
- reference-corpus adequacy decision absent
- real-photo stability adequacy decision absent

Upstream:

- https://figshare.com/articles/dataset/Face_Research_Lab_London_Set/5047666
- https://doi.org/10.6084/m9.figshare.5047666.v5
- https://debruine.github.io/reprostim/

### London Set multi-angle extension — PRIMARY_NEXT_SOURCE_CANDIDATE

Role:

- preferred same-subject real-photo `head_yaw` extension because it preserves the already adopted London subject provenance, consent basis, sampling frame, provider path, and reference identities
- candidate comparison: neutral front against genuine left/right three-quarter or profile captures from the same subject

Verified source facts:

- the upstream London Set documents five simultaneously captured camera angles for each neutral and smiling pose: left profile, left three-quarter, front, right three-quarter, right profile
- the existing Face Lab measurement track has only pinned and receipted front images

Required before adoption:

- acquire the exact multi-angle upstream artifact under the same governed source scope
- freeze exact file inventory and SHA-256 receipts
- confirm deterministic same-subject / angle mapping from source provenance
- run the existing actual-image stability runner without biometric identity matching
- keep raw source images out of repository evidence packets

Boundary:

- this extension can address yaw only
- it does not establish genuine head pitch or roll evidence
- current stability authority remains expression-only until exact yaw evidence is frozen and verified

Upstream:

- https://doi.org/10.6084/m9.figshare.5047666.v5
- https://debruine.github.io/reprostim/

### Pointing'04 Head Pose Image Database — SECONDARY_RESEARCH_DATA_CANDIDATE

Role:

- independent same-subject real-photo yaw / pitch candidate
- possible fallback or complementary source when London multi-angle acquisition is insufficient

Verified source facts:

- 15 subjects
- 2 series of 93 images for each subject
- pose is represented by horizontal and vertical angles spanning negative to positive head rotations
- subject and pose are encoded by source-side acquisition structure, so biometric identity matching is unnecessary for linkage

Boundary:

- Pointing'04 supplies pan/yaw and tilt/pitch style variation, not an independent roll axis
- the current official benchmark page does not by itself freeze a reusable commercial-license contract for this project
- no image may enter Face Lab research evidence until the exact downloadable artifact, license/redistribution terms, and artifact digest are pinned
- therefore this remains a source candidate, not an adopted dataset

Upstream:

- https://crowley-coutaz.fr/Pointing04/data-face.html
- referenced dataset DOI: https://doi.org/10.6084/m9.figshare.5142466.v2

### BIWI Kinect Head Pose — DEFER_LICENSE_RESTRICTED

Role:

- technically strong reference for real same-subject yaw / pitch / roll variation and pose ground truth

Verified research facts:

- approximately 15K images across 20 people
- sequences contain head turning with head-pose rotation annotations
- upstream dataset documentation states non-commercial use such as university research and education

Decision:

- do not adopt into the current BEJEWELY Face Lab evidence pipeline under the observed license
- a technically useful dataset does not override the project license boundary
- reconsider only if a separate permission/license basis is obtained and frozen

Upstream:

- https://vision.ee.ethz.ch/datasets/
- https://huggingface.co/datasets/ETHZurich/biwi_kinect_head_pose

### PANDORA — DEFER_LICENSE_RESTRICTED

Role:

- technically strong same-subject yaw / pitch / roll candidate with separately exercised head-pose axes

Verified research facts:

- more than 250k RGB/depth images with pose annotations
- repeated sequences per subject
- dataset documentation includes runs where head pitch, roll, and yaw are performed separately
- official AImageLab legal notice prohibits commercial use and requires written permission for uses outside the stated scientific-use boundary

Decision:

- do not adopt into the current BEJEWELY Face Lab evidence pipeline under the observed terms
- reconsider only after explicit written permission or another compatible license basis is frozen

Upstream:

- https://aimagelab-legacy.ing.unimore.it/imagelab/page.asp?IdPage=14
- https://aimagelab.ing.unimore.it/pandora/readme/Pandora_GT_readme.pdf

### Current pose-source decision

```text
expression
→ London front neutral/smiling
→ real evidence frozen

head_yaw
→ first choice: London genuine multi-angle extension
→ fallback/complement: Pointing'04 after exact license/artifact pin

head_pitch
→ Pointing'04 candidate after exact license/artifact pin

head_roll
→ no permissive, adopted real same-subject source confirmed yet
→ BIWI/PANDORA technically fit but are license-blocked
```

No pose-source candidate above changes current adequacy state. Until exact same-subject real-photo evidence is acquired, receipted, measured, and reviewed, missing nuisance classes remain missing.

## 4. Reconstruction / validation references

### MICA — RESEARCH_ONLY

Use:

- metric reconstruction comparison/reference

Do not promote directly to Production dependency without a separate license/model review.

### DECA / EMOCA — RESEARCH_ONLY

Use:

- detailed reconstruction and expression research reference

Do not use pretrained output as Face Space truth.

### 3DDFA_V2 — RESEARCH_ONLY

Use:

- independent 3D alignment/reconstruction comparison

Code license alone is insufficient; bundled/model data provenance must be reviewed separately.

### FaceVerse — RESEARCH_ONLY

Use:

- fine-grained 3DMM and East-Asian-data research reference

Dataset/model usage boundary requires separate review.

## 5. Hair / makeup generation

### HairFastGAN — RESEARCH_ONLY

Use:

- hairstyle counterfactual generator research

Boundary:

- pretrained dependency/data chain must be reviewed
- generated hairstyle preference is not compatibility truth

### Stable-Hair — RESEARCH_ONLY

Use:

- alternate hairstyle transfer/generation experiment

Boundary:

- training/pretrained data chain review required
- not a Production dependency candidate yet

### MagicMakeup — RESEARCH_ONLY

Use:

- region-controllable makeup counterfactual research

Boundary:

- base-model license chain prevents automatic Production promotion
- output is experimental evidence only

## 6. Style Space / apparel

### Marqo FashionSigLIP — SECONDARY_POC

Role:

- apparel/style semantic embedding candidate
- product image ↔ style attribute retrieval
- future Style Space research

Observed model card license: Apache-2.0.

Boundary:

- embedding is not Face×Style compatibility score
- fashion retrieval quality does not establish flatteringness

Upstream:

- https://huggingface.co/Marqo/marqo-fashionSigLIP

## 7. Automated preference sanity checks

### HPSv3 — SECONDARY_POC

Role:

- broad image preference / quality sanity channel
- independent auxiliary signal in controlled render evaluation

Observed upstream code license: MIT.

Boundary:

- not a Face Lab compatibility oracle
- score must not replace structural/VLM/counterfactual evidence

Upstream:

- https://github.com/MizzenAI/HPSv3

### ImageReward — RESEARCH_ONLY

Role:

- independent general image preference sanity channel

Boundary:

- not face-style compatibility truth

## 8. Current recommended stack

```text
Photo
→ MediaPipe observation / pose evidence
→ BEJEWELY Normalized Face Representation
→ Face Space

Face Space
→ GNM v3 adapter                 [primary face backend]
→ MPFB2 adapter                  [Blender/style experiment workbench]
→ FLAME 2023 Open adapter        [independent comparison/fallback]

all adapters
→ independent structural measurement
→ round-trip error
→ supported / hold

Style Space
→ controlled hair / eyewear / makeup parameters
→ future apparel embedding candidate: FashionSigLIP

Counterfactual renders
→ Face Lab structural judge
+ auxiliary preference sanity signals
→ stability / reversal / perturbation
→ Compatibility Evidence
```

## 9. Explicit exclusions

Do not silently use:

- demographic semantic sampling as user truth
- face identity embeddings for dedup or recommendation
- pretrained model labels as Archetype ground truth
- web co-occurrence as compatibility truth
- generic aesthetic score as Face×Style compatibility truth
- model repository license alone as proof that all pretrained weights/data are commercially reusable

## 10. Next executable gate

R-3D executable work proceeds in this order:

1. pin exact GNM v3 code/model artifact and runtime dependency set
2. implement GNM adapter runner
3. define backend-independent structural measurement operator
4. run 3 generic Face Space fixtures through GNM
5. compute round-trip error
6. implement MPFB2 adapter for the same fixtures
7. compare GNM vs MPFB2
8. add FLAME only as independent third backend if still informative
9. only after geometry round-trip stabilizes, attach hair/eyewear/makeup counterfactual variables
