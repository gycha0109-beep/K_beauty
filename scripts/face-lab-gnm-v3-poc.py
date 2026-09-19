#!/usr/bin/env python3
"""Offline GNM v3 Face Space adapter PoC.

Research-only. This script never imports or uses GNM semantic demographic
samplers. It exercises only the NumPy head model, sparse-68 landmarks and
head identity coefficients.

Expected environment:
  PYTHONPATH=/path/to/google/GNM python scripts/face-lab-gnm-v3-poc.py probe
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
from pathlib import Path
import sys
from typing import Any

GNM_CODE_REVISION = "a424b5153eec9154f3dfa5ee7f214e5817918d54"
GNM_MODEL_BLOB_SHA = "b49ac631e4d3388e42640555c0b25c4fd134b1b8"
GNM_MODEL_SIZE_BYTES = 53_305_389
MEASUREMENT_VERSION = "gnm-sparse68-structural-measurement-v0"
SEMANTICS_VERSION = "face-space-structural-measurement-semantics-v0"
HEAD_IDENTITY_COMPONENTS = 170
DEFAULT_FIT_COMPONENTS = 24

SUPPORTED_METRICS = (
    "lower_face_width_ratio",
    "chin_height_ratio",
    "eye_spacing_ratio",
    "eye_width_ratio",
    "eye_tilt",
    "nose_width_ratio",
)

TOLERANCE = {
    "lower_face_width_ratio": 0.015,
    "chin_height_ratio": 0.015,
    "eye_spacing_ratio": 0.015,
    "eye_width_ratio": 0.015,
    "eye_tilt": 1.0,
    "nose_width_ratio": 0.015,
}


def _load_runtime():
    try:
        import numpy as np
        from scipy.optimize import least_squares
        from gnm.shape import gnm_numpy
    except ImportError as exc:
        raise SystemExit(
            "GNM PoC dependencies are unavailable. Clone the pinned google/GNM "
            "revision, install the minimal research dependencies, and expose the "
            "repository root through PYTHONPATH. Original error: " + str(exc)
        ) from exc
    return np, least_squares, gnm_numpy


def _load_model(gnm_numpy):
    return gnm_numpy.GNM.from_local(
        version=gnm_numpy.GNMMajorVersion.V3,
        variant=gnm_numpy.GNMVariant.HEAD,
    )


def _distance(np, a, b) -> float:
    return float(np.linalg.norm(a - b))


def _safe_ratio(numerator: float, denominator: float, name: str) -> float:
    if not math.isfinite(denominator) or denominator <= 1e-9:
        raise ValueError(f"invalid normalizer for {name}: {denominator}")
    return numerator / denominator


def _canonical_eye_tilt_deg(np, landmarks) -> float:
    # iBUG/FAN-68 eye corners:
    # right-eye horizontal corners 36/39, left-eye horizontal corners 42/45.
    # Canonicalize both sides to an outward->inner direction with positive x so
    # mirrored topology does not cancel the sign.
    right = landmarks[39] - landmarks[36]
    left = landmarks[42] - landmarks[45]
    if right[0] < 0:
        right = -right
    if left[0] < 0:
        left = -left

    def angle(v):
        return math.degrees(math.atan2(float(v[1]), float(v[0])))

    return (angle(right) + angle(left)) / 2.0


def measure_sparse68(landmarks) -> dict[str, float]:
    """Measure the v0 backend-independent structural subset.

    The sparse-68 topology cannot faithfully observe forehead height,
    cheekbone width or full upper-face length. Those dimensions remain
    unsupported in the GNM v0 adapter manifest instead of being fabricated.
    """
    np, _, _ = _load_runtime()
    landmarks = np.asarray(landmarks, dtype=np.float64)
    if landmarks.shape != (68, 3):
        raise ValueError(f"expected sparse-68 landmarks with shape (68, 3), got {landmarks.shape}")

    jaw_width = _distance(np, landmarks[0], landmarks[16])
    return {
        "lower_face_width_ratio": _safe_ratio(
            _distance(np, landmarks[4], landmarks[12]), jaw_width, "lower_face_width_ratio"
        ),
        "chin_height_ratio": _safe_ratio(
            _distance(np, landmarks[33], landmarks[8]), jaw_width, "chin_height_ratio"
        ),
        "eye_spacing_ratio": _safe_ratio(
            _distance(np, landmarks[39], landmarks[42]), jaw_width, "eye_spacing_ratio"
        ),
        "eye_width_ratio": _safe_ratio(
            (
                _distance(np, landmarks[36], landmarks[39])
                + _distance(np, landmarks[42], landmarks[45])
            )
            / 2.0,
            jaw_width,
            "eye_width_ratio",
        ),
        "eye_tilt": _canonical_eye_tilt_deg(np, landmarks),
        "nose_width_ratio": _safe_ratio(
            _distance(np, landmarks[31], landmarks[35]), jaw_width, "nose_width_ratio"
        ),
    }


def _landmarks_for_identity(model, gnm_numpy, identity):
    _, landmarks = model.vertices_and_landmarks(
        gnm_numpy.GNMLandmarksType.HEAD_SPARSE_68,
        identity=identity,
    )
    return landmarks


def _identity_vector(np, model, head_coefficients):
    identity = np.zeros(model.identity_dim, dtype=np.float32)
    count = min(len(head_coefficients), HEAD_IDENTITY_COMPONENTS, model.identity_dim)
    identity[:count] = np.asarray(head_coefficients[:count], dtype=np.float32)
    return identity


def _model_probe(model) -> dict[str, Any]:
    np, _, gnm_numpy = _load_runtime()
    identity = np.zeros(model.identity_dim, dtype=np.float32)
    landmarks = _landmarks_for_identity(model, gnm_numpy, identity)
    metrics = measure_sparse68(landmarks)
    return {
        "schemaVersion": "face-space-gnm-v3-probe-v0",
        "researchOnly": True,
        "productionAuthority": False,
        "semanticDemographicSamplingAllowed": False,
        "gnmCodeRevision": GNM_CODE_REVISION,
        "gnmModelGitBlobSha": GNM_MODEL_BLOB_SHA,
        "gnmModelSizeBytes": GNM_MODEL_SIZE_BYTES,
        "measurementVersion": MEASUREMENT_VERSION,
        "semanticsVersion": SEMANTICS_VERSION,
        "model": {
            "version": str(model.version),
            "variant": str(model.variant),
            "identityDim": int(model.identity_dim),
            "expressionDim": int(model.expression_dim),
            "numVertices": int(model.num_vertices),
            "numJoints": int(model.num_joints),
            "headIdentityComponentScope": HEAD_IDENTITY_COMPONENTS,
            "landmarks": 68,
        },
        "templateMetrics": metrics,
    }


def fit_metrics(model, target: dict[str, float], fit_components: int, ridge: float):
    np, least_squares, gnm_numpy = _load_runtime()
    if fit_components < 1 or fit_components > HEAD_IDENTITY_COMPONENTS:
        raise ValueError(f"fit_components must be 1..{HEAD_IDENTITY_COMPONENTS}")
    missing = [key for key in SUPPORTED_METRICS if key not in target]
    if missing:
        raise ValueError("target metrics missing: " + ", ".join(missing))
    if ridge <= 0:
        raise ValueError("ridge must be > 0")

    target_vector = np.asarray([target[key] for key in SUPPORTED_METRICS], dtype=np.float64)
    scales = np.asarray([TOLERANCE[key] for key in SUPPORTED_METRICS], dtype=np.float64)
    sqrt_ridge = math.sqrt(ridge)

    def residual(coefficients):
        identity = _identity_vector(np, model, coefficients)
        landmarks = _landmarks_for_identity(model, gnm_numpy, identity)
        measured = measure_sparse68(landmarks)
        measured_vector = np.asarray(
            [measured[key] for key in SUPPORTED_METRICS], dtype=np.float64
        )
        structural = (measured_vector - target_vector) / scales
        regularization = sqrt_ridge * np.asarray(coefficients, dtype=np.float64)
        return np.concatenate([structural, regularization])

    # GNM's NumPy model stores identity arrays as float32. SciPy's default
    # numerical Jacobian step around an all-zero x0 can be smaller than a
    # meaningful float32 perturbation, yielding a false zero-gradient optimum.
    # Use an explicit absolute central-difference step instead.
    jacobian_step = 1e-2

    def jacobian(coefficients):
        coefficients = np.asarray(coefficients, dtype=np.float64)
        jac = np.zeros(
            (len(SUPPORTED_METRICS) + fit_components, fit_components),
            dtype=np.float64,
        )
        for index in range(fit_components):
            plus = coefficients.copy()
            minus = coefficients.copy()
            plus[index] += jacobian_step
            minus[index] -= jacobian_step
            plus_structural = residual(plus)[: len(SUPPORTED_METRICS)]
            minus_structural = residual(minus)[: len(SUPPORTED_METRICS)]
            jac[: len(SUPPORTED_METRICS), index] = (
                plus_structural - minus_structural
            ) / (2.0 * jacobian_step)
        jac[len(SUPPORTED_METRICS) :, :] = sqrt_ridge * np.eye(
            fit_components, dtype=np.float64
        )
        return jac

    result = least_squares(
        residual,
        x0=np.zeros(fit_components, dtype=np.float64),
        jac=jacobian,
        bounds=(-3.0, 3.0),
        max_nfev=120,
        x_scale="jac",
        xtol=1e-9,
        ftol=1e-9,
        gtol=1e-9,
    )
    identity = _identity_vector(np, model, result.x)
    measured = measure_sparse68(_landmarks_for_identity(model, gnm_numpy, identity))

    dimensions = []
    for key in SUPPORTED_METRICS:
        error = abs(measured[key] - target[key])
        dimensions.append(
            {
                "id": key,
                "target": float(target[key]),
                "measured": float(measured[key]),
                "absoluteError": float(error),
                "tolerance": TOLERANCE[key],
                "passed": bool(error <= TOLERANCE[key]),
            }
        )

    passed = all(item["passed"] for item in dimensions)
    return {
        "schemaVersion": "face-space-gnm-v3-fit-result-v0",
        "measurementVersion": MEASUREMENT_VERSION,
        "semanticsVersion": SEMANTICS_VERSION,
        "status": "pass" if passed else "hold",
        "ok": passed,
        "solver": {
            "success": bool(result.success),
            "status": int(result.status),
            "message": str(result.message),
            "nfev": int(result.nfev),
            "cost": float(result.cost),
            "fitComponents": fit_components,
            "ridge": ridge,
            "coefficientL2": float(np.linalg.norm(result.x)),
            "maxAbsCoefficient": float(np.max(np.abs(result.x))),
        },
        "dimensions": dimensions,
        "identityHeadCoefficients": [float(value) for value in result.x],
    }


def _selftest(model, fit_components: int, ridge: float):
    np, _, gnm_numpy = _load_runtime()
    truth = np.zeros(model.identity_dim, dtype=np.float32)
    # Synthetic only: no user image and no demographic semantic sampler.
    seed = np.asarray([0.35, -0.25, 0.20, -0.15, 0.12, -0.10], dtype=np.float32)
    truth[: len(seed)] = seed
    target = measure_sparse68(_landmarks_for_identity(model, gnm_numpy, truth))
    fit = fit_metrics(model, target, fit_components=fit_components, ridge=ridge)
    payload = {
        "schemaVersion": "face-space-gnm-v3-selftest-v0",
        "researchOnly": True,
        "syntheticOnly": True,
        "semanticDemographicSamplingAllowed": False,
        "gnmCodeRevision": GNM_CODE_REVISION,
        "gnmModelGitBlobSha": GNM_MODEL_BLOB_SHA,
        "targetMetrics": target,
        "fit": fit,
    }
    canonical = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()
    payload["resultDigest"] = hashlib.sha256(canonical).hexdigest()
    return payload


def sensitivity_scan(model, components: int, amplitude: float):
    np, _, gnm_numpy = _load_runtime()
    if components < 1 or components > HEAD_IDENTITY_COMPONENTS:
        raise ValueError(f"components must be 1..{HEAD_IDENTITY_COMPONENTS}")
    if not math.isfinite(amplitude) or amplitude <= 0 or amplitude > 1.0:
        raise ValueError("amplitude must be > 0 and <= 1.0")

    jac = np.zeros((len(SUPPORTED_METRICS), components), dtype=np.float64)
    component_rows = []
    for index in range(components):
        plus = np.zeros(model.identity_dim, dtype=np.float32)
        minus = np.zeros(model.identity_dim, dtype=np.float32)
        plus[index] = amplitude
        minus[index] = -amplitude
        plus_metrics = measure_sparse68(_landmarks_for_identity(model, gnm_numpy, plus))
        minus_metrics = measure_sparse68(_landmarks_for_identity(model, gnm_numpy, minus))
        derivative = np.asarray(
            [
                (plus_metrics[key] - minus_metrics[key]) / (2.0 * amplitude)
                for key in SUPPORTED_METRICS
            ],
            dtype=np.float64,
        )
        jac[:, index] = derivative

        normalized = np.abs(
            derivative
            / np.asarray([TOLERANCE[key] for key in SUPPORTED_METRICS], dtype=np.float64)
        )
        total = float(np.sum(normalized))
        dominant_index = int(np.argmax(normalized))
        component_rows.append(
            {
                "componentIndex": index,
                "dominantMetric": SUPPORTED_METRICS[dominant_index],
                "dominantNormalizedSensitivity": float(normalized[dominant_index]),
                "crossDimensionLeakage": (
                    0.0 if total <= 1e-12 else float(1.0 - normalized[dominant_index] / total)
                ),
                "derivative": {
                    key: float(derivative[metric_index])
                    for metric_index, key in enumerate(SUPPORTED_METRICS)
                },
            }
        )

    normalized_jac = jac / np.asarray(
        [TOLERANCE[key] for key in SUPPORTED_METRICS], dtype=np.float64
    )[:, None]
    singular_values = np.linalg.svd(normalized_jac, compute_uv=False)
    threshold = max(float(singular_values[0]) * 1e-4, 1e-8)
    effective_rank = int(np.sum(singular_values > threshold))

    metric_rows = []
    for metric_index, key in enumerate(SUPPORTED_METRICS):
        row = np.abs(normalized_jac[metric_index])
        order = np.argsort(row)[::-1][: min(5, components)]
        metric_rows.append(
            {
                "id": key,
                "maxNormalizedSensitivity": float(row[order[0]]),
                "topComponents": [
                    {
                        "componentIndex": int(index),
                        "normalizedSensitivity": float(row[index]),
                    }
                    for index in order
                ],
            }
        )

    return {
        "schemaVersion": "face-space-gnm-v3-sensitivity-v0",
        "researchOnly": True,
        "syntheticOnly": True,
        "semanticDemographicSamplingAllowed": False,
        "gnmCodeRevision": GNM_CODE_REVISION,
        "gnmModelGitBlobSha": GNM_MODEL_BLOB_SHA,
        "measurementVersion": MEASUREMENT_VERSION,
        "semanticsVersion": SEMANTICS_VERSION,
        "componentScope": {
            "start": 0,
            "count": components,
            "headIdentityComponentLimit": HEAD_IDENTITY_COMPONENTS,
            "amplitude": amplitude,
        },
        "effectiveRank": effective_rank,
        "metricCount": len(SUPPORTED_METRICS),
        "singularValues": [float(value) for value in singular_values],
        "metrics": metric_rows,
        "components": component_rows,
    }


def _write(payload: dict[str, Any], output: str | None):
    encoded = json.dumps(payload, indent=2, sort_keys=True) + "\n"
    if output:
        path = Path(output)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(encoded, encoding="utf-8")
    sys.stdout.write(encoded)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("command", choices=("probe", "selftest", "sensitivity"))
    parser.add_argument("--output")
    parser.add_argument("--fit-components", type=int, default=DEFAULT_FIT_COMPONENTS)
    parser.add_argument("--ridge", type=float, default=0.03)
    parser.add_argument("--components", type=int, default=24)
    parser.add_argument("--amplitude", type=float, default=0.25)
    args = parser.parse_args()

    _, _, gnm_numpy = _load_runtime()
    model = _load_model(gnm_numpy)

    if args.command == "probe":
        payload = _model_probe(model)
    elif args.command == "selftest":
        payload = _selftest(model, fit_components=args.fit_components, ridge=args.ridge)
        if payload["fit"]["status"] != "pass":
            _write(payload, args.output)
            return 2
    else:
        payload = sensitivity_scan(
            model,
            components=args.components,
            amplitude=args.amplitude,
        )
        if payload["effectiveRank"] < 1:
            _write(payload, args.output)
            return 3

    _write(payload, args.output)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
