# Face Lab V2 Visual Try-On Canary v1

> Track: Face Lab / face-research
> Stage: Visual Try-On P0-C
> Paid execution: local only, exactly one new output maximum
> CI paid execution: forbidden

## 목적

Visual Try-On의 첫 실사용 검증은 다음 세 가지를 한 얼굴에 동시에 적용한다.

- coral/orange lip
- lavender/purple highlighter
- gray lens

이 조합은 최종 지원 범위를 뜻하지 않는다.

이미 수동 ChatGPT 실험에서 변화가 잘 보였던 세 영역을 이용해 다음을 검증하기 위한 canary fixture다.

- source identity preservation
- selected-region adherence
- reference-image usefulness
- multi-item coexistence
- unselected-region stability

## 입력 파일

사용자 얼굴과 제품/착용 reference는 저장소에 커밋하지 않는다.

기본 경로:

```text
private/face-lab-visual-try-on/input/source.png
private/face-lab-visual-try-on/input/lip-reference.png
private/face-lab-visual-try-on/input/highlight-reference.png
private/face-lab-visual-try-on/input/lens-reference.png
```

PNG/JPEG/WebP를 허용한다.

필요하면 다음 환경변수로 input root 안의 다른 파일을 선택할 수 있다.

```text
FACE_LAB_VISUAL_TRY_ON_SOURCE_IMAGE
FACE_LAB_VISUAL_TRY_ON_LIP_REFERENCE
FACE_LAB_VISUAL_TRY_ON_HIGHLIGHT_REFERENCE
FACE_LAB_VISUAL_TRY_ON_LENS_REFERENCE
```

경로는 반드시 `private/face-lab-visual-try-on/input` 아래에 있어야 한다.

## Precheck — 비용 0

```bash
npm run run:face-lab-v2-visual-try-on-canary -- precheck
```

또는 campaign ID를 명시한다.

```bash
npm run run:face-lab-v2-visual-try-on-canary -- precheck VT-CANARY-MANUAL-01
```

Precheck는:

- 4개 입력 이미지 존재/형식 검증
- reference count/총 byte cap 검증
- 3개 product-bound operation 생성
- deterministic reference ordering 검증
- source/reference SHA-256 기록
- render spec SHA-256 기록
- instruction SHA-256 기록
- provider request binding 생성

만 수행한다.

이미지 provider 호출은 0회다.

성공 verdict:

```text
FACE_LAB_VISUAL_TRY_ON_PRECHECK_PASS
```

## Canary — 실제 유료 출력 최대 1장

명시적 비용 승인 없이는 실행되지 않는다.

```bash
FACE_LAB_VISUAL_TRY_ON_LIVE_APPROVAL=I_ACCEPT_ONE_OPENAI_IMAGE_COST \
npm run run:face-lab-v2-visual-try-on-canary -- canary
```

조건:

- CI에서는 실행 불가
- precheck 필수
- precheck 이후 source/reference가 바뀌면 차단
- 동일 campaign에 기존 checkpoint/gate가 있으면 재생성 차단
- source 1장 + reference 3장
- output은 1장
- OpenAI API key 필요
- provider 내부의 제한된 429 retry 외에 별도 재실행 루프 없음

성공 시:

```text
private/face-lab-visual-try-on/<campaign-id>/
  precheck.json
  canary-output.png
  manifest.checkpoint.json
  canary-gate.json
```

성공 verdict:

```text
FACE_LAB_VISUAL_TRY_ON_CANARY_READY_FOR_REVIEW
```

이 시점에서 자동 후속 생성은 없다.

## Human review

검토 항목:

1. 같은 사람으로 보이는가
2. 입술 외형은 유지하면서 coral/orange 계열 lip이 보이는가
3. cheek high point에 lavender/purple reflectivity가 보이는가
4. iris anatomy를 망가뜨리지 않고 gray lens가 보이는가
5. 세 변화가 서로 섞이지 않는가
6. hair/face geometry/background/lighting 등 비대상 영역이 과도하게 변하지 않는가
7. 구매 전 참고용 결과로 충분히 자연스러운가

승인:

```bash
npm run run:face-lab-v2-visual-try-on-canary -- approve
```

거절:

```bash
npm run run:face-lab-v2-visual-try-on-canary -- reject
```

approve/reject는 provider 호출 0회다.

## Privacy / evidence

- source face image는 private 경로에만 둔다.
- reference image도 private 경로에만 둔다.
- JSON evidence에는 image bytes/base64를 기록하지 않는다.
- 각 reference는 assetRef/slot/role/mime/byteLength/SHA-256으로만 바인딩한다.
- provider prompt 원문은 evidence JSON에 저장하지 않고 SHA-256만 저장한다.

## 현재 경계

이 단계는 canary 실행 경로의 준비와 안전장치까지 구현한다.

실제 유료 canary는 사용자의 명시적 비용 승인 없이는 실행하지 않는다.
