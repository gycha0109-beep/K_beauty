import { pathToFileURL } from "node:url";
import path from "node:path";

const workspaceRoot = process.cwd();

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    const withoutAlias = specifier.slice(2);
    const extension = path.extname(withoutAlias);
    const candidates = extension
      ? [withoutAlias]
      : [`${withoutAlias}.js`, `${withoutAlias}.ts`, path.join(withoutAlias, "index.js")];

    for (const candidate of candidates) {
      const resolvedPath = path.join(workspaceRoot, candidate);

      try {
        return await nextResolve(pathToFileURL(resolvedPath).href, context);
      } catch {}
    }
  }

  return nextResolve(specifier, context);
}
