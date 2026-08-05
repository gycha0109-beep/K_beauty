# Recommendation Metadata Shadow Evidence v1

## Executive conclusion

**EVIDENCE_READY_NO_ACTIVATION** — 164 products × 12 deterministic scenarios were replayed through the actual legacy scorer. The shadow policies changed no Production result, response, explanation, persistence projection, or CandidateExposurePolicy fingerprint.

## Fixture provenance

- Source main: `4202bd2c9a83f276436e226aee9d9bbc9ace2a8f`
- Source branch: `e6a116afec9a99d40b59ade0e38d3a451cf456e1`
- Exported at: `2026-08-04T22:35:38.007314+09:00`
- Products: 164
- Fixture SHA-256: `e4788383a21ac4207d553fbfb5300dc629b8eab5ad200ffd1313d43e94e0c856`
- Sanitization: top-three aggregate review signals, canonical ingredient aggregates, and market aggregates only; no raw review text, URL, credential, session, user, or image data.

## Legacy invariance

- Ranking hashes match: true
- Public response hashes match: true
- Score hashes match: true
- Explanation hashes match: true
- Persistence hashes match: true
- CandidatePolicy fingerprints match: true

## Cleanser results

- Structured deep-clean products: 9; heuristic deep-clean products: 0; false negatives: 9.
- Deep-clean candidate Top 3 counts by scenario: {"U1":1,"U10":0,"U11":0,"U12":0,"U2":0,"U3":0,"U4":0,"U5":0,"U6":0,"U7":0,"U8":0,"U9":0}
- U5 sensitive + redness Top Pick changed: false
- Largest rank drop: 어성초 쿼세티놀 모공 딥 클렌징 폼 (0bced9fe-aa08-4982-bb4a-03fb9ed509c1), U5, Δrank 2
- False-negative products with any rank/penalty impact: 9/9
- Unaffected scenarios: U1, U10, U11, U12, U2, U3, U4, U7
- Decision: **READY_FOR_POLICY_REVIEW**

## Balm results

- Non-primary balm products exposed in a legacy Top Pick or Top 3: 2
- Local/eye-lip balm legacy Top Pick cases: 1
- Candidate A impact: {"topPickChangedScenarios":2,"top3ChangedScenarios":2,"eligibilityChanges":156}
- Candidate B impact: {"topPickChangedScenarios":2,"top3ChangedScenarios":2,"eligibilityChanges":84}
- Lower-change policy: candidate_b
- Metadata-unknown balm products: 0
- Decisions: **CANDIDATE_A_REVIEWABLE**, **CANDIDATE_B_REVIEWABLE**

## Sunscreen results

- Current catalog protection-completeness rank/eligibility changes: 0
- Water-resistance unknown products: 10; current score impact: 0
- Virtual incomplete sunscreen excluded from candidate Top Pick: true
- Current catalog gate is a no-op: true
- Decisions: **CURRENT_CATALOG_NOOP_READY**, **ADMIN_V2_REQUIRED**

## Cross-category findings

The policies are category-scoped. Cleanser changes only recompute cleanser penalties, balm policies only alter primary-moisturizer eligibility, and sunscreen completeness only alters sunscreen primary eligibility. No score is introduced for balm or sunscreen candidates.

## Admin v1 parity risk

new sunscreen rows may enter legacy candidates without SPF/UVA because Admin v1 does not collect the metadata and Production eligibility is unchanged. Existing rows are complete, but newly imported rows can omit the metadata until Admin v2 supplies and validates it.

## Persistence limitation

The corpus verifies deterministic snapshot hashes and shadow purity. It does not add metadata to saved public reports or change owner/reentry contracts.

## Activation recommendation

Do not activate any policy in Production in this stage. Use these artifacts for policy review only.

## Remaining blockers

- Human policy approval for cleanser structured authority.
- Role-schema decision between balm candidate A and B.
- Admin v2 completeness enforcement before sunscreen gating protects newly created rows.
