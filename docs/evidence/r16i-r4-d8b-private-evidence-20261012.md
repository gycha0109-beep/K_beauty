# R16I-R4-D8B — 영구 보관형 비공개 판매증빙 (2026-10-12)

## 제공 기능
- 관리자 `/admin/products/r16i-correction-review` 화면에서 공식몰 80ml 단품 또는 화해 80ml×2 세트의 **실제 스크린샷, 촬영 시각, 선택 옵션, 입력 가격, 설명 메모**를 직접 업로드.
- `GET/POST /api/admin/products/r16i-correction-review/evidence`: `admin.products.review` 인증/인가, POST Origin·multipart·요청 5MiB 제한, 4MiB 파일 제한, PNG/JPEG/WebP MIME 및 실제 파일 magic 검증. 업로드 전 기존 D4 상품 리비전·Binding·Offer·Subject readback 충돌 검사.
- 서버 서비스 키로만 접근 가능한 비공개 Storage 버킷 `admin-product-correction-evidence`. 클라이언트에 서비스 키 노출 없음; anon/authenticated upload/read 정책 없음. 파일마다 무작위 UUID 경로, SHA-256, 최초 입력자 및 촬영(운영자 주장) 시각 저장.
- 신규 `admin_product_correction_evidence_v1`: append-only `UNVERIFIED` 증빙만 삽입, Product FK 고정. 개인 식별정보는 업로드 전에 가리도록 UI 안내. 원본 이미지가 자동으로 검증된 상업적 근거가 되지 않음.
- UI에서 저장된 증빙 목록을 다시 읽고, 관리자 권한을 통과한 경우에만 **60초 만료되는 임시 열람 링크** 생성. 영구 공개 URL 없음.
- 기존 D4 readback, source refresh, D7 필드 표/메모, Product/Offer/Subject/추천 경로에는 실질 변경 없음.
- 오입력/파일 타입 위장/중복·추가 필드/원본 출처 변조/과대 이미지/미래·오래된 캡처 시간 거부.
- CI 테스트 및 안전 검사: 마이그레이션 RLS 및 비공개 버킷 구성, 실제 API auth+same-origin, 암호화 해시, 업로드 실패 시 파일 정리, 업로드 이후 불변 state.

## 범위와 운영 주의
- DB 마이그레이션 및 Storage 버킷이 **실제로 배포된 후**에만 저장 기능이 작동함. 단순 React 배포로 버킷이 만들어지지 않음.
- 신규 테이블/버킷은 Product/Offer/Subject/가격/랭킹 운영값을 수정하지 않음.
- 증빙 `UNVERIFIED`는 운영자 입력 데이터이고, 값의 정확성·옵션·리뷰 귀속을 증명하지 않음.
- 기존 보안 취약점 #1208 미해결. D8-C/D 실제 승인·DB 변경 RPC 및 추천 164×12 회귀는 아직 미구현.
- 이미지 업로드 저장 자체는 Production Storage/증빙 테이블에 새 자료를 추가하는 **쓰기**이며, 기존 'Production 변경 0건' 표현과 구분해야 함.

## 후속
1. 신규 마이그레이션의 **격리 DB 테스트** 통과 및 Production 적용 여부 확인 (최초 적용 후 테이블/버킷/RLS 보안 점검).
2. 실제 관리자 로그인으로 PNG/JPEG/WEBP 파일 1건 업로드 → 목록 readback → 비공개 링크 열람 검증 (개인정보 없는 테스트 이미지만).
3. D8-C 명시적 정정안 승인 이력, D8-D 동시성 보호 트랜잭션 및 추천 회귀, 오류 롤백 개발.

Watchtower-Track: taxonomy-ai
