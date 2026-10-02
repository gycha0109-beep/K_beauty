# DATA-AI29C-FILTER-R1 — UV Filter Type Missing Subject Recovery v1

## 판정

`FILTER_R1_PARTIAL_PASS_TORRIDEN_ORGANIC_RECOVERED_ROUNDLAB_HOLD`

UVA R5 closeout 후 current/resolved sunscreen 13개 중 `uv_filter_type`이 비어 있던 두 Subject를 exact formulation 기준으로 재조사했다.

초기 coverage:

```text
UV filter type = 11 / 13
Current Facts  = 94
```

## 1. Torriden — RECOVERED

대상:

`다이브인 모이스처 선크림 60ml / KR / DIVE_IN_MOISTURE_SUN_CREAM_KR_60ML`

현재 공식 상품 페이지의 제품고시 상세 이미지에 current formula 전성분이 직접 공개돼 있다.

관찰된 UV filter composition marker:

- 에칠헥실트리아존
- 디에칠아미노하이드록시벤조일헥실벤조에이트
- 드로메트리졸트리실록산
- 메칠렌비스-벤조트리아졸릴테트라메칠부틸페놀

현재 공식 고시 전성분에서 zinc oxide / titanium dioxide 계열 무기 필터는 관찰되지 않았다.

따라서 Registry 의미 `Declared or composition-established UV filter system class`에 따라:

`uv_filter_type = organic`

으로 product-specific primary/high composition identity evidence를 confirmation했다.

```text
fact_instance_id = c794fb23-5ff6-4af8-b503-fd7e3c5578a6
confirmation_id  = d9f2ca21-457a-438f-8fbd-a02cbc99e1df
evidence_id      = 7ec26952-2bb8-4ab4-b5f5-5ce382f53ab5
source_id        = a46a6d70-d5fc-4e39-a74d-53088e48c8b6
binding_id       = 82dc997f-b64b-472f-8538-a066e8e5132e
```

기존 SPF 50 / UVA PA++++ Fact Instance와 Confirmation ID는 변경되지 않았다.

### 기존 research task

과거 task `f00ecbcc-7dec-437e-bc62-bc154fd06ecc`는 DB상 BLOCKED로 남아 있다.

BLOCKED task를 독립 confirmation 이후 ALREADY_COVERED로 직접 전환하는 governed RPC가 없으므로 SQL UPDATE를 강행하지 않았다.

Current Product Fact가 operational authority이며 과거 task는 historical blocker로만 취급한다.

## 2. Round Lab — HOLD

대상:

`자작나무 수분 선크림 50ml / renewed_KR`

KR 공식몰 exact 제품 페이지는 현재 제품 identity를 확인하지만 text layer에서 정확한 filter classification/full composition을 제공하지 않는다.

글로벌 공식 콘텐츠는 Birch Moisturizing Sunscreen UVLock을 Chemical로 분류하지만, 현재 글로벌/US presentation과 KR SPF50+ Subject 사이 exact formulation equivalence가 고정되지 않았다.

별도 `자작나무 무기자차 선크림`이 존재한다는 사실이나 third-party의 organic 분류를 KR governed Fact로 역전이하지 않는다.

따라서:

`HOLD_EVIDENCE_INSUFFICIENT`

유지.

## 최종 coverage

```text
UV filter type = 12 / 13
missing        = 1
Current Facts = 95
```

## Recommendation boundary

이번 단계는 Product Fact recovery뿐이다.

- Recommendation write 없음
- ranking 변경 없음
- public activation 없음

## 다음 gate

`DATA-AI29C-FILTER-R2 — Round Lab Exact KR Formulation Closeout`

Round Lab은 exact KR formulation authority가 새로 확인되지 않으면 HOLD/watch-on-change로 닫는다.
