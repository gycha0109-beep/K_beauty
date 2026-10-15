#!/usr/bin/env node
// D8K-4B shadow: actual domain contract shapes, synthetic rows, NO DB/network.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { collectActiveRecommendationOfferSlots } from
  "../../lib/commerce/active-recommendation-offer-slots-v1.mjs";
import { reconcileActiveRecommendationAdmissionForOfferRead as review } from
  "../../lib/commerce/active-offer-admission-reconciliation-v1.mjs";

const id = n => "00000000-0000-4000-8000-" + n.toString(16).padStart(12,"0");
const product = n => ({ id:id(n), name:"Product "+n, brand:"Fixture" });
const decision = (n, type="INITIAL_ADMISSION_GRANT") => ({
  contractVersion:"production-recommendation-candidate-admission-v1",
  product:product(n), admissionType:type,
  reasonCodes:type==="INITIAL_ADMISSION_GRANT"
    ? ["INITIAL_ADMISSION_GRANT_CONFIRMED"] :
    type==="LEGACY_COMPATIBILITY_ADMISSION"
    ? ["EXACT_FROZEN_LEGACY_CORPUS_MEMBER"] : ["G2_DECISION:REJECTED"],
  g2:type==="INITIAL_ADMISSION_GRANT"
    ? { decision:"INITIAL_ADMISSION_GRANT",grant:true } : null
});
function snapshot(decisions) {
  const legacy=decisions.filter(x=>x.admissionType==="LEGACY_COMPATIBILITY_ADMISSION").length;
  const grant=decisions.filter(x=>x.admissionType==="INITIAL_ADMISSION_GRANT").length;
  const rejected=decisions.filter(x=>x.admissionType==="REJECTED").length;
  return {
    contractVersion:"production-recommendation-candidate-admission-v1",
    decisions,
    summary:{enumeratedCount:decisions.length,legacyAdmittedCount:legacy,
      nonlegacyCheckedCount:grant+rejected,nonlegacyGrantedCount:grant,
      nonlegacyRejectedCount:rejected,authorityFailureCount:0}
  };
}
const inventory = (p={}) => collectActiveRecommendationOfferSlots(p);
let cases=0;
const check=(actual,expected,label="")=>{cases++;assert.deepEqual(actual,expected,label)};
const reason=(args,expected)=>{const r=review(args);check(r.status,"HOLD");check(r.reason,expected);
  check(r.privateRpcReadInvoked,false);check(r.privateRpcReadAuthorized,false);
  check(r.sellerPriceAuthorized,false);check(r.directCtaAuthorized,false);
  check(r.admissionAlignedCandidateIds,[]);};

const blank=review({slots:inventory()});check(blank.status,"EMPTY");
check(blank.admissionAlignedCandidateIds,[]);
const free=inventory({freeResult:{topPick:product(1)}});
const good=review({slots:free,admissionResult:snapshot([decision(1)])});
check(good.status,"DIAGNOSTIC_MATCH_ONLY");
check(good.admissionAlignedCandidateIds,[id(1)]);
check(good.rpcBatchSizesPreview,[1]);
check(good.recommendationDecisionTypes,{legacy:0,initialGrant:1});
for(const key of ["actualRuntimeAdmissionProven","privateRpcReadAuthorized",
 "privateRpcReadInvoked","optionEvidenceVerified","sellerPriceAuthorized",
 "directCtaAuthorized","liveUiEnabled","productionReleaseAuthorized"]){
  check(good[key],false,key);
}
const legacy=review({slots:free,
 admissionResult:snapshot([decision(1,"LEGACY_COMPATIBILITY_ADMISSION")])});
check(legacy.status,"DIAGNOSTIC_MATCH_ONLY");
check(legacy.recommendationDecisionTypes,{legacy:1,initialGrant:0});
const repeated=inventory({
 freeResult:{topPick:product(1)},
 premiumReport:{routinePlan:{morningSteps:[{product:product(1)}],
 nightSteps:[{product:product(1)}]}},
 functionalPlan:{planMode:"START",productCandidates:[product(2)]}
});
const mixed=review({slots:repeated,
 admissionResult:snapshot([decision(1,"LEGACY_COMPATIBILITY_ADMISSION"),decision(2)])});
check(mixed.admissionAlignedCandidateIds,[id(1),id(2)]);
check(mixed.recommendationDecisionTypes,{legacy:1,initialGrant:1});
check(mixed.rpcBatchSizesPreview,[2]);
const shared=inventory({publicShare:{topPick:product(1),categoryPicks:[product(2)]}});
check(review({slots:shared,admissionResult:snapshot([decision(1),decision(2)])}).status,"EMPTY");
const held=inventory({functionalPlan:{planMode:"HOLD",productCandidates:[product(1)]}});
check(review({slots:held,admissionResult:snapshot([decision(1)])}).status,"EMPTY");
reason({slots:free},"ADMISSION_SNAPSHOT_INVALID");
reason({slots:free,admissionResult:snapshot([])},"RECOMMENDATION_ADMISSION_MISSING");
reason({slots:free,admissionResult:snapshot([decision(1,"REJECTED")])},
  "RECOMMENDATION_ADMISSION_REJECTED");
reason({slots:repeated,admissionResult:snapshot([decision(1)])},
  "RECOMMENDATION_ADMISSION_MISSING");
reason({slots:free,admissionResult:snapshot([decision(1),decision(1)])},
  "ADMISSION_DECISION_IDENTITY_INVALID");
reason({slots:free,admissionResult:{...snapshot([decision(1)]),
 contractVersion:"wrong"}},"ADMISSION_SNAPSHOT_INVALID");
reason({slots:free,admissionResult:{...snapshot([decision(1)]),
 summary:{...snapshot([decision(1)]).summary,authorityFailureCount:1}}},
 "ADMISSION_SUMMARY_INCONSISTENT");
reason({slots:free,admissionResult:snapshot([{...decision(1),g2:{grant:false}}])},
  "INITIAL_GRANT_SNAPSHOT_INCOMPLETE");
reason({slots:free,admissionResult:snapshot([{...decision(1),reasonCodes:[]}])},
  "INITIAL_GRANT_SNAPSHOT_INCOMPLETE");
reason({slots:free,admissionResult:snapshot([{...decision(1),contractVersion:"wrong"}])},
  "ADMISSION_DECISION_IDENTITY_INVALID");
reason({slots:free,admissionResult:snapshot([{...decision(1),product:{id:id(1).toUpperCase()}}])},
  "ADMISSION_DECISION_IDENTITY_INVALID");
reason({slots:free,admissionResult:snapshot([{...decision(1),admissionType:"GRANT_BY_URL"}])},
  "UNKNOWN_ADMISSION_DECISION");
reason({slots:free,admissionResult:snapshot([{...decision(1),
 admissionType:"LEGACY_COMPATIBILITY_ADMISSION",reasonCodes:[],g2:null}])},
 "LEGACY_LINEAGE_NOT_ATTESTED_IN_SNAPSHOT");
const corrupt={...free,candidateIdsForLaterPrivateAdmission:[id(2)]};
reason({slots:corrupt,admissionResult:snapshot([decision(1)])},"CANDIDATE_LIST_DRIFT");
const fakeRead={...free,privateReadAuthorized:true};
reason({slots:fakeRead,admissionResult:snapshot([decision(1)])},"SLOT_CONTRACT_INVALID");
const publicSpoof={...free,rows:free.rows.map(x=>({...x,slot:"S-01"}))};
reason({slots:publicSpoof,admissionResult:snapshot([decision(1)])},
 "CANDIDATE_IDENTITY_INVALID");
const duplicatePos={...free,rows:[...free.rows,free.rows[0]]};
reason({slots:duplicatePos,admissionResult:snapshot([decision(1)])},
 "DUPLICATE_SLOT_POSITION");
const unauthorizedRow={...free,rows:free.rows.map(x=>({...x,commerceReadAuthorized:true}))};
reason({slots:unauthorizedRow,admissionResult:snapshot([decision(1)])},
 "SLOT_ROW_INVALID");
const names=inventory({freeResult:{topPick:{id:"legacy",name:"Not a verified ID",
 buy_link:"https://example.test",price_min:999}}});
check(review({slots:names}).status,"EMPTY");
const many=Array.from({length:65},(_,i)=>({product:product(i+1)}));
const slots65=inventory({premiumReport:{routinePlan:{morningSteps:many}}});
const good65=review({slots:slots65,
 admissionResult:snapshot(Array.from({length:65},(_,i)=>decision(i+1)))});
check(good65.status,"DIAGNOSTIC_MATCH_ONLY");
check(good65.rpcBatchSizesPreview,[64,1]);
check(good65.admissionAlignedCandidateIds.length,65);
const many513=inventory({premiumReport:{routinePlan:{
 morningSteps:Array.from({length:256},(_,i)=>({product:product(i+1)})),
 nightSteps:Array.from({length:256},(_,i)=>({product:product(i+257)}))
}},functionalPlan:{planMode:"START",productCandidates:[product(513)]}});
check(many513.candidateIdsForLaterPrivateAdmission.length,513);
// The 512-ID bound applies even if all snapshot rows are legitimate.
reason({slots:many513,admissionResult:snapshot(
 Array.from({length:513},(_,i)=>decision(i+1))
)},"RPC_BATCH_PLAN_INVALID_PRODUCT_ID_REQUEST");
const out=JSON.stringify(good);
check(out.includes("listing_url") || out.includes("observedPrice") ||
 out.includes("href") || out.includes("price_amount"),false);

// Ensure the actual, source-linked admission evaluator and RPC have not been
// replaced with a fake grant from a UI snapshot.
const core=readFileSync("lib/recommendation-candidate-admission-core.mjs","utf8");
const rpc=readFileSync(
 "supabase/migrations/20260925121815_product_offers_health_presentation_read_v2.sql","utf8");
const surface=readFileSync("lib/commerce/active-offer-admission-reconciliation-v1.mjs","utf8");
assert.match(core,/INITIAL_ADMISSION_GRANT_CONFIRMED/);cases++;
assert.match(core,/EXACT_FROZEN_LEGACY_CORPUS_MEMBER/);cases++;
assert.match(rpc,/to recommendation_admission_runtime/);cases++;
assert.match(rpc,/from public, anon, authenticated, service_role/);cases++;
assert.doesNotMatch(surface,/\.rpc\(|createClient\(|\.from\(|fetch\(|service_role|SUPABASE_SERVICE_ROLE_KEY/);cases++;
assert.match(surface,/privateRpcReadAuthorized: false/);cases++;
console.log(JSON.stringify({status:"PASS",
 stage:"D8K4B_RECOMMENDATION_ADMISSION_OFFER_READ_PREFLIGHT_SHADOW",
 assertions:cases,syntheticOnly:true,actualDbRead:false,
 genuineRuntimeProven:false,registeredRoleModified:false,
 selectedOptionEvidenceVerified:false,sellerPricesPublished:false,
 browserRouteModified:false,productWrites:0,offerWrites:0,
 rankingChanged:false,releaseAuthorized:false}));
