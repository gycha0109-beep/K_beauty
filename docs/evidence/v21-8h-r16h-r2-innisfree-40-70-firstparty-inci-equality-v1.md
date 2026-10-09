# V2.1-8H-R16H-R2 — 한국 이니스프리 40ml·70ml 공식 전성분 실측 비교

## 종료 판정

**`R16H_R2_EXACT_KR_INCI_40_70_MATCH_FORMULATION_LINEAGE_HOLD`**

2026-10-09 21:44 KST(UTC 12:44) 기준 GitHub Actions #37931941113의 실제 한국 공식 HTML 응답 바이트를 다운로드한 뒤 **원본 SHA-256과 전성분 텍스트 SHA-256을 각각 독립 재계산**했다. R16H-R1의 '한국 70ml 원본 미수집' 상태는 **해소**됐으며, 해외 공식몰의 'Birch Seed Oil' 혼동을 국내 전성분에 전이하지 않는다.

| 항목 | 비자 시카 밤 EX 40ml | 비자 시카 밤 EX 대용량 70ml |
|---|---|---|
| 한국 공식 상품번호 | `34622` | `34623` |
| 공식 원본 | https://m.innisfree.com/kr/ko/dp/product/34622?inmPrdCatCd=UA | https://m.innisfree.com/kr/ko/dp/product/34623 |
| 바이트 길이 | 555,448 | 538,371 |
| HTML 원본 SHA-256 | `d562438e70289b9bd5da5dfece7445de8d5c67f28f2184e61381bba81e1734b2` | `7b7e2c0821202fd6d1fc1bffe6c52829caf6f76d53debda5c38b8e378cc2a3bd` |
| 공식 원본 명칭·용량 | 40ml 일치 | 70ml 일치 |
| 공식 상품정보고시 전성분 | 26개 | 26개 |
| 배열·순서 비교 | **26/26 일치** | **26/26 일치** |

동일 전성분 원문 문자열의 SHA-256: `3a9ecd76e31282c42b245986c6b5f6adba0d9dd61c2adfa592a2f411403a8134`.

실제 동일한 한국 공식 고시에 등장한 제품 핵심 성분은 `비자나무씨오일(1,000ppm)`이다. 호주 판매용 페이지의 `Torreya Nucifera Seed Oil`과 대응하는 표기가 관측됐지만 해외/국내 권한은 분리한다. 말레이시아 공식몰의 `Birch Seed Oil` 및 70ml 상품명/40ml 정보표 불일치는 **한국 공식 원본끼리 비교한 결과를 부정하지 않는다**. 단, 해외 공식몰 오타/로컬라이제이션 원인은 이번 실사에서 판정하지 않았다.

### 원본 증적

- [GitHub Actions #37931941113](https://github.com/gycha0109-beep/K_beauty/actions/runs/37931941113)
- 다운로드 원본: artifact **#11616921172** `r16h-p1-innisfree-kr-40-70-bytes`.
- 실행 HEAD: `1c4d407b4c49cd63889417f9eff77a5764b507a0`; 원본 manifest와 **정확히 일치**.
- 전체 ZIP SHA-256: `b9a12c7da48b7782d673e5b48d92c9bec6761bb14a3a931f822666e7e17b643f`.
- 원본 HTML은 Git에 커밋하지 않으며 **7일 보관**이다. 요약 메타 JSON만 저장한다.
- 원본 문자열에서 법정 전성분 필드를 직접 재추출해, 두 동일 문자열 26개 및 문자열 SHA-256이 일치함을 검증했다.
- 저장소 감사 JSON: `evidence/product-decision-axis-non-numeric-shadow-v2/barrier-support-p1-r16h-r2-kr-40-70-official-inci-audit-v1.json`

### 허용 가능한 기술적 결론

**관측 확정:** 두 한국 공식 상품 페이지에 게재된 전성분의 **명칭과 순서**가 동일하다. 40ml와 70ml를 서로 다른 **상업적 포장(presentation)**으로 분류하는 근거가 강화됐다.

**미확정:** 동일 성분명만으로 전체 **함량·배합비**, 실제 제조 **로트**, **현행 처방 세대**, 변경 **시행일**을 증명할 수 없다. 서로 다른 생산 세대에서 동일 성분명 배열을 유지했을 가능성도 있다. 따라서 현재 증거만으로 두 용량의 `formulation_revision_key`, `subject_semantic_key`를 생성하거나 Product Fact Subject를 등록하지 않는다.

**기존 P1 에스네이처 문제는 별개:** 80ml 브랜드 공식 전성분은 25개 확보됐지만, 90ml 판매처 목록은 정제수 first vs 블루아가베잎추출물 500,000ppm first로 충돌하고 **90ml 브랜드 공식 자료/제조 로트 증거는 없다**. 80ml와 90ml 동일성 판정은 계속 HOLD.

### 다음 게이트

`R16H_R3_SNATURE_90ML_BRAND_INCI_AUTHORITY_AND_BOTH_FORMULAS_LOT_APPLICABILITY`

1. 에스네이처 90ml의 **브랜드/제조사 공식 제품 고시, 원본 사진 또는 공인 상품페이지**를 추가 회수해 80ml 전성분과 비교한다.
2. 이니스프리 40/70ml의 배합비·제조 로트 적용 이력은 공개 공식 공지나 제조사 출처가 없으면 **해당 부족 항목만** 공식 문의한다.
3. 별도 독립 신원 검토 및 Production 충돌 점검 전까지 Subject 신규 등록·Intake·Fact·Source Binding 쓰기 0건.
4. R16B/HOLD·ZEROID HOLD·비수치 PDA 164×12=1,968건 및 추천 불변.
