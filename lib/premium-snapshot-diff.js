import { createHash } from "node:crypto";

const DANGEROUS_KEYS = new Set(["__proto__", "constructor", "prototype"]);
const DEFAULT_LIMITS = Object.freeze({
  maxDepth: 16,
  maxVisitedEntries: 20000,
  maxDiffPaths: 12
});
const SAFE_PATH_SEGMENT = /^[A-Za-z_][A-Za-z0-9_-]{0,63}$/;

function valueType(value) {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

function hashText(value) {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function safePathSegment(key) {
  const text = String(key);
  return SAFE_PATH_SEGMENT.test(text)
    ? text
    : `[key:${hashText(text).slice(7, 19)}]`;
}

function joinPath(path, key, isArrayIndex = false) {
  if (isArrayIndex) return path ? `${path}[${key}]` : `[${key}]`;
  const segment = safePathSegment(key);
  return path ? `${path}.${segment}` : segment;
}

function safeKeys(value) {
  try {
    return Object.keys(value)
      .filter((key) => !DANGEROUS_KEYS.has(key))
      .sort();
  } catch {
    return [];
  }
}

function createBoundedHasher(limits) {
  return (value) => {
    const state = {
      entries: 0,
      seen: new WeakSet(),
      truncated: false
    };

    const serialize = (current, depth) => {
      if (depth > limits.maxDepth || state.entries >= limits.maxVisitedEntries) {
        state.truncated = true;
        return '"[bounded]"';
      }

      const type = valueType(current);
      if (type === "undefined") return '"[undefined]"';
      if (type === "number" && !Number.isFinite(current)) return JSON.stringify(`[${String(current)}]`);
      if (type !== "array" && type !== "object") {
        try {
          return JSON.stringify(current);
        } catch {
          return JSON.stringify(`[${type}]`);
        }
      }

      if (state.seen.has(current)) {
        state.truncated = true;
        return '"[cycle]"';
      }
      state.seen.add(current);

      let serialized;
      if (type === "array") {
        const values = [];
        for (let index = 0; index < current.length; index += 1) {
          state.entries += 1;
          values.push(serialize(current[index], depth + 1));
          if (state.truncated) break;
        }
        serialized = `[${values.join(",")}]`;
      } else {
        const entries = [];
        for (const key of safeKeys(current)) {
          state.entries += 1;
          entries.push(`${JSON.stringify(key)}:${serialize(current[key], depth + 1)}`);
          if (state.truncated) break;
        }
        serialized = `{${entries.join(",")}}`;
      }

      state.seen.delete(current);
      return serialized;
    };

    return hashText(serialize(value, 0));
  };
}

function normalizeLimits(options = {}) {
  return {
    maxDepth: Math.max(1, Math.min(64, Number(options.maxDepth) || DEFAULT_LIMITS.maxDepth)),
    maxVisitedEntries: Math.max(
      1,
      Math.min(100000, Number(options.maxVisitedEntries) || DEFAULT_LIMITS.maxVisitedEntries)
    ),
    maxDiffPaths: Math.max(
      1,
      Math.min(100, Number(options.maxDiffPaths) || DEFAULT_LIMITS.maxDiffPaths)
    )
  };
}

export function diffPremiumSnapshots(existingValue, nextValue, options = {}) {
  const limits = normalizeLimits(options);
  const hashValue = createBoundedHasher(limits);
  const state = {
    visitedEntries: 0,
    diffPaths: [],
    truncated: false,
    seenPairs: new WeakMap()
  };

  const record = (path, existing, next, existingPresent = true, nextPresent = true) => {
    if (state.diffPaths.length >= limits.maxDiffPaths) {
      state.truncated = true;
      return;
    }
    const existingType = existingPresent ? valueType(existing) : "missing";
    const nextType = nextPresent ? valueType(next) : "missing";
    const entry = {
      path: path || "$",
      existingType,
      nextType,
      existingPresent,
      nextPresent,
      ...(existingType === "array" ? { existingArrayLength: existing.length } : {}),
      ...(nextType === "array" ? { nextArrayLength: next.length } : {}),
      ...(existingType === "object" ? { existingObjectKeyCount: safeKeys(existing).length } : {}),
      ...(nextType === "object" ? { nextObjectKeyCount: safeKeys(next).length } : {}),
      ...(existingPresent ? { existingHash: hashValue(existing) } : {}),
      ...(nextPresent ? { nextHash: hashValue(next) } : {})
    };
    state.diffPaths.push(entry);
  };

  const visit = (existing, next, path, depth, existingPresent = true, nextPresent = true) => {
    if (state.truncated) return;
    if (depth > limits.maxDepth || state.visitedEntries >= limits.maxVisitedEntries) {
      state.truncated = true;
      return;
    }
    state.visitedEntries += 1;

    if (!existingPresent || !nextPresent) {
      record(path, existing, next, existingPresent, nextPresent);
      return;
    }

    const existingType = valueType(existing);
    const nextType = valueType(next);
    if (existingType !== nextType) {
      record(path, existing, next);
      return;
    }

    if (!["array", "object"].includes(existingType)) {
      if (!Object.is(existing, next)) record(path, existing, next);
      return;
    }

    let pairedNext = state.seenPairs.get(existing);
    if (!pairedNext) {
      pairedNext = new WeakSet();
      state.seenPairs.set(existing, pairedNext);
    } else if (pairedNext.has(next)) {
      state.truncated = true;
      return;
    }
    pairedNext.add(next);

    if (existingType === "array") {
      const length = Math.max(existing.length, next.length);
      for (let index = 0; index < length && !state.truncated; index += 1) {
        visit(
          existing[index],
          next[index],
          joinPath(path, index, true),
          depth + 1,
          index < existing.length,
          index < next.length
        );
      }
      if (existing.length !== next.length && !state.truncated) {
        record(path, existing, next);
      }
      return;
    }

    const existingKeys = safeKeys(existing);
    const nextKeys = safeKeys(next);
    const keys = [...new Set([...existingKeys, ...nextKeys])].sort();
    for (const key of keys) {
      if (state.truncated) break;
      visit(
        existing[key],
        next[key],
        joinPath(path, key),
        depth + 1,
        Object.prototype.hasOwnProperty.call(existing, key),
        Object.prototype.hasOwnProperty.call(next, key)
      );
    }
  };

  visit(existingValue, nextValue, "", 0);
  return {
    equal: state.diffPaths.length === 0 && !state.truncated,
    diffPaths: state.diffPaths,
    truncated: state.truncated,
    visitedEntries: Math.min(state.visitedEntries, limits.maxVisitedEntries)
  };
}

export const PREMIUM_SNAPSHOT_DIFF_LIMITS = DEFAULT_LIMITS;
