# V2.1-8H — Catalog Hosted Adoption Wave 1

> Phase A deterministic plan only. Hosted writes occur only after merge and exact-main CI.

- source main: `429c18937aff04ee8278504196e97a5bc737d4ce`
- upstream research SHA256: `9dcf1462a5601c32594a7fd37b93b3ae4a7393b2e99a3a3c2856ece5a3dd734e`
- upstream materialization SHA256: `a632351a04cccdb4e55c2203f63735d726edebce208ebdf4f10f4b84adb78120`
- Registry: `product-fact-registry-cross-category-v1`
- Subject serializer: `product-fact-subject-identity-v1`
- Proposition serializer: `product-fact-proposition-pilot-v1`
- plan content SHA256: `7e749c0243dc3e2a2ee90f6e1a4c97f03b6c95cd2add26d760b28b6a2ebca4f6`

## Scope

- products: 7
- propositions: 16
- Hosted writes before merge: 0
- production recommendation delta: 0 required

## Subjects

| product_id | subject_semantic_key | identity | current_state | applicability |
|---|---|---|---|---|
| 1f20944c-5a86-4748-8daf-7d57259ea6c0 | 0278e85d0fdeb37acba4ceeb96ec3e4305a3e8f8452332b5e991dc9798013dbb | resolved | current | {"market_applicability":null,"region_applicability":null,"valid_from":null,"valid_to":null} |
| 24103bd1-c7ba-4cc9-b9b9-8129c6452232 | d87563002c8e84636591cf734a7d7d23a20ab5654a1ccdc3ea1cad6aa303a560 | resolved | current | {"market_applicability":null,"region_applicability":null,"valid_from":null,"valid_to":null} |
| 51d526de-b127-47c4-83f1-64fc1ec4aa10 | 9b383fc923a71cf4f63fde0daf72d0ae92806edc339b685b767799f17c929b68 | resolved | current | {"market_applicability":null,"region_applicability":null,"valid_from":null,"valid_to":null} |
| 59b149d0-5ffa-4610-8141-c0a501b60565 | 627a5f3355958e323a74f4a22397a425f63a7133ff889fac8b250bf2af636fcc | resolved | current | {"market_applicability":null,"region_applicability":null,"valid_from":null,"valid_to":null} |
| 65a4be83-a9b7-4b1d-bd58-1b6e99cf66fc | 17598fce1de9d413515ceae4ae7f0cf92fb87f34413e75dd47799ce2d837863b | resolved | current | {"market_applicability":null,"region_applicability":null,"valid_from":null,"valid_to":null} |
| be8a590e-e5cb-4af4-84e7-99c7e121f45a | 8f2c378779f6a1a81b5c5f20673d74ca5780c8de43997e8837df2baaf5b6a251 | resolved | current | {"market_applicability":null,"region_applicability":null,"valid_from":null,"valid_to":null} |
| c4a5f510-8d9e-46bd-a31c-3c0a34fee331 | c06d787e93226ec1710981e1e1eb954f51105e7d0d6abe599c442487a70f91b7 | resolved | current | {"market_applicability":null,"region_applicability":null,"valid_from":null,"valid_to":null} |

## Propositions

| product_id | fact_key | value | scope | proposition_key | source | authority |
|---|---|---|---|---|---|---|
| 1f20944c-5a86-4748-8daf-7d57259ea6c0 | contains_active | "hyaluronic_acid" | {"market":"GLOBAL"} | 4dd6a17d799351a2d34dcb422ff7e84985415b2be08e30dd0aadd6add8c3be0b | https://roundlab.com/products/pine-calming-cica-lotion | product_specific_primary |
| 1f20944c-5a86-4748-8daf-7d57259ea6c0 | primary_use_role | "full_face" | {"market":"GLOBAL"} | 9fa0c13ec45a496187ca605349c39bd1936fdb058ae4b132375287db28b7f289 | https://roundlab.com/products/pine-calming-cica-lotion | product_specific_primary |
| 24103bd1-c7ba-4cc9-b9b9-8129c6452232 | contains_active | "hyaluronic_acid" | {"market":"GLOBAL"} | bba056dda7fd4d029c2e3619df33e14d16d05da66ce51959b4514c4173ce10c4 | https://roundlab.com/products/birch-moisturizing-soothing-gel | product_specific_primary |
| 24103bd1-c7ba-4cc9-b9b9-8129c6452232 | primary_use_role | "multi_area" | {"market":"GLOBAL"} | cf65e7f0e64ad41929d035c081d338c41b2348f714fbfb08e2969fd42decc83c | https://roundlab.com/products/birch-moisturizing-soothing-gel | product_specific_primary |
| 51d526de-b127-47c4-83f1-64fc1ec4aa10 | deep_cleansing | true | {"market":"KR"} | c9e5e2b03416dfb5fecd4d895e3a50291682524cfa7796904109a30f9c30c5b2 | https://medihealshop.com/product/%EB%8D%94%EB%A7%88-%ED%81%AC%EB%A6%BC-%ED%8C%A9-%ED%81%B4%EB%A0%8C%EC%A0%80%EB%A7%88%EB%8D%B0%EC%B9%B4%EC%86%8C%EC%82%AC%EC%9D%B4%EB%93%9C-%EC%A7%84%EC%A0%95-%EC%9E%A5%EB%B2%BD/1659/ | product_specific_primary |
| 59b149d0-5ffa-4610-8141-c0a501b60565 | contains_active | "panthenol" | {"market":"KR"} | 4e220dad3e8fc36e86a5dc34f7f5fd9bfe9f813756513f63b170e31029059a2f | https://laboreve.kr/ | product_specific_primary |
| 65a4be83-a9b7-4b1d-bd58-1b6e99cf66fc | low_ph | true | {"market":"KR"} | f61493fcb981aeeaf90ae0439e9e762f132df81ec5498bc57d0b517e16964cae | https://ybk-cosmetics.com/product/%EB%A6%B4%EB%A6%AC%ED%94%84-%ED%95%98%EC%9D%B4%EB%93%9C%EB%A0%88%EC%9D%B4%EC%85%98-%EB%9D%BC%EC%9D%B4%ED%8A%B8-%ED%8F%BC-%ED%81%B4%EB%A0%8C%EC%A0%80-150ml/18/ | product_specific_primary |
| be8a590e-e5cb-4af4-84e7-99c7e121f45a | contains_active | "panthenol" | {"market":"KR"} | 148e2493e2d97b5bf7366345ed246ce0d48c63c28f8d69cfae8fb54672a15522 | https://clubclio.co.kr/shop/goodsView/0000005157 | product_specific_primary |
| be8a590e-e5cb-4af4-84e7-99c7e121f45a | contains_active | "hyaluronic_acid" | {"market":"KR"} | 6fd066cc24bef6d755cb749d43278ca02ed0615c95bf64f26f1896198884aec1 | https://clubclio.co.kr/shop/goodsView/0000005157 | product_specific_primary |
| be8a590e-e5cb-4af4-84e7-99c7e121f45a | contains_active | "sodium_hyaluronate_crosspolymer" | {"market":"KR"} | e41dcc38f80b4b4f43d254ae31ffe0f51c38f7d38db1121ebf57516e41db56e2 | https://clubclio.co.kr/shop/goodsView/0000005157 | product_specific_primary |
| be8a590e-e5cb-4af4-84e7-99c7e121f45a | product_format | "pad" | {"market":"KR"} | 7ad1e29dbcbcc1e24550732023c53dd09d9397d111e3fb004e339e1d0374db9f | https://clubclio.co.kr/shop/goodsView/0000005157 | product_specific_primary |
| be8a590e-e5cb-4af4-84e7-99c7e121f45a | wipe_off_use | true | {"market":"KR"} | c4c500478d662d022495e162280592077b906540bb499e583b5809afd0ae1562 | https://clubclio.co.kr/shop/goodsView/0000005157 | product_specific_primary |
| c4a5f510-8d9e-46bd-a31c-3c0a34fee331 | contains_active | "mandelic_acid" | {"market":"KR"} | 36feec2c175c7181f93d7e0ef3f7c703c93a18431bca7497e4fe661e3790043a | https://www.dr-g.co.kr/item/9987 | product_specific_primary |
| c4a5f510-8d9e-46bd-a31c-3c0a34fee331 | contains_active | "panthenol" | {"market":"KR"} | a667fd875319508fc621e89b4a9e130f3731849f9904dec716503ec470c11eb6 | https://www.dr-g.co.kr/item/9987 | product_specific_primary |
| c4a5f510-8d9e-46bd-a31c-3c0a34fee331 | contains_active | "niacinamide" | {"market":"KR"} | d8fb9a208c3dd26d4dc36e3b4490933a4f62f67c78b71806ff2e5ae56259574c | https://www.dr-g.co.kr/item/9987 | product_specific_primary |
| c4a5f510-8d9e-46bd-a31c-3c0a34fee331 | product_format | "liquid" | {"market":"KR"} | f77373d8990861b445a27ea6700806fd597934b7bdd4586b5760770912dbd24c | https://www.dr-g.co.kr/item/9987 | product_specific_primary |

## Controlled lifecycle

1. register 7 Subjects
2. ingest 16 evidence records
3. prepare 16 under_review assignments
4. transition 16 ready_for_confirm
5. preflight all 16
6. confirm exact 16 only after every preflight is ready

Expected task-owned delta: Subjects/Sources/Bindings +7; Evidence/Instances/Links/Assignments/Confirmations/Current +16; Review Events +71; adopted products +7.

No research, adjudication, Registry/schema/RPC/migration/scorer/CandidatePolicy/Decision-Axis production changes. Next stage NOT STARTED.
