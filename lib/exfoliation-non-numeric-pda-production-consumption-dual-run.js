import crypto from "node:crypto";
import { evaluateCandidateExposurePolicy } from "./candidate-exposure-policy.js";
import { buildExfoliationNonNumericPdaShadowExternalContext } from "./exfoliation-non-numeric-pda-shadow-adapter.js";
import { materializeExfoliationProductionConsumptionFromGovernedRecord } from "./exfoliation-non-numeric-pda-production-consumption-shadow.js";
export { runExfoliationNormativeProductionPolicyShadowDualRun } from "./exfoliation-non-numeric-pda-normative-production-policy-dual-run.js";
export const EXFOLIATION_PDA_PRODUCTION_CONSUMPTION_DUAL_RUN_VERSION="exfoliation-non-numeric-pda-production-consumption-dual-run-v1";
const stable=v=>Array.isArray(v)?v.map(stable):v&&typeof v==="object"?Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])])):v;
const fp=v=>crypto.createHash("sha256").update(JSON.stringify(stable(v))).digest("hex");
const id=v=>String(v?.id||v?.productId||v?.product_id||"").trim();
export function runExfoliationProductionConsumptionShadowDualRun({canonicalState,candidates,pdaArtifact,responseValue=null,snapshotValue=null,pdaAuthority={}}={}){
  const products=Array.isArray(candidates)?candidates:[],records=Array.isArray(pdaArtifact?.products)?pdaArtifact.products:[],byId=new Map(records.map(r=>[id(r),r]).filter(([x])=>x));
  const responseBefore=structuredClone(responseValue),snapshotBefore=structuredClone(snapshotValue),orderBefore=products.map(id);
  const canonicalBefore=evaluateCandidateExposurePolicy({canonicalState:structuredClone(canonicalState),candidates:structuredClone(products)});
  const externalContext=buildExfoliationNonNumericPdaShadowExternalContext({canonicalState,candidates:products,pdaRecords:records});
  const rows=products.map(product=>{const pid=id(product),record=byId.get(pid)||{product_id:pid,category:product?.category,pda:null};const envelope=materializeExfoliationProductionConsumptionFromGovernedRecord({pdaRecord:record,pdaRecords:records,externalContext,pdaAuthority});const current=canonicalBefore.decisions?.find(d=>d.candidateRef===pid)||null;return stable({product_id:pid,governed_pda_input:record?.pda??null,external_context:externalContext,production_consumption_envelope:envelope,neutral_gate:envelope.neutral_gate,current_canonical_production_result:current,legacy_comparable_state:current?{exposure:current.exposure,reason_codes:current.reasonCodes}:null,reason_codes:envelope.reason_codes,uncertainty:envelope.uncertainty,provenance:envelope.provenance});});
  const canonicalAfter=evaluateCandidateExposurePolicy({canonicalState:structuredClone(canonicalState),candidates:structuredClone(products)}),orderAfter=products.map(id);
  const invariance={canonical_production_fingerprint_before:fp(canonicalBefore),canonical_production_fingerprint_after:fp(canonicalAfter),canonical_response_fingerprint_before:fp(responseBefore),canonical_response_fingerprint_after:fp(responseValue),canonical_snapshot_fingerprint_before:fp(snapshotBefore),canonical_snapshot_fingerprint_after:fp(snapshotValue),candidate_order_fingerprint_before:fp(orderBefore),candidate_order_fingerprint_after:fp(orderAfter),candidate_order_identical:JSON.stringify(orderBefore)===JSON.stringify(orderAfter)};
  invariance.canonical_production_identical=invariance.canonical_production_fingerprint_before===invariance.canonical_production_fingerprint_after;invariance.canonical_response_identical=invariance.canonical_response_fingerprint_before===invariance.canonical_response_fingerprint_after;invariance.canonical_snapshot_identical=invariance.canonical_snapshot_fingerprint_before===invariance.canonical_snapshot_fingerprint_after;
  return stable({version:EXFOLIATION_PDA_PRODUCTION_CONSUMPTION_DUAL_RUN_VERSION,mode:"SHADOW_OBSERVATION_ONLY",production_authority:false,rows,invariance});
}
