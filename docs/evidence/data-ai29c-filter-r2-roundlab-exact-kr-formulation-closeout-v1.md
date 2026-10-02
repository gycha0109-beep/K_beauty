# DATA-AI29C-FILTER-R2 — Round Lab Exact KR Formulation Closeout v1

## 판정

`FILTER_R2_ROUNDLAB_CLOSEOUT_PASS_WATCH_ON_CHANGE_NO_ADMISSIBLE_EXACT_KR_FILTER_AUTHORITY`

FILTER-R1에서 Torriden KR `uv_filter_type=organic`을 governed Current Fact로 회수하여 UV filter coverage는 `11/13 → 12/13`이 되었다.

현재 남은 유일한 missing Subject는 라운드랩 `자작나무 수분 선크림 50ml / renewed_KR`이다.

## 대상

```text
product_id               = 0bb742d2-df6b-49a7-8e29-8f76ae62ac0d
subject_id               = 761e6fd6-3487-4505-a1a7-13c37d5cece4
subject_semantic_key     = cb287a3632034e8626d1580a2b9d82493730882f7694f73accf6cdca1d790e3e
variant_key              = renewed_KR
formulation_revision_key = pilot-freeze-9aba73ebdc1f56e6041286efa04eb74f
market                    = KR

task_id       = 6e0e8b65-0ac2-4246-894b-a19494bd7329
task_state    = BLOCKED
blocker_code  = EVIDENCE_INSUFFICIENT
attempt_count = 1
```

## Registry authority

현재 published Registry v2의 `uv_filter_type` 계약:

```text
definition_checksum = 6dd4e0016889b65dafade9d410692e9ab85b036e0654089950950ceb46f6e917
allowed_values       = mineral | organic | hybrid
evidence             = product_claim | composition_identity
positive authority   = product-specific evidence
```

historical research task는 v1 lineage를 유지하며 checksum은:

```text
c6107f2924d443c80f1c61e7977f54f69a97ac5b5da21f8eb2be13891f1ec52c
```

이다.

두 Registry version은 현재 해당 Fact의 의미와 허용값이 같지만 checksum lineage를 섞지 않는다.

## Exact KR evidence

기존 governed exact KR source:

```text
https://roundlab.co.kr/article/press/8/3087

source_id      = 3fa2f78b-d7c4-4355-bbda-79e747a3ea99
binding_id     = f1734dc9-8ad2-458d-a976-966bfe6e6ef8
binding_state  = exact_subject_match
scope_relation = equivalent
content_digest = 879027d0cd4ffb563e7c028ee98b6454055f6a73c609c2bad80321474886049a
market         = KR
```

이 source는 renewed Birch Juice Moisturizing Sunscreen identity와 `SPF 50+ / PA++++`를 확인하지만 다음 authority를 제공하지 않는다.

- direct `mineral / organic / hybrid` 선언
- 현 formulation의 전체 UV filter composition을 확정할 수 있는 성분 공개

현재 KR 공식 상품 페이지 역시 exact product identity는 확인되지만 accessible official text layer에서 위 filter authority가 확인되지 않는다.

## Global / US evidence는 전이하지 않음

Global official presentation에는 Birch Moisturizing UV Sunscreen을 Chemical로 설명하고 active filters를 공개한 자료가 존재한다.

그러나:

```text
global/US current presentation
!=
governed renewed_KR SPF50+ Subject exact formulation
```

이다.

따라서 exact formulation equivalence가 first-party authority로 확정되기 전에는 KR Subject에 `organic`을 전이하지 않는다.

별도 `자작나무 무기자차 선크림` sibling의 존재나 third-party organic/chemical 분류도 positive Product Fact authority로 사용하지 않는다.

## Watch-on-change

현재 fingerprint가 동일한 동안 동일 source를 반복 검색하지 않는다.

fingerprint:

1. `subject_semantic_key`
2. `formulation_revision_key`
3. `market=KR`
4. exact KR source `content_digest`
5. current published Registry v2 `definition_checksum`

다음 중 하나가 실제로 바뀔 때만 reopen한다.

- exact KR governed source digest가 변경되고 direct filter claim 또는 complete composition이 등장
- current exact KR official product page에 직접 filter classification 또는 complete composition이 등장
- first-party 문서가 KR Subject와 global/US UVLock formulation equivalence를 명시적으로 확정
- Subject semantic/formulation/variant/market identity 변화
- Registry checksum / allowed values / evidence contract / write-authority contract 변화
- 수동 검토된 exact-subject admissible evidence candidate 등장

다음은 reopen 조건이 아니다.

- 별도 mineral sibling 존재
- third-party organic/chemical 분류
- exact-formulation equivalence 없는 global/US Chemical 분류
- SPF/PA 변경만 발생
- generic brand-family filter claim

## Closeout coverage

```text
resolved/current sunscreen = 13
SPF                         = 13/13
UVA label                   = 10/13
UV filter type              = 12/13
UV filter HOLD              = 1
Water duration              = 2/13
Broad Spectrum Current      = 2
Current Product Facts       = 95
```

## Write boundary

R2 Production write는 0건이다.

- Product Fact write 0
- research task mutation 0
- Registry write 0
- policy write 0
- Recommendation write 0
- ranking change 없음
- public activation 없음

## 다음 gate

`DATA-AI29C-PROTECTION-R1 — Protection Gap Watch Closeout`

UVA 3건과 UV filter 1건은 각 exact authority fingerprint 변화가 생길 때만 재개하고, Protection Fact coverage gap이 Recommendation activation으로 오인되지 않도록 watch state를 하나의 운영 closeout으로 묶는다.
