# R16I-R4-D8A — 관리자 실조회 2종 구현 (2026-10-12)

## 실제 제공 기능
- `DB 새로고침`: 기존 관리자 검토 GET `/api/admin/products/r16i-correction-review` 실제 호출, `cache:no-store`, 관리자 세션 same-origin, SELECT 읽기 상태 갱신. 대상 ID 계약 외 응답 거부. 조회 실패 시 **기존값을 최신값으로 계속 표시하지 않고 BLOCKED**로 전환; 재시도 가능.
- `판매처 정보 조회`: GET `/api/admin/products/r16i-correction-review/source-refresh`. 관리자의 `PRODUCTS_REVIEW` 인가 후 **고정된 공식몰 #151 / 화해 #45194** 두 URL만 서버에서 GET. 서버 측 요청은 HTTPS 고정 허용 호스트, 수동 리다이렉트 검증 최대 2회, 타임아웃 6.5초, 512KiB 크기 상한, HTML 응답만 분석. 서버는 응답 상태·접근 제한·HTML SHA256 등만 반환.
- 결과 분류: `HTML_VISIBLE_UNVERIFIED` / `ACCESS_RESTRICTED` / `HTTP_ERROR` / `REDIRECT_BLOCKED` / `PAGE_TOO_LARGE` / `UNEXPECTED_CONTENT_TYPE` / `NETWORK_OR_TIMEOUT_ERROR` 등.
- **가격·선택옵션·재고·SKU 추출 및 검증은 0건**, 브라우저 캡처 저장도 없음. HTML 접근 성공은 실제 결제가격 증명 아님. 검색 색인과 HTML 리치 결과를 상업적 구매 사실로 채택하지 않음.
- 기존 D4 신원·리비전·충돌 검사, D7 UI 본문 및 20필드 개발자 상세, 운영 승인 차단 유지.
- 신규 DB 테이블/RPC/CI 워크플로/앱 쓰기 API 없음. 정적 공급망 취약점 #1208 미해결.

## 후속
1. D8-B: 캡처의 비공개 보관, 파일 해시·원본 시점·직접 캡처 식별과 구성/옵션 연결을 위한 최소 구조. 현재 `storage.buckets`에는 버킷 **0개**라 별도 schema/storage 설계와 보안 검증 필요. 외부 URL 또는 메모를 권위 있는 근거로 자동 승격 금지.
2. D8-C/D: 필드별 명시적 승인 및 변경 전후 해시·동시성 조건·일괄 트랜잭션·롤백·idempotency 구현, 실제 Production 상품 수정은 별도 승인 후만.
3. D8-E: 스킨케어 추천 164×12=1,968 케이스 및 상품/구매 링크 정합성 회귀.

**종료 정의:** 실제 브라우저의 두 조회 버튼과 관리자 권한/접근 제한/실패 차단 테스트 성공. **실제 판매정보 최신값 갱신 및 DB 수정 완료가 아님.**

Watchtower-Track: taxonomy-ai
