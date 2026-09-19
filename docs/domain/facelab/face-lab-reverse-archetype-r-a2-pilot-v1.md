# Face Lab Reverse Archetype / Face Space Seed R-A2 Pilot v1

> Track: FACE LAB / Reverse Archetype Empirical Seed / Face Space  
> Status: Pilot foundation / metadata collection ready  
> Baseline: main@cc029c0f1c6d36304049570641193f94335ed7a3  
> Production impact: none

## 1. Purpose

This slice establishes a bounded first empirical pilot without using the current Archetype scorer as evidence.

The seven current Archetypes are search seeds and cultural-label hypotheses. They are not the internal shape of Face Lab and are not treated as natural ground-truth classes.

The research target is:

```text
cultural label search context
→ blind structural observation
→ sealed FaceLabObservationAnalysis
→ later Normalized Face Representation
→ Face Space distribution analysis
```

The execution boundary is:

    frozen web query context
    -> provenance-only RAW candidate
    -> governed opaque asset handoff
    -> blind Vision observation
    -> observation seal
    -> only then rejoin web context

It must never become:

    web label
    -> current Archetype scorer
    -> score treated as evidence for the same label

It also must never become:

    web label
    -> one average face
    -> that face declared the archetype truth

## 2. Frozen pilot matrix

Retrieval surfaces:

- Google Images / Korean web surface
- Naver Image Search / Korean web surface
- Bing Images / Korean web surface

Collection mode is manual metadata capture only.

The repository does not automate scraping of those surfaces.

Archetype search-seed hypotheses:

- wolf / 늑대상
- cat / 고양이상
- puppy / 강아지상
- deer / 사슴상
- tofu / 두부상
- potato / 감자상
- dino / 공룡상

Each label has eight frozen query strata:

- label
- label + 얼굴
- label + 연예인
- label + 남자
- label + 여자
- label + 남자 연예인
- label + 여자 연예인
- label + 특징

Requested depth is top 5 per retrieval-surface/query pair.

Maximum planned metadata candidates:

    3 surfaces x 7 labels x 8 queries x 5 ranks = 840

The frozen authority files are:

- evidence/facelab/reverse-archetype/pilot-v1/source-manifest.json
- evidence/facelab/reverse-archetype/pilot-v1/query-manifest.json

Changing a retrieval surface, query string, query family, or requested depth creates a new pilot version.

## 3. RAW candidate contract

A RAW candidate stores provenance only.

Required concepts include:

- opaque run ID
- opaque candidate ID
- archetype_query_label
- frozen query ID / string / family
- retrieval surface ID
- origin domain
- rank
- result URL
- landing URL
- image URL
- retrieval timestamp
- acquisition mode
- raw-image-retention flag

The field name ground_truth_label is forbidden.

Observation output and Archetype scoring output are forbidden inside the RAW candidate.

The query label means only:

> this result surfaced under this sampled web context.

It is not Human ground truth.

It also does not mean that all included faces must form one compact cluster. Within-label variation, multimodality, overlap and boundary cases are expected research outputs.

## 4. Blind observation boundary

The observation worker must not receive:

- archetype query label
- Korean Archetype label
- query string or family
- retrieval surface identity
- origin domain
- result URL
- landing URL
- remote image URL
- current Archetype score/ranking

The worker receives only:

- opaque run ID
- opaque candidate ID
- opaque blind observation ID
- opaque governed asset reference
- content digest
- MIME type
- dimensions

Candidate IDs and asset references must be opaque and must not encode a label or source.

## 5. Governance gate

The current pilot source manifest is intentionally metadata-only.

Before a web image can cross into blind observation, an external acquisition/privacy/rights decision must explicitly mark the asset:

    approved_for_research_observation

Until then:

- raw web-image bytes are not retained by this pilot
- blind observation packet creation fails closed
- no Vision call is authorized by this implementation
- Production Face Lab storage is untouched

This PR does not decide legal basis, consent, licensing, redistribution rights, or source-specific terms.

## 6. Eligibility

The primary v1 empirical subset requires:

- photorealistic human image
- exactly one visible human face
- faceLabEligible = true
- normalized Face Lab observation status available or partial

Important exclusions include:

- no face
- multiple faces -> excluded_multi_face
- non-photographic image
- face too small
- face occluded
- unsupported angle/profile
- insufficient image quality
- other non-assessable state

Excluded RAW candidates are not silently deleted.

## 7. Observation seal

A normalized Vision bundle may be sealed only after the blind packet has passed the target-context check.

The sealed record preserves:

- candidate ID
- blind observation ID
- exact asset digest
- normalized eligibility
- normalized FaceLabObservationAnalysis
- primary-subset inclusion/exclusion result
- extraction identity
- deterministic seal digest

Extraction identity must include:

- observation contract version
- observation schema version
- provider
- model
- prompt version or digest
- normalizer version
- eligibility version
- code SHA

Search provenance is rejoined only after the observation is sealed.

The current sealed record stores the normalized `FaceLabObservationAnalysis`, not a final Face Space vector. Any later Face Representation transform must be separately versioned and reproducible from sealed evidence or explicitly record why it cannot be reproduced.

## 8. Duplicate boundary

The first implementation supports exact byte/content digest grouping only.

Repeated exact image occurrences remain in the raw web-frequency dataset and are also represented in a separate exact-duplicate map.

This is not person identity deduplication and is not full visual near-duplicate clustering.

No face embedding or identity recognition is introduced.

## 9. Explicit non-wiring

This research module must not import or call:

- face-lab-archetype-registry
- face-lab-archetype-scoring
- face-lab-archetype-decision

It does not modify:

- /api/analyze
- /api/face-reading
- canonical Face Lab result
- saved_reports
- Supabase Production schema/data
- Production Archetype activation
- current rubric weights or thresholds
- Production Face Representation
- Production Face Space
- Production Style Compatibility
- Production style recommendation

## 10. Verification

Run:

    npm run verify:face-lab-reverse-archetype-pilot

The verifier checks at minimum:

- 7 x 8 query freeze
- three metadata-only retrieval surfaces
- 840 maximum-candidate calculation
- query-manifest deterministic regeneration
- RAW provenance-only contract
- ground-truth prohibition
- blind context leakage prohibition
- governance fail-closed
- exactly-one-face primary subset
- multi-face exclusion
- observation sealing before context join
- seal digest integrity
- exact duplicate grouping
- no current Archetype scorer dependency

## 11. Next execution step

After this foundation is accepted, R-A2 execution proceeds in two separately auditable parts.

### R-A2A — Metadata pilot

Capture the frozen top-5 result metadata for the frozen source/query matrix and write provenance-only candidate records.

No face observation is needed to complete R-A2A.

### R-A2B — Governed blind observation

Only candidates whose image handling is separately approved may receive an opaque asset reference and cross into blind observation.

The web context stays sealed until observation completion.

### R-A3 — Face Representation derivation

After a sufficient sealed observation sample exists, define and freeze a versioned transform from supported structural observation axes into a reusable Normalized Face Representation.

The transform must not consume the candidate's Archetype query label.

### R-A4 — Face Space distribution analysis

Rejoin the frozen search context only after the structural representation is sealed, then compare sampled distributions by label/query/surface.

Primary outputs are not only centroids. Preserve:

- medians / quantiles / spread
- within-label variation
- cross-label overlap
- boundary cases
- multimodality
- missingness / uncertainty
- retrieval-surface sensitivity
- duplicate robustness

### R-A5 — Parametric experiment handoff

Only after stable structural axes are identified may selected Face Space points be translated into a controlled parametric 3D experiment.

Candidate points can include:

- label-region center candidates
- high-density variants
- cross-label boundary variants
- overlap variants
- out-of-distribution controls

A rendered 3D head is an experimental representation of a Face Space coordinate, not the ground-truth face of an Archetype.

## 12. Completion boundary for this slice

This slice is complete when:

- frozen manifests validate
- verifier passes
- research module remains isolated from Production and Archetype scorer authority
- metadata collection can begin without changing code

This slice does not claim that the current seven Archetypes are valid or invalid.


## 13. Face Space seed interpretation

The R-A2 corpus is the first labeled-context seed layer for a broader Face Space.

It does not remove the need for a future archetype-independent general face corpus.

Why:

```text
only archetype searches
→ possible seven-label sampling bias
→ Face Space may inherit taxonomy assumptions
```

Therefore later research should compare the seed corpus with a separately governed unlabeled/general face corpus.

## 14. Presentation / style observation boundary

A retrieved image can contain useful presentation evidence such as hair, makeup, eyewear, expression and capture conditions.

Those attributes may later be observed in a separate versioned Style Observation contract.

However:

```text
style observed in web result
≠ style compatible with that face
```

Web co-occurrence can generate a style hypothesis only.

It cannot directly produce a Production recommendation rule.

## 15. Style compatibility handoff

The long-term target is defined in:

`face-lab-face-space-style-compatibility-architecture-v1.md`

```text
Face Representation
× Style Representation
× Compatibility Evidence
→ bounded recommendation
```

Potential compatibility research after Face Space stabilization includes:

- controlled parametric 3D face generation
- controlled hair / eyewear / makeup parameter changes
- counterfactual A/B renders
- multi-model blind VLM judging
- A/B order reversal checks
- lighting / camera / crop stability checks
- local face/style perturbation
- holdout generalization
- uncertainty-driven active experimentation

These are future research tracks and are not implemented by this R-A2 foundation.

## 16. No compatibility claim

This pilot may establish sampled web distributions and structural hypotheses.

It does not establish:

- that one Archetype has one best hairstyle
- that a frequently observed style is flattering
- that a 3D prototype is the true average person of a label
- that an AI judge preference equals Korean consumer preference
- that current seven-label taxonomy is complete
- that current seven-label taxonomy must survive unchanged

Any of those claims require their own evidence and promotion gate.
