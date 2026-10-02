# V2.1-8G2-CLOSE — Wave 1 Required Fact Research Closeout

## Decision

`V21_8G2_WAVE1_RESEARCH_CLOSEOUT_PASS_DIRECT6_INSUFFICIENT10`

Wave 1 required-Fact research is closed across exactly eight READY Subjects and sixteen frozen Registry v1 research tasks.\n\nResearch snapshot main: `35b15a1c70389f21951e1b61450da9ff1e7d8588`  \nIntegration main after TRUST GPT catalog-intake v3 guard: `5d92695eda8e47d3e6cbb727b5d904327ffb8fe0`.

## Aggregate

| Metric | Result |
| --- | ---: |
| READY Products | 8 |
| READY Subjects | 8 |
| Frozen tasks | 16 |
| DIRECT_EVIDENCE_FOUND | 6 |
| EVIDENCE_INSUFFICIENT | 10 |
| IDENTITY_OR_SCOPE_BLOCKED | 0 |
| Evidence DB writes | 0 |
| Fact Instance writes | 0 |
| Product Fact Current | 95 |

The aggregate is derived mechanically from the frozen 8G2-A, 8G2-B, and 8G2-C research artifacts. No task is reinterpreted or replaced during closeout.

## Exact 8G3 candidates

Only these six DIRECT tasks are eligible to enter the next evidence-ingest contract gate:

| Product | Fact | Proposed value | Evidence class |
| --- | --- | --- | --- |
| 비플레인 녹두 약산성 클렌징폼 | low_ph | true | product_claim |
| 아토팜 MLE 크림 스틱 밤 | barrier_support_claim | true | measurement |
| 아토팜 MLE 크림 스틱 밤 | primary_use_role | local_area | usage_instruction |
| 닥터트웬티프로젝트 나인 토너 | product_format | liquid | physical_characteristic |
| 닥터지 더모이스처 배리어.D 멀티 밤 | barrier_support_claim | true | product_claim |
| 닥터지 더모이스처 배리어.D 멀티 밤 | primary_use_role | multi_area | usage_instruction |

Each handoff record freezes:

- task / Product / Subject identifiers
- Subject semantic key
- formulation revision key
- Registry v1 definition checksum
- proposed value and evidence class
- exact source locator(s)
- canonical source capture digest(s)
- identity, market, and formulation match

`DIRECT_EVIDENCE_FOUND` is not itself a Product Fact and does not authorize Evidence ingest, review, confirmation, Recommendation activation, or public activation.

## Insufficient ten

The other ten tasks are retained as researched but unresolved:

```text
resolution = EVIDENCE_INSUFFICIENT
proposed_value = null
eligible_for_8g3 = false
false_inference_forbidden = true
```

Their absence of direct official evidence is not converted to `false`.

## Production preflight

```text
Product Fact Current         = 95
Registry v1 READY tasks      = 16
Pristine Registry v1 tasks   = 16
Registry v2 READY tasks      = 0
READY Evidence records       = 0
READY Fact instances         = 0
GPT task-claim RPC           = absent
GPT catalog-ingest RPC       = absent
```

All sixteen hosted task rows remain `RESEARCH_PENDING` with zero attempts and no source locator/digest mutation.

## Preserved boundaries

```text
Product != Product Fact Subject
Evidence != Fact
Fact != Decision Axis
Fact adoption != Recommendation activation
missing != false

Registry v1 only
Evidence ingest authorized = false
Fact instance write authorized = false
Fact confirmation authorized = false
Recommendation activation authorized = false
publicActivation = false
```

## Next gate

`V2.1-8G3-0_EVIDENCE_INGEST_CONTRACT_PREFLIGHT`

8G3-0 must validate Evidence-ingest admissibility and hosted RPC semantics for the exact six candidates before any Evidence write occurs.
