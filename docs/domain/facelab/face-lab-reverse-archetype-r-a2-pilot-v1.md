# Face Lab Reverse Archetype R-A2 Pilot v1

> Track: FACE LAB / Reverse Archetype Empirical Validation  
> Status: Pilot foundation / metadata collection ready  
> Baseline: main@cc029c0f1c6d36304049570641193f94335ed7a3  
> Production impact: none

## 1. Purpose

This slice establishes a bounded first empirical pilot without using the current Archetype scorer as evidence.

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

## 2. Frozen pilot matrix

Retrieval surfaces:

- Google Images / Korean web surface
- Naver Image Search / Korean web surface
- Bing Images / Korean web surface

Collection mode is manual metadata capture only.

The repository does not automate scraping of those surfaces.

Archetype hypotheses:

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

## 12. Completion boundary for this slice

This slice is complete when:

- frozen manifests validate
- verifier passes
- research module remains isolated from Production and Archetype scorer authority
- metadata collection can begin without changing code

This slice does not claim that the current seven Archetypes are valid or invalid.
