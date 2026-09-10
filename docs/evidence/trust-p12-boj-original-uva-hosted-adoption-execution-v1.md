# TRUST-P12 — Beauty of Joseon Original Relief Sun UVA Hosted Adoption Execution v1

## Status

`PRODUCTION_CONFIRMED`

The original Beauty of Joseon Relief Sun Product Fact subject now has both governed sunscreen facts current:

- `spf_value = SPF50+` — pre-existing
- `uva_label = PA++++` — confirmed by TRUST-P12 Phase B

## Authority chain

- P12 plan merge: `90e6f6c35efe553e91a4cee068e4138ce652f10c`
- P12A authority correction merge: `4bc0b36fd831d91508a097b9b196ffd2ce1050cb`
- execution capture main: `4bc0b36fd831d91508a097b9b196ffd2ce1050cb`
- Production: `bygrczggxfuisupcevaz`
- Registry: `product-fact-registry-cross-category-v1`

P12A was applied **before the first Product Fact write** because fresh Production readback showed the existing Subject is market-unscoped (`market_applicability = null`). The UVA fact/evidence itself remains scoped to `GLOBAL`.

## Controlled execution

1. Evidence ingest: `trust-p12-boj-uva-ingest-v1`
2. Review `under_review`: `trust-p12-boj-uva-review-under-v1`
3. Review `ready_for_confirm`: `trust-p12-boj-uva-review-ready-v1`
4. Fresh confirmation preflight: `ready`
5. Confirmation: `trust-p12-boj-uva-confirm-20260911-v1`

No direct Product Fact table DML and no Subject registration were performed.

## Runtime lineage

- product: `25b2763f-529f-4b2e-a436-2e0776279c55`
- subject: `0865df81-9cd9-438c-8167-380b932c1dc0`
- proposition: `ea34c1e334b846df861b198bd658c3ce1a98d422433e66d0b3e3d7c584915f01`
- source: `60a55f19-a71d-4063-9ea5-13775193c940`
- binding: `79ae3693-8f5b-4dbc-9377-a0ded8313881`
- evidence: `34397e1d-1ac3-4a80-90cf-969cfca1a28d`
- assignment: `43fcd6f1-7aa2-4832-8259-5bff7415dde1`
- confirmation: `1068c679-0487-44e7-8429-9bd82a90c75b`
- fact instance: `61e30420-5064-4622-bb82-a2a6aeefdcbe`

## Digests

- source observation: `e09425390b1fbf0e9c4eb4c4a3d1b2854f25d6a7de82a99f57a56a575184e7c9`
- canonical evidence: `95920464b02a26fa8e31ab057fbbc2157cbb761f0a7eed91d8db7df8121cdb69`
- fusion input: `fc4ee6bacd655607e4bc775ca0dea8ff7e9508e0dbbdd8c78ee8e2acb6bcfe98`
- preflight payload: `9519f05a0e8374dfe113b6e9560bb44e5356e8437628daa39ecb1f27a63ea76f`
- preflight prestate: `14661fa82be98d4128b8061cad08c9eb5e100e031e0edd12c302f234223d790a`
- confirmation result: `b787fb3ec5010fa3664acc5d01d67c50ec3b4581a45baae5680f79bb182e13b0`
- execution content: `fdf9ae0669d8d8b0aabcb4e0a4ed20e34cf0c8840464f60207c5ed59ef4a758c`

## Production delta

Prestate:

`Subjects 20 / Sources 20 / Bindings 20 / Evidence 48 / Fact Instances 48 / Evidence Links 48 / Review Assignments 48 / Confirmations 48 / Current 48`

Poststate:

`Subjects 20 / Sources 21 / Bindings 21 / Evidence 49 / Fact Instances 49 / Evidence Links 49 / Review Assignments 49 / Confirmations 49 / Current 49`

Target poststate: `Subject 1 / SPF Current 1 / UVA Current 1`.

## Boundary

- direct Product Fact DML: false
- controlled RPC only: true
- Subject registration: false
- schema change: false
- RPC change: false
- Registry change: false
- recommendation/ranking change: false

`TRUST-P12 Phase B = CONFIRMED`
