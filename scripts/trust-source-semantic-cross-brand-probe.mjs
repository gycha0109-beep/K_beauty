import { readFile } from "node:fs/promises";
import { digestOfficialContent, fetchOfficialBytes } from "../lib/trust/official-source-fetch.mjs";

const manifest = JSON.parse(await readFile("tests/fixtures/trust-phase8g-semantic-adapter/cross-brand-probe-v1.json", "utf8"));
const results = [];

for (const source of manifest.sources) {
  try {
    const first = await fetchOfficialBytes(source.canonical_locator);
    const firstDigest = digestOfficialContent(first.bytes, "official-product-semantic", "v1", {
      sourceMetadata: source.source_metadata,
      canonicalLocator: source.canonical_locator,
    });
    await new Promise((resolve) => setTimeout(resolve, 2000));
    const second = await fetchOfficialBytes(source.canonical_locator);
    const secondDigest = digestOfficialContent(second.bytes, "official-product-semantic", "v1", {
      sourceMetadata: source.source_metadata,
      canonicalLocator: source.canonical_locator,
    });
    results.push({
      source_id: source.source_id,
      publisher: source.publisher,
      status: "SUPPORTED",
      stable: firstDigest.digest === secondDigest.digest,
      digest_basis: firstDigest.digestBasis,
      first_raw_bytes: first.bytes.byteLength,
      second_raw_bytes: second.bytes.byteLength,
    });
  } catch (error) {
    results.push({
      source_id: source.source_id,
      publisher: source.publisher,
      status: String(error?.semanticStatus || error?.message || error),
      stable: false,
    });
  }
}

console.log(`TRUST_PHASE8G_SEMANTIC_CROSS_BRAND_JSON=${JSON.stringify({ contract: manifest.contract, results, authority_mutation: false })}`);
