# Face Lab External Research Dependency Register v1

> Track: FACE LAB / Research Dependencies  
> Reviewed: 2026-09-19  
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

- canonical 468-landmark topology
- Face Geometry metric 3D space
- default canonical face unit = centimeter
- Face Landmarker web result can expose facial transformation matrices
- repository dependency already includes @mediapipe/tasks-vision

Boundary:

- normalized image landmarks are not automatically metric facial dimensions
- camera/pose/perspective must be handled explicitly
- MediaPipe observation does not become identity recognition

Upstream:

- https://github.com/google-ai-edge/mediapipe

## 3. Reconstruction / validation references

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

## 4. Hair / makeup generation

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

## 5. Style Space / apparel

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

## 6. Automated preference sanity checks

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

## 7. Current recommended stack

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

## 8. Explicit exclusions

Do not silently use:

- demographic semantic sampling as user truth
- face identity embeddings for dedup or recommendation
- pretrained model labels as Archetype ground truth
- web co-occurrence as compatibility truth
- generic aesthetic score as Face×Style compatibility truth
- model repository license alone as proof that all pretrained weights/data are commercially reusable

## 9. Next executable gate

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
