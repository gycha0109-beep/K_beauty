# V2.1-8H-R15B — 남은 P0 2개 제품별 공식 Evidence Gap Recovery

## 판정

`R15B_TARGETED_RESEARCH_COMPLETE_FOUR_FACTS_STILL_UNESTABLISHED`

R15A 결과를 기준선으로 보존하고, **마녀공장 판테토인 인리치드 밤 80ml**, **더하르나이 시카이드 밤 100ml**의 `barrier_support_claim` 및 `primary_use_role`에 대해 새로운 브랜드 작성 자료를 재조사했다. 연구 결과는 2상품 × 2 Fact = 4건 모두 **EVIDENCE_INSUFFICIENT**, `proposed_value=null`. 근거 부족을 `false` 또는 `BLOCKED → UNKNOWN`으로 치환하지 않았다.

## R15A 대비 새롭게 확인한 출처

| 출처 | 제품·관찰 | Fact 채택 불가 사유 |
|---|---|---|
| [마녀공장 US 공식 밤 상세](https://manyo.us/products/panthetoin-enriched-balm) | Enriched Balm 80ml를 직접 명시. 보습·진정 및 일반 마사지 사용법 | 제품별 명시적 장벽 지원 주장이 없고 적용 부위 범위 미확정. **US와 KR 제형 동일성 미검증** |
| [마녀공장 US 3단계 세트](https://manyo.us/products/dry-skin-saver-3-step-set) | 해당 밤 80ml를 3단계로 명시. 세트 단위 건조 피부 보호 설명 | 세트 수준 문구를 밤 단독 `barrier_support_claim`에 귀속할 수 없음 |
| [더하르나이 공식 Q&A](https://theharnay.co.kr/article/q-a/6/3025/) | **2021-03-19** 브랜드가 시카이드 밤과 크림의 제형 및 겹쳐 바르는 순서를 구분 | 제형·사용 순서는 장벽 지원 주장이나 `full_face/local_area/multi_area` 사용 *부위*가 아님. 오래된 게시물이므로 현재 SKU 제형 연결도 미확정 |
| [더하르나이 공식 밤 100ml 상품 상세](https://theharnay.co.kr/product/%EB%8D%94%ED%95%98%EB%A5%B4%EB%82%98%EC%9D%B4-%EC%8B%9C%EC%B9%B4%EC%9D%B4%EB%93%9C-%EB%B0%A4-100ml/19/category/1/display/13/?icid=MAIN.product_listmain_12) | 브랜드 자체 상품 상세에서 밤 100ml 확인 | 시각적 상세자료의 원문·해시와 현재 SKU 직접 귀속을 확보하지 못했고 부위 지시가 텍스트로 확인되지 않음 |

R15A에 있던 마녀공장 **판테토인 크림**의 기능성 주장, 더하르나이 **시카이드 크림/라인** 문구, 올리브영 `[피부장벽강화크림]` 판매처 제목은 밤 제품의 공식 Fact를 확인하는 근거가 아니다. 마녀공장 US 사이트의 사용자 리뷰도 브랜드의 공식 주장으로 승격하지 않는다.

**출처 캡처 제한:** 검증 가능한 웹 본문·검색 인덱스/공식 Q&A를 확인했으며, 원본 바이트의 콘텐츠 digest는 취득하지 않았다. 따라서 Evidence source/record를 생성하거나 본문 해시를 임의로 적지 않았다. 본 연구의 `new_source_captures`는 근거 후보에 대한 조사 기록이지 Production `product_evidence_records`가 아니다.

## Fact별 판정

| Product ID | Fact | 연구 상태 |
|---|---|---|
| `e15a1f7e-29b3-49fd-aae4-297bf9ada4ed` | barrier_support_claim | EVIDENCE_INSUFFICIENT |
| 동일 | primary_use_role | EVIDENCE_INSUFFICIENT |
| `06d1ad4b-2291-4b73-8bf4-f1f3c0226fea` | barrier_support_claim | EVIDENCE_INSUFFICIENT |
| 동일 | primary_use_role | EVIDENCE_INSUFFICIENT |

## Production 읽기 재검증

Supabase `bygrczggxfuisupcevaz`를 읽기 전용으로 조회해, 두 상품 각각 `resolved/current` Subject가 1개이며 위 두 Fact의 Evidence / Fact Instance / Current / Review Assignment가 모두 0개임을 확인했다. Research Task는 **4/4 RESEARCH_PENDING, attempt_count=0**이었다. 이는 DB 상태를 변경했다는 뜻이 아니며 R15B 결과를 DB Task 상태로 오인하지 않는다.

## 불변 경계

- DB write **0**, Registry 정의·checksum 변경 **없음**, ZEROID R14C HOLD 유지
- PDA 비수치 상태 유지. 점수·순위·eligibility·candidate policy 변화 **0**
- 비교 기준 **164 products × 12 scenarios = 1,968 evaluations** 유지
- Recommendation/Public/Production cutover 자동 활성화 **없음**

## 다음 통제 게이트

새로운 동일 제품·동일 시장의 **브랜드 직접 작성 자료**가 확보될 때만 조사 재개:
1. 마녀공장에 판테토인 *인리치드 밤* 80ml의 장벽 지원 문구와 정확한 적용 부위 질의
2. 더하르나이에 시카이드 *밤* 100ml 현재 판매 SKU에 직접 연결된 공식 상세이미지 원본 또는 상품별 사용 부위 및 장벽 지원 문구 질의

추가적인 공식 문서가 나오기 전에는 반복적인 무차별 검색·HOLD 보고서 작성보다 다른 연구 대상 진행을 우선한다. **Evidence ingest·review·confirmation은 별도 사전검증과 승인 이후에만 가능**하다.

## 증적

`evidence/product-decision-axis-non-numeric-shadow-v2/barrier-support-p0-remaining-targeted-official-gap-recovery-v1.json` — R15A Git blob 기준선, 신규 4개 출처, Task 4건, Production 읽기 스냅샷, 불변 조건과 다음 게이트를 보존한다.
