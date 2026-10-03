# V2.1-ADMISSION-G4-B — FATION Subject Registration HOLD

## Decision

`V21_ADMISSION_G4_B_FATION_SUBJECT_REGISTRATION_HOLD`

G4-B does **not** register a Product Fact Subject.

The G4-A runtime contract is ready, but the semantic identity required by the existing governed Subject registration path is still unresolved.

## Production prestate

Target:

- 파티온 노스카나인 트러블 세럼
- Product `da5df70c-8cdd-4eb2-93b6-ede46c2f171d`
- Candidate `6a9627b6-a5da-458f-84f7-3a40f91453be`
- Intake `15566618-d039-44c5-ad45-6413ee399db3`
- Market `KR`

Current state remains:

```text
Product Fact Subject = 0
Current KR Subject    = 0
intake identity       = SUBJECT_CREATION_REQUIRED
intake trust          = REVIEW_REQUIRED
tasks                 = 3 x REVIEW_REQUIRED
attempt_count         = 0
Evidence              = 0
```

## Fresh first-party revalidation — 2026-10-03

The previous Phase 5-C HOLD was rechecked against current first-party pages.

The conflict is **not resolved**.

Current official material exposes three distinct ingredient orderings over the same frozen set of 26 ingredient names.

### A — water-first

FATION product 329, 30 ml:

`6eeed9473eaaee36bd09a73fb7b9ac1ddd4b7761c9fe21ae57070c9bc0484334`

The FATION TRY 5 ml page exposes the same ordering.

### B — mugwort-first A

FATION set 613, 30 ml:

`2c0cd6fc3765c9b59baf72b6f34abd4ad905e94c07a49c3c7c5c4facbf977d20`

### C — mugwort-first B

Current Dong-A corporate product page, 30 ml, and FATION 3-product set 757:

`2bfec79eb1d7c9600e898cfbdecfcbbf53606767bf7c6561db6732f5a5583cc4`

All three contain the same 26 ingredient names but in materially different order.

The first-party functional-cosmetic metadata conflict also remains: the standalone product page reports review/notification completed while TRY/set pages report `N`.

## Why registration remains blocked

Catalog identity establishes:

- brand;
- product name;
- 30 ml presentation.

It does **not** establish one current Product Fact formulation revision.

Therefore the existing provisional variant label remains:

`NOSCA9_TROUBLE_SERUM_KR_30ML`

with status:

`PROVISIONAL_NOT_AUTHORIZED`

The following remain NULL:

```text
formulation_revision_key
formulation_label
subject_semantic_key
```

No reviewer may choose one of the three orderings merely because it appears more current or authoritative-looking.

That would convert a source conflict into invented Product Fact authority.

## Required next authority

G4-B can resume only after one of these, or equivalent first-party authority, is obtained:

1. current 30 ml package ingredient panel tied to a manufacturing lot/date;
2. FATION/Dong-A first-party statement identifying the current 30 ml ingredient list or reformulation history;
3. equivalent first-party evidence that distinguishes the current 30 ml formulation from stale/set-page metadata.

Retailer-only context is insufficient.

## Authorized delta

```text
Product Fact Subjects       +0
research task mutations     +0
Evidence                    +0
Fact confirmation           +0
Product Fact Current        +0
Recommendation              +0
```

## Next gate

`V2.1-ADMISSION-G4-B-R1_FATION_FORMULATION_AUTHORITY_RECOVERY`

This is a source-authority recovery gate, not a Subject creation gate.
