# FACE LAB V2 CANONICAL RESULT CONTRACT

> Track: FACE LAB / Product Architecture  
> Status: V2 canonical result authority candidate  
> Scope: Current Face Profile → Target Style → Style Delta → Routes → domain execution → Look Composer → Premium projection / storage  
> Production impact: none until implementation wiring and migration are completed  
> Related: `FACE_LAB_MASTER_SPEC.md`, `FACE_LAB_TARGET_STYLE_MODEL_V1.md`, `FACE_LAB_TARGET_STYLE_SURVEY_V1.md`, `face-lab-face-space-style-compatibility-architecture-v1.md`, `face-lab-archetype-styling-contract-v1.md`

---

## 1. 목적

이 문서는 Face Lab V2의 **하나의 canonical result**가 어떤 정보를 보존해야 하는지 정의한다.

V2의 제품 흐름은 다음이다.

```text
Photo
→ Eligibility / Quality
→ FaceLabObservationAnalysis
→ Normalized Face Representation
→ Current Face Profile

Premium Target Style Survey
→ Target Style Profile

Current Face Profile
+
Target Style Profile
+
Styling Scope / Constraints
↓
Style Delta
↓
Style Routes
↓
Hair / Makeup / Color / Grooming / Eyewear / Accessories
↓
Look Composer
↓
Canonical Face Lab V2 Result
↓
Premium projection / storage / later free teaser projection
```

핵심 원칙:

> **분석 결과, 사용자의 추구미, 스타일 변화 방향, 경로, 실행안은 서로 다른 계층이지만 최종적으로 하나의 canonical result에 연결되어야 한다.**

---

## 2. V2의 제품 중심

Face Lab V2는 Archetype 중심 결과 객체가 아니다.

Canonical result의 사용자 가치 중심은:

```text
현재의 나
→ 내가 원하는 추구미
→ 현재와 목표 사이의 차이
→ 갈 수 있는 여러 경로
→ 실제 실행 방법
```

이다.

Archetype은 별도의 재미 / 공유 / 설명 보조 필드로 내려간다.

---

## 3. 현재 V1 container와의 관계

현재 저장소에는 observation-first canonical container가 존재하며 현재 상태 문서 기준으로 다음 downstream 필드는 아직 완성되지 않았다.

```text
analysis       = populated
archetype      = null
styleIdentity  = null
strategies     = null
color          = null
hair           = null
makeup         = null
faceStyle      = null
looks          = null
```

V2는 기존 analysis authority를 폐기하지 않는다.

V2는 다음처럼 확장한다.

```text
existing analysis
→ currentFaceProfile

new premium preference layer
→ targetStyle

new decision layer
→ styleDelta
→ routes

new execution layer
→ hair / makeup / color / grooming / eyewear / accessories

new composition layer
→ looks

secondary fun layer
→ archetypeFun
```

구형 payload를 무근거로 V2 available 상태로 승격하지 않는다.

---

## 4. Top-level envelope

V2 canonical result는 최소 다음 envelope을 가진다.

```ts
type FaceLabV2CanonicalResult = {
  schemaVersion: "face-lab-canonical-v2";
  resultId: string;

  status:
    | "available"
    | "partial"
    | "insufficient_evidence"
    | "unavailable";

  analyzedAt: string | null;
  updatedAt: string;

  analysisVersion: string | null;
  targetProfileVersion: string | null;
  decisionVersion: string | null;

  failureReason: string | null;
  warnings: string[];

  quality: FaceLabQualityResult;

  currentFaceProfile: CurrentFaceProfileResult | null;
  targetStyle: TargetStyleProfileResult | null;
  styleDelta: StyleDeltaResult | null;
  routes: StyleRouteSetResult | null;

  hair: HairExecutionResult | null;
  makeup: MakeupExecutionResult | null;
  color: ColorExecutionResult | null;
  grooming: GroomingExecutionResult | null;
  eyewear: EyewearExecutionResult | null;
  accessories: AccessoriesExecutionResult | null;
  faceAdjacentStyle: FaceAdjacentStyleExecutionResult | null;

  looks: LookComposerResult | null;

  archetypeFun: ArchetypeFunResult | null;

  productHandoff: ProductHandoffResult | null;

  lineage: FaceLabLineage;
};
```

위 타입은 canonical shape 설명용이다. 실제 TypeScript 구현은 별도 코드 변경에서 고정한다.

---

## 5. 공통 status contract

각 독립 영역은 가능한 한 다음 상태를 사용한다.

```text
available
partial
insufficient_evidence
unavailable
not_requested
not_applicable
```

### available

해당 영역이 충분한 입력과 근거를 가지고 사용자-facing 결과를 만들 수 있다.

### partial

일부 하위 결과만 유효하다.

예:

```text
makeup:
- brow available
- eye available
- blush unavailable
```

### insufficient_evidence

영역은 요청되었지만 근거가 부족해 개인화 결과를 만들 수 없다.

### unavailable

기술 실패, unsupported 상태 또는 필수 입력 부재.

### not_requested

사용자가 해당 Styling Scope를 선택하지 않았다.

### not_applicable

사용자의 조건에 현재 영역이 적용되지 않는다.

예:

```text
facial hair route
→ user opted out
→ not_requested
```

---

## 6. 공통 evidence-bearing field

개인화된 결과 필드는 가능한 한 다음 공통 구조를 따른다.

```ts
type EvidenceBearing<T> = {
  status:
    | "available"
    | "partial"
    | "insufficient_evidence"
    | "unavailable"
    | "not_requested"
    | "not_applicable";

  source:
    | "vision"
    | "face_representation"
    | "user_preference"
    | "target_finder"
    | "derived_rule"
    | "compatibility_evidence"
    | "catalog"
    | "cross_domain_constraint"
    | null;

  confidence: number | null;
  evidence: string[];
  unavailableReason: string | null;
  value: T | null;
};
```

금지:

- `status !== available`인데 default 개인화 결과를 채우기
- source 없이 recommendation을 개인화된 결과로 노출
- confidence를 LLM의 자의적 자신감 문구로 생성

---

# 7. Quality

Quality는 V2에서도 독립 authority다.

```ts
type FaceLabQualityResult = {
  status: "available" | "partial" | "unavailable";

  faceVisibility: number | null;
  lightingSuitability: number | null;
  colorSuitability: number | null;

  poseWarnings: string[];
  occlusionWarnings: string[];
  captureWarnings: string[];

  evidence: string[];
};
```

Quality가 낮다고 전체 result를 무조건 unavailable로 만들지는 않는다.

대신 downstream domain이 필요한 quality 조건을 독립적으로 판단한다.

예:

```text
geometry usable
color unusable
→ currentFaceProfile available
→ hair available
→ color insufficient_evidence
```

---

# 8. Current Face Profile

## 8.1 역할

Current Face Profile은 사용자에게 **현재 얼굴에서 무엇이 스타일에 영향을 주는지** 설명하는 계층이다.

Raw landmark, Provider native output, 3D backend coefficient를 직접 사용자 결과로 노출하지 않는다.

```text
FaceLabObservationAnalysis
+
Normalized Face Representation
+
Face Space
↓
Current Face Profile
```

---

## 8.2 구조

```ts
type CurrentFaceProfileResult = {
  status: "available" | "partial" | "insufficient_evidence" | "unavailable";

  representationRef: string | null;
  faceSpaceVersion: string | null;

  summary: string | null;

  keyFeatures: Array<{
    key: string;
    label: string;
    direction: string | null;
    prominence: "low" | "medium" | "high" | null;
    explanation: string;
    evidence: string[];
    confidence: number | null;
  }>;

  visualLanguage: {
    lineCurve: number | null;
    definition: number | null;
    featureContrast: number | null;
    visualWeightDistribution: string | null;
  } | null;

  structuralProfile: {
    lowerFaceWidth: number | null;
    chinHeight: number | null;
    eyeSpacing: number | null;
    eyeWidth: number | null;
    eyeTilt: number | null;
    noseWidth: number | null;
  } | null;

  presentationObservations: {
    currentHairInfluence: string[] | null;
    currentBrowInfluence: string[] | null;
    currentMakeupInfluence: string[] | null;
    currentEyewearInfluence: string[] | null;
  } | null;

  evidence: string[];
  confidence: number | null;
  unavailableReason: string | null;
};
```

현재 Face Space의 실제 dimension set이 확장되면 `structuralProfile`도 versioning한다.

---

## 8.3 사용자-facing 원칙

사용자에게는 raw z-score를 첫 화면에서 보여주지 않는다.

우선:

```text
당신 얼굴에서 스타일에 가장 크게 작용하는 특징

1. 눈매 방향성
2. 외곽 실루엣
3. 하안부 비율
```

처럼 번역한다.

필요 시 상세 화면에서 수치 근거를 보여줄 수 있다.

---

# 9. Target Style Profile

Target Style Profile은 `FACE_LAB_TARGET_STYLE_MODEL_V1.md`의 authority를 따른다.

Canonical result에서는 survey raw answer 전체를 복제하지 않는다.

최종 normalized profile을 저장한다.

```ts
type TargetStyleProfileResult = {
  status: "available" | "partial" | "needs_confirmation";

  source:
    | "direct_selection"
    | "target_finder"
    | "mixed";

  approvedByUser: boolean;
  approvedAt: string | null;

  targetLabels: string[];

  vector: {
    softSharp: number | null;
    naturalPolished: number | null;
    playfulMature: number | null;
    minimalStatement: number | null;
    warmCool: number | null;
    classicTrendy: number | null;
  };

  priority: string[];
  contexts: string[];

  presentationPreference:
    | "masculine_examples"
    | "feminine_examples"
    | "neutral_examples";

  stylingScope: string[];
  changeTolerance: "minimal" | "light" | "moderate" | "high";

  constraintsRef: string | null;

  preferenceEvidence: string[];
  confidence: number | null;

  registryVersion: string;
  mapperVersion: string;
};
```

---

# 10. Survey raw answer와 canonical target 분리

다음을 같은 객체로 취급하지 않는다.

```text
Survey Answer
≠ Target Style Profile
```

Survey Answer:

- 사용자가 실제 누른 값
- 복수 선택
- 중간 상태
- Target Finder session
- hard exclusion

Target Style Profile:

- 정규화된 목표
- Style Vector
- priority
- scope
- constraint reference
- user approval

Canonical result는 Target Style Profile을 읽고, raw survey는 별도 survey storage contract에 둘 수 있다.

---

# 11. Style Delta

## 11.1 역할

Style Delta는:

> **현재 얼굴과 사용자의 추구미를 연결해, 실제 스타일 parameter를 어느 방향으로 움직일지 만드는 결정 계층**

이다.

중요:

```text
Style Delta
!= Face Vector - Target Vector
```

두 공간의 의미가 다르므로 단순 subtraction을 금지한다.

---

## 11.2 입력

```text
Current Face Profile
+
Target Style Profile
+
Current Presentation
+
Styling Scope
+
Constraints
+
Compatibility Evidence
```

---

## 11.3 구조

```ts
type StyleDeltaResult = {
  status: "available" | "partial" | "insufficient_evidence" | "unavailable";

  targetProfileVersion: string;
  faceProfileVersion: string;

  summary: string | null;

  priorities: Array<{
    rank: number;
    domain:
      | "hair"
      | "brow_grooming"
      | "makeup"
      | "color"
      | "eyewear"
      | "accessories"
      | "facial_hair"
      | "face_adjacent_style";

    parameter: string;
    direction:
      | "increase"
      | "decrease"
      | "shift"
      | "maintain"
      | "open"
      | "reduce"
      | "emphasize"
      | "moderate";

    strength: "light" | "moderate" | "strong";
    expectedEffect: string;
    reason: string;
    evidence: string[];
    constraintState: "allowed" | "limited" | "blocked";
  }>;

  preservedFeatures: Array<{
    feature: string;
    reason: string;
  }>;

  conflicts: Array<{
    type: string;
    description: string;
    resolution: string | null;
  }>;

  confidence: number | null;
  evidence: string[];
  unavailableReason: string | null;
};
```

---

# 12. Style Delta 원칙

1. 사용자가 선택하지 않은 domain을 강제로 사용하지 않는다.
2. hard exclusion을 위반하지 않는다.
3. 얼굴 특징을 “결점”으로 정의하지 않는다.
4. target을 위해 반드시 얼굴 특징을 숨겨야 한다고 가정하지 않는다.
5. 살리기 / 균형 / 방향 전환을 구분한다.
6. 현재 얼굴 구조와 target이 충돌해도 “불가능”으로 단정하기보다 다른 route를 탐색한다.
7. compatibility 근거가 부족하면 범위를 넓히거나 hold한다.
8. Style Delta는 SKU를 직접 선택하지 않는다.

---

# 13. Route Set

## 13.1 역할

Route는 하나의 target에 도달하는 서로 다른 실행 전략이다.

```text
Target 하나
→ Route 여러 개 가능
```

Route를 ranking 1/2/3으로 만들 필요는 없다.

---

## 13.2 구조

```ts
type StyleRouteSetResult = {
  status: "available" | "partial" | "insufficient_evidence" | "unavailable";

  routes: StyleRoute[];

  defaultRouteId: string | null;
  selectedRouteId: string | null;

  comparisonAxes: string[];

  evidence: string[];
  confidence: number | null;
  unavailableReason: string | null;
};

type StyleRoute = {
  routeId: string;
  title: string;
  summary: string;

  strategy:
    | "hair_led"
    | "makeup_led"
    | "grooming_led"
    | "balanced"
    | "low_effort"
    | "high_change"
    | "custom";

  domains: string[];

  changeMagnitude: "low" | "medium" | "high";
  dailyEffort: "low" | "medium" | "high";
  maintenance: "low" | "medium" | "high";
  costBand: "low" | "standard" | "higher" | "unknown";
  reversibility: "easy" | "moderate" | "difficult" | "mixed";

  targetFit: {
    status: "supported" | "bounded" | "uncertain";
    explanation: string;
  };

  constraintFit: {
    hardViolations: string[];
    softTradeoffs: string[];
  };

  actions: Array<{
    domain: string;
    parameter: string;
    direction: string;
    strength: string;
    explanation: string;
  }>;

  whyThisRoute: string;
};
```

---

# 14. Route 생성 규칙

1. 동일한 내용의 route를 이름만 바꿔 여러 개 만들지 않는다.
2. domain 선택지가 좁으면 1~2개 route만 제공할 수 있다.
3. hard constraint violation이 있는 route는 결과에 넣지 않는다.
4. soft tradeoff는 표시할 수 있다.
5. low-effort route를 별도로 만드는 것은 허용한다.
6. 사용자가 Makeup을 선택하지 않으면 Makeup-led route를 만들지 않는다.
7. 사용자가 Hair 변화를 막았으면 큰 Hair route를 만들지 않는다.
8. Route 비교는 사용자 선택을 돕기 위한 것이지 “최고의 route”를 판정하기 위한 것이 아니다.
9. 사용자가 route를 선택하면 `selectedRouteId`를 기록한다.
10. route 변경 시 얼굴 분석을 다시 실행할 필요가 없는 경우 downstream만 재계산한다.

---

# 15. Domain execution 공통 계약

Hair / Makeup / Color / Grooming / Eyewear / Accessories는 같은 canonical style을 공유한다.

```ts
type DomainExecutionBase<T> = {
  status:
    | "available"
    | "partial"
    | "insufficient_evidence"
    | "unavailable"
    | "not_requested"
    | "not_applicable";

  routeId: string | null;
  targetProfileVersion: string | null;

  value: T | null;

  reason: string | null;
  confidence: number | null;
  evidence: string[];

  productSpecificationRefs: string[];
  unavailableReason: string | null;
};
```

---

# 16. Hair result

```ts
type HairExecutionResult = DomainExecutionBase<{
  parting: string[];
  fringe: string[];
  crownVolume: string[];
  sideVolume: string[];
  templeCoverage: string[];
  faceLineExposure: string[];
  lengthDirection: string[];
  layerDirection: string[];
  curvature: string[];
  texture: string[];
  silhouette: string[];

  examples: Array<{
    styleKey: string;
    label: string;
    whyItWorks: string;
    requiredParameters: string[];
  }>;

  avoidOrModerate: Array<{
    direction: string;
    reason: string;
  }>;
}>;
```

Hair style name은 최종 translation layer다.

```text
Face + Target
→ Hair parameter region
→ style catalog mapping
→ 실제 스타일 예시
```

---

# 17. Makeup result

## 17.1 역할

Makeup 결과는 제품 추천보다 먼저 **placement / direction / intensity**를 제공한다.

```ts
type MakeupExecutionResult = DomainExecutionBase<{
  intensity: "grooming_only" | "light" | "medium" | "expressive";

  brows: MakeupTechniqueBlock | null;
  eyes: MakeupTechniqueBlock | null;
  blush: MakeupTechniqueBlock | null;
  lips: MakeupTechniqueBlock | null;
  complexion: MakeupTechniqueBlock | null;
  contourHighlight: MakeupTechniqueBlock | null;

  avoidOrModerate: Array<{
    direction: string;
    reason: string;
  }>;
}>;

type MakeupTechniqueBlock = {
  placement: string[];
  direction: string[];
  intensity: string | null;
  finish: string[];
  colorDirection: string[];
  whyItWorks: string;
  productSpecificationRefs: string[];
};
```

---

## 17.2 Makeup Product Specification

예:

```ts
type MakeupProductSpecification = {
  specId: string;
  category:
    | "lip"
    | "blush"
    | "eyeshadow"
    | "eyeliner"
    | "brow"
    | "base"
    | "highlight"
    | "contour";

  hueFamily: string[] | null;
  undertone: string[] | null;
  depth: string | null;
  chroma: string | null;
  opacity: string | null;
  finish: string[] | null;

  glossLevel: string | null;
  blurLevel: string | null;
  shimmerLevel: string | null;
  diffusion: string | null;
  buildability: string | null;

  constraints: string[];
};
```

SKU는 이 specification 이후에 찾는다.

---

# 18. Color result

```ts
type ColorExecutionResult = DomainExecutionBase<{
  temperatureDirection: string | null;
  depthDirection: string | null;
  chromaDirection: string | null;
  contrastDirection: string | null;

  preferredFamilies: string[];
  moderateFamilies: string[];

  applicationNotes: string[];
  qualityWarnings: string[];
}>;
```

Color result는 퍼스널컬러 계절형 확정이 아니다.

---

# 19. Grooming result

```ts
type GroomingExecutionResult = DomainExecutionBase<{
  brows: string[];
  complexion: string[];
  lipTone: string[];
  facialHair: string[];
  sideburns: string[];
  hairline: string[];

  maintenancePlan: string[];
}>;
```

남성 스타일 중심 사용자에게 Hair 외의 실질적 실행 가치를 제공하기 위한 핵심 영역이다.

---

# 20. Eyewear result

```ts
type EyewearExecutionResult = DomainExecutionBase<{
  frameWidth: string[];
  frameHeight: string[];
  angularity: string[];
  curvature: string[];
  rimThickness: string[];
  bridgeDirection: string[];
  browAlignment: string[];
  visualWeight: string[];
  colorContrast: string[];

  examples: Array<{
    label: string;
    parameterMatch: string[];
    whyItWorks: string;
  }>;
}>;
```

시력, 안과, 의료 판단을 포함하지 않는다.

---

# 21. Accessories result

```ts
type AccessoriesExecutionResult = DomainExecutionBase<{
  scale: string[];
  angularity: string[];
  curvature: string[];
  length: string[];
  visualWeight: string[];
  colorContrast: string[];

  examples: Array<{
    category: string;
    direction: string;
    whyItWorks: string;
  }>;
}>;
```

사용하지 않는 category는 추천하지 않는다.

---

# 22. Face-adjacent style result

```ts
type FaceAdjacentStyleExecutionResult = DomainExecutionBase<{
  neckline: string[];
  collarStructure: string[];
  faceNearColor: string[];
  materialStructure: string[];
  patternIntensity: string[];
  silhouette: string[];
}>;
```

전신 체형을 모르는 상태에서 전신 코디를 확정하지 않는다.

---

# 23. Look Composer

## 23.1 역할

Look Composer는 영역별 결과를 단순 나열하지 않고 하나의 실행 가능한 조합으로 묶는다.

또한 **Visual Conflict Detection**을 수행한다.

---

## 23.2 구조

```ts
type LookComposerResult = {
  status: "available" | "partial" | "insufficient_evidence" | "unavailable";

  looks: Array<{
    lookId: string;
    routeId: string;
    title: string;
    summary: string;

    targetLabels: string[];

    hairRef: string | null;
    makeupRef: string | null;
    colorRef: string | null;
    groomingRef: string | null;
    eyewearRef: string | null;
    accessoriesRef: string | null;

    whyItWorks: string;

    conflictsResolved: string[];
    remainingTradeoffs: string[];
  }>;

  visualConflicts: Array<{
    conflictId: string;
    domains: string[];
    description: string;
    impact: string;
    resolution: string | null;
  }>;

  evidence: string[];
  confidence: number | null;
  unavailableReason: string | null;
};
```

---

# 24. Visual Conflict Detection

예:

```text
Hair outer silhouette
→ sharp / narrow

Brow
→ strong upward angle

Eyeliner
→ opposite downward direction

Target
→ polished + coherent

Result
→ direction conflict detected
```

사용자-facing 설명 예:

> 눈썹과 아이라인이 서로 다른 방향을 강조하고 있어 전체 인상이 분산될 수 있습니다.

Visual Conflict는 “틀린 스타일” 판정이 아니다.

현재 target과의 일관성, visual-weight balance, 방향성 충돌을 설명하는 기능이다.

---

# 25. Archetype Fun

## 25.1 위치

Archetype은 canonical result에 남을 수 있으나 스타일 decision authority는 아니다.

```ts
type ArchetypeFunResult = {
  status:
    | "available"
    | "partial"
    | "insufficient_evidence"
    | "unavailable";

  displayMode: "fun_only";

  primary: {
    key: string;
    label: string;
    affinity: number | null;
  } | null;

  mix: Array<{
    key: string;
    label: string;
    affinity: number | null;
    rank: number;
  }>;

  explanation: string | null;

  authority: {
    canDriveTargetStyle: false;
    canDriveStyleRoute: false;
    canDriveProductRecommendation: false;
  };

  evidence: string[];
};
```

화면에서는:

```text
재미로 보는 나의 이미지 타입
```

정도로 표현한다.

---

# 26. Product Handoff

Face Lab canonical result는 제품 catalog와 직접 결합된 제품 객체를 핵심 authority로 갖지 않는다.

먼저 `Product Specification`을 만든다.

```text
Canonical styling result
↓
Product Specification
↓
Catalog matcher
↓
SKU / Shade candidates
```

구조:

```ts
type ProductHandoffResult = {
  status:
    | "available"
    | "partial"
    | "not_requested"
    | "unavailable";

  specifications: Array<{
    specId: string;
    domain: "makeup" | "grooming" | "hair" | "eyewear" | "accessories";
    category: string;
    requiredAttributes: Record<string, unknown>;
    preferredAttributes: Record<string, unknown>;
    excludedAttributes: Record<string, unknown>;
  }>;

  matches: Array<{
    specId: string;
    productId: string;
    shadeId: string | null;
    matchStatus: "strong" | "partial" | "fallback";
    matchedAttributes: string[];
    missingAttributes: string[];
  }>;

  catalogVersion: string | null;
};
```

Catalog가 없어도 Face Lab V2 styling result는 완주할 수 있어야 한다.

---

# 27. Skin Match cross-domain constraint

Skin Match와 Face Lab은 별도 authority를 유지한다.

```text
Face Lab
→ 표현 목표

Skin Match
→ 피부 상태 / 스킨케어 제약
```

교차 시:

```ts
type CrossDomainConstraint = {
  source: "skin_match";
  targetDomain: "makeup";
  parameter: string;
  effect: "limit" | "prefer" | "avoid";
  reason: string;
  sourceSnapshotRef: string;
};
```

예:

```text
Face Lab:
semi-matte

Skin Match:
dryness / flaking

Cross-domain:
highly matte base limit

Final:
soft satin / controlled semi-matte
```

Skin Match가 Target Style을 바꾸지는 않는다.

---

# 28. Projection policy

하나의 canonical result에서 화면별 projection만 다르게 한다.

```text
Canonical Face Lab V2 Result
├─ Premium Full Report projection
├─ later Free teaser projection
└─ Saved snapshot projection
```

같은 분석 실행에서 서로 다른 엔진 결론을 다시 만들지 않는다.

---

# 29. Premium projection

Premium은 다음을 전체 노출할 수 있다.

- Current Face Profile
- Target Style Profile
- Style Delta
- 영향력이 큰 변화
- Route A / B / C
- Route Comparator
- Hair
- Makeup
- Color
- Grooming
- Eyewear
- Accessories
- Looks
- Visual Conflict
- Product candidates
- Archetype Fun

단, 사용자가 요청하지 않은 domain은 숨기거나 `not_requested` 처리한다.

---

# 30. Free teaser projection

V2에서는 Premium Face Lab이 중심이다.

향후 무료 Face Lab teaser를 제공할 경우 canonical result를 재분석하지 않고 제한적으로 projection한다.

예:

- Current Face Profile 핵심 1~2개
- 재미용 Archetype
- “Premium에서 추구미와 변화 경로를 확인하세요” CTA

무료에서 Target Style Survey 전체를 강제하지 않는다.

---

# 31. Saved snapshot

저장 snapshot은 canonical result의 허용된 subset이다.

저장 가능 후보:

- resultId
- schema/version
- Current Face Profile 요약
- Target Style Profile
- selected route
- Style Delta summary
- domain execution summary
- product match refs
- Archetype Fun
- timestamps

기본적으로 저장하지 않는 것:

- 원본 얼굴 이미지
- raw landmarks
- raw Provider response
- identity embedding
- biometric matching material

---

# 32. Lineage

```ts
type FaceLabLineage = {
  photoAnalysisRef: string | null;
  observationContractVersion: string | null;
  faceRepresentationVersion: string | null;
  faceSpaceVersion: string | null;

  targetSurveyVersion: string | null;
  targetRegistryVersion: string | null;
  targetFinderSetVersion: string | null;
  targetMapperVersion: string | null;

  styleDeltaVersion: string | null;
  routeGeneratorVersion: string | null;

  hairEngineVersion: string | null;
  makeupEngineVersion: string | null;
  colorEngineVersion: string | null;
  groomingEngineVersion: string | null;
  eyewearEngineVersion: string | null;
  accessoriesEngineVersion: string | null;
  lookComposerVersion: string | null;

  catalogVersion: string | null;
  skinMatchSnapshotRef: string | null;
};
```

---

# 33. Recompute dependency graph

모든 변경이 전체 사진 재분석을 요구하지 않는다.

### Target 수정

```text
Target Style changed
↓
styleDelta recompute
↓
routes regenerate
↓
domain execution recompute
↓
looks recompute

NO photo reanalysis
```

### Styling Scope 수정

```text
Scope changed
↓
routes regenerate
↓
affected domain execution
↓
looks recompute

NO photo reanalysis
```

### Constraint 수정

```text
Constraint changed
↓
route eligibility
↓
affected execution
↓
looks

NO photo reanalysis
```

### 새 얼굴 사진 분석

```text
Photo analysis changed
↓
Current Face Profile
↓
Style Delta
↓
Routes
↓
Execution
↓
Looks
```

### Product catalog 변경

```text
Catalog changed
↓
Product Handoff only

NO Style Delta recompute
NO Face reanalysis
```

---

# 34. Result invalidation

다음 상황에서 일부 result를 stale 처리할 수 있다.

- face representation version 변경
- Target Style registry semantic 변경
- user target 수정
- hard constraint 수정
- selected route 변경
- domain engine version 변경
- catalog version 변경

Stale는 전체 result 삭제를 의미하지 않는다.

dependency graph를 따라 필요한 영역만 재계산한다.

---

# 35. Partial availability

Face Lab V2는 모든 영역이 있어야만 결과를 보여주는 구조가 아니다.

예:

```text
Current Face Profile     available
Target Style             available
Style Delta              available
Routes                   available
Hair                     available
Makeup                   not_requested
Color                    insufficient_evidence
Eyewear                  available
Accessories              not_requested
Looks                    partial
Archetype Fun            available
```

이 상태는 정상적인 V2 result다.

---

# 36. Result composition example

설명용 예시:

```json
{
  "schemaVersion": "face-lab-canonical-v2",
  "resultId": "flv2_xxx",
  "status": "partial",
  "analyzedAt": "2026-09-24T00:00:00Z",
  "updatedAt": "2026-09-24T00:02:00Z",
  "failureReason": null,
  "warnings": [],
  "quality": {
    "status": "available",
    "faceVisibility": 0.95,
    "lightingSuitability": 0.82,
    "colorSuitability": 0.58,
    "poseWarnings": [],
    "occlusionWarnings": [],
    "captureWarnings": []
  },
  "currentFaceProfile": {
    "status": "available",
    "summary": "눈매 방향성과 외곽 실루엣이 스타일 인상에 크게 작용합니다.",
    "keyFeatures": []
  },
  "targetStyle": {
    "status": "available",
    "source": "direct_selection",
    "approvedByUser": true,
    "targetLabels": ["sophisticated", "chic"],
    "vector": {}
  },
  "styleDelta": {
    "status": "available",
    "summary": "정돈감과 선명도를 높이는 방향이 핵심입니다.",
    "priorities": []
  },
  "routes": {
    "status": "available",
    "routes": [
      {
        "routeId": "hair-led",
        "title": "헤어 중심",
        "changeMagnitude": "medium"
      },
      {
        "routeId": "balanced",
        "title": "균형형",
        "changeMagnitude": "medium"
      }
    ],
    "selectedRouteId": null
  },
  "hair": {
    "status": "available"
  },
  "makeup": {
    "status": "not_requested"
  },
  "color": {
    "status": "partial"
  },
  "archetypeFun": {
    "status": "available",
    "displayMode": "fun_only"
  }
}
```

위 값과 숫자는 schema 설명용이며 실제 판정값이 아니다.

---

# 37. 사용자 결과 화면 mapping

Canonical result는 다음 화면 구조로 projection할 수 있다.

```text
SECTION 1 — 지금의 나
currentFaceProfile

SECTION 2 — 나의 추구미
targetStyle

SECTION 3 — 무엇을 바꾸면 되는가
styleDelta

SECTION 4 — 가능한 경로
routes

SECTION 5 — 경로 비교
routes comparison metadata

SECTION 6 — 실제 실행
hair
makeup
color
grooming
eyewear
accessories
faceAdjacentStyle

SECTION 7 — 완성 조합
looks

SECTION 8 — 실제 제품
productHandoff

SECTION 9 — 재미로 보는 이미지 타입
archetypeFun
```

---

# 38. Archetype이 없어도 완주되어야 한다

다음은 완전한 V2 flow로 인정한다.

```text
Current Face Profile
→ Target Style
→ Style Delta
→ Routes
→ Hair / Grooming / Makeup
→ Looks

Archetype Fun = unavailable
```

Archetype availability는 V2 launch blocker가 아니다.

---

# 39. Product catalog가 없어도 완주되어야 한다

초기 V2 vertical slice:

```text
Face
→ Target
→ Delta
→ Route
→ Hair / Makeup parameter
→ Product Specification
```

까지 동작하면 Face Lab core는 완주 가능하다.

SKU matching은 이후 catalog가 준비되면서 붙일 수 있다.

---

# 40. LLM / VLM 책임 경계

### Vision / VLM

가능:

- visible observation extraction
- 제한된 presentation cue extraction
- reference style cue extraction

불가:

- Target Style 자동 확정
- 사용자의 취향 추론
- 최종 route 임의 선택
- 근거 없는 compatibility 생성
- Archetype으로 style rule 생성

### LLM

가능:

- 이미 결정된 result를 자연어로 설명
- route title / summary 생성
- parameter result를 사용자 언어로 번역

불가:

- hidden rule 생성
- hard constraint 무시
- engine result 덮어쓰기
- fallback recommendation 생성

---

# 41. 사용자 agency

V2에서 사용자는 다음 결정을 직접 가진다.

- 추구미 승인
- 추구미 수정
- Styling Scope 선택
- hard exclusion 선택
- 변화 강도 선택
- Route 선택
- Route 변경
- 제품 후보 선택

Face Lab은 “당신에게 이것이 정답”으로 닫지 않는다.

---

# 42. 사용자-facing 금지 표현

금지:

- 당신에게 가장 예쁜 스타일
- 얼굴의 결점
- 반드시 고쳐야 하는 부분
- 이 얼굴형은 이 머리를 하면 안 됨
- 남자는 이 스타일
- 여자는 이 스타일
- 객관적으로 더 나은 얼굴
- Archetype이므로 이 화장 필수

권장:

- 이 방향을 선택하면 이런 인상이 더 강조됩니다
- 현재 특징을 살리는 경로입니다
- 다른 분위기로 이동하려면 이 요소를 조정할 수 있습니다
- 이 경로는 관리 시간이 더 적습니다
- 이 경로는 헤어 변화는 크고 메이크업 변화는 적습니다

---

# 43. V1 → V2 migration boundary

기존 canonical result를 다음처럼 취급한다.

### 유지

- quality
- validated analysis
- evidence
- capture warning
- result lifecycle
- free/premium 동일 분석 authority 원칙

### 변환

- styleIdentity
→ `currentFaceProfile + targetStyle`로 의미 분리

- core / alternative
→ 고정 2전략 중심에서 `routes[]` 중심으로 확장

- faceStyle
→ `eyewear + accessories + faceAdjacentStyle + grooming`으로 책임 분리

- archetype
→ `archetypeFun`으로 제품 authority 축소

### 신규

- targetStyle
- styleDelta
- routes
- grooming
- eyewear
- accessories
- productHandoff
- cross-domain constraints

---

# 44. Vertical Slice minimum

Face Lab V2 첫 구현에서 반드시 실제로 관통해야 하는 최소 path:

```text
1. 기존 실제 사진 분석
2. Current Face Profile 생성
3. Premium Target Style Survey
4. Target Style Profile 생성
5. Style Delta 생성
6. 최소 2개 Route 생성
7. Hair minimal execution
8. Makeup 또는 Grooming minimal execution
9. Premium Result projection
10. Target 수정 → downstream 재계산
```

Product SKU matching은 첫 vertical slice의 필수조건이 아니다.

---

# 45. 첫 구현 성공 조건

1. 기존 Face Lab analysis가 Current Face Profile로 연결된다.
2. Premium 설문 결과가 Target Style Profile로 저장된다.
3. Target Style과 Face Profile이 서로 다른 authority로 유지된다.
4. Style Delta가 단순 vector subtraction이 아니다.
5. 사용자가 선택하지 않은 domain은 `not_requested`다.
6. hard exclusion을 위반하는 Route가 생성되지 않는다.
7. 최소 두 개의 실질적으로 다른 Route를 지원할 수 있다.
8. Hair 결과가 parameter 기반으로 나온다.
9. Makeup 결과가 technique → product specification 순서를 따른다.
10. Makeup이 없는 사용자도 Grooming / Hair 등으로 완주된다.
11. Archetype 없이도 결과가 완주된다.
12. Product catalog 없이도 result가 완주된다.
13. Target 수정 시 photo reanalysis 없이 downstream만 재계산할 수 있다.
14. domain 일부 실패 시 partial result를 유지한다.
15. Premium UI가 하나의 canonical result만 읽는다.

---

# 46. 후속 구현 순서

이 계약 이후에는 문서 추가보다 실제 vertical slice 구현으로 전환한다.

권장 순서:

```text
1. Type/schema skeleton
2. Current Face Profile adapter
3. Target Style Profile storage / mapper
4. Style Delta V1 rule skeleton
5. Route Generator V1
6. Hair minimal engine
7. Grooming minimal engine
8. Makeup minimal engine
9. Premium Result adapter
10. Target edit → recompute
11. fixture / contract tests
12. 실제 E2E
```

그 다음 병렬 트랙:

```text
Makeup Product Specification
→ Product / Shade DB schema
→ crawler adapter
→ catalog matcher
```

---

# 47. 최종 정의

```text
Face Lab V2 Canonical Result

=
Current Face Profile
+
User-approved Target Style Profile
+
Style Delta
+
Comparable Style Routes
+
Domain Execution
+
Look Composition
+
Optional Product Matching
+
Fun-only Archetype
```

이 객체가 Face Lab V2의 단일 제품 authority다.
