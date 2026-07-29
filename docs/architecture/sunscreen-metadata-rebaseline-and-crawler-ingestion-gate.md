# Sunscreen Metadata Rebaseline and Crawler Ingestion Gate

## Scope

This task re-baselines the 164-row Production catalog after the two-row sunscreen metadata remediation and defines how the same evidence standard must be applied to future crawler ingestion.

## Exact-head base

- PR #85 Production-remediation head: `ccd0100dcef8e267d37f498998cab85a362161dc`
- Expected Production rows: `164`
- Expected remediation rows after the preserved export timestamp: exactly `2`
- Expected sunscreen rows: `11`
- Expected UVA-complete sunscreen rows: `11`
- Expected pilling-complete sunscreen rows: `11`

## Rebaseline contract

The new baseline must be created as a new version. The preserved pre-remediation export and hashes must not be overwritten.

Required evidence:

1. Two ordered Production reads are byte-equivalent after canonical ordering.
2. Row count is `164` and unique ID count is `164`.
3. Exactly the two approved sunscreen rows were updated after the preserved export timestamp.
4. Both rows contain the approved values, source URLs, and versioned remediation evidence.
5. No sunscreen UVA or pilling metadata gap remains.
6. Product Data Sufficiency Audit completes with transport `164/164`.
7. CandidatePolicy Current Findings remains an exposure no-op.
8. Runtime and shadow visibility remain identical.
9. Canonical stabilization exposes zero active-axis candidates.
10. The post-remediation export SHA-256 and audit dataset hash are retained as a new baseline version.

The live read and export producer is temporary. Embedded public access material and the temporary workflow must be removed after evidence collection. The final branch retains only reusable local verification and architecture records.

## Crawler ingestion policy

Crawler output must never write directly into the authoritative `products` relation.

The required flow is:

`crawler raw capture -> normalized staging -> evidence validator -> quarantine or approval queue -> governed promotion -> post-write replay`

### 1. Raw capture

Every captured field must retain:

- source URL;
- source type: official, retailer, review aggregate, or derived;
- capture timestamp;
- crawler/parser version;
- raw value;
- normalized candidate value;
- evidence excerpt or structured signal reference;
- confidence and conflict state.

Raw evidence is immutable. Re-crawling creates a new capture version rather than replacing the prior evidence.

### 2. Field authority matrix

Fields are classified before ingestion.

- `official_only`: SPF, UVA grade, UV-filter declaration, regulated claims.
- `official_or_exact_retailer`: product identity, size, form, price, purchase URL.
- `review_derived`: pilling, white cast, eye sting, finish, texture.
- `computed`: normalized category and internal capability projections.

A lower-authority source cannot overwrite a higher-authority accepted value.

### 3. Review-derived thresholds

A review-derived value is promotable only when:

- the signal maps to a registered label;
- positive and negative evidence are counted separately;
- minimum evidence and conflict thresholds are satisfied;
- the exact product identity is resolved;
- the derivation rule version is stored;
- unsupported or conflicting evidence remains `unknown`, never defaulted.

A direct mapped signal such as `밀림없는 -> pilling_low` is stronger than indirect texture or absorption signals. Indirect signals alone cannot assign pilling risk.

### 4. Validation gates

Before promotion, each staged row must pass:

- identity uniqueness and exact-product resolution;
- enum and schema validation;
- required source provenance;
- field-authority validation;
- evidence threshold validation;
- conflict detection against accepted values;
- Product Data Sufficiency Audit;
- snapshot transport preservation;
- CandidatePolicy safety replay for affected categories.

Failure routes the row to quarantine with machine-readable reasons. It must not partially update Production.

### 5. Governed promotion

Promotion uses a transaction with:

- advisory lock;
- exact expected pre-state;
- allow-listed fields;
- bounded affected-row count;
- versioned evidence object;
- exact postconditions;
- rollback on any mismatch.

Bulk crawler runs are promoted as versioned batches. Each batch stores input hash, normalized hash, rule version, approved count, quarantined count, and post-write dataset hash.

### 6. Continuous regression

After every promoted batch:

- export the resulting catalog;
- calculate a new versioned dataset hash;
- diff only the approved IDs and fields;
- rerun Product Data Sufficiency, snapshot transport, CandidatePolicy safety, Current Findings, runtime/shadow parity, and build/security gates;
- retain the prior baseline for rollback and audit.

## Implementation sequence after this task

The next implementation task should add a `crawler_product_staging` contract and a pure ingestion validator before changing the existing crawler write path. Direct writes must remain disabled until the staging validator, quarantine reasons, batch manifest, and post-write replay all pass.
