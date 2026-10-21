"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./SkinImageLabeler.module.css";

const STORAGE_KEY = "bejewely-skin-track-local-labels-v1";
const EXPORT_VERSION = "skin-track-image-labels-v1";
const FIELDS = [
  { key: "acne", name: "여드름·트러블", hint: "좁쌀, 구진, 농포, 블랙헤드" },
  { key: "pores", name: "모공", hint: "코·볼 등의 가시적인 모공" },
  { key: "redness", name: "홍조·붉은기", hint: "붉은 영역과 분포" },
  { key: "uneven_tone", name: "톤 불균일·색소", hint: "잡티, 흔적, 얼룩덜룩함" },
  { key: "flaking", name: "각질·들뜸", hint: "표면에 보이는 각질" },
  { key: "shine", name: "유분·광택", hint: "빛에 반사되는 표면 광택" },
  { key: "texture", name: "피부결·요철", hint: "거칠기와 미세한 요철" },
  { key: "wrinkles", name: "주름·잔주름", hint: "이마, 눈가, 입가의 주름" },
  { key: "under_eye", name: "눈가·다크서클", hint: "눈 밑의 색 변화와 그림자" },
  { key: "irritation_appearance", name: "자극으로 보이는 흔적", hint: "붉은 반점, 표면 벗겨짐" }
];
const MAIN_FIELDS = FIELDS.slice(0, 6);
const MORE_FIELDS = FIELDS.slice(6);
const LEVELS = [{ value: 1, label: "약함" }, { value: 2, label: "보통" }, { value: 3, label: "강함" }];
const ALLOWED_EXT = /\.(jpe?g|png|webp|gif|bmp|avif)$/i;
const FIELD_KEYS = new Set(FIELDS.map((item) => item.key));

function fileKey(file) {
  return [file.webkitRelativePath || file.name, file.size, file.lastModified].join("::");
}
function readStoredRecords() {
  try {
    if (typeof window !== "undefined") {
      const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "null");
      return sanitizeRecords(saved?.records);
    }
  } catch { /* unavailable or damaged storage: start empty */ }
  return {};
}
function sanitizeRecords(source) {
  if (!source || typeof source !== "object" || Array.isArray(source)) return {};
  const safe = {};
  for (const [key, record] of Object.entries(source)) {
    if (typeof key !== "string" || key.length > 500 || !record || typeof record !== "object") continue;
    if (record.status !== "done" && record.status !== "skipped") continue;
    const labels = {};
    if (record.labels && typeof record.labels === "object") {
      for (const [axis, value] of Object.entries(record.labels)) {
        if (FIELD_KEYS.has(axis) && Number.isInteger(value) && value >= 1 && value <= 3) labels[axis] = value;
      }
    }
    const clean = record.status === "done" && record.clean === true && Object.keys(labels).length === 0;
    if (record.status === "done" && !clean && !Object.keys(labels).length) continue;
    safe[key] = { status: record.status, labels: record.status === "done" ? labels : {}, clean, updatedAt: typeof record.updatedAt === "string" ? record.updatedAt : null };
  }
  return safe;
}
function toCsvCell(value) {
  let text = String(value ?? "");
  if (/^[\s]*[=+\-@]/.test(text)) text = "'" + text;
  return '"' + text.replace(/"/g, '""') + '"';
}
function downloadText(filename, contents, type) {
  const blob = new Blob([contents], { type });
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
}
function getImageRecord(file, records) {
  return records[fileKey(file)] || null;
}

export default function SkinImageLabeler() {
  const [files, setFiles] = useState([]);
  const [index, setIndex] = useState(0);
  const [records, setRecords] = useState(readStoredRecords);
  const [labels, setLabels] = useState({});
  const [clean, setClean] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [preview, setPreview] = useState("");
  const [message, setMessage] = useState("");
  const folderRef = useRef(null);
  const imageRef = useRef(null);
  const importRef = useRef(null);
  const current = files[index] || null;
  const currentKey = current ? fileKey(current) : null;

  useEffect(() => {
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: EXPORT_VERSION, records })); }
    catch { /* export still works if storage is disabled or full */ }
  }, [records]);

  useEffect(() => {
    const record = currentKey ? records[currentKey] : null;
    setLabels(record?.status === "done" ? { ...record.labels } : {});
    setClean(record?.status === "done" ? record.clean : false);
    setMessage("");
  }, [currentKey]); // intentionally only on image navigation

  useEffect(() => {
    if (!current) { setPreview(""); return; }
    const url = URL.createObjectURL(current);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [current]);

  const counts = useMemo(() => {
    let done = 0, skipped = 0;
    for (const file of files) {
      const status = getImageRecord(file, records)?.status;
      if (status === "done") done++;
      else if (status === "skipped") skipped++;
    }
    return { done, skipped, pending: files.length - done - skipped };
  }, [files, records]);

  function selectFiles(event) {
    const list = Array.from(event.target.files || [])
      .filter((file) => file.type.startsWith("image/") || ALLOWED_EXT.test(file.name))
      .sort((a, b) => (a.webkitRelativePath || a.name).localeCompare(b.webkitRelativePath || b.name, "ko", { numeric: true }));
    const seen = new Set();
    const unique = list.filter((file) => {
      const key = fileKey(file);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    setFiles(unique);
    setIndex(Math.max(0, unique.findIndex((file) => !records[fileKey(file)])));
    setMessage(unique.length ? "" : "이미지 파일이 없습니다. JPG·PNG·WEBP 등이 포함된 폴더를 선택하세요.");
    event.target.value = "";
  }

  function selectSeverity(axis, level) {
    setClean(false);
    setLabels((previous) => {
      const next = { ...previous };
      if (next[axis] === level) delete next[axis];
      else next[axis] = level;
      return next;
    });
    setMessage("");
  }

  function go(delta) {
    if (!files.length) return;
    setIndex((old) => Math.max(0, Math.min(files.length - 1, old + delta)));
  }

  function saveCurrent(status, next = true) {
    if (!current) return;
    if (status === "done" && !clean && !Object.keys(labels).length) {
      setMessage("먼저 특징을 선택하거나 ‘특징 없음’을 눌러주세요.");
      return;
    }
    const record = {
      status,
      labels: status === "done" && !clean ? { ...labels } : {},
      clean: status === "done" && clean,
      updatedAt: new Date().toISOString()
    };
    setRecords((old) => ({ ...old, [currentKey]: record }));
    setMessage("");
    if (next && index < files.length - 1) setIndex(index + 1);
    else if (next) setMessage("마지막 사진입니다. 분류 기록을 내보낼 수 있습니다.");
  }

  function setNoFindings() {
    setClean(true);
    setLabels({});
    setMessage("");
  }

  function findNextPending() {
    const position = files.findIndex((file) => !records[fileKey(file)]);
    if (position < 0) { setMessage("모든 사진을 처리했습니다."); return; }
    setIndex(position);
  }

  function exportJson() {
    if (!Object.keys(records).length) { setMessage("내보낼 분류 기록이 없습니다."); return; }
    downloadText("bejewely-skin-track-labels.json", JSON.stringify({ version: EXPORT_VERSION, exportedAt: new Date().toISOString(), records }, null, 2), "application/json");
  }

  function exportCsv() {
    if (!Object.keys(records).length) { setMessage("내보낼 분류 기록이 없습니다."); return; }
    const header = ["image_key", "status", "clean", "mixed", ...FIELDS.map((field) => field.key), "updated_at"];
    const body = Object.entries(records).map(([key, record]) => {
      const mixed = Object.keys(record.labels).length > 1;
      return [key, record.status, record.clean ? 1 : 0, mixed ? 1 : 0, ...FIELDS.map((field) => record.labels[field.key] ?? ""), record.updatedAt]
        .map(toCsvCell).join(",");
    });
    downloadText("bejewely-skin-track-labels.csv", "\uFEFF" + [header.map(toCsvCell).join(","), ...body].join("\r\n"), "text/csv;charset=utf-8");
  }

  async function importJson(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      if (file.size > 15 * 1024 * 1024) throw new Error("파일 크기가 너무 큽니다.");
      const imported = JSON.parse(await file.text());
      if (imported.version !== EXPORT_VERSION || !imported.records || typeof imported.records !== "object" || Array.isArray(imported.records)) throw new Error("Skin Track JSON 기록 파일이 아닙니다.");
      const safe = sanitizeRecords(imported.records);
      setRecords((old) => ({ ...old, ...safe }));
      setMessage(Object.keys(safe).length + "개의 분류 기록을 불러왔습니다.");
    } catch (error) { setMessage(error.message || "기록을 불러오지 못했습니다."); }
    event.target.value = "";
  }

  const selectedCount = Object.keys(labels).length;
  const savedRecord = current ? getImageRecord(current, records) : null;
  const percent = files.length ? Math.round(((counts.done + counts.skipped) / files.length) * 100) : 0;

  return (
    <main className={styles.root}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <div>
            <p className={styles.eyebrow}>BEJEWELY · FACE LAB</p>
            <h1>피부 사진 판별기 <span className={styles.version}>Skin Track</span></h1>
            <p className={styles.intro}>사진을 보고 특징을 선택하세요. 한 장씩 빠르게 저장됩니다.</p>
          </div>
          <div className={styles.headerActions}>
            <button type="button" className={styles.secondary} onClick={exportCsv}>CSV 저장</button>
            <button type="button" className={styles.secondary} onClick={exportJson}>JSON 백업</button>
            <button type="button" className={styles.secondary} onClick={() => importRef.current?.click()}>기록 불러오기</button>
            <input ref={importRef} className={styles.srOnly} type="file" accept=".json,application/json" onChange={importJson} aria-label="JSON 기록 불러오기" />
          </div>
        </header>

        <section className={styles.progressPanel} aria-label="작업 진행률">
          <div className={styles.progressHead}>
            <strong>{files.length ? `${counts.done + counts.skipped} / ${files.length}장 처리` : "사진을 선택하면 시작됩니다"}</strong>
            <span>{files.length ? `${percent}% · 완료 ${counts.done} · 보류 ${counts.skipped}` : "사진은 서버로 전송되지 않습니다"}</span>
          </div>
          <div className={styles.progressTrack}><div className={styles.progressFill} style={{ width: percent + "%" }} /></div>
        </section>

        {!files.length ? (
          <section className={styles.empty} aria-label="사진 선택">
            <div className={styles.emptySymbol}>✦</div>
            <h2>분류할 피부 사진을 선택하세요</h2>
            <p>폴더를 통째로 선택하거나, 사진 여러 장을 한 번에 열 수 있어요.</p>
            <div className={styles.loadActions}>
              <button className={styles.primary} type="button" onClick={() => folderRef.current?.click()}>사진 폴더 선택</button>
              <button className={styles.secondary} type="button" onClick={() => imageRef.current?.click()}>사진 여러 장 선택</button>
            </div>
            <p className={styles.note}>작업 내용은 이 브라우저에 자동 저장됩니다. 다시 열 때 같은 폴더를 선택하면 이어집니다. 정기적으로 JSON 백업을 받으세요.</p>
          </section>
        ) : (
          <div className={styles.workspace}>
            <section className={styles.photoPanel} aria-label="현재 사진">
              <div className={styles.photoToolbar}>
                <strong>사진 {index + 1} / {files.length}</strong>
                <span className={savedRecord?.status === "done" ? styles.doneTag : styles.mutedTag}>{savedRecord?.status === "done" ? "저장됨" : savedRecord?.status === "skipped" ? "보류됨" : "미분류"}</span>
              </div>
              <div className={styles.imageStage}>
                {preview ? <img src={preview} alt={"분류할 사진 " + current.name} className={styles.image} /> : null}
              </div>
              <div className={styles.fileName} title={current.webkitRelativePath || current.name}>{current.webkitRelativePath || current.name}</div>
              <div className={styles.photoFoot}>
                <button className={styles.secondary} type="button" onClick={() => go(-1)} disabled={index === 0}>← 이전 사진</button>
                <button className={styles.secondary} type="button" onClick={() => go(1)} disabled={index === files.length - 1}>다음 사진 →</button>
              </div>
            </section>

            <section className={styles.classifier} aria-label="피부 특징 분류">
              <div className={styles.classifierHead}>
                <div>
                  <p className={styles.sectionEyebrow}>STEP 01 · 특징 선택</p>
                  <h2>사진에서 무엇이 보이나요?</h2>
                  <p>여러 개 선택할 수 있어요. 강도를 누르면 바로 표시됩니다.</p>
                </div>
                <button className={styles.reset} type="button" onClick={() => { setLabels({}); setClean(false); setMessage(""); }}>초기화</button>
              </div>
              <button type="button" aria-pressed={clean} className={clean ? styles.cleanActive : styles.cleanButton} onClick={setNoFindings}>
                <span>✨ <strong>특징 없음 · 깨끗한 피부</strong></span><span>{clean ? "✓ 선택됨" : "선택"}</span>
              </button>
              <div className={styles.fieldList}>
                {MAIN_FIELDS.map((field) => (
                  <div className={styles.fieldRow} key={field.key}>
                    <div className={styles.fieldTitle}><strong>{field.name}</strong><small>{field.hint}</small></div>
                    <div className={styles.levels} role="group" aria-label={field.name + " 정도"}>
                      {LEVELS.map((level) => (
                        <button type="button" key={level.value} aria-pressed={labels[field.key] === level.value} className={labels[field.key] === level.value ? styles.levelActive : styles.level} onClick={() => selectSeverity(field.key, level.value)}>{level.label}</button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <button type="button" className={styles.moreButton} aria-expanded={showMore} onClick={() => setShowMore(!showMore)}>{showMore ? "추가 항목 접기 −" : "추가 항목 4개 펼치기 +"} <span>피부결 · 주름 · 눈가 · 자극</span></button>
              {showMore ? (
                <div className={styles.fieldList}>
                  {MORE_FIELDS.map((field) => (
                    <div className={styles.fieldRow} key={field.key}>
                      <div className={styles.fieldTitle}><strong>{field.name}</strong><small>{field.hint}</small></div>
                      <div className={styles.levels} role="group" aria-label={field.name + " 정도"}>
                        {LEVELS.map((level) => <button type="button" key={level.value} aria-pressed={labels[field.key] === level.value} className={labels[field.key] === level.value ? styles.levelActive : styles.level} onClick={() => selectSeverity(field.key, level.value)}>{level.label}</button>)}
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
              <div className={styles.summary} aria-live="polite">{clean ? "특징 없음 선택" : selectedCount ? `${selectedCount}개 특징 선택${selectedCount > 1 ? " · 복합 상태로 자동 분류" : ""}` : "아직 선택한 특징이 없습니다"}</div>
              {message ? <p className={styles.notice} role="status">{message}</p> : null}
              <div className={styles.bottomActions}>
                <button className={styles.skipButton} type="button" onClick={() => saveCurrent("skipped")}>판별 어려움 · 보류</button>
                <button className={styles.primary} type="button" onClick={() => saveCurrent("done")}>저장하고 다음 →</button>
              </div>
              <div className={styles.queueActions}>
                <button type="button" onClick={findNextPending}>미분류 사진으로 이동 ↗</button>
                <button type="button" onClick={() => { setFiles([]); setIndex(0); }}>다른 폴더 열기</button>
              </div>
            </section>
          </div>
        )}
        {files.length === 0 && message ? <p className={styles.notice} role="status">{message}</p> : null}
        <footer className={styles.footer}>이미지·사진 내용은 업로드하지 않습니다. 분류 기록은 브라우저에 저장되며 CSV·JSON 파일로 내려받을 수 있습니다. · Skin Track 수집용 임시 가시성 등급 (1~3)</footer>
      </div>
      <input className={styles.srOnly} ref={folderRef} type="file" webkitdirectory="" directory="" multiple onChange={selectFiles} aria-label="사진 폴더 선택" />
      <input className={styles.srOnly} ref={imageRef} type="file" accept="image/*" multiple onChange={selectFiles} aria-label="사진 여러 장 선택" />
    </main>
  );
}
