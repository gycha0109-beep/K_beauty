# D8K-11 — 기존 R16I 증빙 2건 원본 무결성·독립 검토 사전 점검

> 2026-10-15 KST · taxonomy-ai · **OFFLINE_REVIEW_PREFLIGHT_READY / ARCHIVED_ORIGINAL_ACCESS_NOT_APPROVED / OWNER_SELF_REVIEW_GAP_FOUND / PRICE_RELEASE_HOLD**
>
> 이 문서는 D8K-10 사용자 승인 `운영 Supabase SELECT만`을 **Storage 원본 열람이나 관리자 심사 실행에 대한 승인으로 확대하지 않는다**.
> 기존 운영 DB/관리자 Auth/REST API/Storage/증빙 판정·등록·추천·가격 노출·배포는 그대로 둔다.
> 새 기능은 **사용자가 별도 승인해 합법적으로 확보한 로컬 사본**을 나중에 검증하기 위한 무변경 순수 검사와 로컬 CLI만 제공한다.

## 1. D8K-10에서 확인한 실제 증빙 (현재 상태를 덮어쓰지 않음)

| source key | evidence ID | Product | 기록상 선택 구성 | 현 상태 |
| --- | --- | --- | --- | --- |
| `official_single` | `97adb21c-3be4-4654-bce7-54b5dabb2423` | 에스네이처 아쿠아 스쿠알란 수분크림 | **80ml 단품** | `UNVERIFIED` |
| `hwahae_bundle` | `e0feb0e9-69f2-4ebf-bd14-0ccb320b3707` | 동일 기준 상품에 연결된 화해 판매처 캡처 | **80ml×2 + 세럼 10ml** | `UNVERIFIED` |

두 증빙 모두 캡처 메타데이터, 비공개 Storage 원본 경로와 SHA-256 참조가 있다. 그러나 이 항목들의 존재만으로는 **원본 이미지 내용/현장 출처/SKU/결제·배송 조건/검토자 독립성**이 검증되지 않는다.

**중요: 화해 기획세트는 80ml 단품과 같은 selected option이 아니다.** 두 기록의 결제가 필드를 교환하거나 기존 Product `size_ml=160`을 근거 없이 80ml 상품 실체로 정정하지 않는다. Product Fact subject/부모 Offer는 현재 0건이다.

## 2. 이미 있는 관리자 UI — 새 검토 화면 중복 구현하지 않음

`/admin/products/r16i-correction-review`

현재 실제 소스:

- `page.js`: `PRODUCTS_REVIEW` 권한을 가진 관리자만 접근.
- `R16IR4D8PrivateEvidence.js`: **저장된 증빙 불러오기 → 해당 기록의 열람 → 60초 한정 원본 보기**.
- `GET /api/admin/products/r16i-correction-review/evidence?evidenceId=...`: 권한 확인 후 해당 원본의 60초 서명 URL을 반환. **사용자의 관리자 세션에서 직접 사용하는 기능**이며 이 채팅에서는 호출하지 않았다.
- `R16IR4D8CorrectionApproval.js`와 `POST .../approval`: OWNER의 `VERIFIED` 또는 `REJECTED`를 DB 검토 ledger에 **새로 기록**할 수 있으므로 현재 사용자 승인 범위 밖. **이번 단계에서는 ‘원본 인정’·‘반려’·‘수정’·‘제외’·‘제안 승인’ 버튼을 누르지 않는다.**

원본 사진의 민감한 개인 정보는 공개 문서/PR/테스트 fixture에 복사하지 않는다. 임시 signed URL과 실제 file_sha256, Storage object path, 제출자/검토자 계정 UUID는 채팅이나 GitHub 코멘트에 공유하지 않는다.

## 3. 발견한 중요한 보안·독립 검토 누락 (미수정, 보호 승인 필요)

현재 `lib/product-intelligence/r16i-correction-approval-ledger.mjs`의 `reviewR16IEvidence`는 검토 대상 행을 다음 컬럼으로만 조회한다:

```js
.select("evidence_id,product_id")
```

이후 `reviewer_id:actorId`를 검토 ledger에 INSERT한다. 호출자의 `OWNER` 권한을 확인하지만, **원본의 `submitted_by`와 `actorId`가 같은지 조회·비교하지 않는다**. 따라서 OWNER 본인이 자신이 올린 원본을 그대로 `VERIFIED` 처리하는 일이 **코드상 차단되지 않는다**.

또한 `reviewR16IEvidence`는 승인 시 원본 Storage 바이트를 내려받아 SHA-256을 다시 계산하거나 reviewer의 7개 항목별 확인 결과를 서버에서 검증하지 않는다. 기존 `VERIFIED`의 의미를 D8K-11이 요구하는 ‘독립 원본 검토 완료’로 자동 치환할 수 없다.

이는 **새로 발견한 보호 영역 결함**이지만, `Auth/관리자 API/원장 INSERT 동작`은 사용자 승인 없이는 수정하지 않았다. 필요한 후속 보완(별도 승인): 제출자 ≠ 인증된 OWNER 검토자에 대한 서버-side 검사, 원본 해시/7항목 실제 리뷰 근거 결속, 기록 append-only/철회 상태·충돌 안전성. 그러기 전에는 `VERIFIED`가 찍혀도 가격 공개로 자동 승격하면 안 된다.

## 4. 이번에 구현한 D8K-11 오프라인 검사

| 새 파일 | 기능 |
| --- | --- |
| `lib/product-intelligence/r16i-d8k11-existing-evidence-preflight.mjs` | 기존 두 evidence ID/판매처/정확한 URL/옵션명, Product ID, 파일 SHA-256/크기/이미지 magic, 캡처 기간, 제출자·검토자 ID 상이 여부, 7개 리뷰 항목, 결제가 입력의 구조적 유효성 검사 |
| `scripts/product-evidence/check-d8k11-local-existing-archives-v1.mjs` | 명시된 로컬 두 이미지 + 비공개 JSON 메타데이터(+독립 검토 메모)를 읽어 SHA-256과 구조를 실제 파일 바이트에 대조. 네트워크 없음, DB/파일 저장·업로드 없음, 원본/가격/URL/해시/사용자 ID 출력 없음 |
| `scripts/product-evidence/verify-d8k11-existing-archive-review-preflight-v1.mjs` | 실제 두 evidence ID를 표식으로 쓰되 **가상 이미지와 가상 계정**으로 검사; 판매처/옵션 바꿔치기, 누락·중복, 해시 변조, 자가 검토, 잘못된 승인, 오래된 캡처 차단 |
| `scripts/product-evidence/verify-d8k11-local-archive-cli-v1.mjs` | 임시 폴더에서 실제 Node 로컬 파일 입출력·JSON stdout·자가 검토/PNG 변경 거절을 실험하는 가상 파일 smoke test |

승인 판정은 언제나 **`TWO_REVIEW_METADATA_PACKETS_READY_NO_WRITE`**까지다. 이 상태도 `reviewerAccountAuthenticated=false`, `pricePublicationAuthorized=false`, `productFactApproved=false`, `parentOfferBound=false`이며 서버의 독립 검토 인증이나 실제 판매처 원본 진위가 입증된 뜻이 아니다.

기존 증빙을 다운로드했다고 해서 **새 부모 Offer ID를 임의 생성하지 않는다.** D8K-8은 기존 parent Offer UUID를 필요로 하므로 지금처럼 부모 Offer가 없는 단계에서는 별도 D8K-11 사전 검토를 먼저 사용하는 것이 맞다.

## 5. 로컬 검사 방법 — 권한 있는 운영자가 원본을 준비한 이후만

실제 비공개 `object_path`, SHA-256 값, `submitted_by` 등은 고객에게 노출하지 않고, OWNER 승인된 안전한 경로로 한 번에 추출한 다음 **저장소 밖의 비공개 폴더**에서만 `evidenceRows` JSON을 관리한다. 이 작업을 자동으로 수행하는 server export/API를 D8K-11에서 추가하지 않았다.

`metadata.json` (실제 값을 임의로 만들지 말 것):

```json
{
  "evidenceRows": [
    {
      "evidence_id": "97adb21c-3be4-4654-bce7-54b5dabb2423",
      "product_id": "b639c8b4-6a61-440e-b4db-fac7381593ff",
      "source_key": "official_single",
      "source_url": "https://www.snature.kr/product/detail.html?product_no=151",
      "selected_option": "수분크림 80ml 1개",
      "checkout_price_krw": null,
      "captured_at": "REPLACE_WITH_DB_CAPTURE_TIMESTAMP_ISO",
      "created_at": "REPLACE_WITH_DB_CREATED_TIMESTAMP_ISO",
      "evidence_state": "UNVERIFIED",
      "submitted_by": "REPLACE_WITH_ACTUAL_AUTHENTICATED_COLLECTOR_UUID",
      "object_path": "REPLACE_WITH_VERIFIED_PRIVATE_STORAGE_OBJECT_PATH",
      "file_sha256": "REPLACE_WITH_ACTUAL_LOWERCASE_SHA256",
      "file_bytes": null,
      "mime_type": "image/png"
    },
    {
      "evidence_id": "e0feb0e9-69f2-4ebf-bd14-0ccb320b3707",
      "product_id": "b639c8b4-6a61-440e-b4db-fac7381593ff",
      "source_key": "hwahae_bundle",
      "source_url": "https://www.hwahae.co.kr/goods/45194",
      "selected_option": "수분크림 80ml×2 + 세럼 10ml",
      "checkout_price_krw": null,
      "captured_at": "REPLACE_WITH_DB_CAPTURE_TIMESTAMP_ISO",
      "created_at": "REPLACE_WITH_DB_CREATED_TIMESTAMP_ISO",
      "evidence_state": "UNVERIFIED",
      "submitted_by": "REPLACE_WITH_ACTUAL_AUTHENTICATED_COLLECTOR_UUID",
      "object_path": "REPLACE_WITH_VERIFIED_PRIVATE_STORAGE_OBJECT_PATH",
      "file_sha256": "REPLACE_WITH_ACTUAL_LOWERCASE_SHA256",
      "file_bytes": null,
      "mime_type": "image/png"
    }
  ]
}
```

**샘플은 일부 값이 null/placeholder이므로 반드시 HOLD**한다. 확인하지 않은 값으로 통과를 위조하지 않는다.

`review.json`은 reviewer가 원본과 실제 판매처를 독립적으로 대조한 후 작성하는 별도 비공개 파일이며, `{"reviews":[...]}` 구조로 evidence ID마다 하나의 검토 기록을 담는다. 각 검토 기록의 `reviewer_id`, `reviewed_at`, `verdict`, `reason`, `checks`는 실제 검토 근거여야 한다. `checks`는 D8K-8의 정확히 7개 키를 사용한다. 모든 항목 `matched`는 검토를 실제로 완료한 경우만 적는다.

PowerShell (두 실제 원본 PNG/JPG/WebP 사본을 확보한 경우):

```powershell
node scripts/product-evidence/check-d8k11-local-existing-archives-v1.mjs --metadata "D:\private-r16i\metadata.json" --official "D:\private-r16i\official.png" --hwahae "D:\private-r16i\bundle.png"
```

검토자가 실제 분리됐고 7항목 확인을 마친 경우에만:

```powershell
node scripts/product-evidence/check-d8k11-local-existing-archives-v1.mjs --metadata "D:\private-r16i\metadata.json" --official "D:\private-r16i\official.png" --hwahae "D:\private-r16i\bundle.png" --reviews "D:\private-r16i\review.json"
```

**주의:** CLI는 저장된 승인 원장을 수정하지 않는다. 로컬 JSON의 `reviewer_id` 자체는 인증된 관리자 세션 증명이 아니며, 이 검사만 통과했다고 DB에서 ‘원본 인정’을 눌러도 된다는 뜻은 아니다.

## 6. 범위 및 다음 명시 승인 필요 지점

**현재 승인 없이 가능한 일:** 로컬 가상 테스트, 보안 취약점 문서화, 코드 불변 조건 검증, OWNER에게 기존 관리자 UI의 원본 열람 절차 안내.

**현재 승인에 포함되지 않는 일:** 운영 Storage 이미지 다운로드/서명 URL 호출, 원본 객체의 실제 내용 확인, `submitted_by`·서명 파일 해시 등 민감 메타데이터 추출, 관리자의 `review_evidence` POST, `VERIFIED/REJECTED` DB 기록, 자체 Auth/API 변경, correction proposal/approval/apply, Product/Offer/Fact 마이그레이션, 구매 CTA/가격 공개, PR 병합·배포.

별도 명시 권한이 확보되면 **이미 보관한 공식몰·화해 두 파일부터** 실제 이미지 확인 및 제출자≠검토자 서버 검증을 완료하고, 그 후 Product 160ml → 80ml base unit 교정안과 상품별 parent Offer 생성 범위를 제안한다. 보안 이슈 #1208가 열린 동안 출시 게이트는 닫는다.
