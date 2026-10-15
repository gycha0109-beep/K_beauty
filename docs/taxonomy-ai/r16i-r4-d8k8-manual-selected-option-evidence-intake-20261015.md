# D8K-8 — 실제 판매옵션 캡처 파일·독립 검토 연결 (운영 차단)

> 2026-10-15 KST · BEJEWELY taxonomy-ai · **LOCAL_MANUAL_CAPTURE_PIPELINE_READY / REAL_CHECKOUT_AND_REVIEW_AUTHORITY_HOLD**
>
> D8K-7 로컬 Docker PG17 사용자 실행 근거는 통과. 그러나 PG17 통과는 실제 판매처 증거·신뢰된 수집자·독립 검토 권한을 증명하지 않는다.
> D8K-8은 기존 R16I read-only 증거 검토 UX의 체크리스트를 참고하고, **관리자 Auth/API/DB 구조를 건드리지 않고** 공통 상품용 증거 메타데이터 검증기만 추가한다.

## 1. 기존 인프라 재사용 / 의도적으로 연결하지 않은 부분

| 기존 자산 | D8K-8 활용 | 경계 |
| --- | --- | --- |
| `app/admin/products/r16i-correction-review/R16ICorrectionEvidenceWorkbench.js` | 기존 공식몰 옵션, 결제, 판매처 옵션, 배송, 증정 SKU, 리뷰 귀속, 캡처 원본 등 **7개 항목을 검토 지침으로 참조** | 이 UI는 고정 상품 R16I 전용. 새 Product 후보를 직접 주입하거나 Auth 우회하지 않음 |
| `lib/product-purchase-link.js` | 기존 공식몰/올리브영/화해 brand↔domain/path whitelist를 **오프라인 소스 식별 힌트**로 재사용 | trusted URL 구조 ≠ 수집 시점의 선택옵션 증거, 가격 검증, direct CTA |
| `lib/commerce/product-offer-review-history-shadow-v1.mjs` | 최신 관측 및 검토 분리, 동일 수집·검토자 차단, SHA-256 동일성 및 review 상태 재검증 | SQL writer/권한/원본 발행자 인증 아님 |
| D8K-5/6 SQL 후보 | 캡처를 `product_offer_option_observations` 및 `product_offer_option_reviews` 필드와 매핑 | 운영 DB 저장과 migration은 미승인. 명시 승인 전 변경 없음 |
| `lib/commerce/safe-commerce-fetch.mjs` | 현재 직접 fetch를 허용하는 seller가 **Olive Young 한정**이라는 사실 확인 | D8K-8 CLI는 외부 페이지에 네트워크 접속하지 않음. Coupang/Hwahae 임의 fetch 확장 금지 |

## 2. 실제 외부 판매처 후보 검색 (source discovery only)

2026-10-15 공개 페이지 탐색에서 아래 후보 URL을 찾았다. **검색 시 표시된 가격을 실제 장바구니 선택옵션 가격으로 저장하지 않는다.** 가격·할인·배송 정책은 시간, 회원, 지역, 배송·증정 조건에 따라 달라질 수 있다.

| 판매처 | 발견한 공개 URL | 소스 확인 결과 / 미검증 |
| --- | --- | --- |
| 에스네이처 공식몰 | `https://snature.kr/product/detail.html?product_no=151` | 80ml 제품 페이지. 현재 `lib/product-purchase-link.js`의 공식 브랜드 도메인 목록에는 **snature.kr이 없음**. 임의 allowlist 확대 금지. 선택 SKU·최종 구매가 미확정 |
| 화해 | `https://www.hwahae.co.kr/goods/35905` | 80ml 단품 제품 공개 페이지 후보. 이전 R16I 운영 검토의 `goods/45194`와 **서로 다른 listing**으로 취급해야 함. 선택 SKU/옵션·배송 조건 별도 촬영 필요 |
| 쿠팡 | `https://www.coupang.com/vp/products/8393759227?itemId=16093987610&vendorItemId=89624202743` | 공개 페이지상 **80ml×2 선택 옵션 후보**. itemId와 vendorItemId 조합을 식별해야 함. 판매자·최종 결제·재고·배송 변동 가능; 기존 CTA allowlist 미지원 |
| 올리브영 | 80ml 단품의 정확한 `goodsNo` 미확정. 공개 [에스네이처 브랜드 스토어](https://m.oliveyoung.co.kr/m/mtn/brand/A003493)는 **60ml 더블기획** 등을 노출 | 60ml/60ml+증정 옵션을 80ml와 같은 상품이라고 간주하면 안 됨. 검색결과에서 발견된 `stg.oliveyoung.co.kr`은 운영 판매처 링크로 사용하지 않음. 80ml 옵션/정확한 goodsNo 확보까지 HOLD |

위 URL들은 **발견 경로**일 뿐 Product/Offer authority 또는 direct CTA로 승격하지 않는다. 구체적인 상품 선택은 현장 스크린샷과 DB상 canonical `product_id`, 이미 존재하는 `offer_id`를 대조해야 한다. R16I 현재 부모 Offer가 없는 경우 임의 UUID를 만들어 운영 FK를 위조하지 않고 별도 등록 승인까지 중단한다.

## 3. 로컬 실제 캡처에 적용하는 검증기

- `lib/commerce/product-offer-manual-review-intake-v1.mjs`: `inspectManualOptionCapture` + `prepareIndependentOptionReview`, pure functions
- `scripts/product-evidence/prepare-d8k8-local-option-review-v1.mjs`: **실제 사용자의 로컬 원본 파일**과 JSON 메모를 인수로 받아 SHA-256을 실제 바이트에서 계산·대조하는 오프라인 CLI
- `scripts/product-evidence/verify-d8k8-manual-option-review-intake-v1.mjs`: 가짜 UUID/가격/URL 변조·SKU/구성·배송·리뷰·해시·시간·소스 식별 가상 회귀
- `scripts/product-evidence/verify-d8k8-local-file-cli-v1.mjs`: 임시 폴더 안에 **가짜 PNG 파일을 실제 기록**해 CLI 입력·리뷰 분리·손상/심볼릭 링크·예외·출력 검증

CLI는 이미지 OCR이나 판매처 페이지 파싱으로 **판매 가격을 추측하지 않는다**. 수집자가 원본에서 사람이 확인한 값만 manifest에 적으며, 검토자는 **캡처와 실제 페이지를 독립적으로 대조**한 후 7항목을 `matched`로 제출한다. 메모 필드만으로 검토자가 진짜 다른 사람인지 보장할 수 없으므로 최종 등급은 `INDEPENDENT_REVIEW_PACKET_READY_NO_WRITE`, public price/CTA/DB write 모두 `false`다.

CLI는 다음 속성을 보장한다.
- 파일 포맷 PNG/JPEG/WebP/PDF/HTML/TXT의 크기·확장자·대표 magic을 검사
- 파일 바이트 SHA-256과 manifest+review digest 완전 일치 필요
- 심볼릭 링크, 숨긴 환경·키 파일 이름, 중복 입력 경로 차단
- 사용자의 임의 파일을 **외부로 전송·저장하지 않고**, 가격·URL·파일 경로·원본 내용을 콘솔에 출력하지 않음
- 승인·DB 연결·실제 가격 공개 없음. 모든 값은 private candidate 출력에만 머무름

### PowerShell 입력 파일 만들기

원본 캡처는 저장소 밖의 **개인정보를 제거한 비공개 폴더**에 보관한다. 예를 들어 `D:\private-offer-evidence\capture.png`을 사용한다.

```powershell
(Get-FileHash "D:\private-offer-evidence\capture.png" -Algorithm SHA256).Hash.ToLowerInvariant()
(New-Guid).Guid
```

수집자 `capture.json`은 아래 필드를 **실제 확인 가능한 값으로만** 채운다. `productId`, `offerId`는 임의 생성이 아닌 기존 DB 상의 정확한 외래키여야 하며, `observationId`만 새 고유 UUID를 발급한다.

```json
{
  "productId": "REPLACE_WITH_ACTUAL_CANONICAL_PRODUCT_UUID",
  "offerId": "REPLACE_WITH_ACTUAL_EXISTING_PARENT_OFFER_UUID",
  "observationId": "NEW_UUID_FOR_THIS_CAPTURE",
  "brand": "에스네이처",
  "productName": "아쿠아 스쿠알란 수분크림 80ml",
  "sellerKey": "hwahae",
  "sellerName": "화해",
  "listingId": "35905",
  "sourceUrl": "https://www.hwahae.co.kr/goods/35905",
  "sellerOptionKey": "REPLACE_WITH_CONFIRMED_SELLER_OPTION_KEY",
  "variantId": "REPLACE_WITH_EVIDENCED_SKU_ID",
  "optionKind": "single",
  "unitSize": 80,
  "sizeUnit": "ml",
  "quantity": 1,
  "gifts": [],
  "selectedOptionPriceKrw": null,
  "shippingPriceKrw": null,
  "shippingPriceBasis": "unknown",
  "observedAt": "REPLACE_WITH_CAPTURE_ISO_TIMESTAMP",
  "sourceName": "manual_source_capture",
  "sourceRecordId": "REPLACE_WITH_CAPTURE_RECORD_ID",
  "collectorActorKey": "collector_one",
  "sourceEvidenceSha256": "REPLACE_WITH_LOCAL_FILE_SHA256_LOWERCASE"
}
```

**위 샘플은 값이 미확정이라 그대로는 통과하지 않도록 의도했다.** 배송비 확인이 불가능하면 `unknown`/null로 두어도 선택옵션 **상품 가격**에 대한 독립 검토는 가능하지만, 배송비 포함 최종 결제가로 주장하지 않는다. 지역별 추가 배송·회원 혜택이 있는 경우 고정 배송비로 기록하지 않는다.

검토자 파일 `review.json` (검토 메모는 수집자와 별도의 주체가 작성해야 하며, `observationId`와 `sourceEvidenceSha256`는 캡처 파일과 일치해야 한다):

```json
{
  "reviewId": "NEW_INDEPENDENT_REVIEW_UUID",
  "observationId": "MATCH_CAPTURE_OBSERVATION_UUID",
  "verdict": "verified",
  "reviewerReference": "PRIVATE_INDEPENDENT_EVIDENCE_REVIEW_REFERENCE",
  "reviewerActorKey": "reviewer_two",
  "sourceEvidenceSha256": "MATCH_VERIFIED_ARCHIVED_CAPTURE_SHA256",
  "reviewedAt": "REPLACE_WITH_REVIEW_ISO_TIMESTAMP",
  "checks": {
    "product_listing_scope": "UNREVIEWED",
    "selected_sku": "UNREVIEWED",
    "pack_gift_composition": "UNREVIEWED",
    "selected_option_price": "UNREVIEWED",
    "shipping_conditions": "UNREVIEWED",
    "capture_origin": "UNREVIEWED",
    "product_vs_offer_attribution": "UNREVIEWED"
  }
}
```

`verdict=verified`는 모든 체크가 실제로 검토되어 `matched`인 경우에만 수락한다. 하나라도 증거 부족이면 임의로 matched를 입력하지 말고 review를 보류하거나 `rejected`로 판단한다. 검토의 서명·신원은 아직 DB/Auth에 연동되지 않았다.

### 실행

```powershell
node scripts/product-evidence/prepare-d8k8-local-option-review-v1.mjs --manifest "D:\private-offer-evidence\capture.json" --source "D:\private-offer-evidence\capture.png"
```

캡처 metadata/바이트가 일치하면 `AWAITING_INDEPENDENT_REVIEW`; 두 번째 파일도 준비됐으면:

```powershell
node scripts/product-evidence/prepare-d8k8-local-option-review-v1.mjs --manifest "D:\private-offer-evidence\capture.json" --source "D:\private-offer-evidence\capture.png" --review "D:\private-offer-evidence\review.json"
```

독립 검토 메타데이터만 완전하면 `INDEPENDENT_REVIEW_PACKET_READY_NO_WRITE`이다. **실제 검증 완료/게시 권한으로 의미하지 않음.** 소스 페이지 원본 진실성·검토자 신원·Product/Offer DB 소유자가 아직 연결되지 않았다.

테스트:

```powershell
node scripts/product-evidence/verify-d8k8-manual-option-review-intake-v1.mjs
node scripts/product-evidence/verify-d8k8-local-file-cli-v1.mjs
```

## 4. D8K-9 이전에 필요한 운영 계약 — 보호 승인 게이트

1. 실제 `product_id`와 `offer_id`를 신뢰된 **읽기 전용 관리자 권한**으로 재확인하고 listing/selected SKU 결속 (현재 입력 JSON만으로 확인 불가)
2. original capture archive의 접근권한·원본 해시·소스 사이트 관측 시각 신뢰, 수집자/검토자 인증 identity, 별도 검토 감사 로그
3. 결과를 DB review-event/option-observation history에 쓰는 **권한 분리된 승인된 저장 writer**와 rollback/철회 경로 (SQL 후보가 PG17에서 통과했더라도 실제 운영 스키마는 미적용)
4. **실제 선택 옵션 가격·배송·결제 조건**의 지역·회원·쿠폰 scope를 검증한 뒤 private server DTO 및 latest-review enforcement
5. 무료·프리미엄 옵션 비교 UI는 계속 하드 OFF, 공유 링크 제외, direct CTA 허가는 별도 보안 검토
6. 공급망 #1208 해결 및 별도 병합·배포 승인 전까지 HOLD

## 5. 검증 등급

- D8K-7: 사용자 제시 **실제 로컬 Docker PG17** 7/7, 역할 거부 7건 통과.
- D8K-8 pure contract: synthetic/offline validations (실제 판매처 캡처·개별 판매자 가격 없음).
- D8K-8 CLI: 명시적으로 지정한 로컬 파일에서 SHA-256 계산, private packet metadata 검사. 샘플 테스트는 synthetic bytes.
- 판매처 공개 웹 페이지 URL 발견은 **탐색 결과**일 뿐 원본 관측 증거 저장·독립 검토·가격 승인 상태가 아니다.

**Protected boundary**: `supabase/migrations`, Auth/RLS/grants, API response, saved report, production Product/Offer, provider crawler, external fetch policy, payment, feature gate, merge, deploy 미수정.
