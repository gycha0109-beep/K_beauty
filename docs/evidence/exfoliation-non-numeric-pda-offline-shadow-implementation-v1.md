# V2.1-8P Exfoliation Non-Numeric PDA Offline/Shadow Implementation v1

Execution-start main: `8f8d492f2682c97f71f3f7880adb710f1be4c7f2`.

## Authority and scope

This stage consumes, without redesign, V2.1-8O `STRUCTURED_CATEGORICAL` contract `exfoliation-non-numeric-pda-contract-v1` with SHA256 `c85418df574b550672f9523bd6827e4265b57a9d7901e5bf8f6b4de203d45d40`. The frozen upstream outcome remains `NON_NUMERIC_EXFOLIATION_PDA_CONTRACT_FROZEN`.

Hosted Product Fact authority was read once, READ ONLY, then reduced to a checked-in canonical snapshot. CI does not contact Supabase. The snapshot contains 164 catalog product/category rows, 16 Product Fact subjects, and 28 relevant Current rows across the six mapper input fact keys. Raw Evidence bodies and unstable access timestamps are excluded.

Snapshot SHA256: `31311c223cfc1084e02e226e36b60b6052884f16c52cdc3f5308b786641a9fea`.

## Offline/shadow mapper

Mapper version: `exfoliation-non-numeric-pda-offline-shadow-v1`.

The mapper emits exactly one `exfoliation_load` PDA object for every catalog product. Only `toner_essence`, `toner_pad`, and `treatment` are applicable. Other categories emit the frozen `NOT_APPLICABLE` structure.

The v1 governed active identity set is `lactic_acid`, `mandelic_acid`, and `salicylic_acid`. All qualifying governed propositions are retained with deterministic serialization order only. Active count is cardinality, not potency. No numeric or ordinal magnitude is created.

Context remains context-only: `active_concentration`, `recommended_use_frequency`, `product_format`, `wipe_off_use`, and `pad_surface_texture`. Concentration is consumed only when its parent proposition matches a mapped governed active. Missing context remains missing and produces the frozen categorical uncertainty reason rather than a zero/default.

## Catalog replay

- catalog: 164
- applicable: 66
- not applicable: 98
- signal established: 3
- signal not established: 4
- signal unknown: 59
- signal blocked: 0
- single active: 2
- multiple active: 1
- none established: 4
- numeric non-null: 0
- ordinal non-null: 0
- potency ordering non-null: 0

Coverage frequencies: `{"active_identity_with_unscaled_context":3,"missing_fact":59,"no_relevant_fact":4,"not_applicable":98}`.

Uncertainty frequencies: `{"ACTIVE_CONCENTRATION_MISSING":65,"NEGATIVE_SIGNAL_NOT_AUTHORIZED":4,"NO_V1_RELEVANT_ACTIVE_IDENTITY_MATCH":4,"PAD_SURFACE_TEXTURE_MISSING":23,"PRODUCT_FORMAT_MISSING":45,"RECOMMENDED_USE_FREQUENCY_MISSING":64,"SOURCE_BLOCKED_OR_MISSING_CURRENT":59,"WIPE_OFF_USE_MISSING":46}`.

## Canonical 8O examples

The catalog replay reproduces the four frozen examples exactly at the PDA object boundary:

- The Ordinary Mandelic Acid 10% + HA: mapped `mandelic_acid`, established, single, 10% concentration context, numeric/ordinal null.
- Dr.G Red Blemish 10-Cica Capsule Soothing Toner: mapped `mandelic_acid`, established, single, concentration missing preserved.
- Medicube Zero Pore Pad 2.0: `lactic_acid` + `salicylic_acid`, multiple, pad/wipe/texture context preserved, no potency implication.
- Anua PDRN Hyaluronic Acid Capsule 100 Serum: no v1 relevant active, governed signal not established, non-axis identities preserved, negative signal not authorized.

## Provenance and missingness

Every emitted provenance reference is copied from the frozen snapshot and includes subject, Fact Instance, Confirmation, proposition/parent proposition, fact key, semantic status, authority ceiling, fused confidence, and mapper role. Raw Evidence bodies are not copied. Concentration parent lineage violations: 0. Fabricated provenance references: 0.

`missing != false`, `reviewed_not_established != false`, and `evidence_insufficient != false` remain hard invariants. V1 does not emit an explicit negative exfoliation signal without authority.

## Determinism and production boundary

Canonical serialization recursively sorts object keys, preserves explicitly sorted arrays, emits UTF-8/LF, and is byte-compared Build A vs Build B and against checked-in generated artifacts.

This mapper is offline/shadow only. It has no network or Supabase client dependency and is not imported by production Recommendation code. Product Fact Registry, Hosted data, migrations, scorer, ranker, eligibility, CandidatePolicy, public response, persistence, and legacy production behavior remain unchanged.

Historical V2.1-8J through 8O verifiers and the canonical 164 × 12 = 1968 Recommendation invariance suite are required in CI. Every production delta remains zero and PDA production consumption remains `NO`.

Primary terminal outcome: `NON_NUMERIC_EXFOLIATION_PDA_OFFLINE_SHADOW_REPLAY_VALIDATED`.
