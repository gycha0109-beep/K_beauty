# D8K-3 — 공통 구매처 비교 UI (mock-only)

> 2026-10-15 · STATUS: CODE_READY / NODE_SYNTHETIC_VERIFIED / BROWSER_E2E_AND_REAL_DATA_HOLD.
> 별도 브랜치: feat/taxonomy-ai/d8k3-seller-comparison-mock-ui-20261015.
> D8K-2 PR #1320 위의 추가 소형 변경이며 본격 앱 연결·운영 노출 아님.

## 실제 구현

- lib/commerce/product-offer-presentation-v1.mjs: D8K-1에서 따로 검증·계산된 다중 판매처 비교 결과를 한국어/영어 UI 표시값으로만 바꾸는 순수 함수. 직접 URL, CTA 허가, DB 접근 로직 없음.
- components/commerce/ProductOfferComparison.jsx: 무료 및 프리미엄 카드에서 추후 함께 사용할 수 있는 공통 인터페이스. 단품/묶음/증정 기획세트 별도 그룹, 판매처 이름/선택옵션 가격/배송비 포함 여부/가격 관측일/배송비 미확인 안내. 좁은 화면은 1열, 큰 화면 2열; 라이트/다크 Tailwind 클래스 및 aria 안내 포함.
- 실제 근거 미확정 CTA는 무조건 disabled. 현 mock component는 D8K-1이 URL을 허가한 테스트 fixture에서도 구매 클릭이 불가능하며, UI 스위치를 통해 몰래 허가하도록 만들지 않았다.
- scripts/product-evidence/verify-d8k3-offer-presentation-v1.mjs: 단품과 증정 기획세트 분리, KR/EN, 배송비/총 결제액 구분, HOLD/empty, NULL/0 필터, 반응형/다크 클래스, 비활성 버튼을 가상 데이터로 검사.
- 새 검증은 기존 scripts/product-evidence/verify-r16i-price-scope-review-v1.mjs에 편입. 별도 CI workflow 없음.

## 지켜진 영역과 현재 안 되는 것

- 현재 무료 결과/프리미엄 실제 카드에 아직 import/render 연결하지 않았다. UI 소스를 만들었다는 것과 사용자가 화면에서 볼 수 있다는 것은 다르다.
- 상품 가격·링크를 수집하거나 신뢰 상태를 승격하지 않았다. UI는 D8K-1 가상 Option projector 입력을 기준으로 테스트했다. UI에 근거 없는 live Offer를 넣지 않는다.
- Product 추천 적합도 점수, Product 가격 원본, API 응답/저장 포맷, DB schema, RLS/Auth/결제, 운영 배포, 직접 링크 allowlist에 변경 없음.
- 2열 및 dark/light, ko/en은 정적 계약과 뷰모델에 대한 테스트다. **실제 브라우저/시각·키보드·스크린리더 E2E는 아직 검증하지 않았다.**
- D8K-4 실제 연결에는 추천 Product ID, 상품 노출 허가, 저장 리포트/공유 공개 투영 경계와 내부 Offer RPC 접근 경로를 별도 확인해야 한다. DB/API 보호 변경은 독립 승인 전 HOLD.
- Supply Chain #1208 여전히 release/merge 차단. D8D v2 SNATURE owner gate OFF.

## 검증

- Node 직접 실행: node scripts/product-evidence/verify-d8k3-offer-presentation-v1.mjs
- 기존 DB 검증체인: node scripts/product-evidence/verify-r16i-price-scope-review-v1.mjs
- Synthetic local draft PASS 14 scenarios; 정확한 브랜치/PR SHA에 대한 GitHub CI와 브라우저 E2E는 별도 확인.
- 후속: UI 실제 화면 소비자 연결 전에 권한 변경 없는 테스트 경로로 mock snapshot 확인, 승인된 옵션/evidence 확보 후 D8K-4 PR. 보호 권한이 확보되지 않으면 여기서 멈춘다.
