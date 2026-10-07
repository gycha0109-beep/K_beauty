# V2.1-8H-R14A — ZEROID Presentation Size Recovery Recheck

## 판정

`HOLD — FIRST_PARTY_PRESENTATION_SIZE_UNCONFIRMED`

대상:

- 제품: 제로이드 인텐시브 SOS 플러스 밤
- Product ID: `7a98b5e7-2c1f-441a-afee-dd1c592d95bc`
- catalog size: `40ml`

## R9 기존 HOLD

R9는 공식 ZEROID 제품 페이지에서 현재 제품명과 전성분을 확인했지만, first-party 텍스트에서 40ml presentation을 닫지 못했다.

기존 이유:

`CURRENT_FORMULA_ESTABLISHED_PRESENTATION_SIZE_NOT_FIRST_PARTY_CLOSED`

`FIRST_PARTY_PRESENTATION_SIZE_UNCONFIRMED`

R14A는 이 HOLD를 자동 해제하지 않고 최신 공개 근거로 다시 검증했다.

## 최신 first-party 재검증

공식 ZEROID 제품 페이지:

`https://www.zeroid.co.kr/web/product/product_detail.asp?idx=365`

현재 공개 HTML에서 확인된 것:

- `인텐시브 SOS 플러스 밤`
- `INTENSIVE SOS+ BALM`
- 제품 설명
- 전성분
- 공식 제품 이미지 locator

확인되지 않은 것:

- HTML 텍스트의 `40ml`
- 공식 제품 이미지에 인쇄된 용량의 검증 가능한 판독
- 공개 사업자몰 target SKU의 `40ml` 텍스트

공식 사업자몰 entrypoint는 존재하지만 공개 크롤링 가능한 target SKU presentation을 확보하지 못했다.

## 보강 근거

다수 secondary/retail source는 `40ml`를 일관되게 표시한다.

- 화해: 40ml
- 전문 판매처: 40ml
- marketplace: 40ml
- 일부 판매처는 제조업자/책임판매업자를 `(주)네오팜`으로 표시

그러나 R9 authority policy는 secondary corroboration만으로 missing first-party presentation scope를 닫는 것을 금지한다.

따라서 40ml가 시장에서 강하게 corroborate된다는 사실과, Product Fact Subject를 등록할 권위가 생겼다는 판단은 분리한다.

## Production readback

현재 Production:

```text
catalog size_ml   = 40
Subject           = 0
Current Fact      = 0
Fact Instance     = 0
Confirmation      = 0
```

R14A에서 hosted write는 0이다.

## 결정

`HOLD` 유지.

아래 조건 중 하나가 충족되기 전에는 Subject 등록으로 넘어가지 않는다.

1. ZEROID 공식 제품 정보가 target SKU와 `40ml`를 명시적으로 결합
2. 공식 사업자몰의 해당 SKU가 `40ml`를 노출
3. 공식 제품 이미지에서 `40ml`를 검증 가능하게 판독하고 그 이미지가 idx=365 product page에 직접 결합됨을 고정

## 다음 게이트

`V2.1-8H-R14B_ZEROID_FIRST_PARTY_PRESENTATION_CAPTURE`

상태:

`BLOCKED_PENDING_EXTERNAL_FIRST_PARTY_EVIDENCE`

R14B entry condition이 충족되기 전에는:

- Subject registration 금지
- Evidence ingest 금지
- Review preparation 금지
- Confirmation 금지
- Recommendation admission/activation 금지
