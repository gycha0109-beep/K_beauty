# R16H-R3 — 에스네이처 90ml 공식 이미지 17개 전수 재검토 사전 단계

## 목적
R16H-R2에서 한국 이니스프리 40ml·70ml의 **공식 전성분 26/26 일치**를 확정했다. 남은 P1인 에스네이처 젤크림은 **브랜드 공식몰 #99 = 80ml**, 상세 이미지 경로 중 **90ml/260826 디렉터리 17개**가 혼재한다.

R16G에서 **처음(01.webp)·마지막(17.jpg) 2개** 이미지를 확보하여 시각 검수했으나, 두 이미지는 90ml 법정 전성분/로트 증빙이 아니다. 본 단계에서는 공식 HTML 원본에서 추출한 **나머지 정확한 15개 이미지**를 실제 바이트로 수집하고 전부 독립 검수할 준비를 한다.

## 수집
- 공식 출처: `https://www.snature.kr/web/upload/new_design/gelcream/90ml/260826/`
- 대상: `gelcream_02.jpg`부터 `gelcream_16.jpg`까지, 실제 HTML의 정확한 확장자 JPG/WEBP/GIF를 반영한 고정 15개.
- 기존 read-only `fetchOfficialAssetBytes` 재사용, HTTPS·공용 DNS·리디렉션·브랜드 호스트 검사, 파일별 8MiB·10초 제한, 바이너리 매직과 MIME 확인.
- **기존** `.github/workflows/taxonomy-ai-r16d-source-capture.yml` 작업에 추가. 새 워크플로를 만들지 않는다.
- 실제 응답 파일·HEAD/바이트 길이·SHA-256 매니페스트는 GitHub Actions 7일짜리 `r16h-r3-snature-firstparty-detail-images` 아티팩트에 보존한다. 이미지 원본을 Git에 커밋하지 않는다.
- 수집 성공 시에도 **`VISUAL_INSPECTION_REQUIRED`**. 디렉터리 `90ml`과 숫자 `260826`을 SKU, 제조일, 처방 리뉴얼 유효일로 간주하지 않는다.

## 현재 성분표 충돌 — 1차·3차 출처 분리

- 브랜드 공식 80ml 법정 고시 이미지: 25개, **정제수 → 글리세린 → 부틸렌글라이콜 → 1,2-헥산다이올 → 블루아가베잎추출물**.
- Funch Reward 90ml 상품 고시: 동일 순서로 시작하는 25개 성분. https://funchreward.com/product/에스네이처-아쿠아-오아시스-수분-젤크림-90ml/549
- G마켓 90ml 상품 고시: **블루아가베잎추출물(500,000ppm) → 정제수 → 글리세린**으로 시작. https://item.gmarket.co.kr/Item/ItemDetailV2?goodsCode=4671825529
- 브랜드 공식 NEWS 2024년 4월 프로모션에는 90ml 기획세트가 있었다. https://m.snature.kr/article/news/3/10033/page/2/
- 판매처의 전성분 표기는 **제조사 승인 및 로트 범위의 출처가 아니므로** 같은 성분 세트가 확인되더라도 동일 포뮬러 세대를 확정할 수 없다.

## R3-R2 승인 게이트

실제 이미지가 확보되면 **총 17개(기존 2 + 신규 15)의 시각 콘텐츠를 전수 검사**한다. 90ml 공식 포장 전성분/배치 번호가 없으면 `OFFICIAL_90ML_PANEL_NOT_RECOVERED` 판정으로 기술적 탐색을 종료하고 제조사/브랜드에 **정확한 부족 항목만** 문의한다. 메일은 사용자 승인 전까지 발송하지 않는다.

- 두 제품 `formulation_revision_key=null` / `subject_semantic_key=null`
- Subject 등록·Fact 확정·Intake 수정·Source Binding·Production DB 쓰기 0
- R16B (아누아/160ml), ZEROID HOLD 유지. 비수치 PDA 164×12=1,968건 및 랭킹 변화 0.
