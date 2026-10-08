# V2.1-8H-R15A — 남은 P0 2개 공식 Evidence 연구

## 종료 판정

`BARRIER_SUPPORT_P0_REMAINING_READY_OFFICIAL_EVIDENCE_RESEARCH_INSUFFICIENT4`

전 단계 ZEROID R14C HOLD와 분리하여, 공식 identity가 이미 확정된 다음 두 제품을 **읽기 전용** 연구했다.

- 마녀공장 판테토인 인리치드 밤 80ml — `e15a1f7e-29b3-49fd-aae4-297bf9ada4ed`
- 더하르나이 시카이드 밤 100ml — `06d1ad4b-2291-4b73-8bf4-f1f3c0226fea`

두 Subject는 Production에서 `resolved/current`. 해당 Evidence / Fact Instance / Current Fact / Review Assignment는 각각 0건이다. 기존 Research Task 네 건은 `RESEARCH_PENDING`, attempt 0이다.

## 공식 근거 검토

### 마녀공장

대상 공식 상품 페이지: https://www.manyo.co.kr/goods/goods_view.php?goodsNo=1905

- 공식 제품명 및 80ml 용량 확인
- 진정·보습 중심 설명 확인
- 사용방법: 피부 결에 따라 골고루 펴 바른 뒤 두드려 흡수
- 대상 페이지의 기능성 심사 안내는 `해당없음`

`barrier_support_claim`: 이 텍스트는 수분·진정 홍보일 뿐 **제품별 피부장벽 지원을 직접 확정하지 않는다.**

`primary_use_role`: 피부에 골고루 바르는 일반적 설명만으로 `full_face / local_area / multi_area` 중 하나를 정하지 않는다.

인접 공식 상품 https://manyo.co.kr/goods/goods_view.php?goodsNo=1906 은 **판테토인 크림**의 피부장벽 기능성 문구를 포함한다. 이는 상품이 다르므로 밤 Fact에 전이 금지.

### 더하르나이

대상 공식 상품 페이지: https://theharnay.co.kr/product/%EB%8D%94%ED%95%98%EB%A5%B4%EB%82%98%EC%9D%B4-%EC%8B%9C%EC%B9%B4%EC%9D%B4%EB%93%9C-%EB%B0%A4-100ml/19/

공식 상품 목록: https://www.theharnay.com/

- 브랜드 공식 목록 및 검색 인덱스에서 **시카이드 밤 100ml** 확인
- 세부 이미지 원문·적용 부위 안내를 검증 가능한 본문 텍스트로 확보하지 못함
- 홈 화면의 장벽 관련 메시지는 시카이드 크림/라인 문맥과 혼재되어 밤에 귀속 불가
- 올리브영의 `[피부장벽강화크림]` 표기는 2차 판매처 단서로만 보존: https://www.oliveyoung.co.kr/store/goods/getGoodsDetail.do?goodsNo=A000000212725

`barrier_support_claim`: 공식 대상 상품별 직접 문구 미확보.

`primary_use_role`: 공식 상품별 사용 부위 지시 미확보.

## 연구 Task 결과

| 상품 | Fact Key | 연구 판정 |
|---|---|---|
| 마녀공장 | barrier_support_claim | EVIDENCE_INSUFFICIENT |
| 마녀공장 | primary_use_role | EVIDENCE_INSUFFICIENT |
| 더하르나이 | barrier_support_claim | EVIDENCE_INSUFFICIENT |
| 더하르나이 | primary_use_role | EVIDENCE_INSUFFICIENT |

**미확정은 거짓/명시적 부정이 아니다.** 위 네 건은 모두 `proposed_value=null`. 공식 이미지의 미추출 문구도 없는 것으로 단정하지 않으며, 검증 가능한 원문 확보 전까지 제약을 유지한다.

## Production 불변성

- Evidence DB write: 0
- Subject write: 0
- Fact Instance / Confirmation write: 0
- Review Assignment write: 0
- Research Task write: 0
- Recommendation write: 0

R15A는 연구 closeout이지 Evidence ingest·Fact confirmation이 아니다.

## 다음 단계

`V2.1-8H-R15B_P0_TARGETED_OFFICIAL_EVIDENCE_GAP_RECOVERY`

다음에는 대상 공식 브랜드가 작성한 자세한 상품별 사용법, 공식 FAQ, 제조사 문서 또는 날짜/원문 추적 가능한 상품 상세 시각 자료로 **정확한 제품별 문구**를 확보해야 한다. R15B 전에는 추정으로 값 또는 false를 넣거나 ZEROID HOLD를 자동 해제하지 않는다.
