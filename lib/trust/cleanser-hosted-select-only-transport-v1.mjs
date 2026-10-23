/**
 * Standalone opt-in live audit must be SELECT-only even if accidentally given
 * a privileged Supabase credential. This is not an authorization substitute;
 * host/service-role credentials must remain server-side and out of CI.
 */
export const CLEANSER_READONLY_TRANSPORT_VERSION="cleanser-readonly-hosted-audit-transport-v1";
export const ALLOWED_CLEANSER_TABLES=Object.freeze([
  "products","catalog_trust_intake","product_fact_research_tasks",
  "product_fact_subjects","product_source_bindings","trust_source_observations",
  "product_fact_current","product_fact_instances","product_fact_confirmations"
]);
const tables=new Set(ALLOWED_CLEANSER_TABLES);
export function createCleanserSelectOnlyFetchV1({baseUrl,fetchImpl}={}){
  if(typeof fetchImpl!=="function")throw new TypeError("FETCH_IMPL_REQUIRED");
  let host;
  try{
    host=new URL(baseUrl);
    if(host.protocol!=="https:"||host.username||host.password||host.hash||
       host.search||host.pathname!=="/")
      throw new Error("INVALID_HOST");
  }catch{throw new TypeError("TRUSTED_HOSTED_SUPABASE_ORIGIN_REQUIRED");}
  return async (input,init={})=>{
    const target=typeof input==="string"?input:input?.url;
    let uri;
    try{uri=new URL(target);}catch{throw new Error("SELECT_ONLY_URL_INVALID");}
    const method=String(init?.method || (typeof input==="object"&&input?.method) || "GET").toUpperCase();
    const table=uri.pathname.startsWith("/rest/v1/")?uri.pathname.slice("/rest/v1/".length):"";
    if(uri.origin!==host.origin||uri.username||uri.password||uri.hash||
      method!=="GET"||!tables.has(table)||init?.body!=null)
      throw new Error("SELECT_ONLY_TABLE_GET_REQUIRED");
    return fetchImpl(input,{...init,method:"GET",redirect:"error"});
  };
}
