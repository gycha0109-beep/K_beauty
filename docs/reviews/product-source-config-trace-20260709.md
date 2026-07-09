# Product Source Config Trace - 2026-07-09

이 문서는 product source config trace 및 read-only availability 진단 문서이며, 제품 데이터 변경 또는 runtime 정책 변경 승인이 아니다.

## Phase 22 실패 요약

Phase 22 Pure Engine Target Scenario Replay는 `/api/analyze`를 호출하지 않고 shared decision engine을 직접 호출했다. 격리 상태는 유지되었다.

```text
routeInvoked=false
supabaseWriteExecuted=false
runtimeMutation=false
```

하지만 4개 target scenario 모두 `candidate_source_empty_after_pure_engine_replay`로 실패했다. live read-only product source가 unavailable이었고, fallback sanitized capture row는 legacy scorer가 요구하는 `name` / `brand` 등 scorer-compatible product row가 아니었다.

## Phase 23 결론 요약

Phase 23은 scorer-compatible 최소 row contract를 확인했다.

- `id`
- `name`
- `brand`
- authorized recommendation category
- `product_form`은 serum/moisturizer subcategory semantics에 관여

Phase 23 runner는 `getRecommendationProducts()`를 직접 호출했지만 `missing_config`로 종료되었다. 당시 산출물은 실제 scorer-compatible row를 확보하지 못했고 target scenario replay도 실행하지 않았다.

## Phase 24 목적

Phase 24의 목적은 `missing_config` 원인을 추적하고, 현재 checkout에서 read-only product loading이 가능한지 확인하는 것이다.

이번 단계는 다음을 하지 않는다.

- `/api/analyze` 호출
- Supabase write
- evaluator hard filter / score / weight 변경
- CandidatePolicy runtime 연결
- UI/API response 변경
- DB/schema/migration 변경
- 제품 데이터 원본 변경
- synthetic product 생성

## Product Source Entrypoint

현재 추천 엔진의 product source entrypoint는 [lib/product-source.js](D:/Ji_hwan/K_Beauti%20AI/lib/product-source.js)의 `getRecommendationProducts()`다.

경로:

```text
getRecommendationProducts()
loadRecommendationProducts()
fetchSupabaseProducts()
getSupabaseConfig()
createClient(...).from("products").select("*").order("created_at", { ascending: false }).limit(500)
```

`buildSkinMatchDecisionBundle()`은 `options.products`가 있으면 그 배열을 쓰고, 없으면 `getRecommendationProducts()`를 호출한다.

## 필요한 Config / Env Key

`getSupabaseConfig()`는 아래 URL key 중 하나와 anon key 중 하나가 필요하다.

| Key | 현재 .env 파일 key 존재 | read-only source 필요 여부 |
| --- | --- | --- |
| `SUPABASE_URL` | 없음 | URL fallback |
| `NEXT_PUBLIC_SUPABASE_URL` | 있음 | URL fallback |
| `SUPABASE_ANON_KEY` | 없음 | anon key fallback |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 있음 | anon key fallback |
| `SUPABASE_SERVICE_ROLE_KEY` | 있음 | product read-only source에는 불필요 |

env 값과 secret 값은 출력하지 않았다.

## Missing Config 원인

`missing_config`의 정확한 조건은 `getSupabaseConfig()`에서 다음 중 하나라도 만족하지 못할 때다.

```text
SUPABASE_URL 또는 NEXT_PUBLIC_SUPABASE_URL 존재
SUPABASE_ANON_KEY 또는 NEXT_PUBLIC_SUPABASE_ANON_KEY 존재
```

Phase 23에서 실패한 직접 원인은 direct Node script가 `.env.local`을 자동 로드하지 않았기 때문이다. `.env.local`에는 필요한 public Supabase URL/anon key 이름이 존재하지만, Phase 23 script의 direct Node process에서는 env loader를 쓰지 않아 `process.env` 기준으로 비어 있었다.

Phase 24 trace는 값을 출력하지 않고 `.env.local` key presence만 확인한 뒤 `dotenv`로 안전 로드하여 read-only smoke를 수행했다.

## Route Product Source vs Script Product Source

Route path:

```text
Next runtime env loading
POST /api/analyze
buildSkinMatchDecisionBundle()
getRecommendationProducts()
Supabase anon read-only products select
```

Script path:

```text
direct Node process
alias loader
buildSkinMatchDecisionBundle() 또는 getRecommendationProducts()
getSupabaseConfig() reads process.env only
```

차이:

- Next route는 framework env loading을 받는다.
- direct Node script는 `.env.local`을 자동 로드하지 않는다.
- `/api/analyze`는 product read 외에 guard/session/premium store mutation path가 있으므로 no-write capture 경로로 부적합하다.

## Read-only Product Loading 가능 여부

Phase 24 trace 결과, `.env.local` key를 값 출력 없이 로드하면 read-only source는 사용 가능했다.

```text
status=available
rowsRead=164
scorerCompatibleCount=164
scorerIncompatibleCount=0
serviceRoleRequired=false
```

집계만 기록했고 product name, brand, purchase URL, review text, raw form, image/base64/PII는 출력하지 않았다.

Category aggregate:

```text
cleanser=26
moisturizer_balm=20
moisturizer_cream=10
moisturizer_gel=10
moisturizer_lotion_emulsion=21
sunscreen=11
toner_essence=24
toner_pad=24
treatment=18
```

Recommendation slot aggregate:

```text
cleanser=26
moisturizer=61
serum=18
sunscreen=11
toner_essence=48
```

## Local Fixture / Static Source 가능 여부

현재 repo에는 즉시 사용 가능한 local scorer-compatible product source entrypoint가 없다.

- `tmp/functional-shadow-captures/*.json`: sanitized capture rows는 `name` / `brand`를 제거하므로 기존 scorer filter를 통과하지 못한다.
- `data/hwahae-review-signals`: review signal source material이지 `getRecommendationProducts()` 호환 product loader가 아니다.
- `data/hwahae`: import/source material이며 현재 scorer-compatible loader가 아니다.
- `data/promo-seeds.json`: product source가 아니다.

따라서 local fixture/static source를 Phase 25 replay source로 쓰려면 별도 승인된 read-only transformer가 필요하다. 현재 단계에서는 만들지 않았다.

## Scorer-compatible Row 확보 가능성

가능하다. 현재 `.env.local`의 public Supabase URL/anon key를 direct Node script에서 안전 로드하면 기존 `getRecommendationProducts()` 경로가 164개 scorer-compatible row를 제공한다.

이 결론은 read-only aggregate smoke 기준이다. 아직 Phase 25 replay evidence가 아니며, actual `/api/analyze` capture evidence도 아니다.

## 추천하는 다음 전략

Phase 25에서 pure engine replay를 재실행하되, `/api/analyze`를 호출하지 말고 direct Node runner가 `.env.local`을 값 출력 없이 로드한 뒤 기존 read-only `getRecommendationProducts()` source를 사용하게 한다.

권장 전략:

```text
phase25_rerun_pure_engine_replay_with_read_only_product_source
```

## Phase 25 복귀 지점

Phase 25에서는 다음을 확인한다.

- target scenario 4개가 read-only source로 candidate rows를 생성하는지
- active-only / metadata-incomplete / serum / strong-caution coverage가 확장되는지
- replay evidence와 actual capture evidence를 계속 분리하는지
- high-risk collapsed count가 계속 0인지

## Runtime 미적용 확인

Phase 24는 다음을 변경하지 않았다.

- [app/api/analyze/route.js](D:/Ji_hwan/K_Beauti%20AI/app/api/analyze/route.js)
- [lib/skin-match-decision-engine.js](D:/Ji_hwan/K_Beauti%20AI/lib/skin-match-decision-engine.js)
- evaluator hard filter / score / weight
- CandidatePolicy runtime
- UI/API response
- DB/Supabase schema/migration/policy
- product data
- existing capture fixture originals

## Validation

- `node scripts/trace-product-source-config.mjs` passed.
- `node scripts/verify-product-source-config-trace.mjs` passed after narrowing a false-positive secret-leak pattern that matched the allowed key name `SUPABASE_SERVICE_ROLE_KEY`.

The trace emitted existing direct-ESM warnings for `--experimental-loader` and `MODULE_TYPELESS_PACKAGE_JSON`.
