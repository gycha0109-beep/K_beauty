# V2.1-8G — Catalog Evidence Research Wave 1

> Exact V2.1-8F 12-product batch. Official-source research freeze only. Hosted Product Fact writes = 0. V2.1-8H NOT STARTED.

## Authority

- source main: `61d9d40db0f7fdac9aa2db1b68cad259f11e6ec0`
- 8F selection JSON SHA256: `b7bcbc9be95bd81a9d2014c79728317eaee5771bfb6deea3bc6f23af3cddc59b`
- 8F selection MD SHA256: `c43dd31b4110f60b5dd5356bf3cc149d55850de4b6e47c3814ca318df58bc4cd`
- Registry: `product-fact-registry-cross-category-v1`
- Subject serializer: `product-fact-subject-identity-v1`
- Proposition serializer: `product-fact-proposition-pilot-v1`
- Fusion: `v2.1-4-product-fact-evidence-fusion-v1`

## Research result

- researched products: 12/12
- terminal target Fact slots: 45/45
- supported products: 7
- supported propositions: 16
- proposition collisions: 0
- disposition counts: `{"EVIDENCE_INSUFFICIENT":15,"REGISTRY_GAP":2,"REVIEWED_NOT_ESTABLISHED":9,"SOURCE_ACCESS_BLOCKED":3,"SOURCE_NOT_FOUND":4,"SUPPORTED":12}`
- Hosted Product Fact writes: 0

## Product closure

| product_id | brand | product | category | identity | closure | supported propositions | blocked target slots |
|---|---|---|---|---|---|---:|---:|
| 24103bd1-c7ba-4cc9-b9b9-8129c6452232 | 라운드랩 | 자작나무 수분 수딩젤 | moisturizer_gel | resolved | PARTIALLY_SUPPORTED | 2 | 2 |
| 173c63a8-a40d-4d1e-acb6-a7944d66ec43 | 브링그린 | 알로에 수딩 젤 | moisturizer_gel | resolved | SOURCE_BLOCKED | 0 | 4 |
| 97deb2cc-2fae-4dbb-8253-03170e197002 | 러베 | 5중 세라마이드 로션 | moisturizer_lotion_emulsion | resolved | EVIDENCE_INSUFFICIENT | 0 | 4 |
| c4a5f510-8d9e-46bd-a31c-3c0a34fee331 | 닥터지 | 레드 블레미쉬 10-시카 캡슐 수딩 토너 | toner_essence | resolved | PARTIALLY_SUPPORTED | 4 | 2 |
| dfc4b232-9997-4584-a886-bc7074b6f247 | 닥터트웬티프로젝트 | 나인 토너 | toner_essence | resolved | EVIDENCE_INSUFFICIENT | 0 | 4 |
| 59b149d0-5ffa-4610-8141-c0a501b60565 | 라보레브 | 피치마이크로바이옴 78 피디알엔 토너 | toner_essence | resolved | PARTIALLY_SUPPORTED | 1 | 3 |
| 1f20944c-5a86-4748-8daf-7d57259ea6c0 | 라운드랩 | 소나무 진정 시카 로션 | moisturizer_lotion_emulsion | resolved | PARTIALLY_SUPPORTED | 2 | 2 |
| 65a4be83-a9b7-4b1d-bd58-1b6e99cf66fc | YBK | 릴리프 하이드레이션 라이트 폼 클렌저 | cleanser | resolved | PARTIALLY_SUPPORTED | 1 | 2 |
| 8889342d-d9a2-454b-aa27-60d4934b9978 | 메디필 | 레드 락토 콜라겐 클리어 폼클렌저 2.0 | cleanser | resolved | SOURCE_BLOCKED | 0 | 3 |
| 51d526de-b127-47c4-83f1-64fc1ec4aa10 | 메디힐 | 더마 크림 팩 클렌저 마데카소사이드 | cleanser | resolved | PARTIALLY_SUPPORTED | 1 | 2 |
| 0b59cb66-ab03-4a0d-815e-7a94a5c7ae65 | 메이크프렘 | 세이프 미 클렌징폼 | cleanser | resolved | EVIDENCE_INSUFFICIENT | 0 | 3 |
| be8a590e-e5cb-4af4-84e7-99c7e121f45a | 구달 | 어성초 히알루론 수딩 클리어패드 | toner_pad | resolved | PARTIALLY_SUPPORTED | 5 | 2 |

## Fact-slot adjudication

| product_id | fact_key | disposition | normalized value | authority | confidence | reason |
|---|---|---|---|---|---|---|
| 24103bd1-c7ba-4cc9-b9b9-8129c6452232 | primary_use_role | SUPPORTED | "multi_area" | product_specific_primary | high | Official directions explicitly allow face, hair, nails, or any part needing care. |
| 24103bd1-c7ba-4cc9-b9b9-8129c6452232 | barrier_support_claim | REVIEWED_NOT_ESTABLISHED | — | none | unknown | Official moisture-defense-barrier wording describes moisture retention; not promoted to an explicit skin-barrier-support Product Fact. |
| 24103bd1-c7ba-4cc9-b9b9-8129c6452232 | contains_active | SUPPORTED | "hyaluronic_acid" | product_specific_primary | high | Official active/full ingredient text explicitly includes Hyaluronic Acid; canonical entity already exists in Hosted Product Fact. |
| 24103bd1-c7ba-4cc9-b9b9-8129c6452232 | active_concentration | REGISTRY_GAP | — | none | unknown | Numeric birch concentration is source-internally inconsistent and cannot be bound to an existing canonical contains_active entity; no concentration is fabricated. |
| 173c63a8-a40d-4d1e-acb6-a7944d66ec43 | primary_use_role | SOURCE_NOT_FOUND | — | none | unknown | Only secondary Olive Young identity corroboration was retained; no admissible exact official brand/manufacturer fact-bearing source was found. |
| 173c63a8-a40d-4d1e-acb6-a7944d66ec43 | barrier_support_claim | SOURCE_NOT_FOUND | — | none | unknown | Only secondary Olive Young identity corroboration was retained; no admissible exact official brand/manufacturer fact-bearing source was found. |
| 173c63a8-a40d-4d1e-acb6-a7944d66ec43 | contains_active | SOURCE_NOT_FOUND | — | none | unknown | Only secondary Olive Young identity corroboration was retained; no admissible exact official brand/manufacturer fact-bearing source was found. |
| 173c63a8-a40d-4d1e-acb6-a7944d66ec43 | active_concentration | SOURCE_NOT_FOUND | — | none | unknown | Only secondary Olive Young identity corroboration was retained; no admissible exact official brand/manufacturer fact-bearing source was found. |
| 97deb2cc-2fae-4dbb-8253-03170e197002 | primary_use_role | EVIDENCE_INSUFFICIENT | — | none | unknown | Official exact 200ml identity is machine-readable, but target Fact-bearing detail is image-only and was not promoted from visual inference. |
| 97deb2cc-2fae-4dbb-8253-03170e197002 | barrier_support_claim | EVIDENCE_INSUFFICIENT | — | none | unknown | Official exact 200ml identity is machine-readable, but target Fact-bearing detail is image-only and was not promoted from visual inference. |
| 97deb2cc-2fae-4dbb-8253-03170e197002 | contains_active | EVIDENCE_INSUFFICIENT | — | none | unknown | Official exact 200ml identity is machine-readable, but target Fact-bearing detail is image-only and was not promoted from visual inference. |
| 97deb2cc-2fae-4dbb-8253-03170e197002 | active_concentration | EVIDENCE_INSUFFICIENT | — | none | unknown | Official exact 200ml identity is machine-readable, but target Fact-bearing detail is image-only and was not promoted from visual inference. |
| c4a5f510-8d9e-46bd-a31c-3c0a34fee331 | product_format | SUPPORTED | "liquid" | product_specific_primary | high | Official page describes a water formulation for the exact toner. |
| c4a5f510-8d9e-46bd-a31c-3c0a34fee331 | contains_active | SUPPORTED | ["niacinamide","panthenol","mandelic_acid"] | product_specific_primary | high | Exact official full ingredient list contains all three canonical entities already governed/Hosted. |
| c4a5f510-8d9e-46bd-a31c-3c0a34fee331 | recommended_use_frequency | REVIEWED_NOT_ESTABLISHED | — | none | unknown | Official directions specify order/application but no daily, AM/PM, or weekly frequency. |
| c4a5f510-8d9e-46bd-a31c-3c0a34fee331 | wipe_off_use | REVIEWED_NOT_ESTABLISHED | — | none | unknown | Official directions say apply evenly and absorb; no wipe instruction is established. This is not supported(false). |
| dfc4b232-9997-4584-a886-bc7074b6f247 | product_format | EVIDENCE_INSUFFICIENT | — | none | unknown | Official exact 300ml identity is accessible, but target Fact-bearing product-detail text is not machine-verifiable. |
| dfc4b232-9997-4584-a886-bc7074b6f247 | contains_active | EVIDENCE_INSUFFICIENT | — | none | unknown | Official exact 300ml identity is accessible, but target Fact-bearing product-detail text is not machine-verifiable. |
| dfc4b232-9997-4584-a886-bc7074b6f247 | recommended_use_frequency | EVIDENCE_INSUFFICIENT | — | none | unknown | Official exact 300ml identity is accessible, but target Fact-bearing product-detail text is not machine-verifiable. |
| dfc4b232-9997-4584-a886-bc7074b6f247 | wipe_off_use | EVIDENCE_INSUFFICIENT | — | none | unknown | Official exact 300ml identity is accessible, but target Fact-bearing product-detail text is not machine-verifiable. |
| 59b149d0-5ffa-4610-8141-c0a501b60565 | product_format | EVIDENCE_INSUFFICIENT | — | none | unknown | Exact product name is a toner, but physical presentation is not explicitly stated in a governed physical-characteristic statement. |
| 59b149d0-5ffa-4610-8141-c0a501b60565 | contains_active | SUPPORTED | "panthenol" | product_specific_primary | high | Official exact product card explicitly names Panthenol; canonical entity already exists in Hosted Product Fact. |
| 59b149d0-5ffa-4610-8141-c0a501b60565 | recommended_use_frequency | REVIEWED_NOT_ESTABLISHED | — | none | unknown | Official accessible product text contains no explicit use frequency. |
| 59b149d0-5ffa-4610-8141-c0a501b60565 | wipe_off_use | REVIEWED_NOT_ESTABLISHED | — | none | unknown | Official accessible product text contains no explicit wipe instruction. |
| 1f20944c-5a86-4748-8daf-7d57259ea6c0 | primary_use_role | SUPPORTED | "full_face" | product_specific_primary | high | Official directions explicitly say apply an appropriate amount to the face. |
| 1f20944c-5a86-4748-8daf-7d57259ea6c0 | barrier_support_claim | REVIEWED_NOT_ESTABLISHED | — | none | unknown | Ingredient-level Centella function references barrier maintenance, but no product-specific barrier-support claim is promoted. |
| 1f20944c-5a86-4748-8daf-7d57259ea6c0 | contains_active | SUPPORTED | "hyaluronic_acid" | product_specific_primary | high | Official active/full ingredient text explicitly includes Hyaluronic Acid; canonical entity already exists. |
| 1f20944c-5a86-4748-8daf-7d57259ea6c0 | active_concentration | REGISTRY_GAP | — | none | unknown | Official numeric concentrations are attached to ingredient entities not present in the canonical Product Fact entity namespace; HA has no explicit numeric concentration. |
| 65a4be83-a9b7-4b1d-bd58-1b6e99cf66fc | low_ph | SUPPORTED | true | product_specific_primary | high | Official exact base-product summary explicitly states weak-acidic / pH-protective care. |
| 65a4be83-a9b7-4b1d-bd58-1b6e99cf66fc | deep_cleansing | EVIDENCE_INSUFFICIENT | — | none | unknown | No admissible exact product-specific deep/pore/heavy-cleansing claim is machine-verifiable. |
| 65a4be83-a9b7-4b1d-bd58-1b6e99cf66fc | fragrance_declared | EVIDENCE_INSUFFICIENT | — | none | unknown | No admissible official fragrance-present declaration or fragrance-free claim was established. |
| 8889342d-d9a2-454b-aa27-60d4934b9978 | low_ph | SOURCE_ACCESS_BLOCKED | — | none | unknown | Exact official URL is identified but direct access is currently blocked by Cafe24 verification; search-index text is not sufficient for supported adjudication. |
| 8889342d-d9a2-454b-aa27-60d4934b9978 | deep_cleansing | SOURCE_ACCESS_BLOCKED | — | none | unknown | Exact official URL is identified but direct access is currently blocked by Cafe24 verification; search-index text is not sufficient for supported adjudication. |
| 8889342d-d9a2-454b-aa27-60d4934b9978 | fragrance_declared | SOURCE_ACCESS_BLOCKED | — | none | unknown | Exact official URL is identified but direct access is currently blocked by Cafe24 verification; search-index text is not sufficient for supported adjudication. |
| 51d526de-b127-47c4-83f1-64fc1ec4aa10 | low_ph | REVIEWED_NOT_ESTABLISHED | — | none | unknown | Official exact product page was reviewed; no direct low-pH/weak-acidic claim is established. |
| 51d526de-b127-47c4-83f1-64fc1ec4aa10 | deep_cleansing | SUPPORTED | true | product_specific_primary | high | Official exact product summary explicitly states 99.8% cleansing of pore impurities. |
| 51d526de-b127-47c4-83f1-64fc1ec4aa10 | fragrance_declared | REVIEWED_NOT_ESTABLISHED | — | none | unknown | No explicit fragrance-present declaration or fragrance-free claim is established; absence is not false. |
| 0b59cb66-ab03-4a0d-815e-7a94a5c7ae65 | low_ph | EVIDENCE_INSUFFICIENT | — | none | unknown | Official current exact identity is verified, but target Fact-bearing detail is not machine-verifiable; historical other-size claims are not assumed equivalent. |
| 0b59cb66-ab03-4a0d-815e-7a94a5c7ae65 | deep_cleansing | EVIDENCE_INSUFFICIENT | — | none | unknown | Official current exact identity is verified, but target Fact-bearing detail is not machine-verifiable; historical other-size claims are not assumed equivalent. |
| 0b59cb66-ab03-4a0d-815e-7a94a5c7ae65 | fragrance_declared | EVIDENCE_INSUFFICIENT | — | none | unknown | Official current exact identity is verified, but target Fact-bearing detail is not machine-verifiable; historical other-size claims are not assumed equivalent. |
| be8a590e-e5cb-4af4-84e7-99c7e121f45a | product_format | SUPPORTED | "pad" | product_specific_primary | high | Official product configuration is explicitly counted in sheets and directions describe attachment/wiping. |
| be8a590e-e5cb-4af4-84e7-99c7e121f45a | contains_active | SUPPORTED | ["hyaluronic_acid","panthenol","sodium_hyaluronate_crosspolymer"] | product_specific_primary | high | Official full ingredient list explicitly contains all three canonical entities already used by Hosted Product Fact. |
| be8a590e-e5cb-4af4-84e7-99c7e121f45a | pad_surface_texture | EVIDENCE_INSUFFICIENT | — | none | unknown | No authoritative machine-readable smooth/embossed/textured surface statement was established; image inference is prohibited. |
| be8a590e-e5cb-4af4-84e7-99c7e121f45a | wipe_off_use | SUPPORTED | true | product_specific_primary | high | Official directions explicitly instruct wiping gently along skin texture after use. |
| be8a590e-e5cb-4af4-84e7-99c7e121f45a | recommended_use_frequency | REVIEWED_NOT_ESTABLISHED | — | none | unknown | Official directions describe how to use the pad but not an explicit daily/AM-PM/weekly frequency. |

## Supported propositions

| product_id | subject semantic key | fact_key | value | scope | proposition key | source | authority | confidence |
|---|---|---|---|---|---|---|---|---|
| 24103bd1-c7ba-4cc9-b9b9-8129c6452232 | d87563002c8e84636591cf734a7d7d23a20ab5654a1ccdc3ea1cad6aa303a560 | primary_use_role | "multi_area" | {"market":"GLOBAL"} | cf65e7f0e64ad41929d035c081d338c41b2348f714fbfb08e2969fd42decc83c | https://roundlab.com/products/birch-moisturizing-soothing-gel | product_specific_primary | high |
| 24103bd1-c7ba-4cc9-b9b9-8129c6452232 | d87563002c8e84636591cf734a7d7d23a20ab5654a1ccdc3ea1cad6aa303a560 | contains_active | "hyaluronic_acid" | {"market":"GLOBAL"} | bba056dda7fd4d029c2e3619df33e14d16d05da66ce51959b4514c4173ce10c4 | https://roundlab.com/products/birch-moisturizing-soothing-gel | product_specific_primary | high |
| c4a5f510-8d9e-46bd-a31c-3c0a34fee331 | c06d787e93226ec1710981e1e1eb954f51105e7d0d6abe599c442487a70f91b7 | product_format | "liquid" | {"market":"KR"} | f77373d8990861b445a27ea6700806fd597934b7bdd4586b5760770912dbd24c | https://www.dr-g.co.kr/item/9987 | product_specific_primary | high |
| c4a5f510-8d9e-46bd-a31c-3c0a34fee331 | c06d787e93226ec1710981e1e1eb954f51105e7d0d6abe599c442487a70f91b7 | contains_active | "niacinamide" | {"market":"KR"} | d8fb9a208c3dd26d4dc36e3b4490933a4f62f67c78b71806ff2e5ae56259574c | https://www.dr-g.co.kr/item/9987 | product_specific_primary | high |
| c4a5f510-8d9e-46bd-a31c-3c0a34fee331 | c06d787e93226ec1710981e1e1eb954f51105e7d0d6abe599c442487a70f91b7 | contains_active | "panthenol" | {"market":"KR"} | a667fd875319508fc621e89b4a9e130f3731849f9904dec716503ec470c11eb6 | https://www.dr-g.co.kr/item/9987 | product_specific_primary | high |
| c4a5f510-8d9e-46bd-a31c-3c0a34fee331 | c06d787e93226ec1710981e1e1eb954f51105e7d0d6abe599c442487a70f91b7 | contains_active | "mandelic_acid" | {"market":"KR"} | 36feec2c175c7181f93d7e0ef3f7c703c93a18431bca7497e4fe661e3790043a | https://www.dr-g.co.kr/item/9987 | product_specific_primary | high |
| 59b149d0-5ffa-4610-8141-c0a501b60565 | 627a5f3355958e323a74f4a22397a425f63a7133ff889fac8b250bf2af636fcc | contains_active | "panthenol" | {"market":"KR"} | 4e220dad3e8fc36e86a5dc34f7f5fd9bfe9f813756513f63b170e31029059a2f | https://laboreve.kr/ | product_specific_primary | high |
| 1f20944c-5a86-4748-8daf-7d57259ea6c0 | 0278e85d0fdeb37acba4ceeb96ec3e4305a3e8f8452332b5e991dc9798013dbb | primary_use_role | "full_face" | {"market":"GLOBAL"} | 9fa0c13ec45a496187ca605349c39bd1936fdb058ae4b132375287db28b7f289 | https://roundlab.com/products/pine-calming-cica-lotion | product_specific_primary | high |
| 1f20944c-5a86-4748-8daf-7d57259ea6c0 | 0278e85d0fdeb37acba4ceeb96ec3e4305a3e8f8452332b5e991dc9798013dbb | contains_active | "hyaluronic_acid" | {"market":"GLOBAL"} | 4dd6a17d799351a2d34dcb422ff7e84985415b2be08e30dd0aadd6add8c3be0b | https://roundlab.com/products/pine-calming-cica-lotion | product_specific_primary | high |
| 65a4be83-a9b7-4b1d-bd58-1b6e99cf66fc | 17598fce1de9d413515ceae4ae7f0cf92fb87f34413e75dd47799ce2d837863b | low_ph | true | {"market":"KR"} | f61493fcb981aeeaf90ae0439e9e762f132df81ec5498bc57d0b517e16964cae | https://ybk-cosmetics.com/product/%EB%A6%B4%EB%A6%AC%ED%94%84-%ED%95%98%EC%9D%B4%EB%93%9C%EB%A0%88%EC%9D%B4%EC%85%98-%EB%9D%BC%EC%9D%B4%ED%8A%B8-%ED%8F%BC-%ED%81%B4%EB%A0%8C%EC%A0%80-150ml/18/ | product_specific_primary | high |
| 51d526de-b127-47c4-83f1-64fc1ec4aa10 | 9b383fc923a71cf4f63fde0daf72d0ae92806edc339b685b767799f17c929b68 | deep_cleansing | true | {"market":"KR"} | c9e5e2b03416dfb5fecd4d895e3a50291682524cfa7796904109a30f9c30c5b2 | https://medihealshop.com/product/%EB%8D%94%EB%A7%88-%ED%81%AC%EB%A6%BC-%ED%8C%A9-%ED%81%B4%EB%A0%8C%EC%A0%80%EB%A7%88%EB%8D%B0%EC%B9%B4%EC%86%8C%EC%82%AC%EC%9D%B4%EB%93%9C-%EC%A7%84%EC%A0%95-%EC%9E%A5%EB%B2%BD/1659/ | product_specific_primary | high |
| be8a590e-e5cb-4af4-84e7-99c7e121f45a | 8f2c378779f6a1a81b5c5f20673d74ca5780c8de43997e8837df2baaf5b6a251 | product_format | "pad" | {"market":"KR"} | 7ad1e29dbcbcc1e24550732023c53dd09d9397d111e3fb004e339e1d0374db9f | https://clubclio.co.kr/shop/goodsView/0000005157 | product_specific_primary | high |
| be8a590e-e5cb-4af4-84e7-99c7e121f45a | 8f2c378779f6a1a81b5c5f20673d74ca5780c8de43997e8837df2baaf5b6a251 | contains_active | "hyaluronic_acid" | {"market":"KR"} | 6fd066cc24bef6d755cb749d43278ca02ed0615c95bf64f26f1896198884aec1 | https://clubclio.co.kr/shop/goodsView/0000005157 | product_specific_primary | high |
| be8a590e-e5cb-4af4-84e7-99c7e121f45a | 8f2c378779f6a1a81b5c5f20673d74ca5780c8de43997e8837df2baaf5b6a251 | contains_active | "panthenol" | {"market":"KR"} | 148e2493e2d97b5bf7366345ed246ce0d48c63c28f8d69cfae8fb54672a15522 | https://clubclio.co.kr/shop/goodsView/0000005157 | product_specific_primary | high |
| be8a590e-e5cb-4af4-84e7-99c7e121f45a | 8f2c378779f6a1a81b5c5f20673d74ca5780c8de43997e8837df2baaf5b6a251 | contains_active | "sodium_hyaluronate_crosspolymer" | {"market":"KR"} | e41dcc38f80b4b4f43d254ae31ffe0f51c38f7d38db1121ebf57516e41db56e2 | https://clubclio.co.kr/shop/goodsView/0000005157 | product_specific_primary | high |
| be8a590e-e5cb-4af4-84e7-99c7e121f45a | 8f2c378779f6a1a81b5c5f20673d74ca5780c8de43997e8837df2baaf5b6a251 | wipe_off_use | true | {"market":"KR"} | c4c500478d662d022495e162280592077b906540bb499e583b5809afd0ae1562 | https://clubclio.co.kr/shop/goodsView/0000005157 | product_specific_primary | high |

## Future V2.1-8H materialization envelope

- future_new_subjects: 7
- future_new_sources: 7
- future_new_bindings: 7
- future_new_evidence: 16
- future_new_fact_instances: 16
- future_new_evidence_links: 16
- future_new_review_assignments: 16
- future_new_confirmations: 16
- future_new_current: 16
- projected adopted products: 16
- projected Current facts: 41

Blocked or uncertain slots create zero Confirmation and zero Current candidates. This is a dry-run planning envelope only; no Product Fact RPC or table mutation is performed.

## Lifecycle

- V2.1-8G research freeze only
- V2.1-8H NOT STARTED
- Product Fact Hosted writes = 0
- production recommendation consumption = unchanged / disabled
