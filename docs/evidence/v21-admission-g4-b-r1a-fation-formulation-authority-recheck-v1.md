# V2.1-ADMISSION-G4-B-R1A — FATION Formulation Authority Recheck

## Decision

`V21_ADMISSION_G4_B_R1A_FORMULATION_AUTHORITY_RECHECK_NOT_RECOVERED`

2026-10-04 기준 first-party 재검색에서도 FATION 30 ml formulation authority는 복구되지 않았다.

이 단계는 research-only이며 Production write는 0이다.

## Category lane status

Recommendation category-authority lane은 이미 다음 결정으로 닫혔다.

`V21_ADMISSION_G4_F2_D1_DEPLOYED_SHADOW_DUAL_READ_OBSERVED_PASS`

FATION category authority는 `treatment`로 해석되지만 Recommendation cutover는 여전히 false다.

따라서 현재 유일한 admission blocker는 Product Fact formulation identity다.

## Current first-party recheck

### FATION standalone product 329

30 ml / 1.01 fl. oz.

ingredient ordering:

`water_first`

digest:

`6eeed9473eaaee36bd09a73fb7b9ac1ddd4b7761c9fe21ae57070c9bc0484334`

현재 페이지는 발송 재고가 최대 36개월 이내 제조품이라는 문구만 제공한다.

formulation effective date와 lot boundary는 없다.

### FATION set 613

30 ml.

ingredient ordering:

`mugwort_first_a`

digest:

`2c0cd6fc3765c9b59baf72b6f34abd4ad905e94c07a49c3c7c5c4facbf977d20`

formulation effective date와 lot boundary는 없다.

### FATION set 1126

30 ml / 1.01 fl. oz.

ingredient ordering:

`mugwort_first_b`

digest:

`2bfec79eb1d7c9600e898cfbdecfcbbf53606767bf7c6561db6732f5a5583cc4`

현재 페이지에는:

`2022년 6월 15일 이후 제조된 상품만을 취급`

문구가 존재한다.

그러나 이 문구는 해당 ingredient ordering이 2022-06-15부터 적용됐다는 의미를 명시하지 않는다.

따라서 formulation revision effective date로 사용할 수 없다.

### Dong-A product NNTS20

현재 동아제약 공식 제품 페이지도 30 ml / 1.01 fl. oz.를 노출하며 `mugwort_first_b` ordering을 제공한다.

그러나 reformulation date, effective date, lot/manufacturing applicability는 제공하지 않는다.

## Adjudication

현재 first-party 상태는 여전히:

```text
distinct ingredient orderings = 3
ingredient set                 = same 26 names
product identity               = resolved
presentation identity          = resolved
formulation revision identity  = unresolved
```

따라서:

`FORMULATION_AUTHORITY_NOT_RECOVERED`

를 유지한다.

페이지 최신성, 현재 노출 여부, 동아제약 corporate page라는 이유만으로 하나의 ordering을 current Product Fact formulation으로 승격하지 않는다.

## Production boundary

다음은 계속 금지된다.

- Product Fact Subject registration
- task claim
- Evidence ingest
- Product Fact confirmation
- Recommendation admission cutover

Production writes:

`0`

## R2 condition

명목상 다음 gate는:

`V2.1-ADMISSION-G4-B-R2_FATION_FORMULATION_AUTHORITY_EVIDENCE_REVIEW`

이지만 현재:

`authorized = false`

다.

R2는 기존 recovery contract를 충족하는 신규 first-party authority가 실제로 확보된 경우에만 시작한다.
