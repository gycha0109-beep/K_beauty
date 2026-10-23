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


## 11. 2026-10-21 two-origin revalidation approval — actual indexed official offer evidence and rights HOLD

User explicitly approved a **new limited read-only check of two precise official origins** after #1378. This approval authorizes only the operator's request; it is **not manufacturer permission to reproduce pages for commercial use**, and does not supersede robots restrictions.

- **Robots/network:** Requests to `https://www.sidmool.com/robots.txt` and `https://beautyofjoseon.com/robots.txt` were unavailable through the current web retrieval interface; isolated local HTTPS also failed DNS resolution. As a result **no successful direct robots-first site probe and no new live direct product GET were performed**. No artificial `robotsAllowed=true` status, access-token workaround, redirect override or request re-authorization was created. Search-engine indexed first-party page results were used **only as leads/observations**.
- **Sidmool**: The indexed official product page `https://www.sidmool.com/shop/shopdetail.html?branduid=76777` gives `무기자차 데일리 썬밀크`, `75ml` *per unit*, `SPF20`, `PA++` and a distinct 2-item discount announcement. The purchase-option widget is only exposed as `[Select]` in the available cache, so **exact selected commercial SKU is not independently inspectable**. Do not turn buying two discounted bottles into an inherent 150ml product variant. The legacy DB capacity is NULL; it must not be silently set to 75.
- **Beauty of Joseon**: Indexed first-party global pages at `https://beautyofjoseon.com/products/relief-sun-rice-probiotics?country=PH&currency=PHP` and its UK 1-pack locale counterpart display **50ml per unit**, explicit `1-Pack` and `2-Pack` commercial variants, and the renamed presentation `Relief Sun : Rice + Niacinamide`. The official FAQ **asserts** that earlier `Rice + Probiotics` was renamed and the formula stayed the same. This is manufacturer claim, **not independent composition/formulation laboratory proof**. The bare historical source locator returned 404 through direct retrieval while indexed locale-parameterized versions existed, so exact current canonical/variant routing is **not established**. Do not map Shopify variant IDs or 2-pack to a single 100ml container without separately reviewable selected-option evidence.
- **Terms of use:** The first-party <https://beautyofjoseon.com/pages/terms-and-conditions> Article 23 explicitly restricts commercial duplication/reuse of site information without the company's prior permission. The user's approval cannot confer that permission. Sidmool's equivalent legal authorization could not be verified. **No raw page content, brand images, complete ingredient passages, source HTML or third-party-copyright excerpts are committed.**
- **Frozen observation:** `evidence/trust/p2v3-two-brand-public-index-offer-audit-20261021.json` carries only minimal typed claim summaries, provenance URLs/date/access limitations, and status. The source channel is **search-indexed first-party page**, not a newly fetched or lawfully archived manufacturer artifact. `scripts/verify-trust-p2-v3-two-brand-public-index-offer.mjs` verifies 75ml/50ml physical-unit semantics and distinct offers, rejects false SKU/gold elevation and is imported into canonical TRUST P2 verification.

**Quantifiable status**: two public indexed first-party identity/capacity **review leads** (2/2), one explicit indexed 1/2-pack option family (Beauty of Joseon), no confirmed direct source captures, no legal reuse clearance, no two-independent-reviewer gold, **0/20 evaluation gold** and historical **0/5 exact official SKU**. Both source licensing and actual selected-option provenance remain HOLD. Existing Product Fact/Subject/source rights, ranking/recommendation and DB stay unchanged. Progress requires *manufacturer-permitted source evidence* or a source review/inspection workflow approved under applicable site policies—not another name parser PR.


## 12. 2026-10-21 owner-approved live catalog fact updates — **this supersedes prior excessive HOLD for ordinary fields**

**Scope separation:** `products.name`, `products.size_ml`, and `products.source_url` may be updated from publicly displayed product facts with a citation/link under **one operator/owner's approval**. It does **not** require manufacturer permission merely to cite a URL or record factual volume; no original HTML/archive/photo copy or two blind reviewers are necessary. **Two independent adjudicators are only an optional standard for a separate accuracy/gold research benchmark**, never a blocker for ordinary source-backed metadata corrections. Site copying, source crawl throughput, and copyrighted asset reuse are separate questions. Older paragraphs asserting commercial reuse license or two independent reviewers as prerequisites for *basic catalog size/link updates* are superseded here.

**Actual production Supabase corrections (verified with `UPDATE ... RETURNING` followed by `SELECT`):** `evidence/trust/p2d-five-catalog-owner-sourced-corrections-20261021.json`.

- Beplain `9b81da7a`: `340ml → 180ml` with official source `https://www.beplain.co.kr/m/product_detail.html?brand_uid=10739162`; official product disclosure states **70 sheets / 180ml**, currently marketed with **+10 bonus sheets**. Kept prior Hwahae URL in `hwahae_url`; bonus sheets do not increase bottle size.
- ATOPALM `bd98f785`: `600ml → 300ml`; manufacturer publicly differentiates `300ml` single and `300ml × 2` bundle. Official product `2184` linked. Prior `unit_price_per_10ml=1016.67` was based on total two-bottle volume and has been set to `NULL` to avoid a misleading derived number. **Price fields may still represent a historical third-party promotional bundle**; price reconciliation is a separate actual outstanding issue.
- Isntree `fe5f7e61`: correct `300ml` unchanged, switched `source_url` from Hwahae promotional listing to official product `56`, retained old `hwahae_url`.
- Torriden `31015762`: correct `50ml` unchanged, official **single-bottle** product `goodsNo=58` linked, distinct from `goodsNo=76` two-bottle set.
- Dr.G **EX** `4cbd41f3`: correct `70ml` unchanged and exact-EX third-party `https://www.hwahae.co.kr/products/2195805` recorded in both `source_url` and `hwahae_url`. Found current official 70ml **non-EX** siblings, **not** evidence of identical EX version; *do not* fake an official source link or official exact-SKU confirmation.

**Two other previously discussed rows:** SIDMOOL `a6994fcd` remains **75ml with official brand source and original Hwahae link**; Beauty of Joseon `25b2763f` remains **50ml** and gained the previously missing first-party locale-linked `source_url` in this follow-up.

**What 5/5 means:** All five named diagnostic **catalog rows now have a cited source URL** and the two plain unit-volume errors were corrected. **Four of five** have an explicit direct manufacturer product locator; the fifth has the exact named secondary retail listing. It does **not** mean five independently confirmed first-party selected commercial SKUs, any model accuracy score, unchanged formulation, or five distinct reviewer adjudications. No migration, Fact/Subject authority, ranking admission or wholesale product update took place.

**Verification:** `scripts/verify-trust-p2d-five-catalog-owner-corrections.mjs` is included in canonical TRUST P2D verification; it guards count, source type, corrected sizes, preserved distinct offers and no fabricated exact-offer SKU/Fact authority. Actual production SQL is a separately executed, verified owner-authorized field update and **not** a side effect of that offline script.


## 13. 2026-10-21 follow-up: single-bottle official price and Dr.G EX exact family

As-of **2026-10-21**, the ATOPALM manufacturer site explicitly listed the **MLE Lotion 300ml single** at **₩34,500** (product `2184`), with separate **300ml ×2** offer at **₩64,500** (product `2182`). The prior `products.price_min=price_max=30000` did not match the official *single-bottle* page linked in this catalog row. The owner-approved exact-ID SQL update changed **`price_min=price_max=34500` and `unit_price_per_10ml=1150`**, keeping `size_ml=300`, `buy_link` and manufacturer `source_url`. `UPDATE RETURNING` confirmed the change. These are **dated manufacturer-store page prices**; do not infer lowest cross-merchant price, final checkout coupon, or in-stock status. The product has no record in `public.product_offers` as of this check; no offer ledger was fabricated.

The Dr.G `Red Blemish Clear Soothing Cream EX` **70ml** family is independently corroborated by two **brand-operated / labelled '본사직영'** SSG.COM retail listing pages, one `단지형` and one `튜브형`. The publicly indexed manufacturer's own social announcement additionally describes the EX 70ml **tube** launch. However the catalog row has **no selected jar/tube package designation**. Therefore retain its exact-name Hwahae `source_url` and leave exact per-offer SKU unresolved; the newly identified SSG sources are separately logged in `evidence/trust/p2d-atopalm-price-drg-ex-owner-followup-20261021.json`. Do not conflate the EX family with the prior non-EX Dr.G 70ml or assert that the SSG seller listing is a first-party manufacturer **domain**.

Ordinary catalog facts remain **single-owner review + cited source URL**. Separate physical package/offer handling remains scoped, and no second reviewer, source-page replication, Product Fact/Subject authority mutation, new product/offer, Recommendation or application API modification is triggered here.

The historical five-row correction artifact and the independent accuracy benchmark are intentionally not rewritten: this is a **subsequent observed price update and variant-source confirmation**, verified by the same canonical owner-facts regression test.


## 14. 2026-10-23 제품·처방·규격·판매 구성 분리 실행 로드맵 (개정안)

**상태: 설계 반영 완료 / 구현 미착수 / 운영 권한 변경 미승인.** 이 섹션이 앞으로의 **단계 및 완료 조건에 대한 기준**이다. 기존 P2 v3의 evidence-first 원칙과 PF-1의 frozen Subject 계약을 변경하거나 재승인 없이 무효화하지 않는다. 클렌저 10개 사례는 별도 [클렌저 사전심사 계획](cleanser-initial-admission-preflight-v1.md)의 적용 대상이다.

### 14.1 결정: 네 가지 신원을 분리한다

| 개념 | 의미 | 현재 책임/후보 | 금지 |
| --- | --- | --- | --- |
| 기본 제품/카탈로그 앵커 | 브랜드·제품 계열을 가리키는 기존 상품 행 | 기존 \`products.id\` 유지 | 기존 카탈로그 UUID가 곧 제조사 제품/처방 인증이라는 가정 |
| 처방·의미상 변형 | Product Fact 진위가 같은 제품 상태 | 기존 \`product_fact_subjects\`, immutable \`formulation_revision_key\` | 용량·판매 가격만으로 Subject 생성/병합 |
| 실물 규격(presentation) | 단일 용기 용량·단위·포장 형태·리필 여부 | 신규 \`product_presentations\` **후보**와 기존 source binding의 \`presentation_metadata\` | 150ml 두 개를 300ml 단일 용기로 환산 |
| 판매 상품(offer) | 판매처, 한 시점의 상품 구성·단가·링크·재고 | 기존 \`product_offers\`, \`seller_listing_observations\` 및 \`offer_components\` **후보** | 기획 세트 가격을 본품 단품 가격/피부 분석 근거로 사용 |

- PF-1의 D1/D5/D9/D11을 우선한다. \`product_fact_subjects\`가 처방의 단일 정본이며 **새 formulation 엔터티를 만들지 않는다**. 120ml와 150ml는 동일 처방이 검증되면 한 Subject에, 리뉴얼·성분 차이가 검증되면 서로 다른 Subject에 연결된다.
- \`products\`의 \`size_ml\`, \`price_min/max\`, \`buy_link\`를 곧바로 삭제/재정의하지 않는다. 기존 상품/추천/관리자 소비자는 유지하고, 새 표현은 shadow read-model에서 시험한다.
- 현행 \`products(normalized_brand,normalized_name)\` 유니크 제약과 \`product_offers(seller_key,listing_id/listing_url)\` 유니크 제약은 확인됐다. 판매 구성별로 \`products\`를 새로 INSERT해서 제약을 우회하지 않는다. 같은 외부 listing ID가 구성을 바꾸는 사례도 **시간별 관측**으로 보존한다.
- 현재 \`product_evidence_source_subject_bindings.presentation_metadata\`와 \`equivalent_presentation_match\`가 있으므로 \`presentation_formulation_links\`라는 제3의 정본 테이블은 **기본 채택하지 않는다**. 먼저 현행 승인·이력·복수 규격 참조 요구를 충족하는지 검토한다. 부족하다고 검증될 때만 별도 매핑 또는 버전드 연관 테이블을 설계 승인받는다.

### 14.2 단계별 실행 계획과 선행조건

| 단계 | 상태 | 변경 범위 및 산출물 | 진행/완료 조건 |
| --- | --- | --- | --- |
| **R0. 현행 계약/카탈로그 감사** | **읽기 전용 조사 완료** | \`products\`/Subject/Source Binding/\`product_offers\` 현황, P2 v3와 PF-1 규칙 차이, 기존 클렌저 10건의 120↔150ml·170↔220ml 불일치 사례 정리 | 현재 제약과 원본 소유자·데이터 출처 기록, 기존 ID 보존 결정 |
| **R1. 규격·세트 표준 계약** | **설계 예정** | \`product_presentations\`(단일 실물 용기/단위), \`offer_components\`(본품/증정품/리필/동일제품 추가수량), 기존 offer/Subject 연계 계약 정의. 단위·수량·유효시점·증거·미확인 상태 포함. 필요 시에만 매핑 테이블 추가 검토 | 120/150ml, g/ml, 패드 수/액량, 1+1, 본품+세럼 10ml, 리뉴얼, 리테일 SKU 이동의 정규화·무중복·재현 테스트 통과. **DDL 전 DB/RLS/API 영향·승인 별도** |
| **R2. 관측·증거 보존과 shadow 판정기** | **미착수** | 기존 읽기 경로를 유지하는 readonly adapter; 판매처별 시점 스냅샷/가격/구성품 원본 추적; family/unit/offer/formulation 구분과 \`SAME_FORMULA_CONFIRMED\` / \`DIFFERENT_FORMULA_CONFIRMED\` / \`FORMULA_UNRESOLVED\` 분류 | 출처 누락·서로 다른 SKU·숫자 단위 충돌·증정품 혼입시 자동 동일 처방 판정 0건. 공식몰 네트워크 접근·원본 보존은 사이트 사용 권리와 별도 승인 필요 |
| **R3. TRUST Subject/Source 적용** | **미착수·보호 단계** | 기존 PF-1 Source→Subject binding \`exact_subject_match\`·\`equivalent_presentation_match\`와 제형 lineage를 재사용. 공식 근거로 확정된 처방만 승인 경로에 연결 | 원본 증거/검토 이력·시장 범위·동일 처방 확인 없이는 cross-size Current Fact 공유 금지. 미확정 구성은 \`product_family_only\` 또는 \`formulation_ambiguous\`로 유지. 변형 \`variant_key\`의 기존 worker/G2 처리 제한 별도 검증 |
| **R4. 클렌저 admission 게이트 재배치** | **미착수·설계/테스트 후** | 현행 \`VERIFIED_EXACT_CAPACITY_REQUIRED\`를 **카탈로그 전체 Subject 신원 게이트에서 분리**하고, 용량 검증은 presentation/offer 및 원본 source scope에 적용. 단, source-to-subject 근거는 축소 금지 | 동일 처방의 다른 용량을 불필요하게 HOLD하지 않으면서, 공식 자료가 가리키는 SKU와 실제 구매 규격을 정확히 구별; 검증되지 않은 처방의 피부 분석 재사용 0건 |
| **R5. 카탈로그·추천 shadow 비교** | **미착수** | 기존/신규 read-model 병행; 가격·판매구성 변화가 Fact/추천 점수에 영향 없는지 검증, 실제 처방 변경 시 재검증·이전 Subject 역사 보존 | frozen 기존 추천 164개 불변 또는 심사된 차이만 허용. \`low_ph\`/\`deep_cleansing\`의 **근거 없음 ≠ false**. 정해진 독립 gold set과 중복/오결합률·abstain 품질 기준 사전 확정 |
| **R6. 승인된 제한 활성화/롤백** | **미착수·별도 승인 필요** | 미리 검증된 데이터/권한만 기존 판매·G2 경로로 단계적 반영, 제한 canary와 추적 로그, 기존 경로 즉시 복귀 스위치 | R1~R5 근거, 관리자/DB 보안 승인, 공급망/CI·규모별 canary·롤백 검증 후에만 병합·배포/추천 활성화. \`read_recommendation_admission_authority_v1\`의 cleanser 지원 부재를 임의 bypass 금지 |

**우선순위**는 R1 → R2 → R3 → R4 → R5 → R6이며, R0은 설계 조사만 끝났다는 뜻이다. R1~R6를 이미 구현했거나 실제 Subject/Fact가 생성됐다는 뜻이 아니다. R1 설계가 승인되어도 protected DB migration은 별도 변경권한/롤백 검증 전까지 HOLD이다.

### 14.3 판정 매트릭스와 재사용 정책

| 발생한 변화 | 제품 앵커 | 처방 Subject/Fact | presentation/offer |
| --- | --- | --- | --- |
| 120ml에서 150ml로 판매 규격 변경 | 유지 | **동일 처방 근거가 있으면 재사용**, 없으면 미확정 | 150ml 규격과 새 offer 추가 |
| 150ml + 세럼 10ml 사은품 | 본품 유지 | 본품 처방 불변이 확인된 범위에서만 재사용; 세럼 성분은 본품 근거에 병합 금지 | 본품 150ml + 증정품 10ml를 2 component로 기록 |
| 150ml 1+1 | 유지 | 동일 용기·처방인 경우만 재사용 | \`quantity=2\`로 기록, 단일 용기 300ml로 만들지 않음 |
| 할인/판매처/재고 변동 | 유지 | 재검증 불필요 | 가격·시간·채널만 변경, 피부 점수 불변 |
| 외관·패키지 리뉴얼 | 유지 | **동일 제형 확인시** 재사용 | 새 포장/상품 코드·시점 분리 |
| 실제 성분/효능 관련 제형 변경 | 유지 | 새로운 immutable Subject + predecessor/supersession; 기존 Fact는 역사로 보존 | 각 판매 규격을 해당 Subject에 다시 연결 |
| 성분/제형 연속성 미확인 | 유지 | **강제 병합도 새 확정 Subject도 금지**, 관련 Fact 소비 보류 | 상품 자체는 연구 후보로 보존, 잘못된 추천 노출 차단 |

**가격 규칙:** 결제 가격은 \`offer.price_amount\`로, 할인/시점/쿠폰 자격을 구분한다. 본품 단위 가격은 구성품과 수량이 **명시·검증된 경우에만** 계산한다. 증정품 용량을 본품 용량에 더하지 않으며, 미확인 기획 세트의 가격을 단품 가격으로 추정하지 않는다.

**증거 규칙:** \`products.size_ml\`/상품명/현재 판매 링크는 가설이며, 공식·소매 증거는 해당 family/unit/offer/formulation 범위를 넘지 않는다. 출처 사용권·보존 가능한 원본·검토자 판단·시점이 없으면 권위 있는 Source Binding/Subject/Current Fact로 승격하지 않는다.

### 14.4 클렌저 10개 고정 수용 기준

- 기존 \`products.id\` 10개 및 연구 접수 10/태스크 20개를 보존한다. 재수집을 위해 제품을 재등록하지 않는다.
- 라곰 120↔150ml 및 170↔220ml는 **규격 충돌 조사 대상**으로 남기되 그것만으로 제품/처방이 틀렸다고 단정하지 않는다. 과거 판매 규격·리뉴얼·동일 처방 여부를 원본 기반으로 구분한다.
- 제로이드 240ml와 브랜드 페이지의 용량 미확정, 공식 Source Binding 없는 나머지 상품 역시 분리된 연구 후보로 관리한다. 가짜 digest/거짓 Subject를 만들지 않는다.
- **상품 기본 정보 확인 / 처방 동일성 심사 / 특정 판매 SKU 매핑 / 화해 원본 결합**을 독립적으로 진단한다. 한 항목의 불일치가 나머지 항목을 근거 없이 무효화하거나 통과시키지 않도록 한다.
- **출고 조건:** 동일성 골드셋에서 잘못된 Subject/offer 결합 0건, 신원 미확정 보류 작동, 재검증 트리거, historical Fact 보존, frozen 164개 기존 추천 결과 검증, 제한 canary/롤백이 모두 검증되기 전에는 G2 production 연결 금지.

### 14.5 오너와 경계

- **TRUST/PF-1:** Subject, 제형 구분, evidence binding, re-review 및 Fact confirmation의 유일한 권위.
- **Catalog/Offer:** 제품 앵커, 단일 용기 presentation, 세트 구성·가격·구매 링크와 버전드 판매 관측.
- **Recommendation/G2:** 검증된 처방 Fact·추천 메타데이터 소비, runtime 활성화 및 rollback의 유일한 권위.
- **불변:** legacy 164 제품/추천·점수식·운영 DB·RLS·API·호스팅·외부 공식 사이트 요청은 이 문서의 로드맵 갱신으로 변경되거나 승인되지 않는다.

이 로드맵의 완료 판정은 **스키마가 존재하는지**가 아니라, 동일 처방의 용량/판매 변화와 실제 처방 변경을 정확히 구분하고, 불확실할 때 안전하게 보류하며, 추천·구매 정보를 독립적으로 유지할 수 있는지에 달려 있다.
