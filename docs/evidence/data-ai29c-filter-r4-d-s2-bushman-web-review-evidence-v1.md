# DATA-AI29C-FILTER-R4-D-S2 — BUSHMAN 웹·리뷰 피부 적합성 근거 재검토

**판정:** `WEB_REVIEW_EVIDENCE_CROSSCHECK_COMPLETE_ADMIN_REVIEW_NOT_EXECUTED`
관측일: 2026-10-09 / `taxonomy-ai` / 선행 S1 [PR #1188](https://github.com/gycha0109-beep/K_beauty/pull/1188)

## 1. 조사 범위와 품질 기준

기존 BUSHMAN `50g`와 공식 `50ml`는 **사용자 결정에 따른 내부 동일 제품 가정**으로 합쳐 검토한다. 이는 공식 제조사 SKU 동일성 증명/관리자 attestation이 아니며 해당 가정만으로 DB Subject 권한을 변경하지 않는다.

- 1차 공식 제품 고시: [부쉬맨 프로 선크림 #31](https://bushmankorea.com/product/%EB%B6%80%EC%89%AC%EB%A7%A8-%EC%9B%8C%ED%84%B0%ED%94%84%EB%A3%A8%ED%94%84-%ED%94%84%EB%A1%9C-%EC%84%A0%ED%81%AC%EB%A6%BC-spf50-pa-50ml/31/) — 선크림, SPF50+ PA++++, 저자극, 레포츠/워터프루프, 부드러운 발림, 백탁현상방지 **제조사 표기**.
- [화해 상품 리뷰와 AI 요약](https://www.hwahae.co.kr/goods/50706?goods_tab=review_ingredients) — 검색에 노출된 긍정: 잘 발리는 75, 백탁 없는 32, 자극 없는 31, 눈통증 없는 22, 끈적하지 않은 21. 부정: 유분 있는 17, 답답한 3, 알러지 반응 3. **이 숫자는 화해가 분류한 태그 언급 수이며, 확률·모집단 대비 비율·임상 빈도가 아니다.** 상품 페이지의 리뷰 집계는 검색 시점에 따라 286·299 등으로 보였으므로 고정 표본수/분모를 주장하지 않는다.
- [화해 제품별 실사용 리뷰](https://www.hwahae.com/en/products/BUSHMAN-Waterproof-Pro-Suncream-SPF50PLUS-PAPLUS-PLUS-PLUS-PLUS/1884027/reviews), [건성 사용자 리뷰](https://www.hwahae.com/en/products/BUSHMAN-Waterproof-Pro-Suncream-SPF50PLUS-PAPLUS-PLUS-PLUS-PLUS/1884027/reviews?skin_type=dry) — 2026-08-14 더운 날 두껍게 바를 때 밀림, 2026-05-28 눈 자극과 눈에 띄는 백탁, 2026-07-30 적은 백탁·눈시림 없는 경험 등 **반대 사례**가 함께 존재.
- 브랜드몰 구매자 [2026-04-07 후기](https://review3.cre.ma/bushman001.cafe24.com/mobile/reviews/388)는 개인 기준 톤업·백탁 없음, [2026-03-26 후기](https://review3.cre.ma/bushman001.cafe24.com/mobile/reviews/508)는 눈시림 없음·백탁 거의 없음, [2026-06-22 후기](https://review3.cre.ma/bushman001.cafe24.com/mobile/reviews/4845)는 민감 피부 자극을 기술한다. 구매자 진술/마케팅 유사 표현은 실험실 입증이 아니며 인센티브·자가선택 편향 가능성을 배제하지 않는다.

이 단계에서 신규 HTML 원본 해시 계산·보관, 제조사 직접 연락, 외부 리뷰 스크래핑 DB 적재, 어드민 리뷰 실행은 수행하지 않았다. 링크는 조사 근거 참조이며 새로운 validated content digest로 둔갑시키지 않는다.

## 2. 12개 필드 최종 사전판정

| 필드 | 제안 state | 제안 값 | 출처 충돌 / 결론 |
|---|---|---|---|
| category_slot | established | sunscreen | 공식 제품/기존 canonical taxonomy가 명확 |
| skin_types | reviewed_not_established | null | 건성·복합성·민감성 사용자 경험이 서로 달라 적합 피부 타입 불특정 |
| concerns | reviewed_not_established | null | UV 차단·사용후기만으로 유분/장벽/트러블 고민 enum 확정 금지 |
| texture | reviewed_not_established | null | 부드러운 발림·꾸덕함은 watery/gel/lotion/cream의 확정 분류가 아님 |
| finish | reviewed_not_established | null | 보송함과 유분/답답함 평가 공존 |
| uv_filter_type | established | hybrid | registry v2 Product Fact Current 기성 근거만 사용 |
| sensitivity_safe | reviewed_not_established | null | 공식 저자극/긍정 리뷰 대 민감피부 자극 사례, 안전성 일반화 금지 |
| irritation_risk | reviewed_not_established | null | 불편·자극 사례 존재, 집계 태그를 low/medium/high 발생률로 오인 금지 |
| tone_up | reviewed_not_established | null | 한 구매자의 비톤업 인상만으로 false 부여 불가 |
| **white_cast** | **reviewed_not_established** | **null** | **S1 변경:** 백탁방지 제조사 주장·백탁없음 후기 대 실제 백탁 경험이 충돌. 전체 사용자 `none` 확정 철회 |
| eye_sting | reviewed_not_established | null | 눈시림 없다는 다수 태그와 개별 눈 자극 사례 양립 |
| pilling_risk | reviewed_not_established | null | 무난한 발림과 고온·두꺼운 베이스에서 밀림 사례 양립 |

**S1 → S2:** S1에서는 `white_cast=none`(medium)을 제안했으나, S2는 **검증된 상반 후기 때문에 확정 제안을 보류**한다. 이전 S1 증거를 수정하거나 삭제하지 않고 새로운 리뷰 결정을 별도 evidence에 남긴다.

## 3. 적용 시뮬레이션과 RPC 제약

- 제안 `12/12 reviewed`, `2 established`, `10 reviewed_not_established`.
- `evaluateSunscreenSemanticEnvelope()`상 제안 모두 실제 리뷰되었다는 가정으로 `envelopeReady=true` (core 두 필드 확정).
- `neutral`은 시뮬레이션 적격. `whiteCastRelevant`, `eyeStingRelevant`, `sensitivityRelevant`, `pillingRelevant` 등은 미확정으로 fail-closed.
- 기존 `admin_register_sunscreen_recommendation_semantic_field_v1(uuid,text,jsonb)`는 관리자 `admin.products.review` 역할, `request_id`, 8개 payload 키, 각 field 최소 1 evidence record 및 리뷰별 현재/선행 review ID를 요구한다. `category_slot`은 `canonical_taxonomy`, `uv_filter_type`은 `product_fact_current` 증거 타입이 별도 필수다.
- JSON에는 **승인 전 구조적 예시인 `rpcPayloadPreview` 12개**를 수록했다. 이는 감사자 서명이 없고 근거 링크와 값 확인 전이므로 곧바로 호출/일괄 실행할 승인 패키지가 아니다. 리뷰 sample `source_type`는 지원하는 기존 계약만 사용한다.

## 4. 범위 및 후속

Production 실제 Semantic `0/12`, Subject lineage `data-ai29c-c5-presentation-identity-correction-v1`, Fact Current 3개를 SELECT로 확인했다. 이 단계 **Production write 0**. Product/Subject/Fact/Source/Recommendation, Ranking/Beta/Public/UVA/Water 변경하지 않는다.

다음 R4-D-S3에서 실제 관리자 역할 확인, payload별 출처 원본 검증, review 등록의 감사/멱등성/중복 방지 확인 후에만 12개 등록을 판단한다. 50g/50ml 논의를 새로 시작하거나 제조사 메일을 보내지 않는다. 운영 리뷰 12/12와 별도로 Subject authority가 충족될 때까지 R4-E Admission은 독립 HOLD다.
