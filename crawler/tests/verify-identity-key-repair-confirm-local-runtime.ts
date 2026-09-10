import assert from "node:assert/strict";

import { createClient } from "@supabase/supabase-js";

const OWNER_ID = "30000000-0000-4000-8000-000000000001";
const VIEWER_ID = "30000000-0000-4000-8000-000000000003";

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`identity_key_repair_runtime_missing_${name.toLowerCase()}`);
  return value;
}

async function expectRpcError(
  operation: PromiseLike<{ error: { message: string; code?: string } | null }>,
  expectedMessage: string,
): Promise<void> {
  const { error } = await operation;
  assert.ok(error, `expected ${expectedMessage}`);
  assert.match(error.message, new RegExp(expectedMessage));
}

async function main(): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.API_URL || requiredEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = process.env.ANON_KEY;
  const service = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const seedRows = [
    {
      id: "91000000-0000-4000-8000-000000000001",
      name: "Birch Juice Moisturizing Sun Cream",
      brand: "ROUND LAB",
      category: "sunscreen",
      skin_types: [],
      concerns: [],
      texture: "lotion",
      finish: "natural",
      irritation_risk: "low",
      sensitivity_safe: true,
      normalized_brand: "round lab",
      normalized_name: "birchjuicemoisturizingsuncream",
    },
    {
      id: "91000000-0000-4000-8000-000000000002",
      name: "Manual Brand Product",
      brand: "LA ROCHE-POSAY",
      category: "sunscreen",
      skin_types: [],
      concerns: [],
      texture: "lotion",
      finish: "natural",
      irritation_risk: "low",
      sensitivity_safe: true,
      normalized_brand: "larocheposay",
      normalized_name: "manual brand product",
    },
    {
      id: "91000000-0000-4000-8000-000000000003",
      name: "Collision Product",
      brand: "Test Brand",
      category: "sunscreen",
      skin_types: [],
      concerns: [],
      texture: "lotion",
      finish: "natural",
      irritation_risk: "low",
      sensitivity_safe: true,
      normalized_brand: "test brand",
      normalized_name: "collision product",
    },
    {
      id: "91000000-0000-4000-8000-000000000004",
      name: "Collision Product",
      brand: "Test Brand",
      category: "sunscreen",
      skin_types: [],
      concerns: [],
      texture: "lotion",
      finish: "natural",
      irritation_risk: "low",
      sensitivity_safe: true,
      normalized_brand: "test brand",
      normalized_name: "collisionproduct",
    },
    {
      id: "91000000-0000-4000-8000-000000000005",
      name: "Stale State Product",
      brand: "Test Brand",
      category: "sunscreen",
      skin_types: [],
      concerns: [],
      texture: "lotion",
      finish: "natural",
      irritation_risk: "low",
      sensitivity_safe: true,
      normalized_brand: "test brand",
      normalized_name: "stalestateproduct",
    },
  ];

  const seed = await service.from("products").insert(seedRows);
  if (seed.error) throw new Error(`identity_key_repair_runtime_seed_failed:${seed.error.message}`);

  const viewerPreflight = service.rpc("admin_preflight_product_identity_key_repair_v1", {
    p_actor_user_id: VIEWER_ID,
    p_product_id: seedRows[0].id,
  });
  await expectRpcError(viewerPreflight, "admin_product_review_capability_required");

  if (anonKey) {
    const anon = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const anonymousPreflight = await anon.rpc("admin_preflight_product_identity_key_repair_v1", {
      p_actor_user_id: OWNER_ID,
      p_product_id: seedRows[0].id,
    });
    assert.ok(anonymousPreflight.error, "anon must not execute repair preflight");
  }

  const safePreflight = await service.rpc("admin_preflight_product_identity_key_repair_v1", {
    p_actor_user_id: OWNER_ID,
    p_product_id: seedRows[0].id,
  });
  if (safePreflight.error) throw new Error(`identity_key_repair_runtime_preflight_failed:${safePreflight.error.message}`);
  const safe = safePreflight.data as Record<string, unknown>;
  assert.equal(safe.eligible, true);
  assert.equal(safe.disposition, "safe_mechanical_candidate");
  assert.equal(safe.proposed_normalized_brand, "round lab");
  assert.equal(safe.proposed_normalized_name, "birch juice moisturizing sun cream");

  const manualPreflight = await service.rpc("admin_preflight_product_identity_key_repair_v1", {
    p_actor_user_id: OWNER_ID,
    p_product_id: seedRows[1].id,
  });
  if (manualPreflight.error) throw new Error(`identity_key_repair_runtime_manual_preflight_failed:${manualPreflight.error.message}`);
  assert.equal((manualPreflight.data as Record<string, unknown>).eligible, false);
  assert.equal((manualPreflight.data as Record<string, unknown>).disposition, "manual_review_required");

  const collisionPreflight = await service.rpc("admin_preflight_product_identity_key_repair_v1", {
    p_actor_user_id: OWNER_ID,
    p_product_id: seedRows[3].id,
  });
  if (collisionPreflight.error) throw new Error(`identity_key_repair_runtime_collision_preflight_failed:${collisionPreflight.error.message}`);
  assert.equal((collisionPreflight.data as Record<string, unknown>).eligible, false);
  assert.equal((collisionPreflight.data as Record<string, unknown>).disposition, "blocked_proposed_collision");

  const requestId = `identity-key-repair-v1:${seedRows[0].id}`;
  const confirmArgs = {
    p_actor_user_id: OWNER_ID,
    p_request_id: requestId,
    p_product_id: seedRows[0].id,
    p_expected_normalized_brand: String(safe.expected_normalized_brand),
    p_expected_normalized_name: String(safe.expected_normalized_name),
    p_expected_updated_at: String(safe.expected_updated_at),
    p_reason: "mechanical whitespace identity key repair",
  };

  const confirmed = await service.rpc("admin_confirm_product_identity_key_repair_v1", confirmArgs);
  if (confirmed.error) throw new Error(`identity_key_repair_runtime_confirm_failed:${confirmed.error.message}`);
  const result = confirmed.data as Record<string, unknown>;
  assert.equal(result.status, "confirmed");
  assert.equal(result.idempotent, false);
  assert.equal(result.normalized_name, "birch juice moisturizing sun cream");
  assert.ok(result.audit_id);

  const readback = await service
    .from("products")
    .select("normalized_brand, normalized_name")
    .eq("id", seedRows[0].id)
    .single();
  if (readback.error) throw new Error(`identity_key_repair_runtime_readback_failed:${readback.error.message}`);
  assert.equal(readback.data.normalized_brand, "round lab");
  assert.equal(readback.data.normalized_name, "birch juice moisturizing sun cream");

  const retry = await service.rpc("admin_confirm_product_identity_key_repair_v1", confirmArgs);
  if (retry.error) throw new Error(`identity_key_repair_runtime_retry_failed:${retry.error.message}`);
  assert.equal((retry.data as Record<string, unknown>).status, "confirmed");
  assert.equal((retry.data as Record<string, unknown>).idempotent, true);
  assert.equal((retry.data as Record<string, unknown>).audit_id, result.audit_id);

  await expectRpcError(
    service.rpc("admin_confirm_product_identity_key_repair_v1", {
      ...confirmArgs,
      p_expected_normalized_name: "different-old-key",
    }),
    "product_identity_key_repair_request_conflict",
  );

  const stalePreflight = await service.rpc("admin_preflight_product_identity_key_repair_v1", {
    p_actor_user_id: OWNER_ID,
    p_product_id: seedRows[4].id,
  });
  if (stalePreflight.error) throw new Error(`identity_key_repair_runtime_stale_preflight_failed:${stalePreflight.error.message}`);
  const stale = stalePreflight.data as Record<string, unknown>;
  assert.equal(stale.eligible, true);

  const staleMutation = await service
    .from("products")
    .update({ updated_at: new Date(Date.now() + 60_000).toISOString() })
    .eq("id", seedRows[4].id);
  if (staleMutation.error) throw new Error(`identity_key_repair_runtime_stale_setup_failed:${staleMutation.error.message}`);

  await expectRpcError(
    service.rpc("admin_confirm_product_identity_key_repair_v1", {
      p_actor_user_id: OWNER_ID,
      p_request_id: `identity-key-repair-v1:${seedRows[4].id}`,
      p_product_id: seedRows[4].id,
      p_expected_normalized_brand: String(stale.expected_normalized_brand),
      p_expected_normalized_name: String(stale.expected_normalized_name),
      p_expected_updated_at: String(stale.expected_updated_at),
      p_reason: "stale prestate rejection check",
    }),
    "product_identity_key_repair_prestate_stale",
  );

  const audit = await service
    .from("admin_audit_logs")
    .select("action, target_id, before_value, after_value")
    .eq("action", "admin.product.identity_key_repaired")
    .eq("target_id", seedRows[0].id)
    .single();
  if (audit.error) throw new Error(`identity_key_repair_runtime_audit_failed:${audit.error.message}`);
  assert.equal(audit.data.before_value.normalized_name, "birchjuicemoisturizingsuncream");
  assert.equal(audit.data.after_value.normalized_name, "birch juice moisturizing sun cream");

  process.stdout.write(
    "verify:identity-key-repair-confirm:local-runtime PASS (service-only, capability, safe-only, collision, stale, idempotency, audit, readback)\n",
  );
}

main().catch((error) => {
  process.stderr.write("verify:identity-key-repair-confirm:local-runtime FAIL\n");
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
