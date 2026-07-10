import { pathToFileURL } from "node:url";
import path from "node:path";
import { existsSync } from "node:fs";

const ROOT = process.cwd();

export async function resolve(specifier, context, defaultResolve) {
  if (specifier.startsWith("@/")) {
    const withoutAlias = specifier.slice(2);
    const absolute = path.join(ROOT, withoutAlias);
    let withExtension = absolute;
    if (!path.extname(withExtension)) {
      if (existsSync(`${absolute}.js`)) {
        withExtension = `${absolute}.js`;
      } else if (existsSync(`${absolute}.ts`)) {
        withExtension = `${absolute}.ts`;
      } else {
        withExtension = `${absolute}.js`;
      }
    }

    return {
      url: pathToFileURL(withExtension).href,
      shortCircuit: true
    };
  }

  return defaultResolve(specifier, context, defaultResolve);
}
