import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const checkedFiles = [];

function read(path) {
  const absolutePath = resolve(root, path);

  if (!existsSync(absolutePath)) {
    throw new Error(`missing file: ${path}`);
  }

  checkedFiles.push(path);
  return readFileSync(absolutePath, "utf8");
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertIncludes(text, value, label) {
  assert(text.includes(value), `${label} missing: ${value}`);
}

function assertNotIncludes(text, value, label) {
  assert(!text.includes(value), `${label} unexpectedly contains: ${value}`);
}

function quotedValues(text, pattern) {
  return new Set([...text.matchAll(pattern)].map((match) => match[1]));
}

function assertSameSet(left, right, label) {
  const leftValues = [...left].sort();
  const rightValues = [...right].sort();
  assert(
    JSON.stringify(leftValues) === JSON.stringify(rightValues),
    `${label} mismatch: ${JSON.stringify({ left: leftValues, right: rightValues })}`
  );
}

const migrationFiles = readdirSync(resolve(root, "supabase/migrations"))
  .filter((name) => name.endsWith("_admin_access_foundation.sql"));
assert(migrationFiles.length === 1, "exactly one admin access foundation migration is required");

const migrationPath = `supabase/migrations/${migrationFiles[0]}`;
const migration = read(migrationPath);
const capabilities = read("lib/admin/capabilities.js");
const access = read("lib/admin/access.js");
const middleware = read("lib/supabase/middleware.js");
const layout = read("app/admin/layout.js");
const page = read("app/admin/page.js");
const design = read("docs/architecture/admin-access-foundation-v1.md");
const runtimeVerifier = read("scripts/verify-admin-access-runtime.sh");
const packageJson = JSON.parse(read("package.json"));

[
  "create table if not exists public.admin_memberships",
  "create table if not exists public.admin_audit_logs",
  "required_capability text not null",
  "alter table public.admin_memberships enable row level security",
  "alter table public.admin_audit_logs enable row level security",
  "revoke all on table public.admin_memberships from public, anon, authenticated, service_role",
  "revoke all on table public.admin_audit_logs from public, anon, authenticated, service_role",
  "create or replace function public.get_current_admin_role()",
  "create or replace function public.admin_has_capability(p_capability text)",
  "create or replace function public.bootstrap_first_admin_owner(p_user_id uuid)",
  "create or replace function public.record_admin_audit_event(",
  "p_actor_user_id uuid",
  "p_required_capability text",
  "pg_advisory_xact_lock(hashtextextended('bejewely_admin_owner_bootstrap', 0))",
  "grant execute on function public.bootstrap_first_admin_owner(uuid) to service_role",
  "grant execute on function public.record_admin_audit_event(uuid, text, text, text, text, jsonb, jsonb, text, text, jsonb) to service_role",
  "grant select on table public.admin_audit_logs to service_role",
  "admin_owner_already_bootstrapped",
  "admin_access_required",
  "admin_capability_required",
  "admin_audit_reason_required",
  "admin_audit_logs_idempotency_uidx"
].forEach((value) => assertIncludes(migration, value, "admin migration"));

assert(
  !/grant\s+(insert|update|delete|all)[\s\S]{0,120}admin_(memberships|audit_logs)[\s\S]{0,80}to\s+authenticated/i.test(migration),
  "authenticated browser role must not receive direct admin table writes"
);
assert(
  !/grant\s+execute[\s\S]{0,220}bootstrap_first_admin_owner[\s\S]{0,100}to\s+(anon|authenticated|public)/i.test(migration),
  "first-owner bootstrap must remain service-role-only"
);
assert(
  !/grant\s+execute[\s\S]{0,260}record_admin_audit_event[\s\S]{0,100}to\s+(anon|authenticated|public)/i.test(migration),
  "audit RPC must remain service-role-only"
);
assert(
  !/grant\s+(insert|update|delete|all)[\s\S]{0,120}admin_audit_logs[\s\S]{0,80}to\s+service_role/i.test(migration),
  "service role must not receive direct audit-log mutation privileges"
);
assert(
  !/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(migration),
  "migration must not hardcode an administrator email"
);

const migrationRoles = quotedValues(
  migration,
  /'(admin_(?:viewer|operator|privacy|owner))'/g
);
const applicationRoles = quotedValues(
  capabilities,
  /"(admin_(?:viewer|operator|privacy|owner))"/g
);
assertSameSet(migrationRoles, applicationRoles, "admin role registry");

const migrationCapabilities = quotedValues(
  migration,
  /'(admin\.[a-z.]+)'/g
);
const applicationCapabilities = quotedValues(
  capabilities,
  /"(admin\.[a-z.]+)"/g
);
assertSameSet(migrationCapabilities, applicationCapabilities, "admin capability registry");

[
  'import "server-only"',
  '.auth.getUser()',
  '.from("admin_memberships")',
  '.eq("user_id", user.id)',
  '.eq("is_active", true)',
  "normalizeAdminRole",
  "adminRoleHasCapability",
  "membership_unavailable",
  "admin_membership_required"
].forEach((value) => assertIncludes(access, value, "admin access resolver"));

[
  "user_metadata",
  "premium_entitlement",
  "admin_override",
  "createSupabaseAdminClient",
  "SUPABASE_SERVICE_ROLE_KEY"
].forEach((value) => assertNotIncludes(access, value, "admin access resolver"));

assertIncludes(middleware, 'pathname === "/admin"', "middleware admin route");
assertIncludes(middleware, 'pathname.startsWith("/admin/")', "middleware admin descendants");

[
  "requireAdminCapability(ADMIN_CAPABILITIES.DASHBOARD_READ)",
  "!access.authenticated || !access.accountUser",
  "!access.allowed",
  "notFound()",
  "redirect(\"/?auth_required=admin\")",
  'export const dynamic = "force-dynamic"'
].forEach((value) => assertIncludes(layout, value, "admin layout"));

assertIncludes(page, "가짜 지표를 보여주는 대시보드가 아닙니다", "admin overview");
assertIncludes(page, "Product Candidate Reviews", "admin next scope");

[
  "profiles",
  "Premium의 `admin_override`",
  "Middleware",
  "admin_memberships",
  "admin_audit_logs",
  "service-role",
  "transaction advisory lock",
  "isolated Supabase role-matrix"
].forEach((value) => assertIncludes(design, value, "admin design"));

[
  "bootstrap_first_admin_owner",
  "second owner bootstrap",
  "premium_entitlement",
  "admin.products.review",
  "authenticated audit RPC",
  "idempotent audit retry",
  "service-role direct audit table write"
].forEach((value) => assertIncludes(runtimeVerifier, value, "admin runtime verifier"));

assert(
  packageJson.scripts?.["verify:admin-access-foundation"] ===
    "node scripts/verify-admin-access-foundation.mjs",
  "package verifier command must be registered"
);

console.log(
  JSON.stringify(
    {
      status: "passed",
      migration: migrationPath,
      checkedFiles: [...new Set(checkedFiles)].sort(),
      roleCount: applicationRoles.size,
      capabilityCount: applicationCapabilities.size
    },
    null,
    2
  )
);
