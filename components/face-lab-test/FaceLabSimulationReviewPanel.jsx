"use client";

import { useMemo, useState } from "react";

const IDENTITY_LABELS = Object.freeze({
  facial_geometry: "얼굴 구조",
  eye_anatomy: "눈 구조",
  nose_geometry: "코 구조",
  jaw_chin_geometry: "턱·얼굴선",
  ear_geometry: "귀 구조"
});

const EDIT_SCOPE_LABELS = Object.freeze({
  face_structure: "얼굴 구조",
  background: "배경",
  clothing: "의상",
  body: "신체",
  head_pose: "머리·얼굴 방향",
  camera_perspective: "카메라 구도",
  expression: "표정",
  lighting_direction: "조명 방향",
  unrequested_beautification: "요청하지 않은 미화"
});

const IDENTITY_OPTIONS = Object.freeze([
  ["stable", "유지"],
  ["minor_drift", "소폭 변화"],
  ["major_drift", "큰 변화"],
  ["not_assessable", "판단 어려움"]
]);

const SCOPE_OPTIONS = Object.freeze([
  ["unchanged", "동일"],
  ["minor_change", "소폭 변화"],
  ["major_change", "큰 변화"],
  ["not_assessable", "판단 어려움"]
]);

const ROUTE_OPTIONS = Object.freeze([
  ["executed", "실행됨"],
  ["partial", "일부만"],
  ["missed", "반영 안 됨"],
  ["contradicted", "반대로 변경"],
  ["not_assessable", "판단 어려움"]
]);

const COLOR_OPTIONS = Object.freeze([
  ["on_target", "일치"],
  ["near_target", "근접"],
  ["off_target", "불일치"],
  ["not_assessable", "판단 어려움"]
]);

function emptyMap(keys) {
  return Object.fromEntries(
    (keys || []).map((key) => [key, null])
  );
}

function countAnswered(values) {
  return Object.values(values || {}).filter(Boolean).length;
}

function allAnswered(values) {
  return Object.values(values || {}).every(Boolean);
}

function statusLabel(value) {
  if (value === "pass") return "PASS";
  if (value === "review") return "REVIEW";
  if (value === "fail") return "FAIL";
  if (value === "not_applicable") return "N/A";
  return "NOT EVALUATED";
}

function targetSummary(target) {
  const parts = [];

  if (target?.slotKey) {
    parts.push(target.slotKey);
  }

  if (Array.isArray(target?.targetRegions) && target.targetRegions.length) {
    parts.push(target.targetRegions.join(", "));
  }

  const intensity = target?.application?.intensity;
  if (typeof intensity === "string" && intensity.trim()) {
    parts.push(intensity.trim());
  }

  return parts.join(" · ");
}

function semanticColorSummary(target) {
  const sources = [
    target?.requestedSemanticAttributes,
    target?.preferredSemanticAttributes,
    target?.candidateSemanticAttributes
  ];

  const fragments = [];

  for (const source of sources) {
    if (!source || typeof source !== "object" || Array.isArray(source)) {
      continue;
    }

    for (const [key, value] of Object.entries(source)) {
      if (
        typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean"
      ) {
        fragments.push(`${key}: ${String(value)}`);
      }
    }
  }

  return [...new Set(fragments)].slice(0, 4).join(" · ");
}

function ChoiceRow({
  label,
  detail = "",
  options,
  value,
  onChange
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white/70 p-3 dark:border-zinc-800 dark:bg-zinc-950/35">
      <div className="mb-2">
        <p className="text-sm font-semibold">{label}</p>
        {detail ? (
          <p className="ui-text-secondary mt-1 text-xs leading-5">
            {detail}
          </p>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2">
        {options.map(([optionValue, optionLabel]) => {
          const selected = value === optionValue;

          return (
            <button
              key={optionValue}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(optionValue)}
              className={
                selected
                  ? "min-h-9 rounded-full border border-zinc-950 bg-zinc-950 px-3 text-xs font-semibold text-white dark:border-white dark:bg-white dark:text-zinc-950"
                  : "min-h-9 rounded-full border border-zinc-300 bg-white px-3 text-xs font-semibold text-zinc-700 hover:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
              }
            >
              {optionLabel}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ReviewSection({
  number,
  title,
  answered,
  total,
  children
}) {
  return (
    <section className="border-t border-zinc-200 pt-5 first:border-t-0 first:pt-0 dark:border-zinc-800">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="ui-kicker">0{number}</p>
          <h3 className="mt-1 text-base font-bold">{title}</h3>
        </div>
        <span className="ui-chip-compact px-3 py-1.5 text-xs">
          {answered} / {total}
        </span>
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

export default function FaceLabSimulationReviewPanel({
  template,
  submitStatus = "idle",
  submitError = "",
  result = null,
  onSubmit,
  onResetResult
}) {
  const identityKeys = template?.identity?.dimensions || [];
  const editScopeKeys = template?.editScope?.dimensions || [];
  const routeTargets = template?.route?.targets || [];
  const colorTargets = template?.color?.targets || [];

  const [identity, setIdentity] = useState(() => emptyMap(identityKeys));
  const [editScope, setEditScope] = useState(() => emptyMap(editScopeKeys));
  const [routeOperations, setRouteOperations] = useState(() =>
    emptyMap(routeTargets.map((target) => target.operationId))
  );
  const [colorResponses, setColorResponses] = useState(() =>
    emptyMap(colorTargets.map((target) => target.operationId))
  );
  const [copyStatus, setCopyStatus] = useState("idle");

  const counts = useMemo(
    () => ({
      identity: countAnswered(identity),
      editScope: countAnswered(editScope),
      route: countAnswered(routeOperations),
      color: countAnswered(colorResponses)
    }),
    [identity, editScope, routeOperations, colorResponses]
  );

  const complete =
    allAnswered(identity) &&
    allAnswered(editScope) &&
    allAnswered(routeOperations) &&
    allAnswered(colorResponses);

  const resetResponses = () => {
    setIdentity(emptyMap(identityKeys));
    setEditScope(emptyMap(editScopeKeys));
    setRouteOperations(
      emptyMap(routeTargets.map((target) => target.operationId))
    );
    setColorResponses(
      emptyMap(colorTargets.map((target) => target.operationId))
    );
    setCopyStatus("idle");
    onResetResult?.();
  };

  const submit = () => {
    if (!complete || submitStatus === "submitting") {
      return;
    }

    onSubmit?.({
      reviewerRef: "operator-01",
      identity,
      editScope,
      routeOperations,
      colorTargets: colorResponses
    });
  };

  const copyReviewJson = async () => {
    if (!result?.identityScopeReview || !result?.routeColorReview) {
      return;
    }

    const exportPayload = {
      caseId: result.caseId,
      identityScopeReview: result.identityScopeReview,
      routeColorReview: result.routeColorReview
    };

    try {
      await navigator.clipboard.writeText(
        JSON.stringify(exportPayload, null, 2)
      );
      setCopyStatus("copied");
    } catch {
      setCopyStatus("error");
    }
  };

  return (
    <section
      className="ui-card p-5 sm:p-6"
      data-face-lab-simulation-review-panel
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="ui-kicker">GATE G · CALIBRATION REVIEW</p>
          <h2 className="ui-title mt-2 text-xl">
            생성 결과 품질 검토
          </h2>
          <p className="ui-text-secondary mt-2 max-w-2xl text-sm leading-6">
            Before와 Simulation을 직접 비교해 모든 항목을 선택해 주세요.
            기본 PASS 값은 없으며 판단하기 어려운 항목은 별도로 표시할 수 있습니다.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="ui-chip-compact px-3 py-1.5">
            Case: {template.caseId}
          </span>
          {template?.trace?.renderSpecSha256 ? (
            <span
              className="ui-chip-compact px-3 py-1.5"
              title={template.trace.renderSpecSha256}
            >
              Trace: {template.trace.renderSpecSha256.slice(0, 12)}
            </span>
          ) : null}
        </div>
      </div>

      <div className="mt-6 space-y-6">
        <ReviewSection
          number={1}
          title="Identity Preservation"
          answered={counts.identity}
          total={identityKeys.length}
        >
          {identityKeys.map((dimension) => (
            <ChoiceRow
              key={dimension}
              label={IDENTITY_LABELS[dimension] || dimension}
              options={IDENTITY_OPTIONS}
              value={identity[dimension]}
              onChange={(value) =>
                setIdentity((current) => ({
                  ...current,
                  [dimension]: value
                }))
              }
            />
          ))}
        </ReviewSection>

        <ReviewSection
          number={2}
          title="Edit Scope"
          answered={counts.editScope}
          total={editScopeKeys.length}
        >
          {editScopeKeys.map((dimension) => (
            <ChoiceRow
              key={dimension}
              label={EDIT_SCOPE_LABELS[dimension] || dimension}
              options={SCOPE_OPTIONS}
              value={editScope[dimension]}
              onChange={(value) =>
                setEditScope((current) => ({
                  ...current,
                  [dimension]: value
                }))
              }
            />
          ))}
        </ReviewSection>

        <ReviewSection
          number={3}
          title="Route Adherence"
          answered={counts.route}
          total={routeTargets.length}
        >
          {routeTargets.map((target) => (
            <ChoiceRow
              key={target.operationId}
              label={target.operationId}
              detail={targetSummary(target)}
              options={ROUTE_OPTIONS}
              value={routeOperations[target.operationId]}
              onChange={(value) =>
                setRouteOperations((current) => ({
                  ...current,
                  [target.operationId]: value
                }))
              }
            />
          ))}
        </ReviewSection>

        <ReviewSection
          number={4}
          title="Color Fidelity"
          answered={counts.color}
          total={colorTargets.length}
        >
          {colorTargets.length ? (
            colorTargets.map((target) => (
              <ChoiceRow
                key={target.operationId}
                label={target.operationId}
                detail={
                  semanticColorSummary(target) ||
                  targetSummary(target) ||
                  "Render Spec 색상 의도"
                }
                options={COLOR_OPTIONS}
                value={colorResponses[target.operationId]}
                onChange={(value) =>
                  setColorResponses((current) => ({
                    ...current,
                    [target.operationId]: value
                  }))
                }
              />
            ))
          ) : (
            <div className="rounded-xl border border-zinc-200 bg-zinc-50/70 px-4 py-3 text-sm dark:border-zinc-800 dark:bg-zinc-950/35">
              이번 Render Spec에는 별도 색상 평가 대상이 없습니다.
              <span className="ml-2 font-semibold">Color Fidelity · N/A</span>
            </div>
          )}
        </ReviewSection>
      </div>

      {submitError ? (
        <p className="mt-5 rounded-xl border border-amber-300/60 bg-amber-50/80 px-4 py-3 text-sm leading-6 text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-100">
          {submitError}
        </p>
      ) : null}

      {result?.summary ? (
        <div className="mt-6 rounded-2xl border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-950/45">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="ui-kicker">CALIBRATION RESULT</p>
              <h3 className="mt-1 text-lg font-bold">
                Overall · {statusLabel(result.summary.overall)}
              </h3>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="ui-chip-compact px-3 py-1.5">
                Identity {statusLabel(result.summary.identity)}
              </span>
              <span className="ui-chip-compact px-3 py-1.5">
                Edit Scope {statusLabel(result.summary.editScope)}
              </span>
              <span className="ui-chip-compact px-3 py-1.5">
                Route {statusLabel(result.summary.route)}
              </span>
              <span className="ui-chip-compact px-3 py-1.5">
                Color {statusLabel(result.summary.color)}
              </span>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void copyReviewJson()}
              className="ui-button-primary min-h-10 px-4 text-sm font-semibold"
            >
              {copyStatus === "copied" ? "Review JSON 복사됨" : "Review JSON 복사"}
            </button>
            <button
              type="button"
              onClick={resetResponses}
              className="min-h-10 rounded-xl border border-zinc-300 bg-white px-4 text-sm font-semibold dark:border-zinc-700 dark:bg-zinc-900"
            >
              다시 평가
            </button>
          </div>
          {copyStatus === "error" ? (
            <p className="ui-text-secondary mt-2 text-xs">
              클립보드 복사에 실패했습니다. 브라우저 권한을 확인해 주세요.
            </p>
          ) : null}
        </div>
      ) : (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <p className="ui-text-secondary text-xs leading-5">
            미응답 {identityKeys.length + editScopeKeys.length + routeTargets.length + colorTargets.length - counts.identity - counts.editScope - counts.route - counts.color}
          </p>
          <button
            type="button"
            onClick={submit}
            disabled={!complete || submitStatus === "submitting"}
            className="ui-button-primary min-h-11 px-5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40"
          >
            {submitStatus === "submitting" ? "평가 확정 중..." : "평가 확정"}
          </button>
        </div>
      )}
    </section>
  );
}
