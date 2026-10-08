# V2.1-8H-R14C — ZEROID 현재 SKU와 공식 40ml 이미지 귀속 검증

## 종료 판정

**HOLD — CURRENT_SKU_TO_OFFICIAL_40ML_GRAPHIC_LINEAGE_UNVERIFIED**

이전 R14B에서 ZEROID 공식 이미지가 **인텐시브 SOS 플러스 밤 40ml**를 명시한다는 시각 근거를 확보했다. R14C는 그 이미지가 **현재 상세 페이지 idx=365의 40ml presentation**에 귀속되는지를 독립적으로 검증했다.

## 공식 링크 비교

| 출처 | 확인 | 미확정 |
|---|---|---|
| [현재 공식 상세](https://www.zeroid.co.kr/web/product/product_detail.asp?idx=365) | 제품명 및 전성분, `top_Intensive_sosbalm.jpg`, `202509739133436.jpg` 링크 | 40ml 텍스트 또는 40ml summary 이미지 직접 링크 |
| [브랜드 공식 시각 이미지](https://www.zeroid.co.kr/data/rental/brand/summery_Intensive_sosbalm.jpg) | 공식 도메인 이미지 검색 미리보기에 제품명 및 40ml 표기 | 원본 바이트/해시, 현재 idx=365 귀속 |
| [이미지 인덱스 연관 페이지](https://www.zeroid.co.kr/web/product/product_detail.asp?idx=322) | 현재 페이지의 실제 제품명이 '리케닉 크림 우레아 10%'임 | ZEROID SOS 밤과 동일 SKU임을 입증하지 못함 |

공식 상세 썸네일과 공식 40ml summary 이미지에 `Intensive_sosbalm`라는 파일명 공통 부분이 있다. 이는 제품명 관련 단서이지만, 제형 개정·구성 변경·이전 presentation과 구분되지 않아 단독 귀속 권위가 아니다.

직접 원본 이미지 다운로드는 실행환경의 네트워크/캐시 제약으로 실패했다. 따라서 원본 이미지 바이트를 획득했다고 기록하지 않았고, SHA-256은 null로 남겼다.

## 권위 판단

현재까지:

- 첫 번째 필수 조건: ZEROID 공식 브랜드 소유 40ml 시각 자료 — 확인
- 두 번째 필수 조건: 현재 공식 제품 idx=365 및 해당 용량 자료의 명시적 결합 — **미확정**
- R9 정책상 두 번째 조건 미달 시 Subject 등록 권한 없음

R14C에서는 DB·추천·레지스트리를 변경하지 않았다.

## 다음 단계

`R14D_ZEROID_CURRENT_PRESENTATION_OFFICIAL_AUTHORITY_ACQUISITION`을 **외부 공식 증거 대기**로 둔다.

시작 조건: 제로이드/네오팜의 현행 제품별 40ml 명시 페이지, 공식 SKU 명세, 또는 idx=365와 40ml 이미지를 직접 연결하는 재현 가능한 공식 캡처.

이 조건 없이 같은 2차 판매처·검색 인덱스를 반복 수집하거나 HOLD를 해제하지 않는다. 조건 충족 시에도 다음 작업은 **별도의 Subject identity preflight**이고, 자동 등록이나 추천 활성화가 아니다.
