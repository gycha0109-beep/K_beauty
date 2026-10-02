# V2.1-8G3-0-R1 — GPT Research Worker Coexistence Closeout

## Decision

`V21_8G3_0_R1_GPT_WORKER_COEXISTENCE_PASS`

After the 8G3-0 zero-write contract was merged, Production exposed the GPT catalog intake and product-scoped research-claim RPCs from migration `20261001183000`.

This is a runtime-state drift from the earlier 8G3-0 preflight snapshot, so coexistence was rechecked before allowing 8G3-A.

## Result

The automatic GPT pipeline cannot claim the frozen Wave 1 tasks through its normal path.

The orchestrator:

1. calls `ingest_gpt_catalog_product_v1`,
2. accepts the returned `product_id` only when state is exactly `TRUST_RESEARCH_READY`,
3. passes that same returned ID to `claim_gpt_catalog_research_tasks_v1`.

The ingest RPC blocks an already-normalized catalog Product as `BLOCKED_DUPLICATE` before Product creation. Therefore the normal automated path does not advance an existing Wave 1 Product to the claim call.

The claim RPC itself is also product-scoped; it contains no cross-product sweep.

## Privileged manual boundary

A direct **service-role** invocation of the claim RPC with an existing Wave 1 Product ID could claim those tasks.

That is not reachable from the normal GPT ingest orchestrator, but it is a privileged operational risk. Therefore 8G3-A must:

- re-read all 16 frozen task rows immediately before Evidence ingest,
- require all 16 to remain `RESEARCH_PENDING / attempt_count=0 / last_research_at=NULL`,
- never call `claim_gpt_catalog_research_tasks_v1`,
- execute only the six frozen `admin_ingest_product_fact_evidence_v1` payloads.

## Production readback

```text
GPT intake runs for READY 8 = 0
Registry v1 tasks total      = 16
Pristine Registry v1 tasks   = 16
max task updated_at          = 2026-10-02 15:43:44.136807+09

Product Fact Current         = 95
READY Evidence               = 0
READY Fact Instances         = 0
target Sources               = 0
target Bindings              = 0
target Evidence              = 0
probe audit residue          = 0
```

The frozen tasks have therefore not been touched by the newly available GPT worker RPCs.

## Authority boundary

```text
8G3-A Evidence ingest                = authorized
8G3-A research worker claim          = forbidden
review preparation                   = not authorized
confirmation preflight               = not authorized
confirmation                         = not authorized
Recommendation activation            = false
publicActivation                      = false
```

## Next gate

`V2.1-8G3-A_CONTROLLED_EVIDENCE_INGEST`
