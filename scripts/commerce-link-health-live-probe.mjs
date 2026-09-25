#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { checkOliveYoungLink } from "../lib/commerce/oliveyoung-link-health.mjs";

const DEFAULT_MANIFEST =
  "tests/fixtures/commerce-link-health/oliveyoung-canary-v1.json";

function argValue(name) {
  return (
    process.argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3) ||
    null
  );
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function validateManifest(manifest) {
  const allowedContracts = new Set([
    "commerce-link-health-live-canary-v1",
    "commerce-link-health-live-snapshot-v1",
  ]);

  if (
    !allowedContracts.has(manifest?.contract) ||
    manifest?.authority_mutation !== false ||
    manifest?.seller_key !== "oliveyoung" ||
    !Array.isArray(manifest?.offers) ||
    manifest.offers.length < 1 ||
    manifest.offers.length > 72 ||
    (manifest?.contract === "commerce-link-health-live-snapshot-v1" &&
      manifest?.production_offer_count !== manifest.offers.length)
  ) {
    throw new Error("COMMERCE_LINK_HEALTH_MANIFEST_INVALID");
  }

  const offerIds = new Set();
  for (const offer of manifest.offers) {
    if (
      !String(offer?.offer_id || "").trim() ||
      !String(offer?.product_id || "").trim() ||
      !String(offer?.listing_id || "").trim() ||
      !String(offer?.listing_url || "").startsWith("https://")
    ) {
      throw new Error("COMMERCE_LINK_HEALTH_MANIFEST_OFFER_INVALID");
    }
    if (offerIds.has(offer.offer_id)) {
      throw new Error("COMMERCE_LINK_HEALTH_MANIFEST_DUPLICATE_OFFER");
    }
    offerIds.add(offer.offer_id);
  }
}

export async function runOliveYoungLiveProbe({
  manifestPath = DEFAULT_MANIFEST,
  delayMs = 750,
} = {}) {
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  validateManifest(manifest);

  const results = [];
  for (const offer of manifest.offers) {
    if (results.length > 0 && delayMs > 0) await sleep(delayMs);
    const checkedAt = new Date().toISOString();
    const result = await checkOliveYoungLink({
      listingUrl: offer.listing_url,
      listingId: offer.listing_id,
    });
    results.push({
      offer_id: offer.offer_id,
      product_id: offer.product_id,
      listing_id: offer.listing_id,
      checked_at: checkedAt,
      ...result,
    });
  }

  const counts = results.reduce((acc, item) => {
    acc[item.resultClass] = (acc[item.resultClass] || 0) + 1;
    return acc;
  }, {});

  return Object.freeze({
    contract: "commerce-link-health-live-probe-result-v1",
    manifest_contract: manifest.contract,
    seller_key: manifest.seller_key,
    authority_mutation: false,
    offer_count: results.length,
    counts,
    results,
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = await runOliveYoungLiveProbe({
    manifestPath: argValue("manifest") || DEFAULT_MANIFEST,
    delayMs: Number(argValue("delay-ms") || 750),
  });
  console.log(`COMMERCE_LINK_HEALTH_LIVE_PROBE_JSON=${JSON.stringify(result)}`);
}
