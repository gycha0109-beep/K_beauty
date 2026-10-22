#!/usr/bin/env node
/** A CLI for licensed official-page captures. No DB access, persistence, or approval. */
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import {
  collectExistingCleanserOfficialCapture,
  evaluateExistingCleanserOfficialCapture,
} from "../lib/existing-cleanser-official-capture-v1.mjs";

function valueOf(name) {
  const p = "--" + name + "=";
  const found = process.argv.filter(x=>x.startsWith(p));
  if (found.length>1) throw new Error("DUPLICATE_ARGUMENT:"+name);
  return found.length ? found[0].slice(p.length).trim() : null;
}
function required(name) {
  const value=valueOf(name);
  if (!value) throw new Error("REQUIRED_ARGUMENT:"+name);
  return value;
}
export async function runExistingCleanserOfficialCaptureCli() {
  const product=JSON.parse(await readFile(required("product-file"),"utf8"));
  const hosts=required("approved-hosts").split(",").map(x=>x.trim().toLowerCase()).filter(Boolean);
  const captureFile=valueOf("captured-html");
  const permitLive=valueOf("permit-live-fetch");
  const siteAuthorized=valueOf("site-use-authorized");
  if ((captureFile && permitLive) || (!captureFile && permitLive!=="true")) {
    throw new Error("SELECT_EXACTLY_ONE_CAPTURE_METHOD");
  }
  let output;
  if (captureFile) {
    // Authorized existing bytes supplied separately; no live website requests.
    const bytes=await readFile(captureFile);
    output=evaluateExistingCleanserOfficialCapture({
      product,officialUrl:required("official-url"),
      finalUrl:valueOf("final-url")||required("official-url"),
      htmlBytes:bytes,approvedBrandHosts:hosts,
      capturedAt:required("captured-at"),
    });
  } else {
    // Website use/robots and copyright rights must already be checked.
    // The URL is still validated by the TRUST SSRF-safe official fetch helper.
    if (siteAuthorized!=="true") {
      throw new Error("EXPLICIT_SITE_USE_AUTHORIZATION_REQUIRED");
    }
    output=await collectExistingCleanserOfficialCapture({
      product,approvedBrandHosts:hosts,siteUseAuthorized:true,
    });
  }
  return output;
}
if (process.argv[1] && fileURLToPath(import.meta.url)===process.argv[1]) {
  try {
    const result=await runExistingCleanserOfficialCaptureCli();
    process.stdout.write(JSON.stringify(result,null,2)+"\n");
    if (result.state!=="RESEARCH_CANDIDATE_ONLY") process.exitCode=2;
  } catch(error) {
    process.stderr.write(String(error?.message||"CAPTURE_FAILED")+"\n");
    process.exitCode=1;
  }
}
