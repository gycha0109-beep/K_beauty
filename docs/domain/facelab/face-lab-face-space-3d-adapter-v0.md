# Face Lab FaceSpace3DAdapter v0 Research Contract

> Track: FACE LAB / R-3D Parametric Counterfactual Lab  
> Status: research contract / no Production authority  
> Scope: Face Space → replaceable 3D backend → independent measurement → round-trip validation

## 1. Purpose

Face Space를 특정 3D 모델의 native parameter에 종속시키지 않고 Google GNM v3, MPFB2/MakeHuman, FLAME 2023 Open 등 서로 다른 backend를 교체 가능한 adapter로 검증한다.

```text
Normalized Face Representation
→ Face Space
→ FaceSpace3DAdapter
→ mesh
→ independent measurement
→ round-trip report
```

3D backend의 목적은 Archetype 정답 얼굴 생성이 아니라 controlled counterfactual experiment를 위한 구조 재현이다.

## 2. Authority boundary

```text
Face Space
= internal structural authority

MPFB target / Blender Shape Key
= backend-native control

FLAME beta
= backend-native latent coefficient

render / mesh
= experimental artifact
```

Native parameter를 Face Space axis의 의미로 직접 승격하지 않는다.

## 3. Adapter candidates

### Google GNM v3

2026-09-19 조사에서 추가된 최우선 face-specific backend candidate다.

특징:

- Google 공식 parametric 3D head ecosystem
- 2026 공개 GNM Head v3
- 170 head identity components를 포함한 253 identity components
- 383 expression components
- head / eyes / teeth / tongue geometry
- NumPy / JAX / PyTorch / TensorFlow backend
- fitting utilities: regularized least squares / linear vertex-basis projection
- built-in sparse 68 head landmark definition
- official code/model release가 Apache 2.0으로 공개됨
- reviewed code revision: `a424b5153eec9154f3dfa5ee7f214e5817918d54`
- pinned model blob: `b49ac631e4d3388e42640555c0b25c4fd134b1b8` / 53,305,389 bytes
- official package metadata: `gnm-shape` 3.0.0

Face Lab에서는 identity coefficient 자체를 해석 가능한 Face Space axis로 사용하지 않는다.

```text
Face Space structural target
→ optimize / fit GNM head identity coefficients
→ generated mesh
→ independent measurement
→ round-trip error
```

GNM semantic identity sampler의 demographic label을 Face Lab Face Space 생성 또는 사용자 얼굴 추론에 사용하지 않는다. 특히 얼굴 외형으로 성별·민족/인종 같은 민감 속성을 추론하거나 balancing truth로 만들지 않는다.

공식 GNM code/model artifact는 v0 research manifest에서 exact Git revision/blob까지 pin했다. 다만 공식 package의 core dependency set에 TensorFlow가 포함되므로 웹 application runtime과 분리된 Python research environment에서 먼저 실행한다.

Executable 승격 전 남은 핵심은 backend-independent Face Space measurement objective와 GNM fitting runner 구현이다.

GNM v3는 공식적으로 barycentric `HEAD_SPARSE_68` landmark set을 제공한다. 2026-09-19 현재 official MediaPipe 468 ↔ GNM correspondence는 제공되지 않는 것으로 확인했다. 따라서 community mapping을 authority로 가져오지 않는다.

초기 executable PoC는 다음 중 하나를 사용한다.

1. GNM native sparse-68 / mesh-native structural measurement
2. 별도로 검증한 backend-independent measurement anchors
3. 향후 official correspondence가 생길 경우 versioned mapping

MediaPipe 468 결과를 임의 index mapping으로 GNM에 직접 대응하지 않는다.

현재 우선순위:

```text
GNM v3
→ primary face-specific adapter PoC candidate

MPFB2
→ Blender/style controlled experiment workbench candidate

FLAME 2023 Open
→ independent comparison / fallback face backend candidate
```

### MPFB2

역할:

- offline Blender experiment backend
- existing modeling targets 활용
- 필요한 경우 BEJEWELY custom target
- later hair/material/asset experiment integration

초기 mapping candidate 예:

- head vertical relation → existing head vertical target family
- forehead height relation → forehead vertical target family
- cheek volume → cheek volume target family
- chin height → chin height target family
- nose width → nose width target family
- unsupported structural dimension → custom target 또는 hold

실제 target basename과 scale mapping은 executable PoC에서 다시 고정한다.

### FLAME 2023 Open

역할:

- independent parametric face backend
- latent shape space 기반의 구조 재현 비교

Face Space axis를 FLAME beta index에 직접 대응하지 않는다.

```text
Face Space target measurements
→ optimize FLAME coefficients
→ mesh
→ re-measure
→ round-trip error
```

정확한 FLAME model artifact와 license version은 executable 단계에서 provenance로 고정해야 한다.

## 4. v0 vector contract

v0는 Production Face Space schema를 확정하지 않는다.

연구 vector는 다음 최소 개념을 가진다.

- vector ID
- normalization version
- dimension ID
- numeric value
- unit

금지:

- Archetype label을 vector에 내장
- identity embedding
- backend-native coefficient를 canonical dimension으로 사용

## 5. Mapping strategies

Adapter dimension mapping은 다음 중 하나다.

- direct_target
- composite_target
- custom_target_required
- optimization_fit
- unsupported

각 supported dimension은 round-trip absolute tolerance를 가져야 한다.

## 6. Round-trip gate

```text
requested vector F
→ adapter
→ mesh M
→ independent measurement
→ measured vector F'
→ error(F, F')
```

PASS는 모든 supported dimension이 해당 adapter/version의 tolerance 안에 들어온 경우다.

Unsupported dimension은 숨기지 않고 명시한다.

Backend가 얼굴을 그럴듯하게 렌더했다는 사실은 PASS 기준이 아니다.

## 7. Additional diagnostics

Executable PoC에서 다음을 추가한다.

- local monotonicity
- cross-dimension leakage
- clipping / saturation
- repeated-run determinism
- backend/version drift
- camera/pose/measurement nuisance stability

## 8. Backend comparison

동일 vector를 GNM v3, MPFB2, FLAME 2023 Open에 입력한다.

비교 대상:

- dimension별 round-trip error
- supported coverage
- failure/hold pattern
- generation stability
- automation cost
- rendering/style integration cost

Face Space definition을 특정 backend의 오차를 감추기 위해 수정하지 않는다.

## 9. Initial PoC scope

처음부터 7 Archetype을 만들지 않는다.

우선 3개의 generic Face Space fixture와 약 8~12개의 구조 dimension으로 adapter contract를 검증한다.

Style experiment는 adapter round-trip이 안정화된 뒤 최소 hair variables부터 붙인다.

초기 hair candidate:

- forehead exposure
- crown volume
- side volume
- fringe weight
- curl

## 10. Production boundary

v0는 다음을 하지 않는다.

- Production Face Space activation
- user face reconstruction
- user-facing 3D output
- Archetype decision
- Style Compatibility decision
- automatic recommendation
- identity recognition

이 contract와 verifier는 연구 adapter가 Face Space authority를 침범하지 않는지 검증하기 위한 기반이다.
