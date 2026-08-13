# V2.1-8D — Source Gap Recovery Wave 1

> Repository-only evidence freeze / Fusion re-evaluation / future materialization dry-run. Hosted Product Fact writes = 0.

## Immutable authority

- source main: `118152c40d76d2956d85c5bbc56ecdbe725b5ee7`
- frozen V2.1-2 materialization: `b2f19878f00f53d9a60dad0b1515fff1f566449e6a531825e712dfa2e3f19bb2`
- frozen corpus/mapping/gap: `47457c0242451a35305fd8eceba0ebb7e210eb9ee2e73134ccf41696d18e517d` / `c746c5d02f654ed7f0a8e8385611ac65ca30b9c4648fa4c6454ac863e7c9314f` / `5a4580d76cca62d90a3ac306744054c507a6d5e45b0b91a41dffb3b754980215`
- M1 subject: `d600446336216d911d4aada62502fcbcc5b800abc671094b27fa5625f241d810`
- M1 formulation: `pilot-freeze-eaa1452f7abd275fb4d096089a03e4b2`
- M1 selected_market: `KR`; subject market_applicability: `null`
- R1 incorrect prompt authority: `RESOLVED_AS_PROMPT_AUTHORITY_ERROR`

## M1 scope adjudication

- result: `VALID_NARROWER_FACT_SCOPE`
- recovered fact/evidence market: `KR`
- binding: `exact_subject_match` / `narrower`
- historical Subject identity mutation required: `false`

The controlled-write contract stores fact scope independently and rejects a market mismatch only when the Subject itself has a non-null market applicability. Resolved evidence accepts an exact/equivalent Subject binding with an `equivalent` or `narrower` scope relation. Therefore the historical M1 Subject remains unchanged while the recovered facts remain KR-scoped.

## Recovery result

- M1 RECOVERED_SUPPORTED: 2 propositions
- M3 VARIANT_SCOPE_CONFLICT: 0 propositions
- P1 FORMULATION_SCOPE_CONFLICT: 0 propositions
- registry gap: `subjective_soothing_observation` only; no Registry expansion
- `primary_use_role=multi_area`: `00bb4342dc4f76621a6961b928f39910aa311d5fa3e9b5f01d27fbc385a2c3c4`
- `barrier_support_claim=true`: `bbf0b595d0b81eae256ffa6b06065430e36c528f9d20cdd14c575c992c2be2fd`
- exact six-slot counts: 2 recovered / 2 variant conflict / 2 formulation conflict

## Future materialization boundary

- candidate: M1 only, 2 propositions / 1 product
- future Subject: historical M1 identity, +1 only in a separate authorized stage
- future source/binding: source insert +1 if the R2 read-only prestate remains unchanged; binding `exact_subject_match/narrower`
- actual adopted products / Current facts remain 8 / 23
- future V2.1-8E projection only: 9 / 25
- evidence SHA-256: `587afd259b12b93f11bb0ebae65370e12d07cf2b623c35c962ba4cf1ee72c3bc`
- materialization SHA-256: `9324d64492332da47bf118aa21ec3e9177c98f821b4c5f0556b8c3a9e8c55735`
- Hosted writes: 0

No V2.1-8E execution, P2 identity work, Registry mutation, production scoring change, or recommendation activation.
