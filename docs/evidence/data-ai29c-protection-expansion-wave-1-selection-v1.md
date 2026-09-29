# DATA-AI29C-C5 — Protection Discrimination Recovery Wave 1 Planning

> Planning-only authority. Candidate crawler/ranking data is a discovery and research-priority lead only. It is not Product Fact evidence, does not promote Products, and does not change Recommendation.

## Authority

- Source main: `a10df31e73f4ad453eb5f64b4057c44cf40fe5a4`
- Registry: `product-fact-registry-cross-category-v1`
- Taxonomy: `catalog-taxonomy-v1`
- Selection policy: `data-ai29c-protection-expansion-selection-v1`
- Frozen snapshot SHA256: `2b474f4b4b17e9980d65af4637b790c42ffcb7a754a7a47b69342414989f3716`
- Mode: `RESEARCH_READINESS_FALLBACK_WAVE`

## Current governed sunscreen corpus

| Axis | Eligible | Distinct scoring buckets |
|---|---:|---:|
| SPF | 12 / 12 | 1 |
| UVA | 10 / 12 | 1 |
| Water duration | 0 / 12 | 0 |

- Production cutover authorized: **false**
- Outdoor rankable signal authorized: **false**

## Frozen candidate pool

- Canonical taxonomy sunscreen candidates: 37
- Planning eligible: 36
- Excluded: 1
- Selected Wave 1: 8
- Deferred: 28

### Protection discovery leads

- Exact discrimination leads: 0
- SPF non-50 leads: 0
- UVA non-PA++++ leads: 0
- Numeric water-duration leads: 0
- Durationless water-claim research leads: 1

The frozen source metadata contains **no exact SPF/UVA/water-duration discrimination lead**. Wave 1 therefore runs in research-readiness fallback mode. A durationless water claim may increase research priority, but it is never converted into a water-resistance duration.

## Exact Wave 1 selection

| Rank | Candidate | Brand | Product | Class | Score | Source rank | Evidence obs. | Leads |
|---:|---|---|---|---|---:|---:|---:|---|
| 1 | `77856d50-a033-4646-ae23-2a1162138319` | BUSHMAN | Waterproof Pro Suncream [SPF50+/PA++++] | PROTECTION_RESEARCH_LEAD | 67 | 5 | 5 | water_claim_research |
| 2 | `fd94a38e-ce09-4f4e-8bfd-882f47e071b5` | ohana | Escape Desert Sun Serum [SPF50+/PA++++] | FALLBACK_RESEARCH | 51 | 1 | 5 | none |
| 3 | `d433bd51-6bea-4647-a82e-18dafdccd45b` | ROUNDLAB | Birch Moisture Sun Cream [SPF50+/PA++++] | FALLBACK_RESEARCH | 51 | 1 | 6 | none |
| 4 | `30104119-75e7-4527-9b89-21c2a2fb37a8` | CellFusionC | SUNSCREEN [SPF50+/PA++++] [AQUATICA COOLING] | FALLBACK_RESEARCH | 49 | 3 | 5 | none |
| 5 | `0af31488-09c8-417c-8cfe-d1ad05231814` | INNISFREE | HYALURON MOIST SUNSCREEN [SPF50+/PA++++] | FALLBACK_RESEARCH | 48 | 4 | 5 | none |
| 6 | `787e1c41-7d42-48f1-be74-e6d5c9837b7f` | Torriden | DIVE IN Watery Sun Serum [SPF50+/PA++++] | FALLBACK_RESEARCH | 47 | 5 | 5 | none |
| 7 | `1eae1cd9-ede3-41c8-87e2-c8bab93ff9e0` | FULLY | (RICE) CERAMIDE MOISTURE SUN CREAM [SPF50+/PA++++] | FALLBACK_RESEARCH | 46 | 6 | 5 | none |
| 8 | `16fe9bcb-ef37-41cd-a379-8db8ab1eb2d0` | SHINGMULNARA | White Rice Moisture Sun Cream [SPF50+/PA++++] [Bright Tone up] | FALLBACK_RESEARCH | 45 | 7 | 5 | none |

## Selection semantics

- `spf_non_50`, `uva_non_pa4`, `water_duration`: candidate-source discovery leads only.
- `water_claim_research`: durationless research lead only; never duration evidence.
- Hwahae/ranking/crawler data is not Product Fact positive authority.
- Exact Product/Subject identity and official evidence remain governed by Catalog Review → TRUST → Product Fact.
- Missing evidence remains unknown, never false and never a ranking penalty.

## Next operational stage

Each selected candidate must pass the existing catalog-only identity preflight/approval and promotion authority before TRUST intake. This planning artifact itself performs no promotion and no Hosted mutation.

## Invariants

- Hosted writes: 0
- Product promotion intent: 0
- Product Fact write intent: 0
- Recommendation write intent: 0
- Production ranking changed: false
- Candidate source used as Product Fact authority: false
- Water claim converted to duration evidence: false
- Runtime consumption: false
