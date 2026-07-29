# Sunscreen Metadata Rebaseline and Crawler Ingestion Gate

## Scope

This task re-baselines the 164-row Production catalog after the two-row sunscreen metadata remediation and defines the mandatory ingestion boundary for future crawler data.

## Base and boundaries

- PR #85 Production-remediation head: `ccd0100dcef8e267d37f498998cab85a362161dc`
- Production rows changed by remediation: exactly `2`
- Production runtime, CandidatePolicy, GoalPolicy, schema, migration, crawler write path, runtime flags, and deployment configuration changed by this task: none
- The preserved pre-remediation export and hashes remain immutable historical evidence.

## Rebaseline result

Two ordered read-only Production catalog reads were identical.

Catalog identity:

- rows: `164`
- unique IDs: `164`
- products changed after the preserved export timestamp: `2`
- approved changed products: `2`
- unexpected changed products: `0`
- exact approved field diff: `8` fields across the two remediation rows

Sunscreen completeness:

- sunscreen rows: `11`
- UVA complete: `11/11`
- pilling complete: `11/11`
- protection ready: `11/11`
- preference ready: `11/11`

Product Data Sufficiency:

- status: `audit_complete`
- snapshot transport: `164/164`
- gaps: critical `0`, important `0`, quality `0`

Versioned post-remediation baseline:

- normalized raw export SHA-256: `59fe10c81c713fa950bfb187bfb5107c5b01d69bad489f85414a7d26c7558422`
- Product Data Sufficiency dataset hash: `6c74785e7b7163a70fa2d47526ba4845a062bbd70486b01485da7cd4b5a1e978`
- catalog snapshot hash: `0c015b15509aacee24f479610fb958404fdf68c03f1cb1f2c33f5e0a61ec64da`
- audit semantic hash: `ad4ac07d3a85361adbb69420643730964fdb231c542f785e374a3f1de73a4527`

The old preserved dataset hash `f346d90ed722432dd1e1367a50939954ec5030abb9a7ea72fdef61bb1dc93e2f` was not overwritten or reinterpreted as the new baseline.

## Actual catalog policy replay

The post-remediation 164-row Production catalog was replayed through the actual CandidatePolicy runtime and shadow path.

- scenarios: `11`
- Current Findings unexpected exposure drift: `0`
- runtime/shadow divergence: `0`
- sunscreen protection-complete: `11/11`
- sunscreen visible under neutral UV context: `11/11`
- stabilization active-axis source candidates: `86`
- stabilization active-axis visible candidates: `0`
- assertions: `103`
- semantic hash: `e2b86c08fdfc1a84e8b9508c6eb1f02094a6c112549e1cab3bcdcb2ef3426e7c`

Final policy verdict:

`SUNSCREEN_METADATA_REMEDIATION_REBASELINED_NO_REGRESSION`

## Regression verification

Preview execution at verification commit `f36ec3d5d92a84c2f07befe4c816f1cbc31771df` completed:

- Production build: PASS
- preparation steps: `17/17` PASS
- security exact manifest including two temporary rebaseline verifiers: `58/58` PASS
- SEC-11 site-origin normalization: PASS
- live catalog identity/audit rebaseline: PASS
- actual post-remediation CandidatePolicy replay: PASS

The verification exposed one stale test-only readiness assertion. The producer contract correctly distinguishes:

- actual evidence unavailable + pure replay source unavailable -> `blocked_by_source_unavailability`;
- actual evidence unavailable + pure replay source available -> `needs_more_evidence_before_design`.

The verifier now validates both branches from actual evidence state instead of hard-coding one result. Production evaluator logic was not changed.

All temporary live-read code, embedded public access material, Security-manifest additions, and Preview postbuild hooks were removed after evidence collection.

## Offline exact gate

The retained network-free verifier is:

`scripts/verify-sunscreen-metadata-rebaseline-local.mjs`

It validates the normalized export hash, dataset hash, row identity, two remediation evidence rows, sunscreen completeness, Product Data Sufficiency, and snapshot transport without DB, HTTP, credentials, or environment variables.

```powershell
node scripts/verify-sunscreen-metadata-rebaseline-local.mjs --input "_local_data/products-raw-export-post-sunscreen-remediation.json"
```

Machine-readable result:

`tmp/sunscreen-metadata-rebaseline-local.json`

## Crawler ingestion policy

Crawler output must never write directly into the authoritative `public.products` relation.

Required flow:

`crawler raw capture -> normalized staging -> evidence validator -> quarantine or approval queue -> governed promotion -> post-write replay`

### 1. Immutable raw capture

Every captured field must retain:

- source URL and source type;
- capture timestamp;
- crawler and parser version;
- raw value;
- normalized candidate value;
- evidence excerpt or structured signal reference;
- confidence and conflict state.

Re-crawling creates a new capture version. It does not overwrite prior raw evidence.

### 2. Field authority matrix

- `official_only`: SPF, UVA grade, UV-filter declaration, regulated claims.
- `official_or_exact_retailer`: product identity, size, form, price, purchase URL.
- `review_derived`: pilling, white cast, eye sting, finish, texture.
- `computed`: normalized category and internal capability projections.

A lower-authority source cannot overwrite a higher-authority accepted value.

### 3. Review-derived evidence rules

A review-derived value is promotable only when:

- the exact product identity is resolved;
- the signal maps to a registered label;
- positive and negative evidence are counted separately;
- minimum evidence and conflict thresholds pass;
- the derivation rule version is stored;
- unsupported or conflicting evidence remains `unknown`.

Direct mapped evidence such as `밀림없는 -> pilling_low` is stronger than indirect texture or absorption signals. Indirect signals alone cannot assign pilling risk.

### 4. Validation and quarantine

Every staged row must pass:

- identity uniqueness and exact-product resolution;
- enum and schema validation;
- provenance and field-authority validation;
- evidence threshold and conflict validation;
- Product Data Sufficiency Audit;
- snapshot transport preservation;
- affected-category CandidatePolicy replay.

A failure produces a machine-readable quarantine reason. It cannot partially update Production.

### 5. Governed promotion

Promotion must use one transaction with:

- advisory lock;
- exact expected pre-state;
- allow-listed fields;
- bounded affected-row count;
- versioned evidence object;
- exact postconditions;
- rollback on any mismatch.

Each crawler batch must retain:

- raw input hash;
- normalized input hash;
- crawler/parser/rule versions;
- approved and quarantined counts;
- approved IDs and fields;
- post-write export and dataset hashes.

### 6. Continuous regression

After every promoted batch:

- export the resulting catalog as a new version;
- compare only approved IDs and allow-listed fields;
- rerun Product Data Sufficiency and snapshot transport;
- rerun CandidatePolicy safety, Current Findings, and runtime/shadow parity;
- rerun security, syntax, and Production build gates;
- retain the prior baseline for rollback and audit.

## Next implementation task

Implement **Crawler Product Staging & Evidence Validator** before changing any crawler write path.

Required first delivery:

- `crawler_product_staging` contract;
- field-authority registry;
- evidence-rule registry;
- pure validator;
- machine-readable quarantine reasons;
- versioned batch manifest;
- governed promotion plan;
- post-write replay contract.

Direct crawler writes remain disabled until all of these gates pass.
