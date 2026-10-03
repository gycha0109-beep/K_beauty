# V2.1-ADMISSION-G4-B-R1 — FATION Formulation Authority Recovery

## Decision

`V21_ADMISSION_G4_B_R1_FORMULATION_AUTHORITY_NOT_RECOVERED`

This stage is research-only and performs zero Production writes.

## Current Production boundary

FATION remains:

```text
Product Fact Subject     = 0
Current KR Subject       = 0
Current Product Fact     = 0
pristine blocked tasks   = 3
intake identity          = SUBJECT_CREATION_REQUIRED
intake trust             = REVIEW_REQUIRED
```

No task claim, Evidence ingest, Subject registration, Fact confirmation, or Recommendation mutation is authorized.

## What was re-searched

Fresh first-party review on 2026-10-03 covered:

- current FATION 30 ml standalone product page;
- current FATION set pages carrying the same 30 ml serum;
- current Dong-A corporate product route;
- Dong-A product press material;
- reformulation / renewal / current-formula searches on the first-party domains.

No first-party reformulation notice, formulation effective date, or lot-bound current 30 ml ingredient panel was recovered.

## Current first-party contradiction

The same 30 ml product/presentation is represented by three distinct ingredient orderings.

### water-first

FATION product 329:

`6eeed9473eaaee36bd09a73fb7b9ac1ddd4b7761c9fe21ae57070c9bc0484334`

### mugwort-first A

FATION set 613:

`2c0cd6fc3765c9b59baf72b6f34abd4ad905e94c07a49c3c7c5c4facbf977d20`

### mugwort-first B

FATION set 757 / FATION set 1126 / Dong-A NNTS20:

`2bfec79eb1d7c9600e898cfbdecfcbbf53606767bf7c6561db6732f5a5583cc4`

All three contain the same 26 ingredient names.

The conflict is therefore not basic Product identity; it is **formulation revision identity**.

## Manufacturing-window signal does not close the gap

FATION set 1126 currently says that it handles products manufactured on or after:

`2022-06-15`

while exposing the mugwort-first-B ordering.

The standalone current 30 ml page exposes water-first and says shipped stock is manufactured within the preceding 36 months.

Neither statement identifies:

- the reformulation date;
- an exact lot boundary;
- which ordering is the current canonical KR 30 ml formulation.

Therefore page recency or manufacturing-window wording cannot be converted into a Product Fact formulation revision.

## Recovery contract

The HOLD may be reconsidered only when one of the following is obtained.

### A. Lot-bound current package panel

Required together:

- exact 30 ml FATION NOSCA9 TROUBLE SERUM package;
- visible lot/batch or manufacturing date;
- complete ingredient panel from that same package;
- capture date and provenance.

### B. First-party written formulation statement

A FATION or Dong-A response must explicitly identify:

- the current KR 30 ml formulation or ingredient ordering; and
- its effective date, reformulation date, or lot/manufacturing applicability.

Ticket/message/date provenance must be retained.

### C. First-party reformulation notice

The official notice must map:

`old formulation → current formulation`

and provide an effective-date or equivalent applicability boundary for the exact 30 ml product.

## What is not sufficient

The following may not unlock Subject registration:

- retailer-only ingredient lists;
- search ranking or crawl recency;
- product number alone;
- same ingredient set without revision boundary;
- Product/presentation convergence alone;
- choosing the most recent-looking official page.

## Exact first-party inquiry

Public customer contact currently exposed on the official product pages:

`080-920-3003`

The required questions are:

1. 현재 한국 판매용 노스카나인 트러블 세럼 30ml의 전성분 순서가 어느 공식 페이지의 표기와 일치하는가?
2. 해당 전성분이 적용되기 시작한 제조일자/로트 또는 리뉴얼 시점은 언제인가?
3. 기존 정제수-first 표기와 쑥잎추출물-first 표기 중 어느 것이 현행 30ml 제조품에 적용되는가?
4. 가능하면 현행 30ml 패키지 전성분 또는 공식 리뉴얼 이력을 확인할 수 있는 자료를 제공할 수 있는가?

A response must be preserved with source/date/ticket provenance before semantic review.

## Next gate

`V2.1-ADMISSION-G4-B-R2_FATION_FORMULATION_AUTHORITY_EVIDENCE_REVIEW`

R2 is conditional. It may start only when new qualifying first-party authority has actually been captured.
