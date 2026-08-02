# Synthetic Evaluation Toolkit #T2

# Generation Contract & Prompt Compiler Design v1

## 0. 문서 상태

- Toolkit Track: `#T2`
- 작업 유형: 설계 전용
- 기준 브랜치: `feature/T1-synthetic-toolkit-workspace-foundation`
- 구현 상태: 미구현
- Provider 호출: 금지
- 이미지 생성: 금지
- production runtime 연결: 금지

`#T2`는 Toolkit 내부 작업 식별자이며 GitHub 실제 PR 번호가 아니다.

---

## 1. 목적

이 문서는 합성 얼굴 평가 후보를 만들기 위한 의미 계약과 Provider별 프롬프트 컴파일 경계를 고정한다.

핵심 책임은 두 가지다.

1. 사람이 자유형 프롬프트를 직접 작성하지 않고 구조화된 `GenerationSpec`으로 생성 의도를 표현한다.
2. 같은 의미 명세를 Provider별 표현 방식으로 결정론적으로 변환한다.

이 단계는 이미지를 만들거나 실제 라벨을 확정하지 않는다.

```text
GenerationSpec
→ validation
→ canonicalization
→ ProviderProfile
→ PromptCompiler
→ CompiledPrompt
```

후속 파이프라인은 별도다.

```text
CompiledPrompt
→ generation execution
→ generated candidate
→ independent observation
→ judgment
→ purpose-specific promotion
```

---

## 2. 기준 자료와 우선순위

### 2.1 설계 기준

이 설계는 다음 프로젝트 자료의 원칙을 따른다.

- `bejewely-face-analyze-pipeline-07-30.txt`
- `Face_Lab_구현_명세_0716_수정본.md`
- `face_lab_진행상황_0727.txt`
- Toolkit Track `#T1` workspace boundary

### 2.2 권위 순서

```text
현재 저장소 코드와 package boundary
→ 확정된 Face Lab 안전 불변식
→ 이 #T2 설계
→ 과거 실험 프롬프트와 생성 결과
```

과거 프롬프트나 생성 결과는 설계 참고 자료일 뿐 계약의 권위가 아니다.

현재 `main`에는 과거 통합 브랜치의 canonical Vision 계약 전체가 존재하지 않으므로, #T2는 production observation 계약을 복제하거나 재정의하지 않는다. 생성 계약만 독립적으로 설계한다.

---

## 3. 절대 불변식

### G-01. 생성 의도는 관찰 라벨이 아니다

```text
프롬프트에 지정한 값
≠ 이미지에서 실제 관찰된 값
≠ Gold label
```

`GenerationSpec`의 모든 target은 `intended` 의미를 가진다.

### G-02. 생성 성공은 데이터셋 승격이 아니다

이미지가 생성돼도 candidate일 뿐이다. 별도의 eligibility, observation, judgment, consensus, promotion 절차를 통과해야 한다.

### G-03. 프롬프트 컴파일러는 판정 엔진이 아니다

컴파일러는 대표 상, 피부 상태, 품질 적합성, dataset eligibility를 판정하지 않는다.

### G-04. production은 toolkit에 의존하지 않는다

```text
production application ─X→ @bejewely/synthetic-evaluation
```

공유가 필요한 순수 계약만 미래의 `@bejewely/face-contracts`를 통한다.

### G-05. Provider 호출은 adapter 계층의 책임이다

#T2 compiler는 텍스트와 parameter hint만 산출한다. API key, 세션, 브라우저 자동화, 네트워크 호출을 소유하지 않는다.

### G-06. 자유형 override는 금지한다

검증을 우회하는 `extraPrompt`, `customNegative`, `rawProviderParams` 같은 임의 문자열 입력을 허용하지 않는다.

### G-07. 성인 합성 인물만 허용한다

미성년자 또는 나이가 모호한 인물을 생성 대상에 포함하지 않는다.

### G-08. 외모 우열·정체성·관상 추론을 생성 목표로 삼지 않는다

금지 대상:

- attractiveness score
- beauty rank
- celebrity identity imitation
- real-person likeness
- personality
- fortune
- health diagnosis
- ethnicity classification label
- intelligence or ability

### G-09. 직접 동물 단어를 얼굴 프롬프트에 삽입하지 않는다

`cat`, `rabbit`, `fox`, `dog` 같은 taxonomy token은 campaign intent metadata로 존재할 수 있으나 기본 compiler가 그대로 문장에 삽입하지 않는다.

직접 삽입은 동물 귀, 코, 눈, 일러스트 스타일 등 오염을 만들 수 있다.

### G-10. 같은 입력은 같은 결과를 만든다

동일한 다음 입력은 byte-identical `CompiledPrompt`를 생성해야 한다.

- canonical `GenerationSpec`
- compiler version
- template version
- ProviderProfile version

---

## 4. 책임 분리

```text
Campaign Planner
  └─ 어떤 조건을 몇 장 만들지 결정

GenerationSpec Contract
  └─ 한 후보의 생성 의도를 구조화

Prompt Compiler
  └─ 의미 명세를 Provider 표현으로 변환

Provider Adapter
  └─ 수동 또는 자동 생성 실행

Candidate Import
  └─ 이미지와 생성 이력을 등록

Judgment Pipeline
  └─ 실제 관찰과 승격 여부 결정
```

#T2의 범위는 `GenerationSpec Contract`와 `Prompt Compiler`까지다.

---

## 5. GenerationSpec v1

### 5.1 상위 구조

```ts
type GenerationSpecV1 = {
  schemaVersion: "generation-spec-v1";
  specId: string;
  purpose: GenerationPurpose;
  subject: SubjectIntent;
  capture: CaptureIntent;
  appearance: AppearanceIntent;
  featureIntent: FaceFeatureIntent | null;
  archetypeIntent: ArchetypeIntentMetadata | null;
  skinIntent: SkinIntent;
  variation: VariationIntent;
  exclusions: ExclusionPolicy;
  provenance: SpecProvenance;
};
```

### 5.2 `specId`

`specId`는 임의 UUID가 아니라 canonical payload digest에 묶는다.

권장 형식:

```text
gen_<sha256 first 24 hex>
```

`specId` 계산에서 제외되는 값:

- 사람이 읽는 note
- 생성 시각
- job id
- candidate id

동일한 의미 명세는 동일한 `specId`를 가져야 한다.

---

## 6. 생성 목적

```ts
type GenerationPurpose =
  | "capture_control"
  | "skin_cue_control"
  | "face_feature_control"
  | "paired_skin_edit"
  | "mixed_control_pilot";
```

### 목적별 제한

| purpose | 허용 target | 비고 |
|---|---|---|
| `capture_control` | subject, capture, appearance | 조건 통제력 확인 |
| `skin_cue_control` | capture + skinIntent | A/B/C/D 독립 생성 |
| `face_feature_control` | featureIntent | 승인된 feature cue만 |
| `paired_skin_edit` | reference + skin mutation | 같은 identity 비교 |
| `mixed_control_pilot` | feature + skin | pilot 전용, 대량 생성 금지 |

`mixed_control_pilot`은 단일 축 제어가 검증되기 전 campaign 기본값으로 사용할 수 없다.

---

## 7. SubjectIntent

```ts
type SubjectIntent = {
  syntheticPersonOnly: true;
  adultAgeBand: "20s" | "30s" | "40s" | "50s";
  presentation: "feminine" | "masculine" | "androgynous";
  regionalAppearanceHint: "korean_appearance_hint" | null;
  personCount: 1;
};
```

### 규칙

- 정확한 나이 숫자를 사용하지 않는다.
- `regionalAppearanceHint`는 생성 표현 힌트이며 observed ethnicity label이 아니다.
- 실제 인물 이름, 유명인, 사용자 이름, identity reference를 허용하지 않는다.
- `syntheticPersonOnly`와 `personCount: 1`은 고정값이다.

---

## 8. CaptureIntent

```ts
type CaptureIntent = {
  mediaStyle: "realistic_documentary_reference";
  pose: "direct_frontal";
  gaze: "camera";
  expression: "neutral";
  framing: "head_and_shoulders";
  headVisibility: "full_head_neck_upper_shoulders";
  background: "plain_light_gray";
  lighting: "soft_even_diffuse";
  whiteBalance: "natural";
  focus: "sharp_face";
  aspectRatio: "1:1";
  width: 1024;
  height: 1024;
};
```

### 고정 이유

- 얼굴 구조와 피부 cue를 동시에 비교하기 쉽다.
- 조명과 각도 변수를 줄인다.
- 지나친 beauty portrait 편향을 줄인다.
- 후보 간 crop 차이를 줄인다.

### framing 불변식

다음은 서로 다른 상태다.

```text
head_and_shoulders
≠ extreme_close_up
≠ passport_crop
≠ upper_body
```

compiler는 `full head, neck, and upper shoulders visible` 문구를 명시해야 한다.

---

## 9. AppearanceIntent

```ts
type AppearanceIntent = {
  hairColor: "dark_brown_black";
  hairStyle: "tied_back";
  hairFaceClearance: "away_from_forehead_and_cheeks";
  clothing: "plain_crew_neck_top";
  glasses: false;
  jewelry: false;
  visibleAccessories: false;
  visibleMakeup: "none";
};
```

### 규칙

- bare shoulders 또는 노출이 큰 crop을 방지하기 위해 plain top을 명시한다.
- `visibleMakeup: none`은 실제 무화장을 증명하는 observed label이 아니다.
- 머리카락은 핵심 얼굴 영역을 가리지 않도록 고정한다.

---

## 10. FaceFeatureIntent

### 10.1 목적

직접적인 대표 상 단어 대신 관찰 가능한 얼굴 cue를 생성 목표로 표현한다.

```ts
type FaceFeatureIntent = {
  schemaVersion: "face-feature-intent-v1";
  cueProfileVersion: string;
  eyeShape: ControlledCue;
  eyeDirection: ControlledCue;
  faceWidth: ControlledCue;
  verticalProportion: ControlledCue;
  jawContour: ControlledCue;
  straightCurvedBalance: ControlledCue;
  featureContrast: ControlledCue;
};

type ControlledCue = {
  value: string;
  strength: "subtle" | "moderate";
};
```

### 10.2 제한

- 값은 승인된 cue registry에 존재해야 한다.
- 임의 문자열을 허용하지 않는다.
- `extreme`, `exaggerated`, `cartoon` 강도는 허용하지 않는다.
- 하나의 cue profile이 실제 archetype 정답을 보장하지 않는다.

### 10.3 archetype과의 관계

```text
Archetype campaign intent
→ approved taxonomy mapping
→ FaceFeatureIntent
→ prompt compilation
```

#T2 compiler는 archetype weight를 직접 feature cue로 변환하지 않는다. 그 mapping은 taxonomy와 scoring rubric이 승인된 별도 단계의 책임이다.

---

## 11. ArchetypeIntentMetadata

```ts
type ArchetypeIntentMetadata = {
  taxonomyVersion: string;
  primary: string;
  secondary: string | null;
  intendedWeights: Record<string, number>;
  compilationMode: "metadata_only";
};
```

### 불변식

- weight 합은 정확히 `1.0`이어야 한다.
- 이 값은 prompt에 직접 들어가지 않는다.
- observed archetype score와 분리 저장한다.
- taxonomy mapping이 없는 spec은 `face_feature_control`로 compile할 수 없다.

---

## 12. SkinIntent

```ts
type SkinIntent = {
  baselineTexture: "natural_visible_pores";
  redness: {
    severity: "none" | "mild";
    regions: Array<"left_cheek" | "right_cheek" | "sides_of_nose">;
    pattern: "diffuse" | "none";
  };
  blemishes: {
    severity: "none" | "mild";
    regions: Array<"left_cheek" | "right_cheek" | "chin">;
    countBand: "none" | "three_to_five";
    pattern: "discrete" | "none";
  };
  oiliness: "not_targeted";
  dryness: "not_targeted";
};
```

### v1 제한

#T2에서 검증된 첫 축은 다음뿐이다.

- natural texture / visible pores
- mild diffuse redness
- three-to-five subtle discrete blemishes

`moderate`, `high`, 질환명, 염증 진단, 흉터, 색소질환 등은 v1에 넣지 않는다.

### 충돌 규칙

- `severity: none`이면 regions는 빈 배열이어야 한다.
- `pattern: none`과 non-empty regions를 함께 사용할 수 없다.
- blemish count가 `none`이면 severity도 `none`이어야 한다.
- redness cue와 blemish cue는 별도 축이다.

---

## 13. A/B/C/D 기준 fixture

### A — clean control

```json
{
  "redness": {
    "severity": "none",
    "regions": [],
    "pattern": "none"
  },
  "blemishes": {
    "severity": "none",
    "regions": [],
    "countBand": "none",
    "pattern": "none"
  }
}
```

Prompt intent:

```text
natural clear skin with visible pores and normal tonal variation,
no noticeable diffuse cheek or nose redness,
no visible inflamed blemishes,
not flawless or airbrushed
```

### B — redness only

```text
mild diffuse redness on both cheeks and sides of the nose
no discrete pimples or blemishes
```

### C — blemishes only

```text
three to five small subtle discrete blemishes on cheeks and chin
no diffuse cheek or nose redness
```

### D — combined

```text
mild diffuse redness on both cheeks and sides of the nose
plus three to five small subtle discrete blemishes on cheeks and chin
```

### fixture 정책

- A/B/C/D는 compiler snapshot test의 필수 fixture다.
- 각 condition당 최소 두 개의 독립 생성 결과가 있어야 Provider 제어력을 판단할 수 있다.
- 이미지 결과 평가는 #T2 범위가 아니다.

---

## 14. VariationIntent

```ts
type VariationIntent = {
  pairingMode: "independent" | "reference_edit";
  referenceCandidateId: string | null;
  mutationScope: "full_generation" | "skin_only";
  preserve: Array<
    | "identity"
    | "framing"
    | "pose"
    | "gaze"
    | "expression"
    | "hair"
    | "clothing"
    | "background"
    | "lighting"
  >;
};
```

### independent

- 매 condition을 별도로 생성한다.
- identity 일치는 요구하지 않는다.
- prompt control smoke test에 적합하다.

### reference_edit

- 동일 reference asset이 반드시 필요하다.
- `mutationScope`는 `skin_only`다.
- identity, framing, pose, gaze, expression, hair, clothing, background, lighting을 모두 preserve한다.
- Provider adapter가 reference input을 지원하지 않으면 compile 실패한다.

#T2는 reference image를 저장하거나 전달하지 않는다. 필요한 reference ID와 operator instruction만 산출한다.

---

## 15. ExclusionPolicy

```ts
type ExclusionPolicy = {
  required: readonly [
    "beauty_filter",
    "airbrushed_skin",
    "heavy_retouching",
    "glam_makeup",
    "dramatic_lighting",
    "smile",
    "head_tilt",
    "side_view",
    "hair_occlusion",
    "stylized_rendering",
    "illustration",
    "text",
    "labels",
    "logo",
    "watermark",
    "symbol",
    "bare_shoulders"
  ];
};
```

필수 exclusion은 spec 작성자가 제거하거나 약화할 수 없다.

---

## 16. SpecProvenance

```ts
type SpecProvenance = {
  campaignId: string;
  authoredBy: "campaign_planner" | "human_operator";
  sourceTemplateId: string;
  sourceTemplateVersion: string;
  createdAt: string;
  notes: string | null;
};
```

### digest 규칙

`createdAt`과 `notes`는 semantic digest에서 제외한다.

### 보안 규칙

다음을 포함할 수 없다.

- user image URL
- raw image bytes
- user account ID
- email
- name
- API key
- cookie
- Provider session token

---

## 17. Canonicalization

### 17.1 목적

서로 같은 의미를 가진 JSON이 다른 key order 때문에 다른 digest를 갖지 않게 한다.

### 17.2 규칙

- object key는 사전순 정렬
- enum은 canonical token 사용
- set 성격 array는 registry order로 정렬
- `null`과 field omission을 혼용하지 않음
- 숫자는 finite number만 허용
- weight는 정규화하지 않고 정확히 검증
- free-text note는 semantic payload에서 제외

### 17.3 결과

```ts
type CanonicalGenerationSpec = {
  spec: GenerationSpecV1;
  canonicalJson: string;
  specDigest: string;
};
```

---

## 18. ProviderProfile

```ts
type ProviderProfile = {
  id: string;
  version: string;
  providerFamily: "gemini_image" | "gpt_image" | "sdxl_comfyui";
  executionMode: "manual_web" | "local_workflow" | "api";
  status: "active_pilot" | "reference_only" | "disabled";
  capabilities: {
    separateNegativePrompt: boolean;
    referenceImage: boolean;
    seed: boolean;
    structuredParameters: boolean;
  };
  templateVersion: string;
};
```

### 초기 profile

#### `gemini-image-manual-v1`

- execution: `manual_web`
- positive와 exclusion을 하나의 prose prompt로 합친다.
- 별도 negative prompt를 전제하지 않는다.
- 모델명과 생성 시각은 operator가 import 단계에서 기록한다.
- reference edit 지원 여부는 실제 사용 화면과 operator 확인에 따라 capability로 결정한다.

#### `gpt-image-manual-v1`

- execution: `manual_web`
- prose prompt와 operator instruction을 산출한다.
- 모델명과 생성 시각은 import 단계에서 기록한다.
- 실제 UI 기능을 compiler가 가정하지 않는다.

#### `sdxl-comfyui-reference-v1`

- execution: `local_workflow`
- status: `reference_only`
- positive와 negative prompt를 분리한다.
- 과거 smoke test 재현을 위한 parameter hint만 보존한다.
- 대량 생성 기본 profile로 사용할 수 없다.

### API profile

#T2에서는 활성 API profile을 정의하지 않는다. API 호출과 비용 발생은 별도 승인 단계다.

---

## 19. CompiledPrompt v1

```ts
type CompiledPromptV1 = {
  schemaVersion: "compiled-prompt-v1";
  specId: string;
  specDigest: string;
  compilerVersion: "prompt-compiler-v1";
  templateVersion: string;
  providerProfile: {
    id: string;
    version: string;
    executionMode: "manual_web" | "local_workflow" | "api";
  };
  content: {
    positivePrompt: string;
    negativePrompt: string | null;
    operatorInstructions: string[];
    parameterHints: Record<string, string | number | boolean | null>;
  };
  promptDigest: string;
};
```

### 저장해야 하는 값

- canonical spec digest
- compiler version
- template version
- ProviderProfile id/version
- 최종 positive prompt
- 최종 negative prompt
- operator instruction
- parameter hint
- compiled prompt digest

### 포함하지 않는 값

- API key
- raw Provider response
- browser cookies
- user identity
- image bytes
- observed labels
- Gold decision

---

## 20. Prompt section ordering

모든 prose profile은 다음 순서를 고정한다.

```text
1. synthetic adult subject
2. capture and framing
3. hair, clothing, accessories, makeup constraints
4. approved face feature cues
5. skin cues
6. realism and natural texture
7. preserve instructions for paired edit
8. exclusions
9. final analysis-reference purpose statement
```

section 순서가 바뀌면 template version을 올린다.

---

## 21. 공통 base prompt 의미

Provider 문법은 달라도 다음 의미는 유지한다.

```text
Create a realistic documentary-style reference portrait of one synthetic adult Korean-presenting person.
Show a direct frontal head-and-shoulders portrait with the full head, neck, and upper shoulders visible.
The person looks straight at the camera with a neutral expression.
Use a plain light-gray background, soft even diffuse lighting, natural white balance, and sharp facial focus.
Dark hair is tied back and kept away from the forehead and cheeks.
Use a plain crew-neck top. No glasses, jewelry, accessories, or visible makeup.
Preserve natural unretouched skin texture, visible pores, slight natural asymmetry, and realistic facial detail.
This is an analysis-friendly reference image, not a beauty advertisement or fashion editorial.
```

이 문장은 template 의미 예시다. 구현 시 exact snapshot은 Provider profile별로 고정한다.

---

## 22. exclusion compilation

### prose profile

별도 negative prompt가 없으면 마지막 단락에 합친다.

```text
Do not add beauty filters, airbrushed or flawless skin, heavy retouching, glam makeup, dramatic lighting, smiling, head tilt, side view, hair covering the face, stylized rendering, illustration, text, labels, logos, watermarks, symbols, or bare shoulders.
```

### separate-negative profile

positive prompt에는 목적과 원하는 상태만 둔다.

negative prompt에는 exclusion registry를 deterministic order로 직렬화한다.

---

## 23. paired edit compilation

`reference_edit` mode는 다음 문장을 필수로 포함한다.

```text
Use the supplied reference image as the identity and composition source.
Keep identity, framing, pose, gaze, expression, hair, clothing, background, lighting, and camera perspective unchanged.
Modify only the requested skin cues.
```

reference capability가 false인 profile에서 이 mode를 요청하면 `reference_capability_required` 오류로 실패한다.

---

## 24. Validation Error Contract

```ts
type GenerationValidationErrorCode =
  | "invalid_spec_version"
  | "invalid_spec_id"
  | "adult_age_required"
  | "single_synthetic_person_required"
  | "unsupported_generation_purpose"
  | "unsupported_provider_profile"
  | "provider_profile_disabled"
  | "unsupported_target_axis"
  | "unapproved_feature_cue"
  | "archetype_mapping_required"
  | "archetype_weight_invalid"
  | "conflicting_skin_targets"
  | "reference_candidate_required"
  | "reference_capability_required"
  | "unsafe_exclusion_override"
  | "free_text_override_forbidden"
  | "non_deterministic_value"
  | "sensitive_provenance_forbidden";
```

### fail-closed 원칙

- unsupported field를 조용히 무시하지 않는다.
- default target을 자동 삽입하지 않는다.
- 잘못된 enum을 유사값으로 보정하지 않는다.
- Provider가 지원하지 않는 기능을 fallback generation으로 바꾸지 않는다.

---

## 25. Compiler API 설계

```ts
type CompilePromptInput = {
  spec: GenerationSpecV1;
  providerProfile: ProviderProfile;
};

type CompilePromptResult =
  | {
      ok: true;
      canonicalSpec: CanonicalGenerationSpec;
      compiledPrompt: CompiledPromptV1;
    }
  | {
      ok: false;
      errors: Array<{
        code: GenerationValidationErrorCode;
        path: string;
      }>;
    };
```

```ts
function compilePrompt(input: CompilePromptInput): CompilePromptResult;
```

### 금지

- throw-only public API
- partial compiled prompt 반환
- warning만 남기고 계속 진행
- runtime 환경변수에 따라 prompt 의미 변경
- locale에 따라 target semantics 변경

---

## 26. 버전 관리

독립 버전 네 개를 유지한다.

```text
GenerationSpec schema version
Compiler version
Prompt template version
ProviderProfile version
```

### 변경 규칙

| 변경 | 올릴 버전 |
|---|---|
| field 추가·삭제·의미 변경 | spec schema |
| compile 알고리즘 변경 | compiler |
| 문장·section order 변경 | template |
| capability·parameter 변경 | ProviderProfile |

이미 생성된 `CompiledPrompt`는 불변 artifact로 취급한다.

---

## 27. 계획된 파일 구조

#T2 구현 시 권장 구조다. 이 설계 PR에서는 생성하지 않는다.

```text
packages/face-contracts/
└─ src/
   └─ synthetic-generation/
      ├─ generation-spec.js
      ├─ compiled-prompt.js
      ├─ provider-profile.js
      └─ validation-errors.js

tools/synthetic-evaluation/
└─ src/
   └─ generation/
      ├─ canonicalize-generation-spec.js
      ├─ validate-generation-spec.js
      ├─ compile-prompt.js
      ├─ templates/
      │  ├─ common-reference-portrait-v1.js
      │  ├─ skin-cue-v1.js
      │  └─ exclusions-v1.js
      └─ providers/
         ├─ gemini-image-manual-v1.js
         ├─ gpt-image-manual-v1.js
         └─ sdxl-comfyui-reference-v1.js
```

### package boundary

- 순수 schema, enum, validator contract만 `face-contracts`
- template와 compile 로직은 toolkit
- production app import 금지

---

## 28. 구현 fixture 계획

### positive fixtures

1. A clean independent
2. B redness-only independent
3. C blemishes-only independent
4. D combined independent
5. B paired edit
6. D paired edit
7. approved face feature cue pilot

### negative fixtures

1. minor age band
2. two-person subject
3. real person name
4. unsupported skin severity
5. redness none + non-empty regions
6. blemish none + non-zero count
7. missing reference candidate
8. unsupported reference profile
9. removed required exclusion
10. raw free-text override
11. direct archetype compilation without mapping
12. NaN or non-finite weight
13. weight sum not 1.0
14. sensitive user provenance

---

## 29. acceptance criteria for future #T2 implementation

### Contract

- `GenerationSpec v1` exact validation
- canonical JSON deterministic
- digest deterministic
- intended target namespace 명시
- A/B/C/D fixture 통과
- invalid fixture fail-closed

### Compiler

- 같은 입력에서 byte-identical prompt
- Provider profile별 exact snapshot
- unsupported capability fail-closed
- required exclusions 누락 불가
- direct animal taxonomy token 미출력
- no API call
- no filesystem image write

### Architecture

- production source에서 toolkit import 0
- toolkit은 local contract package만 의존
- DB, API route, UI, auth, payment 변경 0
- external dependency 추가 0을 기본 목표로 함

### Verification

```text
npm run synthetic:test
npm run synthetic:verify
npm run architecture:guard
npm run build
```

---

## 30. 구현 순서

```text
T2-1 contract enums and validators
→ T2-2 canonicalization and digest
→ T2-3 common template sections
→ T2-4 Gemini manual profile
→ T2-5 GPT Image manual profile
→ T2-6 SDXL reference-only profile
→ T2-7 A/B/C/D fixtures and snapshots
→ T2-8 architecture boundary verification
```

하나의 PR에서 모두 구현하더라도 각 단계는 독립 검증 가능해야 한다.

---

## 31. 이번 설계의 의도적 비대상

- Provider API adapter
- 브라우저 자동화
- Gemini 또는 GPT 웹 UI 조작
- 이미지 생성 실행
- ComfyUI workflow 실행
- generated candidate import
- SHA-256 asset hashing
- perceptual duplicate detection
- eligibility
- Vision observation
- archetype scoring
- judge consensus
- dataset promotion
- DB schema
- admin review UI
- production Face Lab 연결
- user photo collection
- consent registry

---

## 32. 후속 Toolkit Track

```text
#T1 Workspace Foundation
→ #T2 Generation Contract & Prompt Compiler
→ #T3 Candidate Import & Provenance
→ #T4 Observation Adapter
→ #T5 Judgment & Consensus
→ #T6 Promotion & Dataset Versioning
```

세부 Track 번호는 구현 계획에서 다시 검토할 수 있으나 다음 순서는 유지한다.

```text
생성 계약
→ 후보 등록
→ 독립 관찰
→ 판단
→ 목적별 승격
```

---

## 33. 최종 설계 판단

#T2의 핵심은 프롬프트 문장을 잘 쓰는 것이 아니다.

```text
자유형 prompt
→ 구조화된 intended contract

Provider별 임의 문장
→ versioned deterministic compiler

동물상 token 직접 생성
→ 승인된 관찰 cue 기반 생성

생성 성공
→ candidate only

생성 의도
→ observed label과 분리
```

이 경계를 지키면 Gemini, GPT Image, SDXL 또는 다른 생성기로 교체해도 생성 의도와 실제 평가 결과를 동일한 방식으로 추적할 수 있다.
