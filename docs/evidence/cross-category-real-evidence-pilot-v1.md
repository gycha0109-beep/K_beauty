# Cross-Category Real-Product Evidence Pilot v1

## 1. Frozen scope and baseline

This document records the Phase 3B candidate freeze first, then the completed real-source research and frozen mapping result. The candidate population was committed before external evidence was used to establish Product Facts.

- pilot version: `cross-category-real-evidence-pilot-v1`
- baseline main: `e1c9af6ad69e54a6a8d2e614de545e48f4e749b1`
- candidate-selection freeze commit: `195a06c57cf72955645866b1d15d226ce115ee61`
- frozen registry version: `product-fact-registry-cross-category-v1`
- frozen registry blob: `32fdaa2d3a181c9d18888fc48c1343e083ad20f7`
- frozen registry core blob: `4d514f7eff80d299d6893a7f3b1c97d40ce451ba`
- frozen Phase 3A verifier blob: `5020853bc1948e9544d04dcdfe5dde44fe2aa22a`
- frozen inventory audit blob: `8fb808ccdfb51eabd88e550d25e33bd42d293223`
- reference inventory: `783afb91a964f5d762f46846f9ef854902b48e95` / `fixtures/recommendation-metadata/products-v1.json`
- reference inventory canonical SHA-256: `e4788383a21ac4207d553fbfb5300dc629b8eab5ad200ffd1313d43e94e0c856`

Current-catalog metadata was used only for membership and hard-case selection. It was never promoted to supported Product Fact authority.

## 2. Candidate freeze record

| pilot | current_catalog_product_id | brand | current_catalog_name | domain | selection reason | legacy selection hints |
|---|---|---|---|---|---|---|
| S1 | `0bb742d2-df6b-49a7-8e29-8f76ae62ac0d` | ROUND LAB | 자작나무 수분 선크림 | sunscreen | Market-scoped SPF/UVA and linked US variant without scope collapse. | `Legacy sunscreen protection/filter/wear fields; NOT_EVIDENCE_AUTHORITY.` |
| S2 | `25b2763f-529f-4b2e-a436-2e0776279c55` | Beauty of Joseon | 맑은쌀 선크림 / Relief Sun : Rice + Probiotics | sunscreen | Protection labels plus alias/identity bridging to an official exact product. | `Legacy SPF/UVA/filter/wear fields; NOT_EVIDENCE_AUTHORITY.` |
| S3 | `cbcd06a2-de29-47ca-afd1-ab1d5de93903` | ANESSA | Perfect UV Skincare Milk NA / 퍼펙트 UV 선스크린 스킨케어 밀크 NA | sunscreen | JP NA variant plus real categorical water-resistance rating. | `Legacy 80-minute water-resistance hint; NOT_EVIDENCE_AUTHORITY.` |
| T1 | `fa5b1f6b-1e55-47b0-bfa1-494be512df07` | Derma Factory | Niacinamide 20% Serum / 나이아신아마이드 20% 세럼 | treatment | One active with explicit subject-bound 20% concentration. | `Catalog name + legacy ingredient/concern/review summaries; NOT_EVIDENCE_AUTHORITY.` |
| T2 | `0b88019a-9eb2-4be9-842d-f1e60e42cf51` | The Ordinary | Mandelic Acid 10% + HA | treatment | Multi-active case where only one active has an established concentration. | `Catalog name + legacy metadata; NOT_EVIDENCE_AUTHORITY.` |
| T3 | `24a339bf-f380-493f-88b5-68e6be887c30` | Anua | PDRN Hyaluronic Acid Capsule 100 Serum | treatment | Multi-active/numeric-name case where `100` must not become concentration. | `Catalog name + legacy ingredient/review summaries; NOT_EVIDENCE_AUTHORITY.` |
| M1 | `4aa41038-de5b-4125-97b0-a50e7575cc00` | ILLIYOON | Ceramide Ato Concentrate Cream 150mL / 세라마이드 아토 집중크림 | moisturizer_cream | Full-face moisturizer identity with primary-efficacy source scarcity. | `Legacy ingredient/concern/review fields; NOT_EVIDENCE_AUTHORITY.` |
| M2 | `c67266dd-3706-4929-9196-936d1f61cbc5` | La Roche-Posay | Cicaplast Baume B5+ | moisturizer_balm | Multi-area balm role plus barrier claim and panthenol concentration. | `Legacy balm role/tags; NOT_EVIDENCE_AUTHORITY.` |
| M3 | `4cbd41f3-1357-42c6-a6c7-6df0e90d54a7` | Dr.G | R.E.D BLEMISH Clear Soothing Cream EX / 레드 블레미쉬 클리어 수딩 크림 EX | moisturizer_cream | Exact EX review identity without an exact official physical-Fact source. | `Legacy concern/ingredient/review fields; NOT_EVIDENCE_AUTHORITY.` |
| P1 | `d9e40ddb-b1e2-46e4-92db-82744227dfe3` | Anua | 어성초 77 히알루론산 수분 진정 토너 350ml | toner_essence | Liquid-toner current row with exact-size vs official size-variant tension. | `Catalog category/name and legacy signals; NOT_EVIDENCE_AUTHORITY.` |
| P2 | `38dc094e-4148-4566-a743-a09815265f44` | NEEDLY | Daily Toner Pad / 데일리 토너 패드 | toner_pad | Renewed pad with unresolved frozen-catalog formulation lineage. | `Legacy pad category/review aggregates; NOT_EVIDENCE_AUTHORITY.` |
| P3 | `230f1c9c-cbf8-4458-aaac-ea1010a21e8c` | Medicube | Zero Pore Pad 2.0 / 제로 모공 패드 2.0 | toner_pad | Pad format/wipe/surface facts plus exact lactic and salicylic acid composition identities. | `Legacy concerns/review aggregates; NOT_EVIDENCE_AUTHORITY.` |

## 3. Research discipline

- Search results/snippets and AI summaries were discovery aids only; Evidence Records were created from opened source pages recorded in the corpus.
- Source kind and evidence class remain separate.
- Official wording with numeric or test language was **not** promoted to `measurement` unless metric, method context, timepoint, and applicable numeric outcome were sufficiently established.
- Ingredient presence establishes composition identity only; it does not establish efficacy magnitude.
- Review observations remain observations. No aggregate review count was treated as an analyzed denominator.
- Unmapped evidence is retained. No closest-key coercion is allowed.

## 4. Product identity review

| pilot | identity | selected market | result |
|---|---|---|---|
| S1 | `resolved` | KR | Official Korean ROUND LAB page names the catalog product. US UVLock evidence is retained as a linked but distinct market/variant source and is not fused into the KR catalog product. |
| S2 | `resolved` | KR | Exact-product retailer listing bridges the Korean catalog alias 맑은쌀 선크림 to Beauty of Joseon Relief Sun Rice + Probiotics; official product page then supplies primary product evidence. |
| S3 | `resolved` | JP | Official ANESSA page exactly names the NA variant. |
| T1 | `resolved` | KR | Official exact product page names Niacinamide 20% Serum and states availability in Korea and the U.S. |
| T2 | `resolved` | KR | Official South Korea locale page is an exact product match. |
| T3 | `resolved` | US | Official exact product page. The token '100' is explicitly treated as product/delivery naming, not as concentration. |
| M1 | `resolved` | KR | Exact 150mL retailer listing resolves catalog identity; primary-authority physical efficacy is not inferred from retailer/category metadata. |
| M2 | `resolved` | ZA | Official exact product page resolves the balm identity and its multi-purpose use. |
| M3 | `resolved` | KR | Exact EX identity is available from Hwahae, but no exact official EX product page was acquired; primary physical Facts are source-blocked. |
| P1 | `resolved` | KR | Exact 350mL renewed retailer listing resolves the catalog row. Official 250mL renewed page is retained only as a partial size-variant source. |
| P2 | `ambiguous` | KR | Current official page explicitly says renewed 80-pad product, while the frozen catalog row lacks formulation/version lineage. Evidence is retained but authoritative fused Facts are blocked. |
| P3 | `resolved` | KR | Official exact product page resolves the 2.0 pad identity. |

Identity summary: **11 resolved / 1 ambiguous / 0 unresolved**. NEEDLY P2 remains ambiguous because the current official page explicitly describes a renewed 80-pad product while the frozen catalog row has no formulation/version lineage. Its evidence is retained but no authoritative fused Fact is created.

## 5. Source acquisition

- sources acquired: **15**
- `product_specific_primary`: **10**
- `limited_non_product_specific`: **3**
- `review_observation`: **2**

Source records preserve URL, publisher, kind, language, market, exact-product-match state, candidate authority, access date, and notes. Retailer sources are used primarily for exact catalog alias/size identity where official exact identity was unavailable; their authority limitation is retained.

## 6. Evidence and Fact outcome

- evidence records: **29**
- fused mapped Facts: **23**
- measurement evidence: **0** (intentional; no marketing/test number was upgraded just to satisfy coverage)

Evidence-class distribution:

- `composition_identity`: 7
- `observation`: 2
- `physical_characteristic`: 2
- `product_claim`: 14
- `role_declaration`: 1
- `usage_instruction`: 3

Reviewed proposition outcomes:
- `evidence_insufficient`: 1
- `identity_blocked`: 3
- `registry_gap`: 5
- `reviewed_not_established`: 6
- `source_blocked`: 6
- `supported`: 21

No real-sample `evidence_conflict` was found. This is not a claim of product completeness; it means the reviewed propositions in this 12-product sample did not produce a provenance-complete contradiction.

## 7. Relationship-bound real cases

- **T1 Derma Factory:** `contains_active=niacinamide` plus `active_concentration=20%` bound by `subject_ref`.
- **T2 The Ordinary:** `mandelic_acid` and `sodium_hyaluronate_crosspolymer` are independent active propositions; only mandelic acid receives 10%. Missing HA concentration remains `reviewed_not_established`, not zero.
- **M2 Cicaplast:** `panthenol` plus subject-bound 5% concentration; the ingredient/concentration relationship is separate from the balm role and barrier-support claim.
- **P3 Medicube:** `lactic_acid` and `salicylic_acid` are separate composition identities from the exact official ingredient list. Neither acid receives a concentration Fact; both concentration propositions remain `reviewed_not_established`.

## 8. Market / variant scoped real cases

- **ROUND LAB S1:** Korean renewed-product SPF50+/PA++++ is fused only in KR scope. A linked US UVLock page is retained as a partial-match US variant and is not collapsed into the KR Fact set.
- The US `Broad Spectrum` UVA regulatory label is retained as an S1 vocabulary gap because the frozen `uva_label` enum cannot express it.
- **ANESSA S3:** SPF50+/PA++++ is retained under JP + `NA` variant scope. The official `UV耐水性★★` statement is not converted to minutes.

## 9. Claim versus measurement

- **ANUA PDRN T3:** official numeric hydration/test wording is retained as non-measurement evidence because the frozen measurement contract requires sufficient metric/method/timepoint context.
- final `measurement_evidence_count = 0`.

## 10. Review denominator cases

- products with retained real review observations: **2**.
- Every retained review observation with no analyzed denominator records `prevalence = forbidden`.
- Total review count and signal mention count are never used as prevalence denominators.

## 11. Unmapped evidence and gap taxonomy

- unmapped evidence refs retained: **6**
- forced mappings: **0**

- `IDENTITY_GAP`: 1
- `SOURCE_GAP`: 3
- `VALUE_OR_UNIT_GAP`: 1
- `VOCABULARY_GAP`: 3

Severity:
- `S1_VOCABULARY_ONLY`: 4
- `S2_STRUCTURAL`: 0
- `S3_RESEARCH_OR_IDENTITY`: 4

### S1 vocabulary expansion candidates

#### uva_regulatory_label_broad_spectrum
- why current Registry cannot express it: Frozen uva_label enum has PA grades and UVA-PF-declared but no US Broad Spectrum declaration.
- suggested value type: `enum`
- suggested cardinality: `one`
- relationship requirement: `none`
- scope requirement: `['market', 'region', 'variant', 'formulation_version']`
- canonical fact key approved: `false`

#### uv_water_resistance_rating
- why current Registry cannot express it: Frozen water_resistance_duration stores minutes, while the official Japanese ANESSA source declares UV耐水性★★ without minutes.
- suggested value type: `enum`
- suggested cardinality: `one`
- relationship requirement: `none`
- scope requirement: `['market', 'region', 'variant', 'formulation_version']`
- canonical fact key approved: `false`

#### general_irritation_observed
- why current Registry cannot express it: Frozen observation vocabulary has sunscreen-specific eye_sting_observed but no cross-category irritation occurrence proposition.
- suggested value type: `boolean`
- suggested cardinality: `one`
- relationship requirement: `none`
- scope requirement: `['market', 'region', 'variant', 'formulation_version']`
- canonical fact key approved: `false`

#### subjective_soothing_observed
- why current Registry cannot express it: Frozen registry has no governed cross-category soothing observation Fact; review evidence must not be converted to barrier/hydration efficacy.
- suggested value type: `boolean`
- suggested cardinality: `one`
- relationship requirement: `none`
- scope requirement: `['market', 'region', 'variant', 'formulation_version']`
- canonical fact key approved: `false`

### S2 structural gaps

**0**. No relationship, scope, cardinality, value-model, or fusion-semantic change was required by the reviewed real evidence.

### S3 research / identity gaps

- `gap-m1-primary-source` — SOURCE_GAP: Exact 150mL identity is resolved through a retailer, but this research pass did not acquire an exact official product page sufficient to establish role/barrier/measurement Facts.
- `gap-m3-official-source` — SOURCE_GAP: Exact EX identity/reviews were available, but no exact official EX product page was acquired; primary physical claims remain source-blocked.
- `gap-p1-physical-source` — SOURCE_GAP: Exact 350mL retailer identity is resolved, but the acquired exact-size source does not independently establish governed physical/usage Facts without relying on product-category inference.
- `gap-p2-version-lineage` — IDENTITY_GAP: Current official page is explicitly a renewed 80-pad product, while the frozen catalog row lacks formulation/version lineage. Evidence is retained but authoritative fusion is blocked.

## 12. Mandatory real-world acceptance questions

- **A_multi_active_relationship — PASS**: Mandelic acid and sodium hyaluronate crosspolymer are independent contains_active propositions; only mandelic acid receives the source-backed 10% concentration. Missing HA concentration remains reviewed_not_established, not zero.
- **B_market_variant_scope — PASS**: KR RoundLab supported facts remain scoped to the KR renewed product, while the US UVLock derivative is retained as a partial-match linked variant and not collapsed/fused. ANESSA facts retain JP + NA scope.
- **C_claim_vs_measurement — PASS**: Numeric or instrumental marketing/test statements were not promoted to measurement because metric/method/outcome/timepoint context was incomplete. measurement_evidence_count remains 0.
- **D_balm_role_not_efficacy — PASS**: Cicaplast multi-area role and barrier-support claim are separate Facts. Role is not efficacy magnitude or recommendation weight.
- **E_pad_property_not_effect — PASS**: Pad format, wipe-off usage, and embossed surface are represented independently. Exact official ingredients support lactic and salicylic acid composition identities; AHA/BHA/PHA family language is not converted to exfoliation intensity.
- **F_source_shortage_fail_closed — PASS**: Source/identity limitations are represented as source_blocked, identity_blocked, or registry_gap outcomes. No missing proposition is converted to false or global product-unknown.

## 13. Architecture outcome

**`ARCHITECTURE_SURVIVES_REAL_EVIDENCE_PILOT`**

Reason: `S2_STRUCTURAL=0` and `forced_mapping_count=0`. S1 vocabulary and S3 research/identity gaps remain explicitly preserved; they are not hidden to obtain PASS.

## 14. Frozen artifact digests

- corpus SHA-256: `47457c0242451a35305fd8eceba0ebb7e210eb9ee2e73134ccf41696d18e517d`
- mapping SHA-256: `c746c5d02f654ed7f0a8e8385611ac65ca30b9c4648fa4c6454ac863e7c9314f`
- gap report SHA-256: `5a4580d76cca62d90a3ac306744054c507a6d5e45b0b91a41dffb3b754980215`

## 15. Focused verifier

```text
PASS verify-cross-category-real-evidence-pilot-v1
products=12
sources=15
evidence_records=29
mapped_facts=23
assertions=547
measurement_evidence_count=0
forced_mapping_count=0
S1=4
S2=0
S3=4
architecture_outcome=ARCHITECTURE_SURVIVES_REAL_EVIDENCE_PILOT
corpus_sha256=47457c0242451a35305fd8eceba0ebb7e210eb9ee2e73134ccf41696d18e517d
mapping_sha256=c746c5d02f654ed7f0a8e8385611ac65ca30b9c4648fa4c6454ac863e7c9314f
gap_report_sha256=5a4580d76cca62d90a3ac306744054c507a6d5e45b0b91a41dffb3b754980215
git_scope=PASS
```

Local Git scope remains not evaluated because the baseline Git object is absent. Remote exact-head scope is verified separately.

## 16. Protected boundaries

All Phase 3B artifacts remain offline evidence/research only:

- Production recommendation delta = 0
- ranking delta = 0
- Top Pick / Top3 delta = 0
- Admin runtime delta = 0
- DB migration = 0
- Hosted / Production DB write = 0
- Product Fact runtime consumer = 0
- Decision Axis runtime consumer = 0
- #167 activation = 0
- #177 activation = 0

`CROSS_CATEGORY_PRODUCT_FACTS_COMPLETE`, `CROSS_CATEGORY_REAL_EVIDENCE_COMPLETE`, Production Registry/schema readiness, catalog adoption, and recommendation activation are not claimed.
