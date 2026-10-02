"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState
} from "react";
import FaceLabSimulationReviewPanel from "./FaceLabSimulationReviewPanel";

const PILOT_SCHEMA =
  "face-lab-g-e2b-provider-pilot-e2e-v1";
const REVIEW_INPUT_SCHEMA =
  "face-lab-g-e2b-provider-review-input-v1";

function cleanRelativeFileName(value) {
  if (
    typeof value !== "string" ||
    !value.trim()
  ) {
    return null;
  }

  const normalized =
    value.trim().replace(/^\.\//, "");

  if (
    normalized.includes("/") ||
    normalized.includes("\\") ||
    normalized === "." ||
    normalized === ".."
  ) {
    return null;
  }

  return normalized;
}

function jsonBlob(value) {
  return new Blob(
    [
      `${JSON.stringify(
        value,
        null,
        2
      )}\n`
    ],
    {
      type:
        "application/json"
    }
  );
}

function mimeTypeForFile(file) {
  if (
    typeof file?.type === "string" &&
    file.type.startsWith("image/")
  ) {
    return file.type;
  }

  const name =
    String(file?.name || "")
      .toLowerCase();

  if (
    name.endsWith(".jpg") ||
    name.endsWith(".jpeg")
  ) {
    return "image/jpeg";
  }
  if (name.endsWith(".webp")) {
    return "image/webp";
  }
  return "image/png";
}

async function readJsonFile(
  directory,
  fileName
) {
  const safeName =
    cleanRelativeFileName(
      fileName
    );

  if (!safeName) {
    throw new Error(
      "invalid_private_file_name"
    );
  }

  const handle =
    await directory
      .getFileHandle(
        safeName
      );
  const file =
    await handle.getFile();

  return JSON.parse(
    await file.text()
  );
}

async function readBinaryFile(
  directory,
  fileName
) {
  const safeName =
    cleanRelativeFileName(
      fileName
    );

  if (!safeName) {
    throw new Error(
      "invalid_private_file_name"
    );
  }

  const handle =
    await directory
      .getFileHandle(
        safeName
      );

  return handle.getFile();
}

async function writeFile(
  directory,
  fileName,
  value
) {
  const safeName =
    cleanRelativeFileName(
      fileName
    );

  if (!safeName) {
    throw new Error(
      "invalid_private_output_name"
    );
  }

  const handle =
    await directory
      .getFileHandle(
        safeName,
        { create: true }
      );
  const writable =
    await handle
      .createWritable();

  await writable.write(
    value
  );
  await writable.close();
}

function CaseImage({
  label,
  url
}) {
  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950">
      <p className="ui-kicker mb-2">
        {label}
      </p>
      {url ? (
        <img
          src={url}
          alt={label}
          className="aspect-square w-full rounded-xl bg-zinc-100 object-contain dark:bg-zinc-900"
        />
      ) : (
        <div className="aspect-square rounded-xl bg-zinc-100 dark:bg-zinc-900" />
      )}
    </section>
  );
}

export default function FaceLabPilotReviewBoard() {
  const [directory, setDirectory] =
    useState(null);
  const [campaign, setCampaign] =
    useState(null);
  const [cases, setCases] =
    useState([]);
  const [index, setIndex] =
    useState(0);
  const [currentInput, setCurrentInput] =
    useState(null);
  const [sourceFile, setSourceFile] =
    useState(null);
  const [outputFile, setOutputFile] =
    useState(null);
  const [sourceUrl, setSourceUrl] =
    useState("");
  const [outputUrl, setOutputUrl] =
    useState("");
  const [status, setStatus] =
    useState("idle");
  const [error, setError] =
    useState("");
  const [reviewResult, setReviewResult] =
    useState(null);
  const [completed, setCompleted] =
    useState(() => new Set());

  const currentCase =
    cases[index] || null;

  useEffect(() => {
    return () => {
      if (sourceUrl) {
        URL.revokeObjectURL(
          sourceUrl
        );
      }
      if (outputUrl) {
        URL.revokeObjectURL(
          outputUrl
        );
      }
    };
  }, [sourceUrl, outputUrl]);

  const loadCase =
    useCallback(
      async (
        targetDirectory,
        targetCases,
        targetIndex
      ) => {
        const caseMeta =
          targetCases[
            targetIndex
          ];

        if (!caseMeta) {
          return;
        }

        setStatus("loading");
        setError("");
        setReviewResult(null);

        const reviewInput =
          await readJsonFile(
            targetDirectory,
            caseMeta
              .reviewInputFile
          );

        if (
          reviewInput
            .schemaVersion !==
              REVIEW_INPUT_SCHEMA ||
          reviewInput.caseId !==
            caseMeta.caseId
        ) {
          throw new Error(
            "review_input_binding_invalid"
          );
        }

        const sourceName =
          cleanRelativeFileName(
            reviewInput
              .sourceImagePath
          );
        const outputName =
          cleanRelativeFileName(
            reviewInput
              .outputImagePath
          );

        if (
          !sourceName ||
          !outputName
        ) {
          throw new Error(
            "review_image_path_invalid"
          );
        }

        const [
          nextSourceFile,
          nextOutputFile
        ] =
          await Promise.all([
            readBinaryFile(
              targetDirectory,
              sourceName
            ),
            readBinaryFile(
              targetDirectory,
              outputName
            )
          ]);

        const nextSourceUrl =
          URL.createObjectURL(
            nextSourceFile
          );
        const nextOutputUrl =
          URL.createObjectURL(
            nextOutputFile
          );

        setSourceUrl(
          (current) => {
            if (current) {
              URL.revokeObjectURL(
                current
              );
            }
            return nextSourceUrl;
          }
        );
        setOutputUrl(
          (current) => {
            if (current) {
              URL.revokeObjectURL(
                current
              );
            }
            return nextOutputUrl;
          }
        );
        setCurrentInput(
          reviewInput
        );
        setSourceFile(
          nextSourceFile
        );
        setOutputFile(
          nextOutputFile
        );
        setStatus("ready");
      },
      []
    );

  const openCampaign =
    useCallback(
      async () => {
        if (
          typeof window ===
            "undefined" ||
          typeof window
            .showDirectoryPicker !==
            "function"
        ) {
          setError(
            "Desktop Chrome 또는 Edge의 File System Access API가 필요합니다."
          );
          return;
        }

        try {
          setStatus("loading");
          setError("");

          const nextDirectory =
            await window
              .showDirectoryPicker({
                mode: "readwrite"
              });
          const nextCampaign =
            await readJsonFile(
              nextDirectory,
              "manifest.json"
            );

          if (
            nextCampaign
              .schemaVersion !==
                PILOT_SCHEMA ||
            nextCampaign.status !==
              "complete" ||
            nextCampaign.caseCount !==
              8 ||
            !Array.isArray(
              nextCampaign.cases
            ) ||
            nextCampaign
              .cases.length !==
              8
          ) {
            throw new Error(
              "pilot_manifest_invalid"
            );
          }

          for (
            const caseMeta of
            nextCampaign.cases
          ) {
            if (
              !caseMeta
                .reviewInputFile ||
              !caseMeta
                .outputFile ||
              !caseMeta.caseId
            ) {
              throw new Error(
                "pilot_manifest_case_invalid"
              );
            }
          }

          setDirectory(
            nextDirectory
          );
          setCampaign(
            nextCampaign
          );
          setCases(
            nextCampaign.cases
          );
          setCompleted(
            new Set()
          );
          setIndex(0);
          await loadCase(
            nextDirectory,
            nextCampaign.cases,
            0
          );
        } catch (
          nextError
        ) {
          if (
            nextError?.name ===
              "AbortError"
          ) {
            setStatus("idle");
            return;
          }

          setStatus("error");
          setError(
            nextError?.message ||
              "Pilot campaign 폴더를 열 수 없습니다."
          );
        }
      },
      [loadCase]
    );

  const moveTo =
    useCallback(
      async (
        nextIndex
      ) => {
        if (
          !directory ||
          nextIndex < 0 ||
          nextIndex >=
            cases.length
        ) {
          return;
        }

        try {
          setIndex(nextIndex);
          await loadCase(
            directory,
            cases,
            nextIndex
          );
        } catch (
          nextError
        ) {
          setStatus("error");
          setError(
            nextError?.message ||
              "Case를 불러오지 못했습니다."
          );
        }
      },
      [
        cases,
        directory,
        loadCase
      ]
    );

  const submitReview =
    useCallback(
      async (
        responses
      ) => {
        if (
          !directory ||
          !currentInput ||
          !sourceFile ||
          !outputFile ||
          !currentCase
        ) {
          return;
        }

        setStatus("submitting");
        setError("");

        try {
          const response =
            await fetch(
              "/api/face-lab-simulation-private-review",
              {
                method: "POST",
                headers: {
                  "Content-Type":
                    "application/json"
                },
                body:
                  JSON.stringify({
                    reviewInput:
                      currentInput,
                    sourceMimeType:
                      mimeTypeForFile(
                        sourceFile
                      ),
                    outputMimeType:
                      mimeTypeForFile(
                        outputFile
                      ),
                    responses
                  })
              }
            );
          const payload =
            await response
              .json()
              .catch(
                () => null
              );

          if (
            !response.ok ||
            payload?.success !==
              true
          ) {
            throw new Error(
              payload?.error ||
                "private_review_submit_failed"
            );
          }

          await writeFile(
            directory,
            payload.capture
              .fileNames
              .sourceImage,
            sourceFile
          );
          await writeFile(
            directory,
            payload.capture
              .fileNames
              .outputImage,
            outputFile
          );
          await writeFile(
            directory,
            payload.capture
              .fileNames
              .identityScopeReview,
            jsonBlob(
              payload
                .identityScopeReview
            )
          );
          await writeFile(
            directory,
            payload.capture
              .fileNames
              .routeColorReview,
            jsonBlob(
              payload
                .routeColorReview
            )
          );
          await writeFile(
            directory,
            payload.capture
              .fileNames
              .manifest,
            jsonBlob(
              payload.capture
                .manifest
            )
          );
          await writeFile(
            directory,
            payload.runSpecFileName,
            jsonBlob(
              payload.runSpec
            )
          );

          setReviewResult({
            caseId:
              payload.caseId,
            identityScopeReview:
              payload
                .identityScopeReview,
            routeColorReview:
              payload
                .routeColorReview,
            summary:
              payload.summary
          });
          setCompleted(
            (current) => {
              const next =
                new Set(
                  current
                );
              next.add(
                currentCase
                  .caseName
              );
              return next;
            }
          );
          setStatus(
            "submitted"
          );
        } catch (
          nextError
        ) {
          setStatus("error");
          setError(
            nextError?.message ||
              "Human Review를 저장하지 못했습니다."
          );
        }
      },
      [
        currentCase,
        currentInput,
        directory,
        outputFile,
        sourceFile
      ]
    );

  const progress =
    useMemo(
      () => ({
        completed:
          completed.size,
        total:
          cases.length
      }),
      [
        cases.length,
        completed
      ]
    );

  return (
    <main className="ui-page ui-page-shell min-h-screen">
      <div className="mx-auto w-full max-w-[1180px] px-4 pb-24 pt-5 sm:px-6 sm:pt-8">
        <header className="mb-5 rounded-[1.35rem] border border-zinc-200 bg-white/85 p-5 dark:border-zinc-800 dark:bg-zinc-950/60">
          <p className="ui-kicker">
            LOCAL ONLY · GATE G · PRIVATE CALIBRATION
          </p>
          <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="ui-title text-2xl">
                Private Pilot Review Board
              </h1>
              <p className="ui-text-secondary mt-2 max-w-2xl text-sm leading-6">
                로컬 private campaign 폴더의 Before/Simulation 8쌍을 직접 비교해 Gate G Human Review를 확정합니다. G-E2B pilot과 G-E3 calibration wave를 같은 로컬 전용 화면에서 검토하며 이미지 파일은 이 브라우저 세션에서 로컬 폴더 안에서만 읽고 씁니다.
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                void openCampaign()
              }
              className="ui-button-primary min-h-11 px-5 text-sm font-semibold"
            >
              Pilot 폴더 열기
            </button>
          </div>

          {campaign ? (
            <div className="mt-4 flex flex-wrap gap-2 text-xs">
              <span className="ui-chip-compact px-3 py-1.5">
                {campaign.campaignId}
              </span>
              <span className="ui-chip-compact px-3 py-1.5">
                Review {progress.completed}/{progress.total}
              </span>
              <span className="ui-chip-compact px-3 py-1.5">
                Case {index + 1}/{cases.length}
              </span>
            </div>
          ) : null}

          {error ? (
            <p className="mt-4 rounded-xl border border-amber-300/60 bg-amber-50/80 px-4 py-3 text-sm leading-6 text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-100">
              {error}
            </p>
          ) : null}
        </header>

        {currentCase &&
        currentInput ? (
          <>
            <section className="mb-5 rounded-2xl border border-zinc-200 bg-white/80 p-4 dark:border-zinc-800 dark:bg-zinc-950/50">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="ui-kicker">
                    {currentCase.caseName}
                  </p>
                  <p className="ui-text-secondary mt-1 text-sm">
                    Route · {currentCase.routeId} · Generation {currentCase.generationIndex}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={
                      index === 0 ||
                      status ===
                        "submitting"
                    }
                    onClick={() =>
                      void moveTo(
                        index - 1
                      )
                    }
                    className="min-h-10 rounded-xl border border-zinc-300 bg-white px-4 text-sm font-semibold disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-900"
                  >
                    이전
                  </button>
                  <button
                    type="button"
                    disabled={
                      index >=
                        cases.length -
                          1 ||
                      status ===
                        "submitting"
                    }
                    onClick={() =>
                      void moveTo(
                        index + 1
                      )
                    }
                    className="min-h-10 rounded-xl border border-zinc-300 bg-white px-4 text-sm font-semibold disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-900"
                  >
                    다음
                  </button>
                </div>
              </div>
            </section>

            <div className="mb-5 grid gap-4 md:grid-cols-2">
              <CaseImage
                label="BEFORE"
                url={
                  sourceUrl
                }
              />
              <CaseImage
                label="SIMULATION"
                url={
                  outputUrl
                }
              />
            </div>

            <FaceLabSimulationReviewPanel
              key={
                currentInput
                  .caseId
              }
              template={
                currentInput
                  .reviewTemplate
              }
              submitStatus={
                status ===
                "submitting"
                  ? "submitting"
                  : status ===
                      "submitted"
                    ? "submitted"
                    : "ready"
              }
              submitError={
                error
              }
              result={
                reviewResult
              }
              onSubmit={(
                responses
              ) =>
                void submitReview(
                  responses
                )
              }
              onResetResult={() => {
                setReviewResult(
                  null
                );
                setStatus(
                  "ready"
                );
                setError("");
              }}
            />

            {status ===
              "submitted" &&
            index <
              cases.length - 1 ? (
              <div className="mt-5 flex justify-end">
                <button
                  type="button"
                  onClick={() =>
                    void moveTo(
                      index + 1
                    )
                  }
                  className="ui-button-primary min-h-11 px-5 text-sm font-semibold"
                >
                  저장 완료 · 다음 Case
                </button>
              </div>
            ) : null}

            {progress.total === 8 &&
            progress.completed ===
              8 ? (
              <section className="mt-5 rounded-2xl border border-emerald-300/60 bg-emerald-50/80 p-5 dark:border-emerald-900/60 dark:bg-emerald-950/20">
                <p className="font-semibold">
                  Human Review 8/8 저장 완료
                </p>
                <p className="mt-2 text-sm leading-6">
                  {campaign?.calibrationStage ===
                  "G-E3" ? (
                    <>
                      같은 wave 폴더에서 <code>npm run run:face-lab-v2-g-e3-private-wave -- &lt;wave-folder&gt;</code>를 실행해 G-E3 wave closeout을 생성합니다.
                    </>
                  ) : (
                    <>
                      같은 campaign 폴더에서 <code>node scripts/run-face-lab-v2-g-e2b-private-campaign.mjs &lt;campaign-folder&gt;</code>를 실행하면 G-B packet, Calibration Case, G-E2C aggregate가 생성됩니다.
                    </>
                  )}
                </p>
              </section>
            ) : null}
          </>
        ) : (
          <section className="rounded-2xl border border-dashed border-zinc-300 bg-white/60 p-8 text-center dark:border-zinc-700 dark:bg-zinc-950/35">
            <p className="ui-text-secondary text-sm leading-6">
              로컬 Provider Pilot을 <code>FACE_LAB_E2E_PERSIST_OUTPUTS=1</code>로 실행한 campaign 폴더를 선택해 주세요.
            </p>
          </section>
        )}
      </div>
    </main>
  );
}
