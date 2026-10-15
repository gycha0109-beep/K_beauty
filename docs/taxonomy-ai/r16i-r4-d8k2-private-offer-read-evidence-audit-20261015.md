# D8K-2 — 상품별 판매처 조회와 옵션 증거 실사

> 2026-10-15 · STATUS: CODE_READY / SYNTHETIC_OFFLINE_VERIFIED / REAL_DATA_HOLD
> 기준 PR #1255 HEAD 670e0bbc; 별도 taxonomy-ai D8K-2 브랜치. 보호 DB/API/Auth 변경·병합·배포 승인 아님.

## 1. 기존 DB / RPC 확인

- 기존 public.product_offers는 Product UUID, seller, listing ID/URL, 가격 관측 금액·통화·시각, 판매·재고 상태 및 링크 헬스 데이터를 보유한다.
- 현재 선택 옵션 ID, variant/SKU, 단품/다중팩/증정 구성, 옵션별 배송비, 배송비 포함 총결제금액의 독립 근거가 없다. 카탈로그 상품 가격과 판매처 선택 옵션 가격을 혼용하지 않는다.
- 동일 판매자 listing ID 및 URL은 고유 제약을 가지므로 한 페이지의 여러 옵션을 서로 다른 임의 listing으로 쪼개 저장하지 않는다.
- read_product_offer_presentation_authority_v2(uuid[])는 1회 64개 Product ID, 256개 Offer까지 반환한다. 제한된 recommendation_admission_runtime에게만 실행 허가; anon, authenticated 및 service_role은 실행 불가. Raw table SELECT 역시 일반 runtime에서 금지. SECURITY DEFINER owner 경계를 변경하지 않는다.
- 기존 단일 링크 선택기(lib/product-offer-read-path.js)와 D8K-1 판매처별 옵션 비교기(lib/commerce/product-offer-comparison-v1.mjs)는 유지한다.

## 2. 이번 구현

- lib/commerce/product-offer-authority-read-v1.mjs: 정확한 Product UUID 중복 제거/정렬, 64개 단위 조회 계획, 주입된 기존 권한 보유 서버 읽기 함수의 응답 검증, 오류 시 전체 HOLD.
- scripts/product-evidence/verify-d8k2-offer-authority-read-v1.mjs: 외부 네트워크/DB 없이 가상 응답의 수량 상한, 실패, ID 혼입, 중복, 누출 차단 검증.
- scripts/product-evidence/verify-r16i-price-scope-review-v1.mjs: 새 검증을 기존 Database Integration Authority 체인에 연결. 새 Actions workflow 없음.

모듈은 DB 클라이언트·Auth 권한을 만들지 않는다. 실서버 호출자도 추가하지 않는다. 호출자가 추천·노출 허가를 받은 실제 catalog Product UUID만 전달해야 하며 사용자 소유 제품을 섞지 않는다.

입력 상한은 512 ID, 내부 RPC는 최대 64 ID/256 Offer, 합산 비교기 전달 상한은 256행. 예외·권한거부·버전 차이·다른 상품의 Offer·중복 listing·합산 상한 초과 시 전체 HOLD이며 부분 성공 가격을 내놓지 않는다. 중복 추천 ID는 한 번만 조회한다.

현재 RPC에서 반환된 금액과 링크는 실제 선택 옵션·구성·배송비가 증명되지 않았으므로 노출하지 않는다. 내부 반환값에는 Seller/Offer 식별자, 옵션증거 UNATTESTED, comparisonEligible=false, ctaEnabled=false만 남긴다. 조회 결과 0건은 품절이 아니라 미관측이다.

## 3. 판매처별 추가 증거

| 채널 | 필수 검증 | 현재 |
| --- | --- | --- |
| 공식몰 | 공식 도메인·판매자, 선택 variant/용량, 증정·회원가·배송비, 최종 redirect | 미확정 |
| 쿠팡 | 판매자 신분, 선택옵션/구성, 배송·쿠폰 조건, URL allowlist | 직접 CTA 미허가 |
| 올리브영 | 옵션별 정체성, 구성·증정·배송조건, 링크와 가격 관측시점 | 도메인 검사 일부만 기존 존재 |
| 화해 | 상품 옵션과 본품/기획세트 분리, 가격·배송·재고·링크 검증 | 기획세트 단품 가격 전용 불가 |

상품마다 네 판매처가 모두 존재할 필요는 없고, 다른 판매처로 확장할 수 있지만 실제 검증된 Seller 선택옵션만 표시 대상이다.

## 4. 별도 승인 필요한 보호 변경

현행 RPC는 제한된 내부 Transport로 재사용 가능하지만 **검증된 selected-option 가격 비교 DTO**를 만들 수 없다. 실사용을 위해선 독립된 옵션·패키지·배송 근거 구조, 동일 listing의 multi-option key, 가격 이력, Seller/링크 검증, 서버 role 접근 및 사용자 결과 응답/저장 분리 설계가 필요하다.

승인 패킷 필수: 현행 스키마/RPC·권한·기능 소비자 영향표, additive option/evidence 관계와 버전 계약, PG17 격리 권한 시험, 사전 read-only/preflight, 데이터 손실 없는 rollback, Feature OFF 경로. **별도 승인 전 migration, grants, API fields, Production Product/Offer, direct URL allowlist 변경 금지.**

D8D v2 SNATURE 개별 상품 승인 gate는 OFF 유지. 보안 이슈 #1208 및 PR #1288 미병합 상태에서는 최종 PR 병합과 배포 금지.

## 5. 검증/남은 작업

- 로컬 Node: node scripts/product-evidence/verify-d8k2-offer-authority-read-v1.mjs
- 기존 CI: node scripts/product-evidence/verify-r16i-price-scope-review-v1.mjs
- 실제 권한 있는 RPC 호출·실제 판매처 가격·전체 사용자별 Product ID·모바일 UI·공유 링크·저장 리포트 검증은 완료되지 않았다.
- 후속 D8K-3은 독립 mock UI·ko/en·mobile·dark/light·접근성. D8K-4 활성 free/premium 연결은 권한과 데이터 계약 확보 후 수행한다.

**상태:** 운송 계약 CODE_READY, synthetic-only 검증. D8K-2의 실제 판매처 선택옵션·가격·링크 입증과 운영 연결은 HOLD.
