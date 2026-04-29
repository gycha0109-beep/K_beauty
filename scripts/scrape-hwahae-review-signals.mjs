#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";

async function main() {
  const snippetPath = path.resolve(
    process.cwd(),
    "scripts/hwahae-console-extractor-snippet.js",
  );
  const snippet = await fs.readFile(snippetPath, "utf8");

  process.stdout.write(
    [
      "Playwright-first Hwahae scraping is deprecated in this repo.",
      "Use the visible-page browser-console workflow instead:",
      "1. Open a Hwahae product page in your own browser.",
      `2. Paste the snippet from ${snippetPath} into DevTools Console.`,
      '3. Save the raw JSON and replace "USER_MUST_REPLACE_SUPABASE_PRODUCT_ID".',
      '4. Build a fixture with: node scripts/build-review-signal-fixture.mjs --input tmp/hwahae-raw.json --out tmp/hwahae-review-signals.fixture.json',
      '5. Dry-run import with: node scripts/import-review-signals-to-supabase.mjs --file tmp/hwahae-review-signals.fixture.json --dry-run',
      "",
      "--- snippet ---",
      snippet,
    ].join("\n"),
  );
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
