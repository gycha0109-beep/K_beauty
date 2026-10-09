# V2.1-8H-R16G — 공식 이미지 원본 수집 사전검증

## R16F 후속 범위

- 상품: 에스네이처 아쿠아 오아시스 수분 젤크림 80ml, 공식 상품번호 99
- 원본 기반: R16D Actions #37899489889, artifact #11600769958; R16F 공식 HTML 출처 범위 실사
- 현재 표기: 80ml
- HTML 이미지 경로: 90ml 디렉터리 17개, 80ml 정보 이미지 1개, 나머지 2개
- 실제 이미지 내용·제조 로트·포뮬러 변경 여부: **이번 사전검증 시점에는 미확인**

## 수집 대상 — 공식 HTTPS 3개 파일

1. `/web/upload/new_design/gelcream/80ml/gel80ml_info.jpg` (80ml 고시 후보)
2. `/web/upload/new_design/gelcream/90ml/260826/gelcream_01.webp` (90ml 상세 첫 파일)
3. `/web/upload/new_design/gelcream/90ml/260826/gelcream_17.jpg` (90ml 상세 마지막 파일)

모두 `https://www.snature.kr` 기반. 파일 경로의 `90ml` 및 `260826`은 **제품 설명·리뉴얼·처방의 확정 권한이 아니다**.

## 재현 경로

- `scripts/product-evidence/capture-barrier-support-p1-r16g-official-images-v1.mjs`
- 기존 `lib/trust/official-source-fetch.mjs:fetchOfficialAssetBytes` 재사용. HTTPS·공용 DNS·리디렉션·이미지 MIME·실제 파일 시그니처 검사. 응답당 8MiB 및 10초 제한.
- 기존 `.github/workflows/taxonomy-ai-r16d-source-capture.yml`의 동일한 단일 작업(최대 5분)에 추가. 새 GitHub workflow 파일 없음.
- 공식 원본 수집 후 SHA-256·바이트 길이·최종 URL·실패 코드·정확한 HEAD SHA가 포함된 `manifest.json` 및 실제 이미지 바이트를 **7일간의 GitHub Actions artifact**로 보관.
- 확정 아티팩트 이름: `r16g-p1-official-visual-assets`. 실제 수집 전에 성공 또는 Digest 값을 선언하지 않음.
- 오프라인 실패 격리 검증기: `verify-barrier-support-p1-r16g-official-images-v1.mjs`.

## R16G-R2 판정 규칙

원본 캡처 성공 시에도 `RAW_OFFICIAL_IMAGE_CAPTURED_CONTENT_REVIEW_REQUIRED`까지만 허용한다. 실제 이미지에서 **80ml/90ml 표기, 전성분, 제조정보**를 독립적으로 확인해야 한다. 제조사 응답 또는 로트에 묶인 공식 처방 변경 이력이 확보되지 않으면 `formulation_revision_key`와 `subject_semantic_key`는 여전히 null이다.

실패/잘못된 MIME/다른 호스트 리디렉션은 `CAPTURE_BLOCKED`, Digest null. Product Fact·Subject·Intake·Source Binding·추천/랭킹·Production DB **쓰기 0건**.

**다음 단계:** 수집 CI와 아티팩트 확인 → 실제 이미지 시각 검수 → 제조사/브랜드 적용 범위 검증. R16B 및 ZEROID HOLD 유지.
