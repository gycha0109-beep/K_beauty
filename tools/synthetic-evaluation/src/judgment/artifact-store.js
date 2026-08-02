import { mkdir, open, readFile } from "node:fs/promises";
import path from "node:path";
import { stableStringify } from "../shared/canonical-json.js";

function serialized(value) {
  return `${stableStringify(value)}\n`;
}

export async function writeExclusiveJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  const text = serialized(value);
  let handle;
  try {
    handle = await open(filePath, "wx", 0o600);
    await handle.writeFile(text, "utf8");
    await handle.sync();
  } finally {
    await handle?.close();
  }
  return text;
}

export async function writeContentAddressedJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  const text = serialized(value);
  try {
    const handle = await open(filePath, "wx", 0o600);
    try {
      await handle.writeFile(text, "utf8");
      await handle.sync();
    } finally {
      await handle.close();
    }
    return Object.freeze({ created: true, value });
  } catch (error) {
    if (error?.code !== "EEXIST") throw error;
    const existing = await readFile(filePath, "utf8");
    if (existing !== text) throw Object.assign(new Error("immutable_artifact_conflict"), { code: "immutable_artifact_conflict" });
    return Object.freeze({ created: false, value: JSON.parse(existing) });
  }
}

export async function writeSemanticAddressedJson(filePath, value, verifyExisting) {
  await mkdir(path.dirname(filePath), { recursive: true });
  const text = serialized(value);
  try {
    const handle = await open(filePath, "wx", 0o600);
    try {
      await handle.writeFile(text, "utf8");
      await handle.sync();
    } finally {
      await handle.close();
    }
    return Object.freeze({ created: true, value });
  } catch (error) {
    if (error?.code !== "EEXIST") throw error;
    let existing;
    try {
      existing = JSON.parse(await readFile(filePath, "utf8"));
    } catch {
      throw Object.assign(new Error("immutable_artifact_conflict"), { code: "immutable_artifact_conflict" });
    }
    if (typeof verifyExisting !== "function" || !verifyExisting(existing, value)) {
      throw Object.assign(new Error("immutable_artifact_conflict"), { code: "immutable_artifact_conflict" });
    }
    return Object.freeze({ created: false, value: existing });
  }
}

export async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}
