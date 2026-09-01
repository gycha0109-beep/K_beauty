import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const contractPath = join(repoRoot, "apps", "mobile", "google-play-data-safety.json");
const envPath = join(repoRoot, "apps", "mobile", "lib", "env.ts");
const contract = JSON.parse(readFileSync(contractPath, "utf8"));
const envModule = await import(pathToFileURL(envPath).href);

assert.equal(contract.schemaVersion, "mobile-google-play-data-safety-v1");
assert.equal(contract.slice, "MOBILE-16C");
assert.equal(contract.status, "repository_derived_play_console_pending");
assert.equal(contract.authority.googlePlayConsoleSubmission, "external_pending");
assert.equal(contract.authority.processorContractConfirmation, "external_pending");
assert.equal(contract.authority.openAiZeroDataRetention, "external_unverified");

assert.equal(contract.dataCollectionAndSecurity.collectsUserData, true);
assert.equal(contract.dataCollectionAndSecurity.sharesUserData, false);
assert.equal(contract.dataCollectionAndSecurity.allUserDataEncryptedInTransit, true);
assert.equal(contract.dataCollectionAndSecurity.deletionRequestMechanism, true);

const expectedDataTypes = new Map([
  ["Name", { required: false, purposes: ["Account management"] }],
  ["Email address", { required: false, purposes: ["Account management"] }],
  ["User IDs", { required: false, purposes: ["Account management", "App functionality"] }],
  ["Health info", { required: true, purposes: ["App functionality", "Personalization"] }],
  ["Photos", { required: true, purposes: ["App functionality", "Personalization"] }],
  ["Other user-generated content", { required: false, purposes: ["App functionality"] }]
]);

const actualDataTypes = new Map(contract.dataTypes.map((entry) => [entry.dataType, entry]));
assert.deepEqual([...actualDataTypes.keys()].sort(), [...expectedDataTypes.keys()].sort());
for (const [dataType, expected] of expectedDataTypes) {
  const entry = actualDataTypes.get(dataType);
  assert.ok(entry, `Missing Google Play data type: ${dataType}`);
  assert.equal(entry.collected, true, `${dataType} must remain disclosed as collected`);
  assert.equal(entry.shared, false, `${dataType} sharing declaration drifted`);
  assert.equal(entry.required, expected.required, `${dataType} required/optional handling drifted`);
  assert.equal(entry.ephemeral, false, `${dataType} must not be treated as ephemeral without separate authority`);
  assert.deepEqual([...entry.purposes].sort(), [...expected.purposes].sort(), `${dataType} purposes drifted`);
}

const photo = actualDataTypes.get("Photos");
assert.match(photo.basis, /must not be declared ephemeral\/non-collected/);
assert.equal(contract.processorBoundary.openAiApi.trainingDefault, "not_used_for_training_unless_explicitly_opted_in");
assert.equal(contract.processorBoundary.openAiApi.defaultAbuseMonitoringRetention, "up_to_30_days");
assert.equal(contract.processorBoundary.openAiApi.zeroDataRetentionStatus, "external_unverified");
assert.equal(
  contract.processorBoundary.openAiApi.photoEphemeralClaim,
  "prohibited_until_zdr_or_equivalent_nonretention_authority_is_verified"
);

const envKeys = [
  "NODE_ENV",
  "EXPO_PUBLIC_API_BASE_URL",
  "EXPO_PUBLIC_SUPABASE_URL",
  "EXPO_PUBLIC_SUPABASE_ANON_KEY"
];
const previousEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));

try {
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = "mobile-16c-test-anon-key";

  process.env.NODE_ENV = "production";
  process.env.EXPO_PUBLIC_API_BASE_URL = "http://api.example.test";
  process.env.EXPO_PUBLIC_SUPABASE_URL = "https://project.supabase.co";
  assert.throws(
    () => envModule.getMobileApiBaseUrl(),
    /EXPO_PUBLIC_API_BASE_URL must use https in production/,
    "Production API HTTP must fail closed"
  );

  process.env.EXPO_PUBLIC_API_BASE_URL = "https://api.example.test";
  process.env.EXPO_PUBLIC_SUPABASE_URL = "http://project.supabase.test";
  assert.throws(
    () => envModule.getMobileSupabasePublicEnv(),
    /EXPO_PUBLIC_SUPABASE_URL must use https in production/,
    "Production Supabase HTTP must fail closed"
  );

  process.env.EXPO_PUBLIC_API_BASE_URL = "https://api.example.test/";
  process.env.EXPO_PUBLIC_SUPABASE_URL = "https://project.supabase.co";
  assert.equal(envModule.getMobileApiBaseUrl(), "https://api.example.test");
  assert.deepEqual(envModule.getMobileSupabasePublicEnv(), {
    supabaseUrl: "https://project.supabase.co",
    supabaseAnonKey: "mobile-16c-test-anon-key"
  });

  process.env.EXPO_PUBLIC_API_BASE_URL = "https://localhost:3000";
  assert.throws(
    () => envModule.getMobileApiBaseUrl(),
    /cannot target a local-only hostname in production/,
    "Production local-only hosts must remain fail closed"
  );

  process.env.NODE_ENV = "development";
  process.env.EXPO_PUBLIC_API_BASE_URL = "http://10.0.2.2:3000";
  process.env.EXPO_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54321";
  assert.equal(envModule.getMobileApiBaseUrl(), "http://10.0.2.2:3000");
  assert.deepEqual(envModule.getMobileSupabasePublicEnv(), {
    supabaseUrl: "http://127.0.0.1:54321",
    supabaseAnonKey: "mobile-16c-test-anon-key"
  });
} finally {
  for (const key of envKeys) {
    const previous = previousEnv[key];
    if (previous === undefined) delete process.env[key];
    else process.env[key] = previous;
  }
}

console.log("MOBILE_16C_PRODUCTION_HTTPS_FAIL_CLOSED=PASS");
console.log("MOBILE_16C_GOOGLE_PLAY_DATA_SAFETY=PASS");
