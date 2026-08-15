# V2.1-8O Exfoliation Non-Numeric Product Decision Axis Contract v1

Execution main: `070cd4be1e9dcd05660d26451027ae0b504c5034`. V2.1-8N authority remains `NON_NUMERIC_DECISION_REPRESENTATION_RECOMMENDED`. Hosted is read-only and unchanged by this stage.

## Contract mode

Mode: `STRUCTURED_CATEGORICAL`. `numeric_estimate=null`, `ordinal_magnitude=null`, and `potency_order=null` are hard v1 invariants. The axis exposes governed structural/categorical product state, not potency.

## Signal and identity

The signal is the unordered set of supported `contains_active` propositions whose identity belongs to `exfoliating-active-identity-set-v1`: `lactic_acid`, `mandelic_acid`, `salicylic_acid`. The set is versioned and not exhaustive forever. Every relevant proposition is preserved; serialization order is deterministic only and has no semantic rank.

Signal summary states are `GOVERNED_SIGNAL_ESTABLISHED`, `GOVERNED_SIGNAL_NOT_ESTABLISHED`, `GOVERNED_SIGNAL_UNKNOWN`, `GOVERNED_SIGNAL_BLOCKED`, and `NOT_APPLICABLE`. `GOVERNED_SIGNAL_NOT_ESTABLISHED` is not negative evidence. Current v1 cannot assert `NO_EXFOLIATING_SIGNAL`: `contains_active` is an entity-identifier Fact and missing/no mapped identity is not `supported(false)`.

`single` and `multiple` are cardinality descriptors only. **MULTI_ACTIVE_CARDINALITY_IS_NOT_POTENCY.** No first-active, highest-concentration, sum, mean, max, or manual active ranking is permitted.

## Context

`active_concentration`, `recommended_use_frequency`, `product_format`, `wipe_off_use`, and `pad_surface_texture` remain context. None contributes effect magnitude. Concentration is consumed only through matching parent active lineage; missing concentration stays missing and never becomes zero. Registry domain scope is preserved, so product format/wipe-off are toner/pad context and pad surface texture is toner-pad-only context.

## Coverage, uncertainty, provenance

Coverage reuses existing architecture states where possible (`active_identity_only`, `active_identity_with_unscaled_context`, `no_relevant_fact`, `missing_fact`, `insufficient_fact`, `conflict_blocked`, `identity_blocked`) and adds explicit category/not-applicable states for this contract. Missingness remains lossless through deterministic reason enums; no confidence score is invented.

Minimum provenance is subject, proposition, Fact Instance, Confirmation, fact key, semantic status, authority ceiling, fused confidence, parent proposition when applicable, and mapper input role. This is enough to resolve immutable Evidence Links/Source lineage without embedding raw evidence bodies in the PDA.

## Product/downstream boundary

The intrinsic PDA contains product signal/identities, product-specific context, coverage, uncertainty, and provenance. It excludes user sensitivity, recent reaction/history, current routine, product-product duplicate/overlap relations, frequency conflicts against a user's routine, candidate-stack decisions, and final Recommendation decisions. Those remain downstream.

Legacy stronger/weaker and count-based logic is `LEGACY_NOT_AUTHORITY_FOR_NEW_CONTRACT`; it remains separate and unchanged. No equivalence is claimed and no scorer/ranker/CandidatePolicy behavior is modified.

## Examples

- `single_active_with_concentration_context`: 디오디너리 만델릭 애시드 10% + HA 세럼 → GOVERNED_SIGNAL_ESTABLISHED, single, coverage=active_identity_with_unscaled_context, numeric=null, ordinal=null.
- `single_active_missing_concentration`: 닥터지 레드 블레미쉬 10-시카 캡슐 수딩 토너 → GOVERNED_SIGNAL_ESTABLISHED, single, coverage=active_identity_with_unscaled_context, numeric=null, ordinal=null.
- `multi_active_with_pad_context`: 메디큐브 제로 모공 패드 2.0 → GOVERNED_SIGNAL_ESTABLISHED, multiple, coverage=active_identity_with_unscaled_context, numeric=null, ordinal=null.
- `no_v1_relevant_signal_with_context`: 아누아 피디알엔 히알루론산 캡슐 100 세럼 → GOVERNED_SIGNAL_NOT_ESTABLISHED, none_established, coverage=no_relevant_fact, numeric=null, ordinal=null.

## Historical replay and production boundary

- V2.1-8J: `STRUCTURALLY_READY_FOR_BOUNDED_OFFLINE_CALIBRATION`
- V2.1-8K: `NUMERIC_ANCHOR_GAP_CONFIRMED`
- V2.1-8L: `NUMERIC_ANCHOR_EVIDENCE_CONTRACT_DESIGNED`
- V2.1-8M: `NO_NUMERIC_ANCHOR_SOURCE_FOUND`
- V2.1-8N: `NON_NUMERIC_DECISION_REPRESENTATION_RECOMMENDED`

Production invariance remains 164 × 12 = 1968 evaluations with every required delta expected at zero. This stage performs no Hosted write, Registry mutation, migration, numeric fitting, production PDA consumption, Recommendation activation, or legacy heuristic replacement.

Primary terminal outcome: `NON_NUMERIC_EXFOLIATION_PDA_CONTRACT_FROZEN`.

Exactly one next stage: **Exfoliation Non-Numeric PDA Offline/Shadow Implementation & Replay**. It may implement this frozen contract in an offline/shadow-only mapper and replay governed Current Facts; it must not activate production.
