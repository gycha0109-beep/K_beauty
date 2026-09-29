# DATA-AI29C-C6 — Protection Discrimination Recovery Wave 2

## 목적

C5E Production audit의 `HOLD_NO_DISCRIMINATING_AXIS`를 해소하기 위한 discrimination-first 확장입니다.

현재 기준은 sunscreen 15개, SPF governed 13개, UVA governed 11개이며 확인된 SPF/UVA가 각각 하나의 scoring bucket에만 몰려 있습니다. C6는 제품 수 자체가 아니라 **서로 다른 governed SPF/UVA bucket 확보**를 목적으로 합니다.

## Primary 5

| HwaHae ID | 제품 | 공식 보호 라벨 | 공식 페이지 |
|---|---|---|---|
| 1883342 | SIDMOOL Physical daily sunmilk | SPF20 / PA++ | https://www.sidmool.com/shop/shopdetail.html?branduid=76777 |
| 1801617 | SIDMOOL MIN JUNG GI Physical Sun block | SPF35 / PA+++ | https://www.sidmool.com/shop/shopdetail.html?branduid=76921 |
| 1802915 | SIDMOOL Dr. Troub Zinc Physical | SPF35 / PA+++ | https://www.sidmool.com/shop/shopdetail.html?branduid=77142 |
| 1790960 | SIDMOOL Dr. TROUB SKIN RETURNING BIO REPAIR + SUNCREAM | SPF40 / PA++ | https://www.sidmool.com/shop/shopdetail.html?branduid=77107 |
| 1895004 | SIDMOOL JOJOBA SUNCREAM | SPF40 / PA++ | https://www.sidmool.com/shop/shopdetail.html?branduid=77215 |

각 제품은 SIDMOOL 공식 상품 페이지와 HwaHae exact product ID의 두 identity anchor를 갖습니다. HwaHae/공식 페이지의 발견 정보는 아직 Product Fact가 아닙니다.

## Reserve 2

Reserve는 primary와 동시에 활성화하지 않습니다. **primary가 Product promotion 전에 identity/formulation/presentation 검토에서 탈락할 때만** 1:1 교체합니다.

- HwaHae 2005891 — MIN JUNG GI Physical Sun cream, SPF40 / PA++, SIDMOOL branduid=144
- HwaHae 1920264 — Natural sun cream, SPF35 / PA++, SIDMOOL branduid=66

Product promotion 이후 Product Fact 단계가 실패했다는 이유만으로 reserve를 추가하면 canonical sunscreen denominator가 더 커지므로 금지합니다. 그 경우 먼저 해당 Product의 evidence/research/adjudication 문제를 해결합니다.

## Brand-cap override

기본 catalog expansion `brand_cap=1`을 전역 변경하지 않습니다.

C6에서만:

- mode = `PROTECTION_DISCRIMINATION_PROOF`
- active wave size = 5
- C6 active brand cap = 5
- scope = `DATA-AI29C-C6_ONLY`

같은 브랜드 5종을 허용하는 이유는 각 제품이 서로 독립적인 SPF/UVA protection proposition을 제공하기 때문입니다. 이 예외는 Recommendation admission이나 일반 catalog selection 정책으로 전파되지 않습니다.

## Candidate registration readback

Production discovery layer에 7건을 등록했습니다.

- Product writes: 0
- Product Fact Instance writes: 0
- Product Fact Current writes: 0
- review_status: new
- identity_resolution_state: unresolved
- taxonomy: catalog-taxonomy-v1 / sunscreen / active_shadow
- product_write_allowed: false
- product_promotion_allowed: false
- recommendation_admission_allowed: false

## 예상 gate

Primary 5가 모두 exact Subject + governed SPF/UVA confirmation까지 성공할 경우:

- corpus 20
- SPF 18/20 = 90%
- UVA 16/20 = 80%
- SPF buckets = 15–29 / 30–49 / 50+
- UVA buckets = PA++ / PA+++ / PA++++

SPF/UVA gate 통과 조건은 충족하지만 Production cutover는 여전히 별도 검토 대상이며 자동 허용하지 않습니다.

## 다음 gate

C6-D에서 primary 5개에 대해 structural identity review를 수행합니다.

Promotion 전 STOP 조건:

- identity collision
- formulation ambiguity
- presentation ambiguity
- SIDMOOL 공식 페이지와 HwaHae exact product mismatch
