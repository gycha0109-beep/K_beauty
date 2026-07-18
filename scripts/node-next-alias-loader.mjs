import { pathToFileURL, fileURLToPath } from "node:url";
import path from "node:path";
import { existsSync, readFileSync } from "node:fs";
import { transform } from "next/dist/build/swc/index.js";

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

export async function load(url, context, defaultLoad) {
  if (!url.endsWith(".ts")) {
    return defaultLoad(url, context, defaultLoad);
  }

  const filename = fileURLToPath(url);
  const source = readFileSync(filename, "utf8");
  const result = await transform(source, {
    filename,
    sourceMaps: false,
    jsc: {
      parser: {
        syntax: "typescript",
        tsx: false,
        decorators: false,
        dynamicImport: true
      },
      target: "es2022"
    },
    module: {
      type: "es6"
    }
  });

  return {
    format: "module",
    source: result.code,
    shortCircuit: true
  };
}
