import { readFile } from "node:fs/promises";

const targetUrl = new URL("../lib/security/image-source-policy.js", import.meta.url).href;

export async function load(url, context, nextLoad) {
  if (url === targetUrl) {
    return {
      format: "module",
      source: await readFile(new URL(url), "utf8"),
      shortCircuit: true,
    };
  }

  return nextLoad(url, context);
}
