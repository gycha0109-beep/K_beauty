import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const packagePath = path.join(root, "package.json");
const packageJson = JSON.parse(fs.readFileSync(packagePath, "utf8"));

packageJson.workspaces = ["apps/*", "packages/*", "tools/*"];
packageJson.scripts = {
  ...packageJson.scripts,
  "mobile:start": "npm run start --workspace @bejewely/mobile",
  "mobile:android": "npm run android --workspace @bejewely/mobile",
  "mobile:typecheck": "npm run typecheck --workspace @bejewely/mobile",
  "mobile:lint": "npm run lint --workspace @bejewely/mobile",
  "mobile:config": "npm run config:check --workspace @bejewely/mobile",
  "mobile:export:android": "npm run export:android --workspace @bejewely/mobile",
  "verify:mobile-foundation": "node scripts/verify-mobile-architecture-foundation.mjs"
};

fs.writeFileSync(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`);
