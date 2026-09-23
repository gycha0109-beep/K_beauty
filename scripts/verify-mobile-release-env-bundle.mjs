import { readdirSync, readFileSync } from "node:fs";
import { extname, resolve } from "node:path";

const root = resolve(process.argv[2] || "apps/mobile/.expo-ci-dist");
const expected = {
  api: process.env.EXPO_PUBLIC_API_BASE_URL || "",
  supabase: process.env.EXPO_PUBLIC_SUPABASE_URL || "",
  anon: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || ""
};

for (const [key, value] of Object.entries(expected)) {
  if (!value) {
    console.error(`MOBILE_RELEASE_ENV_BUNDLE=FAIL missing_expected_${key}`);
    process.exit(1);
  }
}

function collect(directory) {
  const entries = readdirSync(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...collect(path));
    } else if (extname(entry.name) === ".js") {
      files.push(path);
    }
  }
  return files;
}

const bundles = collect(root);
if (bundles.length === 0) {
  console.error("MOBILE_RELEASE_ENV_BUNDLE=FAIL no_js_bundle");
  process.exit(1);
}

const bundleText = bundles.map((file) => readFileSync(file, "utf8")).join("\n");
const missing = Object.entries(expected)
  .filter(([, value]) => !bundleText.includes(value))
  .map(([key]) => key);

if (missing.length > 0) {
  console.error(`MOBILE_RELEASE_ENV_BUNDLE=FAIL missing_inlined=${missing.join(",")}`);
  process.exit(1);
}

if (bundleText.includes("http://127.0.0.1") || bundleText.includes("http://localhost")) {
  console.error("MOBILE_RELEASE_ENV_BUNDLE=FAIL local_api_origin_embedded");
  process.exit(1);
}

console.log(
  `MOBILE_RELEASE_ENV_BUNDLE=PASS bundles=${bundles.length} api=${expected.api}`
);
