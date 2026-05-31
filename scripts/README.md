# Scripts

이 폴더는 비주얼리 데이터 준비, 리뷰 시그널 변환, Supabase 반영, 브라우저 콘솔 snippet을 관리한다.

## 1. Review signal workflow

화해 제품 상세 페이지에서 사람이 브라우저 콘솔 snippet을 실행해 raw JSON을 얻고, Node 변환 스크립트로 normalized fixture를 만든 뒤 필요할 때 Supabase에 반영한다.

1. 화해 제품 상세 페이지를 브라우저에서 연다.
2. `scripts/console-snippets/화해 제품 리뷰 추출.js` 내용을 DevTools Console에 붙여넣는다.
3. 반환된 raw JSON의 `USER_MUST_REPLACE_SUPABASE_PRODUCT_ID`를 실제 `products.id`로 바꿔 저장한다.
4. `build-review-signal-fixture.mjs`로 fixture를 만든다.
5. `import-review-signals-to-supabase.mjs --dry-run`으로 확인한다.
6. 필요한 경우에만 `--dry-run` 없이 DB update를 실행한다.

## 2. Hwahae import workflow

화해 후보 목록과 Supabase products export를 비교해 신규 후보, 중복 후보, 제외 후보를 나누는 데이터 준비용 workflow다.

- `prepare_hwahae_batch.py`는 live Supabase products를 읽어 임시 products CSV를 만들고 `build_hwahae_import_package.py`를 batch 실행한다.
- `build_hwahae_import_package.py`는 후보 CSV/JSON과 products CSV/JSON을 비교해 review CSV와 최종 신규 후보 JSON을 만든다.
- 이 workflow는 후보 검토용 파일을 만들며 직접 DB에 insert/update하지 않는다.

## 3. DB write scripts

`import-review-signals-to-supabase.mjs`는 `--dry-run` 없이 실행하면 `products.review_signals`, `products.market_signals`, `products.ingredient_signals`를 update할 수 있다.

DB write 가능성이 있는 스크립트는 실행 전 입력 fixture와 대상 product id를 별도로 검토한다.

## 4. Console snippets

`scripts/console-snippets/` 아래 파일은 Node 실행용이 아니라 브라우저 DevTools Console에 붙여넣는 수동 도구다.

- `console-snippets/화해 제품 리뷰 추출.js`: 현재 화해 제품 상세 페이지의 visible text를 읽어 리뷰/마켓/성분 raw JSON을 만든다.
- `console-snippets/화해 상품 이미지 주소 추출.js`: 현재 페이지의 상품 이미지 URL을 표로 보여주고 선택한 URL을 복사한다.
- `console-snippets/화해 제품 20개 후보 추출.js`: 현재 페이지의 JSON-LD ItemList에서 후보 상품 목록을 추출한다.

## 5. Promo scripts

`generate-promo-content.mjs`는 `data/promo-seeds.json`을 읽어 `content/promo/generated/` 아래 promo JSON/CSV를 생성한다. 외부 API나 DB를 호출하지 않는다.

## 6. 정리 후보

- `scrape-hwahae-review-signals.mjs`: 실제 scraper가 아니라 snippet/workflow 출력 helper다. 현재 이름은 역할보다 강하게 보이므로 rename 후보다.
- `CODEX 리뷰 크롤링 자동화 batch.mjs`: `prepare-hwahae-review-raw-batch.mjs`와 거의 중복 가능성이 있어 정리 후보다.
- DB write 가능 파일과 console snippet은 폴더로 더 분리하면 실수 실행 위험을 줄일 수 있다.

## 역할표

| 파일 | 역할 | 실행 환경 | DB write | 비고 |
|---|---|---|---|---|
| `build-review-signal-fixture.mjs` | 화해 raw JSON을 normalized review signal fixture로 변환 | Node | 없음 | Supabase category read는 가능 |
| `import-review-signals-to-supabase.mjs` | fixture를 `products` signal columns에 반영 | Node | 있음 | `--dry-run` 없이 실행 시 DB update 가능 |
| `prepare-hwahae-review-raw-batch.mjs` | CSV 기반 review raw 추출 계획 생성, 옵션으로 Playwright 추출 | Node | 없음 | Supabase products read 검증 가능 |
| `scrape-hwahae-review-signals.mjs` | snippet/workflow 출력 helper | Node | 없음 | 실제 scraper 아님 |
| `CODEX 리뷰 크롤링 자동화 batch.mjs` | batch review raw 추출 계획/실행 보조 | Node | 없음 | `prepare-hwahae-review-raw-batch.mjs`와 중복 가능, 정리 후보 |
| `build_hwahae_import_package.py` | 화해 후보와 products export를 비교해 신규/중복/제외 후보 산출 | Python | 없음 | 변환/검토용 |
| `prepare_hwahae_batch.py` | live products read 후 화해 후보 batch 변환 실행 | Python | 없음 | package script `hwahae:prepare`, `hwahae:override`에서 호출 |
| `generate-promo-content.mjs` | promo seed 기반 콘텐츠 JSON/CSV 생성 | Node | 없음 | package script `promo:generate`에서 호출 |
| `console-snippets/화해 제품 리뷰 추출.js` | 제품 상세 visible text에서 review raw JSON 추출 | Browser Console | 없음 | 수동 붙여넣기 도구 |
| `console-snippets/화해 상품 이미지 주소 추출.js` | 상품 이미지 URL 목록 표시 및 선택 URL 복사 | Browser Console | 없음 | 수동 붙여넣기 도구 |
| `console-snippets/화해 제품 20개 후보 추출.js` | JSON-LD ItemList에서 후보 상품 목록 추출 | Browser Console | 없음 | 수동 붙여넣기 도구 |
