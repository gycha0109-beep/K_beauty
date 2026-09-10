import assert from "node:assert/strict";

import { createClient } from "@supabase/supabase-js";

const PRODUCT_1 = "92000000-0000-4000-8000-000000000001";
const PRODUCT_2 = "92000000-0000-4000-8000-000000000002";

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`product_source_binding_runtime_missing_${name.toLowerCase()}`);
  return value;
}

async function main(): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.API_URL || requiredEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = process.env.ANON_KEY;

  const service = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const initial = await service
    .from("product_source_bindings")
    .select("product_id, source_name, external_type, external_id, binding_state, binding_method, product_scope_state")
    .order("source_name", { ascending: true });
  if (initial.error) throw new Error(`product_source_binding_initial_load_failed:${initial.error.message}`);

  assert.equal(initial.data.length, 2);
  assert.equal(initial.data.every((row) => row.binding_state === "resolved"), true);
  assert.equal(initial.data.every((row) => row.binding_method === "legacy_product_external_key"), true);
  assert.equal(initial.data.every((row) => row.product_scope_state === "product_subject_unresolved"), true);

  if (anonKey) {
    const anon = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const anonymousRead = await anon.from("product_source_bindings").select("binding_id").limit(1);
    assert.ok(anonymousRead.error, "anonymous clients must not read internal source bindings");
  }

  const secondSource = await service
    .from("product_source_bindings")
    .insert({
      product_id: PRODUCT_2,
      source_name: "oliveyoung",
      external_type: "goods",
      external_id: "oy-777",
      source_url: "https://www.oliveyoung.co.kr/store/goods/getGoodsDetail.do?goodsNo=oy-777",
      binding_state: "resolved",
      binding_method: "source_external_id_exact",
      product_scope_state: "product_subject_unresolved",
    })
    .select("binding_id")
    .single();
  if (secondSource.error) throw new Error(`product_source_binding_second_source_insert_failed:${secondSource.error.message}`);
  assert.ok(secondSource.data.binding_id);

  const sameProductThirdSource = await service.from("product_source_bindings").insert({
    product_id: PRODUCT_2,
    source_name: "hwahae",
    external_type: "products",
    external_id: "2002",
    binding_state: "resolved",
    binding_method: "source_external_id_exact",
    product_scope_state: "product_subject_unresolved",
  });
  if (sameProductThirdSource.error) {
    throw new Error(`product_source_binding_multi_source_insert_failed:${sameProductThirdSource.error.message}`);
  }

  const conflictingBinding = await service.from("product_source_bindings").insert({
    product_id: PRODUCT_1,
    source_name: "oliveyoung",
    external_type: "goods",
    external_id: "oy-777",
    binding_state: "resolved",
    binding_method: "source_external_id_exact",
    product_scope_state: "product_subject_unresolved",
  });
  assert.ok(conflictingBinding.error, "one active source identity must not resolve to two products");
  assert.equal(conflictingBinding.error.code, "23505");

  const blankIdentity = await service.from("product_source_bindings").insert({
    product_id: PRODUCT_1,
    source_name: " ",
    external_type: "goods",
    external_id: "bad",
    binding_state: "resolved",
    binding_method: "source_external_id_exact",
    product_scope_state: "product_subject_unresolved",
  });
  assert.ok(blankIdentity.error, "blank source names must be rejected");
  assert.equal(blankIdentity.error.code, "23514");

  const protectedProduct = await service
    .from("products")
    .select("external_source, external_type, external_id")
    .eq("id", PRODUCT_2)
    .single();
  if (protectedProduct.error) throw new Error(`product_source_binding_product_readback_failed:${protectedProduct.error.message}`);
  assert.equal(protectedProduct.data.external_source, null);
  assert.equal(protectedProduct.data.external_type, null);
  assert.equal(protectedProduct.data.external_id, null);

  const deleteAttempt = await service
    .from("product_source_bindings")
    .delete()
    .eq("binding_id", secondSource.data.binding_id);
  assert.ok(deleteAttempt.error, "source bindings must be retired, not deleted through service_role");

  const final = await service
    .from("product_source_bindings")
    .select("product_id, source_name, external_type, external_id, binding_state")
    .order("source_name", { ascending: true });
  if (final.error) throw new Error(`product_source_binding_final_load_failed:${final.error.message}`);

  assert.equal(final.data.length, 4);
  assert.equal(final.data.filter((row) => row.product_id === PRODUCT_2).length, 2);

  process.stdout.write(
    "verify:product-source-bindings:local-runtime PASS (backfill, private access, multi-source, collision, immutable legacy product fields, no delete)\n",
  );
}

main().catch((error) => {
  process.stderr.write("verify:product-source-bindings:local-runtime FAIL\n");
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
