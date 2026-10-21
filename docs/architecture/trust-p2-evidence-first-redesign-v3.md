# TRUST P2 v3 — evidence-first product identity and offer resolution (design / offline shadow)

Status: **PROPOSED, SHADOW ONLY** · 2026-10-21 · Supersedes the old P2 discovery-first **goal and measurement interpretation**, not its preserved archival evidence or currently governed database privileges.

## 1. Decision and root cause

**Question:** Can BEJEWELY establish reliable claims about a product without assuming the existing catalog's recorded \`name + size_ml + source_url\` is correct?

**Decision:** Treat a catalog row as an **unverified assertion**. Separately model the product family, a physical consumer unit (including capacity and pad count), an individual sale offer (single, multiple containers, refill, kit, promotional bundle), and each factual assertion's source/review status. Never assign truth to the catalog because it already has a UUID. Discovery and correctness are separate measurements.

The old P2 flow effectively searched for external confirmation of its own fixed catalog value. If a retailer offered 300ml×2 while the row was 600ml, or pads were measured both by sheets and liquid volume, it forced HOLD, sometimes for a real but differently packaged product. Source reachability/robots, parser coverage, actual mismatch and absent source provenance were reported together as **0/5 exact SKU**, preventing meaningful diagnosis and feedback. Optimizing title parsing alone cannot supply proof of a selected offer, formulation or rights.

The five historical targets are a **known-blocked diagnostic cohort**, not a representative sample for accuracy, recall or automatic coverage estimates.

## 2. Objects and noninterchangeable IDs

| Level | Question | Example | Boundary |
| --- | --- | --- | --- |
| Catalog assertion | What does our DB currently claim? | \`MLE 로션; size_ml=600\` | Input hypothesis, not a source of truth |
| Product family | Which branded product/line/revision? | ATOPALM MLE Lotion | Name evidence cannot prove a specific variant/formulation |
| Physical unit | What is in **one container**? | 300ml lotion; pad 70 sheets and 180ml liquid | \`ml\`, \`sheet\`, \`g\` each typed; never convert unrelated dimensions |
| Commercial offer | What is the selected sale configuration? | one 300ml container; 300ml×2; 300ml+200ml refill+pump | Offer may bundle same or distinct physical units; total contents is not a single container capacity |
| Evidence claim | Who observed **which** property of **which** object? | Retailer A claims \`unit.volume=300ml\` | Evidence scope, source class, observed date, source bytes or locator, rights and reviewer independence stay attached |
| Authority | What may be used downstream? | reviewed unit claim vs Product Fact confirmation | Candidate/claim corroboration never automatically writes DB, Source binding, Subject or Fact |

\`productId\` and \`intakeId\` remain references to legacy data, not newly proven family IDs. Do **not** retrofit new UUIDs or overwrite production \`size_ml\` in this design stage. Do not infer the formula from product name, ingredients from the commercial page, the selling market from a retailer URL, or reuse licenses from crawlability.

## 3. Claim-specific evidence and decisions

An incoming observation must carry:
- \`sourceClass\` (first-party, retailer/third-party, catalog, reviewer), exact locator and collection time where known;
- \`artifactStatus\` (durable reviewable bytes; metadata/digest only; external index snippet only; unavailable), source content fingerprint *only if actual bytes are available*; and a separately recorded use-rights assessment;
- \`subjectScope\` (family, physical unit, offer, optionally formulation), \`dimension\`, \`value\`, \`unit\` and the physical unit or offer it refers to; unknown relationships stay unknown;
- \`identityLinkBasis\`: exact product/variant mapping as separately reviewed evidence, never plain equality of names/sizes;
- \`reviewDecision\` with reviewer/artifact references; independent confirmation requires underlying inspectable evidence, not just two signed JSON booleans.

**Claim state model (future authority pipeline, not implemented in this shadow):**
1. \`CATALOG_ASSERTION\` — current DB row, even when it looks specific.
2. \`EXTERNAL_CANDIDATE\` — source/index claims scoped to a unit/offer. No identity authority.
3. \`CONFLICT_OR_MISSING_RELATIONSHIP\` — divergent values or possible variant/bundle; review the meaning, not simply reject the product.
4. \`REVIEWABLE_PRIMARY_EVIDENCE\` — permissible durable first-party source actually ties the claim to a selected product/offer. This is not yet Fact authority.
5. \`INDEPENDENTLY_ADJUDICATED_CLAIM\` — a reviewed, scoped assertion with source document available to adjudicators.
6. \`EXPLICITLY_RELEASED_FOR_CONSUMER\` — downstream owner applies existing product/Subject/Fact/source-use policy; never implicit in P2.

A source title and page SHA **without retained reviewable content** cannot transition from step 2 to 4/5. Retailer agreement on 300ml cannot verify the manufacturer SKU or any formulation. Multiple reviews of a missing page cannot fix missing page bytes.

**Conflict resolution:** Preserve every candidate independently. \`300ml\` vs \`600ml\` is a catalog-to-unit discrepancy **lead**, not automatic falsification of either product. Pad sheet count and pad fluid ml are distinct independent dimensions. Do not auto-select by source majority, string similarity or total-volume arithmetic; do not silently patch catalog values.

## 4. Worked cases from current five-product evidence

- **Dr.G 70ml** — historical official origin retired, zero new approved primary product evidence: identity and offer remain unverified.
- **beplain 340ml** — secondary listings of 70 sheets/180ml and 70 sheets without volume. Retain sheet count and liquid volume as independent claims; catalogue \`340ml\` remains **reconciliation required**, not overwritten to \`180ml\`.
- **ATOPALM 600ml** — secondary 300ml single and 300ml×2 offer. Model two separate offered components, never assert one \`600ml\` bottle.
- **Isntree 300ml** — two secondary listings of single 300ml offers; historical official 300ml product title candidate but no retained page bytes/selected offer proof. Current \`products.source_url\` points to a publicly indexed 300ml+200ml refill+pump promotional offer, while a separate 300ml item URL exists; log a **source URL versus commercial offer semantic mismatch**. It remains unverified at official-SKU level.
- **Torriden 50ml** — official body name mention and product-root selected size not proven; identity and offer remain unverified.

The production read-only check also found the current \`catalog_trust_intake.source_candidate_id\` empty for beplain, ATOPALM and Isntree, and no \`product_candidates.matched_product_id\` rows for those three. This is a missing traceable handoff **in those inspected tables**, not proof that no historical ingestion evidence exists anywhere.

## 5. What is implemented NOW

**No integration with production.**

- \`lib/trust/p2-evidence-first-shadow-v1.mjs\`: pure read-only, five-target structured **comparison view**. Catalog quantity is an assertion; each third-party listing emits three possible atom types: \`PHYSICAL_CONTAINER_CAPACITY\` (ml), \`PHYSICAL_CONTAINER_PAD_COUNT\` (sheet), and \`OFFER_PHYSICAL_UNIT_COUNT\` (containers). Offer and physical-unit scopes cannot be mixed. Distinct sources are retained; no invented official family/selected offer link.
- \`scripts/report-trust-p2-evidence-first-shadow.mjs\`: offline runner reading only the frozen existing real snapshots. No DB, AI or site requests.
- \`scripts/verify-trust-p2-evidence-first-shadow.mjs\`: frozen real case assertions, bad metadata/provenance negatives and **explicitly counterfactual** unit/offer controls. In-memory counterfactuals are never published as observed performance or "1/5" verified.
- Legacy P2 and P2D observation/result files, independent review ledger and legacy CI behaviors remain intact. This new shadow **does not change** \`catalog_trust_intake\`, \`product_candidates\`, \`products\`, any consumer-facing API, schema, ranking, recommendation or source authorization.
- Real results reported as three *different diagnostic counts*: catalog-vs-unit discrepancy leads, independently sourced capacity-alignment leads, catalog source-offer mismatch leads. The official exact SKU adjudication total remains **0/5**, and **real-world accuracy is \`null\`** because no independent gold labels exist.

**Not implemented:** a general website extractor, formulation matching, real primary document preservation, independent adjudication workflow for new data, database integration, legal/rights clearances, user-facing confidence scores. This is an offline **contract prototype**, not completion of the redesign.

## 6. Evaluation design — do not re-use a 0/5 stress cohort as an accuracy rate

Before any rollout, acquire a **separately collected, double-reviewed, gold-labeled** set across these strata: clear single product, multiple physical capacity variants, promotional kits/refills, pads with two units, low-information/restricted origins, and genuine ambiguous/conflicting source listings. Preserve intended mix and per-stratum denominators; do not select only cases already known to fail. Synthetic examples are only unit tests.

Evaluate independently by distinct outcome and denominator:
- **Family linking precision / false-positive family linking** over **independently adjudicated** cases.
- **Physical unit attribute precision / recall** per dimension and unit (ml, sheet, g where applicable).
- **Commercial offer composition accuracy**, including bundle/kit false merges.
- **Evidence reviewability and source lineage coverage** out of source observations; separately source permission holds.
- **Automatic decision coverage, abstention rate, manual review load**, stratified, with error types; distinguish lack of source access from parser failure.
- **Confirmed source-backed SKU and claimed formulation counts**, only after genuine first-party source and separate authority clearance; never substitute secondary corroboration.

A real-case accuracy numerator must not exist when the gold denominator is zero. Initial release gate: no synthetic case may elevate a third-party claim to an official SKU, combine unlike quantities, treat metadata digest as retained document, or write protected records. Later precision/recall thresholds must be established against the curated actual gold set **before** promotion, not guessed from five blocked samples.

## 7. Migration and decision gates

1. **Shadow only (this PR):** compare existing immutable five-brand evidence and prove typed physical-unit/offer separation. Pass canonical TRUST regression, Main Health and security checks; do not merge this with legacy P2 production results or interpret new diagnostic lead rates as product correctness.
2. **Evidence intake design:** obtain legally reusable, reviewable original source or controlled first-party product-sheet excerpts with documented provenance for an independently selected evaluation sample. Explicitly re-authorize any official-site network access; old one-shot grants have expired/been consumed. Do not scrape to build the gold set without approved scope.
3. **Catalog remediation proposal:** review the traced producer/ingestion and physical packaging semantics for disputed products; the product owner approves any production correction separately. No source relabeling to boost metrics.
4. **Gold assessment:** conduct genuinely independent review of product family, physical unit, selected offer and formulation individually; freeze stratified evaluation cohort and define a precision threshold and an abstention policy before considering integration.
5. **Integration design review:** map new claim outputs through existing TRUST Subject/Fact and source-rights authorization gates; require separate approval before schema, API, database, source binding or recommendation changes. Keep legacy reads until a measured safe replacement exists.

**Stop conditions:** insufficient reviewable evidence; inconsistent unit/offer scopes; purportedly independently reviewed records without source bytes; false-positive identity/offer linking; any change to protected outputs without approval. On these conditions abstain and show precise review reason; **do not create another F-number parser patch to make the 0/5 counter advance**.

## 8. Acceptance / non-goals

- **Accepted:** a reproducible five-case read-only shadow with atomized physical unit versus offer evidence, factual 0/5 official SKU metric, per-claim review lanes, real-world accuracy explicitly unavailable, frozen legacy provenance untouched.
- **Not accepted:** auto-correcting any of the catalog rows, pretending a 2-pack is one large bottle, treating unretained digest or human attestation metadata as official proof, silently changing recommendation eligibility or granting rights.
- **Unresolved:** what licensable first-party review artifacts can lawfully be retained, which human/automated process will create the independent ground truth, which model of formulation revisions must be canonical, and what precision threshold is operationally tolerable. These require specific decisions; this draft does not fabricate them.


## 9. 2026-10-21 real-catalog panel and independent-gold scoring gate (evaluation candidate stage)

**Completed read-only snapshot:** \`evidence/trust/p2v3-real-catalog-evaluation-panel-20261021.json\`. Exactly **20 real catalog rows** selected by a reproducible, deterministic SQL review sampling policy: exclude the original five blocked product IDs, group by \`COALESCE(category::text,'uncategorized')\`, order within each group by \`md5(id::text)\`, take the first **two rows from each of ten observed category groups**. Recorded only public catalog identity, category, unverified \`size_ml\` value and presence/absence of \`source_url\`. No wholesale export, customer data, schema changes or product updates. The 20 are **candidates, not independently proven positive/negative ground-truth examples**. The separately preserved historical five-product stress cohort is excluded from the 20, making **20 evaluation candidates + 5 independent diagnostic holds**. This small intentionally category-balanced panel is neither a population-representative random sample nor a validated SKU selection; no accuracy denominator may be inferred from the cohort size.

Snapshot facts:
- 10 catalog category buckets × 2 per bucket; **14** of the 20 have some catalog \`source_url\` present and **6** have none; **4** have \`size_ml=NULL\`. Source URL existence is not proof the URL owns the right offer or that source rights are granted.
- Categories: cleanser, moisturizer_balm, moisturizer_cream, moisturizer_gel, moisturizer_lotion_emulsion, sunscreen, toner_essence, toner_pad, treatment, uncategorized.
- Category coverage is deliberately diversified but commercial-offer classes (refill/bundle/variant) are **not yet gold-labeled**. Future evaluator must explicitly check whether they are adequately represented rather than claiming full scenario coverage.

**Executable label gate:**
- \`lib/trust/p2-v3-evaluation-gold-gate-v1.mjs\` validates the 20 real catalog records and prevents overlap with the original five. It accepts scoped claims of \`FAMILY_IDENTITY\`, \`PHYSICAL_UNIT_CAPACITY\`, \`OFFER_COMPOSITION\`, \`CATALOG_SOURCE_OFFER\`, each with their own enumerated decisions (no implicit variants or ml conversions).
- A scored gold claim requires a nonempty, byte-readable, sha256-matching reviewable **source excerpt JSON**, and **two different blinded reviewers' individual JSON** files that independently agree on the dimension and decision. Every review file must be separately digest-checked and point to the same source excerpt digest. This *structurally checks provenance documents*, but **cannot itself verify external truth, licensing, reviewer employment independence or first-party authenticity**. Those are real operational review obligations.
- \`evidence/trust/p2v3-independent-gold-ledger-v1.json\` is committed **empty** because there are *no real adjudicated labels yet*. \`scripts/report-trust-p2-v3-gold-evaluation.mjs\` prints zero scorable labels, 20 remaining unlabeled candidates and **\`claimAccuracyOnAttempted=null\`, \`coverageOnGold=null\`**. It does not quietly count synthetic scenarios as real.
- Model predictions may be supplied only as a separate input. For already independently labeled dimensions, predicted \`ABSTAIN\` or no prediction is an abstention. Accuracy on attempted claims = correct/attempted (null if zero attempts); coverage on gold = attempted/scorable gold claims (null if no gold). This is **claim-dimension agreement**, not formulation correctness, official exact SKU, product recommendation accuracy or population generalization. Other dimensions stay missing/unreviewed.
- \`scripts/verify-trust-p2-v3-gold-evaluation.mjs\` runs real unlabeled panel invariants, privacy/authority holds, unknown SKU/category drift tests, source/reviewer digest mismatch, same-reviewer, catalog-to-stress leakage, and **clearly synthetic in-memory** successful/incorrect/abstained scoring checks. It is imported by canonical TRUST P2D; no synthetic evidence artifacts are persisted. No evidence fake link, missing referenced bytes or HTML fingerprint alone may create a review-ready observation.

**Next real operations (not auto-executed):** define which first-party excerpts or packaging evidence may be lawfully retained and independently checked for these 20 rows, then collect real source bytes (new consent/authorization where required), obtain blinded review for a prioritized subset, adjudicate disagreements, and finally calculate *real* label coverage/error by category and offer class. Intakes lacking source-candidate traceability must not be silently labeled as verified. Define release thresholds against real labels **before** deploying changes to catalog or TRUST Fact authority.

**Safety:** No authorized official-site network requests, DB writes, source bindings, Product Fact/Subject writes, AI usage, app surface/API changes, new external scrape, schema or production integration. The existing frozen old five-brand 0/5 exact-SKU observation remains untouched. This panel does not alter or reinterpret it.


## 10. 2026-10-21 exact two-product legacy-source triage: Sidmool / Beauty of Joseon

**Real read-only audit**: \`evidence/trust/p2v3-two-primary-legacy-evidence-triage-20261021.json\` records observations already held in \`public.trust_source_observations\`, \`trust_evidence_candidates\`, \`product_evidence_sources\` and source-verification profile metadata, with **no new first-party site requests** or database mutations. \`evidence/trust/\` repository directory was also checked for retained originals.

1. **SIDMOOL Physical Daily Sunmilk** — catalog ID \`a6994fcd-302f-4e63-acbe-91a3f17a5a65\`, \`size_ml=NULL\`. Existing official-labelled product page locator \`https://www.sidmool.com/shop/shopdetail.html?branduid=76777\`. One historical source record explicitly labels its \`75ml\` amount **\`size_semantics=presentation_only\`**. Three older TRUST observation rows contain brief excerpts reporting \`SPF20\`, \`PA++\`, \`무기자차\`, one also mentioning **75ml**. These are *actual legacy records*, not independently verified source content or proof of exact selected purchase option.
2. **Beauty of Joseon 맑은쌀 선크림** — catalog ID \`25b2763f-529f-4b2e-a436-2e0776279c55\`, \`size_ml=50\`, official-labelled locator \`https://beautyofjoseon.com/products/relief-sun-rice-probiotics\`. One historical TRUST observation supports a prior UV-filter classification claim; other source metadata asserts a name transition **\`Relief Sun : Rice + Probiotics\` → \`Relief Sun : Rice + Niacinamide\`** and says its formula is unchanged. The name/formula continuity is **only archived metadata to be independently reviewed**. Never promote historical same-formula assertions, a 50ml catalog entry, or an unchanged URL to verified identity.
3. The **four** archived TRUST observations (3+1) use digest basis \`frozen-first-party-observation-v1-not-live-page-bytes\`, rather than a digest of available original page content. The seven matching source records have **zero** associated source verification profiles and source verification runs, and **none** provides an \`external_snapshot_reference\`. Original official page HTML or inspectable manufacturer photographs were **not found in the inspected storage paths and SQL records**; this does not prove that no originals exist anywhere. Short stored excerpts are claim metadata, not authenticated source bytes.
4. **Repair to the P2 v3 gold evaluation contract (still offline):** \`PHYSICAL_UNIT_CAPACITY_ML\` accepts a strictly positive numeric value on a licensed independently reviewable source, *even when the legacy catalog capacity is NULL*. It compares **one physical container**, not an offer's total volume. The older \`PHYSICAL_UNIT_CAPACITY\` labels \`CATALOG_MATCH\` / \`CATALOG_CONFLICT\` are explicitly **forbidden** when catalog \`size_ml\` is NULL. This removes a real schema-level blocker for evaluating a Sidmool **75ml source-reported candidate** without inventing a catalog size. In-memory synthetic 75ml reviewer records test the path but are **never published as real labels**.
5. **Next human/source work, separately authorized:** First secure lawful reviewable manufacturer product/label/offer evidence for the two precise locators, with permission and observed-at provenance (including robots/TOS/site-access approval if live sites are contacted). For Sidmool check exact physical **75ml** container, title/product form, purchase option and alias to catalog; for Beauty of Joseon check former/new name *and any formula/revision continuity*, physical **50ml** variant and selected offer. Two truly independent blinded reviewers must cite the same durable artifact and independently decide the specific claim. No automatic migration/product edit/source binding/Subject/Fact right is granted by this document.

**Current outcomes**: real independently scored gold claims **0/20 candidates**; verified official exact SKU **0/5 historical frozen**. Archived 3+1 source claim excerpts are *review leads*, not 4 new independent gold labels. All live network requests, DB writes, AI calls, source promotions and production API changes **0**.
