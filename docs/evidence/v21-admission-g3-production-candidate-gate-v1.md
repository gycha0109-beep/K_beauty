# V2.1-ADMISSION-G3 — Production Candidate Admission Gate Evidence

Status: implementation verification in progress.

## Frozen authority

- Starting main: `6fdff47f3c41a4e90dace8b8f7281b51a92d7c3f`
- G3A: `recommendation-admission-authority-read-v1`, preserved.
- G2: `initial-admission-grant-policy-v1`, preserved.
- Legacy corpus: `LEGACY_FROZEN_RECOMMENDATION_CORPUS_V1`, 164 UUIDs.
- Legacy corpus SHA256: `b6577d95353c4151152cf82e1705131516d5a2558cb68241a8f9fd48d9047a05`.

## G3 runtime contract

Canonical products are enumerated completely with ascending UUID keyset pagination before admission. Exact legacy members receive compatibility admission without a Product Fact read. Every non-legacy row must resolve through the protected G3A reader, existing PDA mapper, and frozen G2 evaluator. Only `INITIAL_ADMISSION_GRANT` is projected into Recommendation normalization.

Expected product-level authority absence or a non-grant decision rejects that product. Authority infrastructure ambiguity (credential, transport, timeout, malformed/unknown contract, stale or ambiguous technical authority) fails the Recommendation request closed. Non-legacy protected reads are sequential and bounded to 64 per request; exceeding the ceiling fails before any protected read.

## Acceptance inventory

- Enumeration: E1-E6.
- Frozen legacy membership: L1-L7.
- Governed admission: G1-G12.
- Historical Recommendation invariance: 164 products × 12 contexts.
- CandidatePolicy: unchanged downstream contract.
- Production runtime proof: exact deployed main SHA, aggregate counts only.

Hosted catalog data is not mutated by this stage. Crawler activation remains out of scope.
