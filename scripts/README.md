# Scripts

이 폴더는 비주얼리 데이터 준비, 화해 후보 정리, 리뷰 시그널 변환, Supabase 반영, 브라우저 콘솔 snippet을 관리한다.

## 폴더 구조

| 위치 | 역할 |
|---|---|
| `scripts/review-signals/` | 화해 제품 상세 리뷰 raw 수집 준비, fixture 변환, Supabase signal 반영 wrapper |
| `scripts/hwahae-import/` | 화해 후보 JSON/CSV와 live products를 비교해 신규/중복/제외 후보 파일 생성 |
| `scripts/console-snippets/` | 브라우저 DevTools Console에 붙여넣는 수동 snippet |
| `scripts/generate-promo-content.mjs` | promo seed 기반 콘텐츠 JSON/CSV 생성 |

`crawler/`는 별도 npm package로 관리되는 DB 기반 크롤러/후보 심사/승격 도구다. 이 README는 root `scripts/` 기준의 파일 기반 도구를 설명한다.

## Review Signal Workflow

화해 제품 상세 페이지에서 사람이 브라우저 콘솔 snippet을 실행해 raw JSON을 얻고, Node 변환 스크립트로 normalized fixture를 만든 뒤 필요할 때 Supabase에 반영한다.

CSV 기반 review raw batch의 canonical 파일은 `scripts/review-signals/prepare-hwahae-review-raw-batch.mjs`다.

1. 화해 제품 상세 페이지를 브라우저에서 연다.
2. `scripts/console-snippets/화해 제품 리뷰 추출.js` 내용을 DevTools Console에 붙여넣는다.
3. 반환된 raw JSON의 `USER_MUST_REPLACE_SUPABASE_PRODUCT_ID`를 실제 `products.id`로 바꿔 저장한다.
4. `scripts/review-signals/build-review-signal-fixture.mjs`로 fixture를 만든다.
5. `scripts/review-signals/import-review-signals-to-supabase.mjs --dry-run`으로 확인한다.
6. 필요한 경우에만 `--dry-run` 없이 DB update를 실행한다.

Package wrapper:

| npm script | 실제 파일 | 역할 |
|---|---|---|
| `review_prepare` | `scripts/review-signals/review-prepare.mjs` | Chrome remote debugging 프로필을 준비하고 다음 단계 안내 |
| `review_in_supabase` | `scripts/review-signals/review-in-supabase.mjs` | CSV 선택, raw 추출 계획/실행, fixture 생성, dry-run/import까지 연결 |

## Hwahae Import Workflow

`hwahae:prepare` 계열은 크롤러가 아니라 파일 기반 후보 정리 workflow다.

화해 후보 JSON을 `data/hwahae/`에 저장한 뒤 live Supabase `products`와 비교해 신규/중복/제외 후보 파일을 만든다. 직접 DB insert/update는 하지 않는다.

Package wrapper:

| npm script | 실제 파일 | 역할 |
|---|---|---|
| `hwahae:prepare` | `scripts/hwahae-import/prepare_hwahae_batch.py` | `data/hwahae/*.json`을 찾아 live products CSV를 임시 생성하고 batch 변환 실행 |
| `hwahae:override` | `scripts/hwahae-import/prepare_hwahae_batch.py` | `manual_overrides.*` 반영 후 같은 batch 변환 재실행 |

내부 변환기:

| 파일 | 역할 |
|---|---|
| `scripts/hwahae-import/build_hwahae_import_package.py` | 후보 CSV/JSON과 products CSV/JSON을 비교해 `hwahae_match_review.csv`, `hwahae_filtered_out.csv`, `hwahae_final_new_candidates.json` 생성 |

## DB Write Scripts

`scripts/review-signals/import-review-signals-to-supabase.mjs`는 `--dry-run` 없이 실행하면 `products.review_signals`, `products.market_signals`, `products.ingredient_signals`를 update할 수 있다.

DB write 가능성이 있는 스크립트는 실행 전 입력 fixture와 대상 product id를 별도로 검토한다.

## Console Snippets

`scripts/console-snippets/` 아래 파일은 Node 실행용이 아니라 브라우저 DevTools Console에 붙여넣는 수동 도구다.

- `console-snippets/화해 제품 리뷰 추출.js`: 현재 화해 제품 상세 페이지의 visible text를 읽어 리뷰/마켓/성분 raw JSON을 만든다.
- `console-snippets/화해 상품 이미지 주소 추출.js`: 현재 페이지의 상품 이미지 URL을 표로 보여주고 선택한 URL을 복사한다.
- `console-snippets/화해 제품 20개 후보 추출.js`: 현재 페이지의 JSON-LD ItemList에서 후보 상품 목록을 추출한다.

## Promo Scripts

`scripts/generate-promo-content.mjs`는 `data/promo-seeds.json`을 읽어 `content/promo/generated/` 아래 promo JSON/CSV를 생성한다. 외부 API나 DB를 호출하지 않는다.

## 역할표

| 파일 | 역할 | 실행 환경 | DB write | 비고 |
|---|---|---|---|---|
| `review-signals/review-prepare.mjs` | Chrome remote debugging 준비 및 review workflow 안내 | Node | 없음 | package script `review_prepare`에서 호출 |
| `review-signals/review-in-supabase.mjs` | CSV 기반 review raw 추출, fixture 생성, Supabase dry-run/import 연결 | Node | 있음 | package script `review_in_supabase`에서 호출, 최종 import 단계는 DB update 가능 |
| `review-signals/prepare-hwahae-review-raw-batch.mjs` | CSV 기반 review raw 추출 계획 생성, 옵션으로 Playwright 추출 | Node | 없음 | canonical review raw batch 파일, Supabase products read 검증 가능 |
| `review-signals/build-review-signal-fixture.mjs` | 화해 raw JSON을 normalized review signal fixture로 변환 | Node | 없음 | Supabase category read는 가능 |
| `review-signals/import-review-signals-to-supabase.mjs` | fixture를 `products` signal columns에 반영 | Node | 있음 | `--dry-run` 없이 실행 시 DB update 가능 |
| `hwahae-import/prepare_hwahae_batch.py` | live products read 후 화해 후보 batch 변환 실행 | Python | 없음 | package script `hwahae:prepare`, `hwahae:override`에서 호출 |
| `hwahae-import/build_hwahae_import_package.py` | 화해 후보와 products export를 비교해 신규/중복/제외 후보 산출 | Python | 없음 | 변환/검토용 |
| `generate-promo-content.mjs` | promo seed 기반 콘텐츠 JSON/CSV 생성 | Node | 없음 | package script `promo:generate`에서 호출 |
| `console-snippets/화해 제품 리뷰 추출.js` | 제품 상세 visible text에서 review raw JSON 추출 | Browser Console | 없음 | 수동 붙여넣기 도구 |
| `console-snippets/화해 상품 이미지 주소 추출.js` | 상품 이미지 URL 목록 표시 및 선택 URL 복사 | Browser Console | 없음 | 수동 붙여넣기 도구 |
| `console-snippets/화해 제품 20개 후보 추출.js` | JSON-LD ItemList에서 후보 상품 목록 추출 | Browser Console | 없음 | 수동 붙여넣기 도구 |
