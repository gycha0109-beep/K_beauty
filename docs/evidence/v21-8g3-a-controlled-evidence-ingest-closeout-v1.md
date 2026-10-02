# V2.1-8G3-A — Controlled Evidence Ingest Closeout

## Decision

`V21_8G3_A_CONTROLLED_EVIDENCE_INGEST_PASS`

The six frozen DIRECT candidates from V2.1-8G2 were materialized in Production as Evidence only.

## Production execution

Execution time:

`2026-10-02T21:23:42.918895+09:00`

Production write authority main:

`fd721425ffcc8d1eb24c23c84a649a8ac9cdf3f0`

The repository later advanced by one unrelated Face Lab/provider-runtime commit. Integration therefore uses:

`3749dd79e95b08d8a6311f40ee6c5fabbd49d8b1`

No Product Fact / Catalog / TRUST path overlapped that drift.

The write ran in one serializable transaction. All 16 frozen Wave 1 research-task rows were locked and revalidated before mutation. Only:

`admin_ingest_product_fact_evidence_v1`

was invoked.

The GPT research-claim RPC, review-preparation RPC, confirmation-preflight RPC, and confirmation RPC were not invoked.

## Exact write envelope

```text
Sources                  0 -> 4
Bindings                 0 -> 4
Evidence                 0 -> 6

Product Fact Current     95 -> 95
target Fact Instances     0 -> 0
target Review Assignments 0 -> 0

Wave 1 pristine tasks    16 -> 16
Registry v2 Wave1 tasks   0 -> 0
GPT intake runs READY 8   0 -> 0
```

This is Evidence materialization only.

`Evidence != Fact`

## Exact Production IDs

### Sources

- beplain: `f65cd3f7-7758-441b-8099-b2e02d9c5406`
- ATOPALM: `df6119d2-279d-4560-a309-c20c386ebf7e`
- Dr.twenty category: `23fc7d07-0496-4980-ae81-fa11977afd17`
- Dr.G: `fd7ace63-3788-4f0a-9868-9aedc9d77265`

### Evidence

- beplain low_ph: `e2317293-6e43-4ab7-a723-03d794d98603`
- ATOPALM barrier_support_claim: `d8a8eae9-164b-48b8-bebf-6cd3bc1a89fc`
- ATOPALM primary_use_role: `ec40b4f2-efff-4084-be16-409cd3aef02f`
- Dr.twenty product_format: `efcb4e81-3f91-496b-9904-066a38c64460`
- Dr.G barrier_support_claim: `94b69391-8aa5-429a-ae54-123ebd9fac8a`
- Dr.G primary_use_role: `fadc53d4-7ab4-482c-a75a-2948c5307857`

Each request produced one `admin.product_fact.evidence_ingested` audit record.

## Runtime and governance invariance

Immediately before the write:

- Registry checksum matched the frozen v1 checksum.
- all 16 Wave 1 tasks were pristine,
- Product Fact Current was 95,
- target Source / Binding / Evidence were all zero,
- READY v2 tasks were zero,
- GPT intake runs for the READY 8 products were zero,
- all relevant runtime function hashes matched the frozen contract,
- the four required registry write policies were active and allowed both new/existing lineage.

Immediately after the write:

- Product Fact Current remained 95,
- no target Fact Instance existed,
- no target Review Assignment existed,
- all 16 Wave 1 tasks remained pristine,
- no Registry v2 Wave 1 task appeared,
- no GPT intake run appeared for the READY 8 products.

## Authority boundary

```text
8G3-A Evidence materialization       = COMPLETE
8G3-A research worker claim          = NOT CALLED
8G3-A review preparation             = NOT CALLED
8G3-A confirmation preflight         = NOT CALLED
8G3-A confirmation                   = NOT CALLED

Recommendation activation            = false
publicActivation                      = false
```

The ten `EVIDENCE_INSUFFICIENT` tasks remain non-Fact outcomes and were not materialized as false.

## Next gate

`V2.1-8G3-B_PRODUCT_FACT_REVIEW_PREPARATION`

8G3-B may prepare review assignments only from these six frozen Evidence records. It must not confirm Product Facts or change Product Fact Current.
