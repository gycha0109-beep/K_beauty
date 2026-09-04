# FaceLab Neutral Face Count Shared Stage v2

## Purpose

Stage A must measure the number of people whose eyes, nose, mouth, and other exact facial features are sufficiently visible to judge. Merely increasing the number of review items is not sufficient: the item set must exercise multiple answer buckets.

The reviewer question is fixed exactly as:

> 눈, 코, 입 등 얼굴의 정확한 특징을 판별할 수 있을 정도로 보이는 사람은 몇 명인가요?

Reviewer choices remain `없음`, `1개`, `2개 이상`, `판단 불가`.

## Supersession

v1 remains immutable historical evidence. v2 is a new authority, campaign key, intake version, digest, and semantic set. Existing v1 assets and previously persisted Human Review rows are not rewritten or deleted.

## Semantic set

The eight-item v2 set is curated internally to the following expected-class distribution:

- `none`: 2
- `one`: 3
- `two_or_more`: 3

`not_assessable` remains a reviewer fallback and is intentionally not a curated expected-answer bucket.

The expected classes live only in `face-count-neutral-curation-validation-20260905-v2.json`; they must never be included in the reviewer authority or public model.

## Visual construction

v2 references immutable governed source bytes already present in the repository. The runtime visual endpoint renders review items deterministically:

- single source: source image as-is,
- obscured single source: strong blur to create a face-present-but-features-not-discernible hard case,
- composite: two or three governed single-face sources displayed together as one review visual.

The semantic-set checker verifies the source hashes and dimensions and rejects source reuse as padding across v2 items.

## Persistence boundary

Selections, navigation, and in-progress state remain digest-bound localStorage only. Database persistence occurs only when the reviewer activates the final `1단계 제출` action. v2 uses a new authority digest and campaign key, so stale v1 local progress cannot silently bind to v2.
