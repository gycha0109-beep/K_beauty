# TRUST P3 — AMBIGUOUS_ATTRIBUTES 비식별 원인 분류 v1

## 범위 및 원칙
기존 `lib/trust/official-primary-root-dom-p3-v1.mjs`의 HTML attribute 파서에서 `AMBIGUOUS_ATTRIBUTES`가 발생한 **최초 실패 이유만** 안전한 enum으로 내보낸다. 입력 HTML, 속성명/값, CSS class, SKU, 제목, URL parameter, 사용자 데이터는 파일·GitHub Actions artifact에 남기지 않는다. 기존 parser의 허용/차단, robots-first fetch, 기존 P3 review candidate 판정, Subject/Fact/Source 및 추천/DB 쓰기 권한을 변경하지 않는다.

## 데이터 계약
오류에 한해 `strictPrimaryRoot.attributeFailure`를 기록한다.

| 필드 | 가능한 값 | 제한 |
|---|---|---|
| `reason` | `UNSUPPORTED_ATTRIBUTE_SYNTAX`, `DUPLICATE_ATTRIBUTE_NAME`, `EMPTY_UNQUOTED_VALUE`, `UNTERMINATED_ATTRIBUTE_QUOTE`, `ATTRIBUTE_COUNT_LIMIT` | 하드코딩 enum |
| `tagKind` | `DIV`, `SECTION`, `FORM`, `SELECT`, `OPTION`, `INPUT`, `SCRIPT` 등 허용된 14종 또는 `OTHER` | DOM 원본 태그를 출력하지 않고 제한된 enum |
| `attributeOrdinal` | 1 ~ 65 | bounded count, 속성명 없음 |

`status`는 항상 기존 `AMBIGUOUS_ATTRIBUTES` **HOLD**, `parseComplete=false`; 신규 진단이 나왔다고 상품 식별, 선택 용량, 제형/판매국가를 승인하지 않는다. 잘못 닫힌 인용부호는 바깥쪽 quote-aware tag boundary에서 `TAG_SCAN_LIMIT` 등으로 보류될 수 있으며, 오류 reason 집계가 HTML5 파서 완전성을 뜻하지 않는다.

## 실측 수용 기준
2026-10-14에 동결한 기준 `evidence/trust/p3-strict-dom-live-20261014.json`: 6개 공식 URL 중 HTML 수집 4, 접근 차단 2, 엄격 parser `AMBIGUOUS_ATTRIBUTES` 3건, `PRIMARY_ROOT_NOT_PROVEN` 1건. 6 URL / 4 origin 대상으로 기존 GitHub Actions `P3-LOCATOR-LIVE-TRIAL`을 한 차례 실행한 뒤 enum 유형별 실제 빈도 기록. 0/6 SKU 확정, 0 DB/AI calls, source/source binding/Subject/Fact/recommendation 쓰기 0 유지를 확인한다.

## HTML5 파서 도입 판단
진단 결과가 유효한 HTML5 속성 문법(예: framework-specific directive) 또는 브라우저가 수정하는 노드 계층 때문에 발생한 것으로 보이면, 현재 파서의 문자열 검증을 느슨하게 하는 대신 표준 HTML5 tree builder 패키지를 **신규 별도 PR**에서 비교한다. 도입 전 lockfile/SCA, 라이선스, 최대 크기·깊이·시간·노드 수, raw content 유출 방지, 결과 단조성(fail-closed) 테스트가 필요하다. 기존 공급망 보안 실패를 allowlist 예외로 우회하지 않는다.

## 상태
현재는 진단 코드와 fixture만 추가했다. CI 및 live artifact 결과가 없으면 사이트별 원인 유형은 **확인되지 않은 상태**다.
