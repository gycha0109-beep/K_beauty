# V2.1-8H-R14B — ZEROID 공식 시각 용량 근거 조사

## 결과

**HOLD_WITH_FIRST_PARTY_VISUAL_CANDIDATE**

R14A와 달리 ZEROID 공식 도메인 소유 이미지에서 **인텐시브 SOS 플러스 밤 40ml**라는 텍스트를 실제 이미지 검색 미리보기로 확인했다.

- 공식 브랜드 이미지: https://www.zeroid.co.kr/data/rental/brand/summery_Intensive_sosbalm.jpg
- 표기: 인텐시브 SOS 플러스 밤 / 40ml
- 현재 공식 제품 상세: https://www.zeroid.co.kr/web/product/product_detail.asp?idx=365
- 상세 이미지: https://www.zeroid.co.kr/data/rental/goods/big/202509739133436.jpg
- 썸네일: https://www.zeroid.co.kr/data/rental/brand/top_Intensive_sosbalm.jpg

## 아직 해소되지 않은 증거 연결

공식 이미지의 존재만으로 **현재 상세 SKU idx=365와 해당 40ml 그래픽이 동일한 최신 presentation**이라고 단정할 수 없다.

- `idx=365` HTML 텍스트에는 40ml가 보이지 않는다.
- 검색 이미지가 귀속된 URL은 `idx=322`였으나 해당 URL은 현재 **리케닉 크림 우레아 10%** 상품이다.
- 공식 `summery_Intensive_sosbalm.jpg`는 이미지 검색에서 확인했지만, `idx=365` HTML에서 이 이미지에 대한 직접 링크를 확보하지 못했다.
- 원본 이미지 바이트/해시를 현재 실행환경에서 확보하지 못했다. `asset_sha256=null`로 보존하며 절대 가공하지 않는다.

이것은 **기존 R14A '공식 이미지 확인 불가' 대비 신규 발견**이지만, R9의 현재 공식 presentation 일치 보증을 모두 만족한 것은 아니다.

## 권위 경계

- `FIRST_PARTY_PRESENTATION_SIZE_UNCONFIRMED` HOLD 자동 해제 금지
- Subject 생성 금지
- Fact/Evidence ingest 금지
- Confirmation 금지
- Recommendation admission/activation 금지
- Production write: 0

## 다음 게이트

`R14C_ZEROID_OFFICIAL_VISUAL_LINEAGE_VERIFICATION`

`idx=365`와 40ml 시각 자료를 직접 결합하는 공식 출처의 실제 HTML, 제품별 상세정보 또는 재현 가능한 날짜/출처가 있는 화면 캡처를 확보하면 **별도 Subject identity preflight**로 넘어간다. 그때까지 HOLD 유지.
