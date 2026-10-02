# V2.1-8G2-0 — Registry v1 Research Contract Closeout

## Decision

`V21_8G2_0_REGISTRY_V1_RESEARCH_CONTRACT_PASS`

8G1 is closed at merge commit `cdb9bd85e515616778c1971569d18586610f5066`.
The merged-main Vercel production deployment for that commit is READY.

8G2-0 is a zero-write research preflight. No Product Fact research has started.

## Frozen scope

- READY Products: **8**
- exact existing Registry v1 tasks: **16**
- HOLD Products excluded: **4**
- replacement Products: **0**
- Registry v2 tasks: **0**

Research waves are frozen as:

- 8G2-A: **6 tasks** — Beplain + Dr.twentyproject + ATOPALM
- 8G2-B: **6 tasks** — Dr.G + WELLAGE + BRINGGREEN
- 8G2-C: **4 tasks** — ruuve + SCINIC

## Registry authority

Pinned registry:

`product-fact-registry-cross-category-v1`

Registry checksum:

`79d41ac13de8080df5199543e31ad7bbc1c1763836ef776313613b7547b79575`

Subject identity serializer:

`product-fact-subject-identity-v1`

The six active Fact definitions required by the 16 tasks are frozen by their v1 definition checksums:

| Fact key | v1 checksum |
| --- | --- |
| barrier_support_claim | 108ad711469c9018bc06560fce20257f05d32d3a4ed57571a4df5f653abc850d |
| contains_active | 7b6f785309dc34f6cd4042ebc7b108b49e118c364e633457c3baf53c77dcb7b3 |
| deep_cleansing | 43e03202518cb69cbf63f08f8494f8f0aabf252dcf942a241c6aac636ed91fd7 |
| low_ph | 2c695147eda6da905207cfa5d4c32e756ff0fa7726e04882f5da5a6f3f29bdcf |
| primary_use_role | 7e12fb3509c5978f01ab1e7d53ec8a86311de4fa6ead83f0391237abe0044dca |
| product_format | f04ee27fd5526ce0866693d146811324f0da4c323fd55f82e91c38ef9273fcc4 |

For all six v1 definitions:

- write policy = active
- new lineage allowed = true
- existing lineage allowed = true
- positive evidence = product-specific evidence
- negative evidence = explicit negative only

The same six Fact keys have different v2 definition checksums. Registry v2 remains outside this research contract and has no authority for these frozen tasks.

## Research adjudication contract

Only three outcomes are allowed:

1. `DIRECT_EVIDENCE_FOUND`
2. `EVIDENCE_INSUFFICIENT`
3. `IDENTITY_OR_SCOPE_BLOCKED`

Mandatory boundaries:

```text
missing != false
negative => explicit negative evidence only
official source first
Product != Product Fact Subject
Evidence != Fact
Fact adoption != Recommendation activation
cross-Subject Fact transfer = forbidden
Evidence write = not authorized in 8G2
Fact instance write = not authorized in 8G2
Fact confirmation = not authorized in 8G2
Recommendation activation = not authorized
```

## Worker-interference preflight

At freeze time:

- `claim_gpt_catalog_research_tasks_v1` in Production: **absent**
- `ingest_gpt_catalog_product_v1` in Production: **absent**
- all 16 tasks: `RESEARCH_PENDING`
- all 16 tasks: `attempt_count = 0`
- all 16 tasks: `last_research_at = NULL`
- all 16 tasks: no source locator/digest written

The GPT catalog-intake implementation exists on merged source main, but its Production migration has not been applied. No automatic worker has claimed the frozen Wave 1 tasks.

## Production invariants

```text
Product Fact Current total = 95
READY Registry v2 tasks    = 0
READY Evidence records     = 0
READY Fact instances       = 0
publicActivation           = false
```

## Next gate

`V2.1-8G2-A_REQUIRED_FACT_RESEARCH_BEPLAIN_DR20_ATOPALM_6_TASKS`

8G2-A may research only the exact six pre-frozen tasks for:

- 비플레인 녹두 약산성 클렌징폼
- 닥터트웬티프로젝트 나인 토너
- 아토팜 MLE 크림 스틱 밤

No Evidence ingest or Fact confirmation is authorized by this closeout.
