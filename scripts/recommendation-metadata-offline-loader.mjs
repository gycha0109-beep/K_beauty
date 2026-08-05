import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { transform } from "next/dist/build/swc/index.js";

const ROOT = process.cwd();
const EXTENSIONS = ["", ".js", ".mjs", ".ts", ".tsx", "/index.js", "/index.ts"];

async function resolveExisting(basePath) {
  for (const extension of EXTENSIONS) {
    const candidate = `${basePath}${extension}`;
    try {
      await access(candidate);
      return pathToFileURL(candidate).href;
    } catch {}
  }
  return null;
}

export async function resolve(specifier, context, defaultResolve) {
  if (specifier.startsWith("@/")) {
    const resolved = await resolveExisting(path.join(ROOT, specifier.slice(2)));
    if (resolved) return { url: resolved, shortCircuit: true };
  }
  if ((specifier.startsWith("./") || specifier.startsWith("../")) && context.parentURL) {
    const basePath = path.resolve(path.dirname(fileURLToPath(context.parentURL)), specifier);
    const resolved = await resolveExisting(basePath);
    if (resolved) return { url: resolved, shortCircuit: true };
  }
  return defaultResolve(specifier, context, defaultResolve);
}

export async function load(url, context, defaultLoad) {
  if (url.endsWith(".ts") || url.endsWith(".tsx")) {
    const filename = fileURLToPath(url);
    const source = await readFile(filename, "utf8");
    const result = await transform(source, {
      filename,
      sourceMaps: false,
      jsc: {
        parser: { syntax: "typescript", tsx: url.endsWith(".tsx"), decorators: false },
        target: "es2022"
      },
      module: { type: "es6" }
    });
    return { format: "module", source: result.code, shortCircuit: true };
  }
  return defaultLoad(url, context, defaultLoad);
}
